import { isEcuadorTexUltraProtocoloG } from './metaProtocoloGAttributionService.js';

const TIMEZONE = 'America/Guayaquil';
const CREATIVE_SALES_SCOPE = ['proto', 'colo-g'].join('');
const CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8_000;
const READY_MIN_SAMPLE = 20;
const READY_MIN_COVERAGE = 60;
const READY_MIN_ATTRIBUTED_SALES = 2;
const saleStatuses = new Set(['confirmado', 'pedido_enviado', 'enviado', 'entregue', 'recompra']);
const memoryCache = new Map();

const cleanText = value => String(value ?? '').trim();
const cleanId = value => {
    const normalized = cleanText(value);
    return normalized && !normalized.includes('{{') && !normalized.includes('}}') ? normalized : '';
};
const asNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const round = (value, digits = 2) => Number(asNumber(value).toFixed(digits));
const percent = (part, total) => total > 0 ? round((part / total) * 100) : 0;
const capScore = value => Math.max(0, Math.min(100, round(value, 0)));
const dateOf = value => {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date : null;
};
const objectId = value => cleanText(value?._id ?? value);
const tracking = record => record?.tracking && typeof record.tracking === 'object' ? record.tracking : {};
const firstValue = (...values) => values.map(cleanId).find(Boolean) || '';
const identityOf = record => {
    const meta = record?.metadata || {};
    const nested = meta.tracking || {};
    const bridge = meta.metaAttributionBridge || {};
    const own = tracking(record);
    return {
        campaignId: firstValue(record?.campaignId, record?.campaign_id, own.campaign_id, nested.campaign_id, bridge.campaignId, bridge.campaign_id),
        adsetId: firstValue(record?.adsetId, record?.adset_id, own.adset_id, nested.adset_id, bridge.adsetId, bridge.adset_id),
        adId: firstValue(record?.adId, record?.ad_id, own.ad_id, nested.ad_id, bridge.adId, bridge.ad_id),
        creativeId: firstValue(record?.creativeId, record?.creative_id, own.creative_id, nested.creative_id, bridge.creativeId)
    };
};
const isProtocol = record => isEcuadorTexUltraProtocoloG(record || {});
const inRange = (value, startAt, endAt) => {
    const date = dateOf(value);
    return Boolean(date && date >= startAt && date < endAt);
};
const hourInEcuador = value => {
    const date = dateOf(value);
    if (!date) return null;
    const hour = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        hour: '2-digit',
        hour12: false
    }).formatToParts(date).find(part => part.type === 'hour')?.value;
    return Number(hour === '24' ? 0 : hour);
};
const stageDate = (visit, key) => visit?.protocoloGStages?.[key] || null;
const metaAction = (row, name) => asNumber((row?.actions || []).find(item => item?.action_type === name)?.value);
const metaActionValue = (row, name) => asNumber((row?.action_values || []).find(item => item?.action_type === name)?.value);

const emptyInternalRow = identity => ({
    key: identity.adId || 'SEM_ATRIBUICAO',
    campaignId: identity.campaignId || '',
    adsetId: identity.adsetId || '',
    adId: identity.adId || '',
    creativeId: identity.creativeId || '',
    entries: 0,
    whatsappClicks: 0,
    conversations: 0,
    leads: 0,
    orders: 0,
    sales: 0,
    revenue: 0
});

const mergeIdentity = (row, identity) => {
    row.campaignId ||= identity.campaignId;
    row.adsetId ||= identity.adsetId;
    row.adId ||= identity.adId;
    row.creativeId ||= identity.creativeId;
    return row;
};

const sourceFromContact = contact => ({
    country: contact?.countryCode,
    sourceUrl: contact?.metadata?.vslSourceUrl,
    productKey: contact?.metadata?.vslVariant || contact?.metadata?.productKey,
    funnel: contact?.metadata?.funnel,
    page: contact?.metadata?.page,
    path: contact?.metadata?.path
});

const sourceFromOrder = order => ({
    country: order?.country,
    sourceUrl: order?.tracking?.sourceUrl,
    productKey: order?.tracking?.productKey,
    productName: order?.tracking?.productName || order?.tracking?.product,
    funnel: order?.tracking?.funnel,
    page: order?.tracking?.page,
    path: order?.tracking?.path
});

export const collectCreativeSalesFactsV185 = ({
    visits = [],
    correlations = [],
    contacts = [],
    messages = [],
    orders = [],
    startAt,
    endAt
} = {}) => {
    const start = dateOf(startAt) || new Date(0);
    const end = dateOf(endAt) || new Date(8640000000000000);
    const rows = new Map();
    const visitById = new Map();
    const visitByKey = new Map();
    const relevantVisitIds = new Set();
    const relevantVisitorKeys = new Set();
    const countedVisitIds = new Set();
    const contactOrderIds = new Set();
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, entries: 0, conversations: 0, score: 0 }));
    let earlyStageObserved = false;

    const rowFor = identity => {
        const key = identity.adId || 'SEM_ATRIBUICAO';
        if (!rows.has(key)) rows.set(key, emptyInternalRow(identity));
        return mergeIdentity(rows.get(key), identity);
    };
    const addHour = (value, field) => {
        const hour = hourInEcuador(value);
        if (Number.isInteger(hour) && hour >= 0 && hour < 24) hourly[hour][field] += 1;
    };

    for (const visit of visits) {
        const id = objectId(visit);
        if (id) visitById.set(id, visit);
        if (visit?.visitorKey) visitByKey.set(String(visit.visitorKey), visit);
        if (!isProtocol(visit)) continue;
        const entryAt = visit.firstSeenAt || stageDate(visit, 'landingAt');
        const entryInRange = inRange(entryAt, start, end);
        const clickInRange = inRange(visit.lastClickAt, start, end);
        const earlyStageInRange = ['videoStartedAt', 'watched25At', 'watched50At', 'earlyCtaVisibleAt', 'formOpenedAt', 'formSubmittedAt']
            .some(key => inRange(stageDate(visit, key), start, end));
        if (!entryInRange && !clickInRange && !earlyStageInRange) continue;
        const dedupeKey = id || cleanText(visit?.visitorKey);
        if (dedupeKey && countedVisitIds.has(dedupeKey)) continue;
        if (dedupeKey) countedVisitIds.add(dedupeKey);
        if (id) relevantVisitIds.add(id);
        if (visit?.visitorKey) relevantVisitorKeys.add(String(visit.visitorKey));
        const identity = identityOf(visit);
        const row = rowFor(identity);
        if (entryInRange) {
            row.entries += 1;
            addHour(entryAt, 'entries');
        }
        if (clickInRange) {
            row.whatsappClicks += Math.max(1, asNumber(visit.clickCount));
        }
        if (earlyStageInRange) earlyStageObserved = true;
    }

    for (const correlation of correlations) {
        if (cleanText(correlation?.status).toUpperCase() !== 'CLAIMED') continue;
        if (!inRange(correlation?.inboundAt || correlation?.evaluatedAt, start, end)) continue;
        const visit = visitById.get(objectId(correlation?.visitId))
            || visitByKey.get(cleanText(correlation?.visitorKey));
        if (!visit || !isProtocol(visit)) continue;
        const row = rowFor(identityOf(visit));
        row.conversations += 1;
        row.leads += 1;
        addHour(correlation?.inboundAt || correlation?.evaluatedAt, 'conversations');
    }

    const correlationsByVisit = new Set(correlations
        .filter(item => cleanText(item?.status).toUpperCase() === 'CLAIMED')
        .flatMap(item => [objectId(item?.visitId), cleanText(item?.visitorKey)])
        .filter(Boolean));

    for (const contact of contacts) {
        const visitId = cleanText(contact?.metadata?.vslVisitId);
        const visitorKey = cleanText(contact?.metadata?.metaAttributionBridge?.visitorKey || contact?.metadata?.tracking?.visitorKey);
        const visit = visitById.get(visitId) || visitByKey.get(visitorKey);
        const relevant = Boolean((visitId && relevantVisitIds.has(visitId))
            || (visitorKey && relevantVisitorKeys.has(visitorKey))
            || isProtocol(sourceFromContact(contact)));
        if (!relevant || !inRange(contact?.firstInboundAt || contact?.metadata?.vslEntryPanelLeadAt || contact?.createdAt, start, end)) continue;
        const identity = identityOf(contact);
        const resolvedIdentity = identity.adId ? identity : identityOf(visit);
        const alreadyCounted = correlationsByVisit.has(visitId) || correlationsByVisit.has(visitorKey);
        if (!alreadyCounted) {
            const row = rowFor(resolvedIdentity);
            row.conversations += 1;
            row.leads += 1;
            addHour(contact?.firstInboundAt || contact?.metadata?.vslEntryPanelLeadAt || contact?.createdAt, 'conversations');
        }
        [contact?.metadata?.customerDraft?.orderId, contact?.metadata?.customerDraft?.currentNegotiationOrderId]
            .map(cleanText).filter(Boolean).forEach(value => {
                contactOrderIds.add(value);
            });
    }

    for (const message of messages) {
        if (cleanText(message?.provider) !== 'vsl_entry') continue;
        const visitId = cleanText(message?.providerPayload?.vslVisitId);
        const visit = visitById.get(visitId);
        if (visit && isProtocol(visit)) rowFor(identityOf(visit));
    }

    for (const order of orders) {
        const visitorKey = cleanText(order?.tracking?.attributionVisitorKey);
        const visit = visitByKey.get(visitorKey);
        const relevant = Boolean((visitorKey && relevantVisitorKeys.has(visitorKey))
            || contactOrderIds.has(cleanText(order?.orderId))
            || isProtocol(sourceFromOrder(order)));
        if (!relevant || !inRange(order?.confirmedAt || order?.entryAt || order?.draftCreatedAt || order?.createdAt, start, end)) continue;
        const ownIdentity = identityOf(order);
        const visitIdentity = identityOf(visit);
        const resolvedIdentity = ownIdentity.adId ? ownIdentity : visitIdentity;
        const row = rowFor(resolvedIdentity);
        row.orders += 1;
        if (saleStatuses.has(cleanText(order?.status).toLowerCase()) || order?.confirmedAt) {
            row.sales += 1;
            row.revenue += asNumber(order?.total);
        }
    }

    hourly.forEach(item => {
        item.score = capScore((item.entries * 35) + (item.conversations * 65));
    });
    const discovered = [...rows.values()].filter(row => row.adId);
    return {
        rows: [...rows.values()],
        discoveredAdIds: [...new Set(discovered.map(row => row.adId))],
        discoveredCampaignIds: [...new Set(discovered.map(row => row.campaignId).filter(Boolean))],
        discoveredAdsetIds: [...new Set(discovered.map(row => row.adsetId).filter(Boolean))],
        hourly,
        earlyStages: earlyStageObserved ? 'AVAILABLE' : 'NO_DATA'
    };
};

const fetchJson = async (url, { fetchImpl, timeoutMs, signal }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('META_TIMEOUT')), timeoutMs);
    const onAbort = () => controller.abort(signal.reason);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    try {
        const response = await fetchImpl(url, { method: 'GET', signal: controller.signal });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body?.error) throw new Error(body?.error?.message || `META_HTTP_${response.status}`);
        return body;
    } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
    }
};

const resolveAccountId = async ({ token, apiVersion, fetchImpl, timeoutMs, signal, configuredAccountId }) => {
    const configured = cleanText(configuredAccountId).replace(/^act_/, '');
    if (configured) return configured;
    const url = new URL(`https://graph.facebook.com/${apiVersion}/me/adaccounts`);
    url.searchParams.set('fields', 'id,account_id,account_status');
    url.searchParams.set('limit', '100');
    url.searchParams.set('access_token', token);
    const payload = await fetchJson(url, { fetchImpl, timeoutMs, signal });
    const accounts = (payload.data || []).filter(item => Number(item.account_status) === 1);
    if (accounts.length !== 1) throw new Error('META_ACCOUNT_NOT_UNIQUE');
    return cleanText(accounts[0].account_id || accounts[0].id).replace(/^act_/, '');
};

const loadAllPages = async ({ url, fetchImpl, timeoutMs, signal }) => {
    const data = [];
    let next = String(url);
    for (let page = 0; next && page < 20; page += 1) {
        const payload = await fetchJson(next, { fetchImpl, timeoutMs, signal });
        data.push(...(payload.data || []));
        next = payload?.paging?.next || '';
    }
    return data;
};

export const loadCreativeMetaInsightsV185 = async ({
    adIds = [],
    startDay,
    endDay,
    fetchImpl = globalThis.fetch,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    now = new Date(),
    token = process.env.META_ACCESS_TOKEN || process.env.META_ADS_ACCESS_TOKEN_EC || process.env.META_ACCESS_TOKEN_EC || '',
    accountId = process.env.META_AD_ACCOUNT_ID_EC || '',
    apiVersion = process.env.META_ADS_API_VERSION || process.env.META_CAPI_API_VERSION || 'v26.0'
} = {}) => {
    const ids = [...new Set(adIds.map(cleanId).filter(Boolean))].sort();
    if (!ids.length) return { status: 'no_data', source: 'none', rows: [], message: 'Nenhum ID persistido no período.', mutationCount: 0 };
    if (!token || typeof fetchImpl !== 'function') {
        return { status: 'degraded', source: 'none', rows: [], message: 'Meta Ads indisponível; leitura interna preservada.', mutationCount: 0 };
    }
    const cacheKey = `${cleanText(accountId)}|${startDay}|${endDay}|${ids.join(',')}`;
    const cached = memoryCache.get(cacheKey);
    if (cached && dateOf(now).getTime() - cached.savedAt < CACHE_TTL_MS) {
        return { ...cached.value, source: 'memory_cache' };
    }
    try {
        const resolvedAccount = await resolveAccountId({ token, apiVersion, fetchImpl, timeoutMs, signal, configuredAccountId: accountId });
        const insightsUrl = new URL(`https://graph.facebook.com/${apiVersion}/act_${resolvedAccount}/insights`);
        insightsUrl.searchParams.set('level', 'ad');
        insightsUrl.searchParams.set('time_increment', '1');
        insightsUrl.searchParams.set('time_range', JSON.stringify({ since: startDay, until: endDay }));
        insightsUrl.searchParams.set('fields', 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,reach,spend,clicks,inline_link_clicks,actions,action_values');
        insightsUrl.searchParams.set('limit', '500');
        insightsUrl.searchParams.set('access_token', token);
        const insightRows = (await loadAllPages({ url: insightsUrl, fetchImpl, timeoutMs, signal }))
            .filter(row => ids.includes(cleanId(row?.ad_id)));
        const detailRows = await Promise.all(ids.map(async id => {
            const url = new URL(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(id)}`);
            url.searchParams.set('fields', 'id,name,status,effective_status,campaign{id,name},adset{id,name},creative{id,name,title}');
            url.searchParams.set('access_token', token);
            return fetchJson(url, { fetchImpl, timeoutMs, signal }).catch(() => ({ id }));
        }));
        const insightByAd = new Map();
        insightRows.forEach(row => {
            const id = cleanId(row.ad_id);
            const aggregate = insightByAd.get(id) || {
                adId: id,
                campaignId: cleanId(row.campaign_id),
                campaignName: cleanText(row.campaign_name),
                adsetId: cleanId(row.adset_id),
                adsetName: cleanText(row.adset_name),
                adName: cleanText(row.ad_name),
                impressions: 0, reach: 0, clicks: 0, linkClicks: 0, landingPageViews: 0,
                metaConversations: 0, metaPurchases: 0, metaPurchaseValue: 0, spend: 0
            };
            aggregate.impressions += asNumber(row.impressions);
            aggregate.reach += asNumber(row.reach);
            aggregate.clicks += asNumber(row.clicks);
            aggregate.linkClicks += asNumber(row.inline_link_clicks) || metaAction(row, 'link_click');
            aggregate.landingPageViews += metaAction(row, 'landing_page_view');
            aggregate.metaConversations += metaAction(row, 'onsite_conversion.messaging_conversation_started_7d');
            aggregate.metaPurchases += metaAction(row, 'purchase') || metaAction(row, 'offsite_conversion.fb_pixel_purchase');
            aggregate.metaPurchaseValue += metaActionValue(row, 'purchase') || metaActionValue(row, 'offsite_conversion.fb_pixel_purchase');
            aggregate.spend += asNumber(row.spend);
            insightByAd.set(id, aggregate);
        });
        const rows = detailRows.map(detail => {
            const id = cleanId(detail.id);
            const insight = insightByAd.get(id) || { adId: id, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, landingPageViews: 0, metaConversations: 0, metaPurchases: 0, metaPurchaseValue: 0, spend: 0 };
            return {
                ...insight,
                campaignId: cleanId(detail?.campaign?.id) || insight.campaignId || '',
                campaignName: cleanText(detail?.campaign?.name) || insight.campaignName || '',
                adsetId: cleanId(detail?.adset?.id) || insight.adsetId || '',
                adsetName: cleanText(detail?.adset?.name) || insight.adsetName || '',
                adName: cleanText(detail?.name) || insight.adName || '',
                creativeId: cleanId(detail?.creative?.id),
                creativeName: cleanText(detail?.creative?.name),
                creativeTitle: cleanText(detail?.creative?.title),
                status: cleanText(detail?.status),
                effectiveStatus: cleanText(detail?.effective_status),
                ctr: percent(insight.linkClicks || insight.clicks, insight.impressions),
                cpc: (insight.linkClicks || insight.clicks) > 0 ? round(insight.spend / (insight.linkClicks || insight.clicks)) : 0,
                cpm: insight.impressions > 0 ? round((insight.spend / insight.impressions) * 1000) : 0
            };
        });
        const value = { status: 'available', source: 'live', fetchedAt: dateOf(now).toISOString(), accountId: resolvedAccount, rows, message: '', mutationCount: 0 };
        memoryCache.set(cacheKey, { savedAt: dateOf(now).getTime(), value });
        return value;
    } catch (error) {
        return { status: 'degraded', source: 'none', rows: [], message: cleanText(error?.message) || 'Meta Ads indisponível.', mutationCount: 0 };
    }
};

const buildRowScore = row => {
    const trafficBase = row.linkClicks || row.clicks;
    const trafficQuality = trafficBase > 0 ? capScore((row.landingPageViews / trafficBase) * 100) : 0;
    const conversationBase = row.whatsappClicks || row.landingPageViews || row.entries;
    const conversationRate = conversationBase > 0 ? capScore((row.conversations / conversationBase) * 100) : 0;
    const salesEvidence = row.conversations > 0 ? capScore((row.sales / row.conversations) * 500) : 0;
    const costEfficiency = row.spend > 0 && row.revenue > 0 ? capScore((row.revenue / row.spend) * 50) : 0;
    const sampleConfidence = capScore((Math.max(row.entries, row.landingPageViews) / READY_MIN_SAMPLE) * 100);
    const total = capScore(
        trafficQuality * 0.20
        + conversationRate * 0.25
        + salesEvidence * 0.30
        + costEfficiency * 0.15
        + sampleConfidence * 0.10
    );
    return {
        total,
        components: {
            traffic_quality: trafficQuality,
            conversation_rate: conversationRate,
            sales_evidence: salesEvidence,
            cost_efficiency: costEfficiency,
            sample_confidence: sampleConfidence
        },
        formula: '20% qualidade do tráfego + 25% conversação + 30% vendas + 15% eficiência de custo + 10% confiança amostral'
    };
};

export const buildCreativeSalesMetricsV185 = ({ facts, meta, startDay, endDay, computedAt = new Date() }) => {
    const metaByAd = new Map((meta?.rows || []).map(row => [cleanId(row.adId), row]));
    const internalRows = [...(facts?.rows || [])];
    if (!internalRows.some(row => row.key === 'SEM_ATRIBUICAO')) internalRows.push(emptyInternalRow({}));
    const rows = internalRows.map(internal => {
        const external = internal.adId ? metaByAd.get(internal.adId) || {} : {};
        const row = {
            ...internal,
            campaignId: internal.campaignId || cleanId(external.campaignId),
            campaignName: cleanText(external.campaignName),
            adsetId: internal.adsetId || cleanId(external.adsetId),
            adsetName: cleanText(external.adsetName),
            adId: internal.adId || '',
            adName: cleanText(external.adName),
            creativeId: internal.creativeId || cleanId(external.creativeId),
            creativeName: cleanText(external.creativeName),
            creativeTitle: cleanText(external.creativeTitle),
            status: cleanText(external.status),
            effectiveStatus: cleanText(external.effectiveStatus),
            impressions: asNumber(external.impressions),
            reach: asNumber(external.reach),
            clicks: asNumber(external.clicks),
            linkClicks: asNumber(external.linkClicks),
            landingPageViews: asNumber(external.landingPageViews),
            ctr: asNumber(external.ctr),
            cpc: asNumber(external.cpc),
            cpm: asNumber(external.cpm),
            spend: round(external.spend),
            attribution: internal.adId ? 'PERSISTED_ID' : 'SEM_ATRIBUICAO'
        };
        return { ...row, score: buildRowScore(row) };
    }).sort((a, b) => b.sales - a.sales || b.conversations - a.conversations || b.spend - a.spend || a.key.localeCompare(b.key));
    const attributed = rows.filter(row => row.adId);
    const totals = rows.reduce((sum, row) => ({
        entries: sum.entries + row.entries,
        whatsappClicks: sum.whatsappClicks + row.whatsappClicks,
        conversations: sum.conversations + row.conversations,
        leads: sum.leads + row.leads,
        orders: sum.orders + row.orders,
        sales: sum.sales + row.sales,
        revenue: sum.revenue + row.revenue,
        landingPageViews: sum.landingPageViews + row.landingPageViews,
        spend: sum.spend + row.spend
    }), { entries: 0, whatsappClicks: 0, conversations: 0, leads: 0, orders: 0, sales: 0, revenue: 0, landingPageViews: 0, spend: 0 });
    Object.keys(totals).forEach(key => { totals[key] = round(totals[key]); });
    const attributedSales = attributed.reduce((sum, row) => sum + row.sales, 0);
    const attributableSignals = rows.reduce((sum, row) => sum + row.entries + row.conversations + row.sales, 0);
    const attributedSignals = attributed.reduce((sum, row) => sum + row.entries + row.conversations + row.sales, 0);
    const attributionCoverage = percent(attributedSignals, attributableSignals);
    const sample = Math.max(totals.entries, totals.landingPageViews);
    const metaAvailable = meta?.status === 'available';
    const hasData = attributableSignals > 0 || totals.landingPageViews > 0 || totals.spend > 0;
    let state = 'NO_DATA';
    if (hasData && !metaAvailable) state = 'DEGRADED';
    else if (hasData) state = 'LEARNING';
    if (hasData && metaAvailable && sample >= READY_MIN_SAMPLE && attributionCoverage >= READY_MIN_COVERAGE && attributedSales >= READY_MIN_ATTRIBUTED_SALES && totals.spend > 0) state = 'READY';
    let confidence = state === 'DEGRADED' ? 'DEGRADED' : 'LOW';
    if (state === 'READY' && attributionCoverage >= 80 && attributedSales >= 3) confidence = 'HIGH';
    else if (state === 'READY') confidence = 'MEDIUM';
    const leader = attributed.slice().sort((a, b) => b.score.total - a.score.total || b.sales - a.sales)[0] || null;
    const bestHour = (facts?.hourly || []).slice().sort((a, b) => b.score - a.score || b.conversations - a.conversations)[0] || null;
    const canSuggestBudget = state === 'READY' && ['MEDIUM', 'HIGH'].includes(confidence) && totals.spend > 0 && attributionCoverage >= READY_MIN_COVERAGE;
    const days = Math.max(1, Math.round((new Date(`${endDay}T05:00:00Z`) - new Date(`${startDay}T05:00:00Z`)) / 86400000) + 1);
    const allocationPercent = canSuggestBudget ? 20 : null;
    const suggestedDailyBudget = canSuggestBudget ? round((totals.spend / days) * 0.20) : null;
    const action = state !== 'READY' ? 'AGUARDAR' : (leader?.score?.total >= 70 ? 'INVESTIR_AGORA' : 'MANTER');
    return {
        version: 'V185',
        scope: CREATIVE_SALES_SCOPE,
        semantics: 'PERSISTED_IDS_ONLY',
        computedAt: dateOf(computedAt).toISOString(),
        timezone: TIMEZONE,
        window: { startDay, endDay },
        ids: {
            ad: facts?.discoveredAdIds || [],
            adset: facts?.discoveredAdsetIds || [],
            campaign: facts?.discoveredCampaignIds || []
        },
        meta: { ...meta, rows: undefined },
        totals: { ...totals, attributedSales, attributionCoverage },
        trackingGap: {
            vslEntries: totals.entries,
            metaLandingPageViews: totals.landingPageViews,
            vslMinusMeta: Math.max(0, totals.entries - totals.landingPageViews),
            metaMinusVsl: Math.max(0, totals.landingPageViews - totals.entries),
            coverage: percent(Math.min(totals.entries, totals.landingPageViews), totals.entries)
        },
        earlyStages: facts?.earlyStages || 'NO_DATA',
        rows,
        radar: {
            state,
            confidence,
            action,
            leaderAdId: leader?.adId || '',
            leaderLabel: leader?.creativeName || leader?.adName || leader?.adId || '',
            leaderCreativeId: leader?.creativeId || '',
            leaderCreativeName: leader?.creativeName || '',
            score: leader?.score || null,
            hours: facts?.hourly || [],
            bestWindow: bestHour?.score > 0 ? { hour: bestHour.hour, label: `${String(bestHour.hour).padStart(2, '0')}h–${String((bestHour.hour + 1) % 24).padStart(2, '0')}h`, entries: bestHour.entries, conversations: bestHour.conversations } : null,
            allocationPercent,
            suggestedDailyBudget,
            degradationReason: state === 'DEGRADED' ? 'META_DATA_UNAVAILABLE' : '',
            explanation: state === 'READY'
                ? 'Amostra, atribuição, vendas e custo atingiram os limites conservadores.'
                : state === 'DEGRADED'
                    ? 'Meta Ads indisponível; os sinais internos permanecem visíveis, sem sugestão de verba.'
                    : state === 'LEARNING'
                        ? 'Há sinal real, mas a amostra ainda não autoriza sugestão de verba.'
                        : 'Nenhum sinal persistido disponível no período.'
        },
        writeCount: 0,
        metaMutationCount: 0
    };
};

export const clearCreativeSalesMetricsV185CacheForTests = () => memoryCache.clear();
