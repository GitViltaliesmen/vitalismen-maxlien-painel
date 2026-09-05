import fs from 'node:fs';
import path from 'node:path';

const ECUADOR_OFFSET_MS = -5 * 60 * 60 * 1000;
const DEFAULT_CACHE_FILE = process.platform === 'win32'
    ? path.resolve('.local', 'meta-ads-insights', 'ec.json')
    : '/opt/vitalismen-automacao/shared/runtime/meta-ads-insights/ec.json';

const number = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
};
const dayInEcuador = (value) => new Date(
    (value instanceof Date ? value : new Date(value)).getTime() + ECUADOR_OFFSET_MS
).toISOString().slice(0, 10);

const actionValue = (actions, names) => Math.max(0, ...names.map((name) => number(
    (actions || []).find((item) => item.action_type === name)?.value
)));

const landingPageViews = (row) => actionValue(row.actions, ['landing_page_view']);
const leads = (row) => actionValue(row.actions, [
    'lead',
    'offsite_conversion.fb_pixel_lead',
    'onsite_conversion.lead_grouped'
]);
const purchases = (row) => actionValue(row.actions, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase'
]);
const conversations = (row) => actionValue(row.actions, [
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.total_messaging_connection'
]);

const emptyTotals = () => ({
    impressions: 0,
    reach: 0,
    linkClicks: 0,
    landingPageViews: 0,
    leads: 0,
    conversations: 0,
    purchases: 0,
    spend: 0
});

const addMetrics = (target, row) => {
    target.impressions += number(row.impressions);
    target.reach += number(row.reach);
    target.linkClicks += number(row.inline_link_clicks) || actionValue(row.actions, ['link_click']);
    target.landingPageViews += landingPageViews(row);
    target.leads += leads(row);
    target.conversations += conversations(row);
    target.purchases += purchases(row);
    target.spend += number(row.spend);
};

const finishMetrics = (metrics) => ({
    ...metrics,
    spend: Math.round(metrics.spend * 100) / 100,
    landingRate: metrics.linkClicks > 0
        ? Math.round((metrics.landingPageViews / metrics.linkClicks) * 1000) / 10
        : 0,
    ctr: metrics.impressions > 0
        ? Math.round((metrics.linkClicks / metrics.impressions) * 1000) / 10
        : 0
});

export const summarizeMetaAdsInsights = (rows = []) => {
    const totals = emptyTotals();
    const days = new Map();
    const ads = new Map();
    for (const row of rows) {
        addMetrics(totals, row);
        const day = String(row.date_start || '');
        if (!days.has(day)) days.set(day, { day, ...emptyTotals() });
        addMetrics(days.get(day), row);
        const adId = String(row.ad_id || '');
        const key = adId || `${row.campaign_id || ''}:${row.adset_id || ''}:${row.ad_name || ''}`;
        if (!ads.has(key)) ads.set(key, {
            campaignId: String(row.campaign_id || ''),
            campaignName: String(row.campaign_name || ''),
            adsetId: String(row.adset_id || ''),
            adsetName: String(row.adset_name || ''),
            adId,
            adName: String(row.ad_name || ''),
            ...emptyTotals()
        });
        addMetrics(ads.get(key), row);
    }
    return {
        totals: finishMetrics(totals),
        rows: [...days.values()].map(finishMetrics).sort((a, b) => a.day.localeCompare(b.day)),
        ads: [...ads.values()].map(finishMetrics).sort((a, b) => (
            b.landingPageViews - a.landingPageViews
            || b.linkClicks - a.linkClicks
            || b.reach - a.reach
        ))
    };
};

const metaError = (body, status) => {
    const error = new Error(body?.error?.message || `Meta HTTP ${status}`);
    const code = number(body?.error?.code);
    const subcode = number(body?.error?.error_subcode);
    if (code === 190 && [463, 467].includes(subcode)) error.code = 'META_ACCESS_TOKEN_EXPIRED';
    else if (code === 190) error.code = 'META_ACCESS_TOKEN_INVALID';
    else if ([10, 200].includes(code)) error.code = 'META_ADS_READ_PERMISSION_MISSING';
    else if (code === 2635) error.code = 'META_ADS_API_VERSION_DEPRECATED';
    else error.code = 'META_ADS_API_FAILED';
    error.httpStatus = status;
    error.metaCode = code;
    error.metaSubcode = subcode;
    return error;
};

const graphGet = async ({ url, token, fetchImpl }) => {
    const target = new URL(url);
    const response = await fetchImpl(target, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw metaError(body, response.status);
    return body;
};

const resolveAccountId = async ({ accountId, version, token, fetchImpl }) => {
    if (accountId) return String(accountId).replace(/^act_/, '');
    const fields = new URLSearchParams({ fields: 'id,name,account_status,currency,timezone_name', limit: '100' });
    const body = await graphGet({
        url: `https://graph.facebook.com/${version}/me/adaccounts?${fields}`,
        token,
        fetchImpl
    });
    const active = (body.data || []).filter((item) => number(item.account_status) === 1);
    if (active.length !== 1) {
        const error = new Error('Defina o ID da conta quando o token acessar zero ou varias contas.');
        error.code = 'META_AD_ACCOUNT_ID_REQUIRED';
        throw error;
    }
    return String(active[0].id || '').replace(/^act_/, '');
};

const readCache = (file) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};

const writeCache = (file, value) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, file);
};

export const loadMetaAdsInsights = async ({
    days = 7,
    now = new Date(),
    env = process.env,
    fetchImpl = fetch,
    accountId = env.META_AD_ACCOUNT_ID_EC,
    accountName = env.META_AD_ACCOUNT_NAME_EC || '',
    country = 'EC',
    token: suppliedToken,
    version: suppliedVersion,
    campaignFilter: suppliedCampaignFilter,
    cacheFile = env.META_ADS_INSIGHTS_CACHE_FILE_EC || DEFAULT_CACHE_FILE,
    cacheTtlMs = number(env.META_ADS_INSIGHTS_CACHE_SECONDS_EC || 300) * 1000
} = {}) => {
    const token = String(
        suppliedToken
        || env.META_ACCESS_TOKEN
        || env.META_ADS_ACCESS_TOKEN_EC
        || env.META_ACCESS_TOKEN_EC
        || ''
    ).trim();
    const version = String(
        suppliedVersion || env.META_ADS_API_VERSION || env.META_CAPI_API_VERSION || 'v26.0'
    ).trim();
    const campaignFilter = String(
        suppliedCampaignFilter === undefined
            ? env.META_ADS_CAMPAIGN_NAME_FILTER_EC || ''
            : suppliedCampaignFilter
    ).trim().toLowerCase();
    const cached = readCache(cacheFile);
    const cacheAgeMs = cached?.fetchedAt ? now.getTime() - new Date(cached.fetchedAt).getTime() : Infinity;
    if (cached && cacheAgeMs >= 0 && cacheAgeMs <= cacheTtlMs && number(cached.days) === number(days)) {
        return { ...cached, source: 'cache', stale: false };
    }
    if (!token) return {
        status: 'unavailable', source: 'none', stale: false, configured: false,
        errorCode: 'META_ADS_ACCESS_TOKEN_EC_MISSING',
        message: 'Configure META_ADS_ACCESS_TOKEN_EC com permissao ads_read.'
    };
    try {
        const resolvedAccountId = await resolveAccountId({
            accountId,
            version,
            token,
            fetchImpl
        });
        const endDay = dayInEcuador(now);
        const end = new Date(`${endDay}T05:00:00.000Z`);
        const startDay = dayInEcuador(new Date(end.getTime() - (Math.max(1, number(days)) - 1) * 86400000));
        const params = new URLSearchParams({
            level: 'ad',
            fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,reach,inline_link_clicks,spend,actions,date_start,date_stop',
            time_range: JSON.stringify({ since: startDay, until: endDay }),
            time_increment: '1',
            limit: '500'
        });
        let next = `https://graph.facebook.com/${version}/act_${resolvedAccountId}/insights?${params}`;
        const rows = [];
        for (let page = 0; next && page < 20; page += 1) {
            const body = await graphGet({ url: next, token, fetchImpl });
            rows.push(...(body.data || []));
            const candidate = body.paging?.next || '';
            next = candidate && new URL(candidate).hostname === 'graph.facebook.com' ? candidate : '';
        }
        const filtered = campaignFilter
            ? rows.filter((row) => [row.campaign_name, row.adset_name, row.ad_name]
                .some((value) => String(value || '').toLowerCase().includes(campaignFilter)))
            : rows;
        const snapshot = {
            status: 'available',
            source: 'live',
            stale: false,
            configured: true,
            accountId: resolvedAccountId,
            accountName: String(accountName || ''),
            country: String(country || ''),
            apiVersion: version,
            campaignFilter,
            days: number(days),
            startDay,
            endDay,
            fetchedAt: now.toISOString(),
            ...summarizeMetaAdsInsights(filtered)
        };
        writeCache(cacheFile, snapshot);
        return snapshot;
    } catch (error) {
        if (cached) return {
            ...cached,
            source: 'cache',
            stale: true,
            errorCode: error.code || 'META_ADS_API_FAILED',
            message: 'Meta indisponivel; exibindo ultimo cache valido.'
        };
        return {
            status: 'unavailable', source: 'none', stale: false, configured: true,
            errorCode: error.code || 'META_ADS_API_FAILED',
            message: error.code === 'META_ADS_READ_PERMISSION_MISSING'
                ? 'O token Meta nao possui ads_read.'
                : error.code === 'META_ACCESS_TOKEN_EXPIRED'
                    ? 'O token Meta expirou e precisa ser renovado.'
                    : error.code === 'META_ACCESS_TOKEN_INVALID'
                        ? 'O token Meta e invalido.'
                        : error.code === 'META_ADS_API_VERSION_DEPRECATED'
                            ? 'A versao da Ads API foi descontinuada.'
                : 'Nao foi possivel consultar os anuncios da Meta.'
        };
    }
};
