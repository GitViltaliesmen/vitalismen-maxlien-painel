import VslVisit from '../models/VslVisit.js';

const clean = (value) => String(value || '').trim();
const digitsOnly = (value) => clean(value).replace(/\D/g, '');

const attributionKeys = [
    'fbclid',
    'fbc',
    'fbp',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'metaCampaignId',
    'metaAdsetId',
    'metaAdId',
    'metaCampaignName',
    'metaAdsetName',
    'metaAdName'
];

const firstClean = (...values) => {
    for (const value of values) {
        const cleaned = clean(value);
        if (cleaned) return cleaned;
    }
    return '';
};

const firstFrom = (input = {}, keys = []) => firstClean(...keys.map((key) => input?.[key]));

export const normalizeMetaTrackingInput = (input = {}, {
    captureOriginalClient = false,
    clientIp = '',
    clientUserAgent = ''
} = {}) => {
    const sourceUrl = firstFrom(input, ['landingUrl', 'landing_url', 'event_source_url', 'eventSourceUrl', 'sourceUrl']);
    const normalized = {
        fbclid: firstFrom(input, ['fbclid', 'meta_fbclid']),
        fbc: firstFrom(input, ['fbc', '_fbc', 'meta_fbc']),
        fbp: firstFrom(input, ['fbp', '_fbp', 'meta_fbp']),
        ext_id: firstFrom(input, ['ext_id', 'external_id', 'externalId']),
        utm_source: firstFrom(input, ['utm_source']),
        utm_medium: firstFrom(input, ['utm_medium']),
        utm_campaign: firstFrom(input, ['utm_campaign']),
        utm_content: firstFrom(input, ['utm_content']),
        utm_term: firstFrom(input, ['utm_term']),
        sourceUrl,
        landingUrl: sourceUrl,
        originalReferrer: firstFrom(input, ['originalReferrer', 'original_referrer', 'referrer']),
        metaCampaignId: firstFrom(input, ['metaCampaignId', 'meta_campaign_id', 'campaign_id']),
        metaAdsetId: firstFrom(input, ['metaAdsetId', 'meta_adset_id', 'adset_id']),
        metaAdId: firstFrom(input, ['metaAdId', 'meta_ad_id', 'ad_id']),
        metaCampaignName: firstFrom(input, ['metaCampaignName', 'meta_campaign_name', 'campaign_name']),
        metaAdsetName: firstFrom(input, ['metaAdsetName', 'meta_adset_name', 'adset_name']),
        metaAdName: firstFrom(input, ['metaAdName', 'meta_ad_name', 'ad_name', 'creative_name'])
    };

    if (captureOriginalClient) {
        normalized.clientIpOriginal = firstClean(clientIp, input.clientIpOriginal, input.client_ip_original, input.client_ip_address);
        normalized.clientUserAgentOriginal = firstClean(clientUserAgent, input.clientUserAgentOriginal, input.client_user_agent_original, input.client_user_agent);
        // Legacy mirrors remain populated only for a request made by the original client.
        normalized.ip = normalized.clientIpOriginal;
        normalized.userAgent = normalized.clientUserAgentOriginal;
    } else {
        normalized.clientIpOriginal = firstFrom(input, ['clientIpOriginal', 'client_ip_original']);
        normalized.clientUserAgentOriginal = firstFrom(input, ['clientUserAgentOriginal', 'client_user_agent_original']);
        normalized.ip = firstFrom(input, ['ip']);
        normalized.userAgent = firstFrom(input, ['userAgent']);
    }

    return Object.fromEntries(Object.entries(normalized).filter(([, value]) => Boolean(value)));
};

export const hasMetaAdAttribution = (tracking = {}) => Boolean(
    tracking.fbc
    || tracking.fbp
    || tracking.fbclid
    || tracking.utm_source
    || tracking.utm_medium
    || tracking.utm_campaign
    || tracking.utm_content
    || tracking.utm_term
);

export const buildFbcFromFbclid = (fbclid = '', date = new Date()) => {
    const click = clean(fbclid);
    if (!click) return '';
    const milliseconds = Math.floor(new Date(date).getTime());
    return `fb.1.${Number.isFinite(milliseconds) ? milliseconds : Date.now()}.${click}`;
};

export const metaAttributionTrackingFromVisit = (visit = {}) => {
    const tracking = visit.tracking || {};
    const out = {};
    for (const key of attributionKeys) {
        if (tracking[key]) out[key] = tracking[key];
    }
    if (!out.fbc && out.fbclid) out.fbc = buildFbcFromFbclid(out.fbclid, visit.firstSeenAt || visit.createdAt);
    if (visit.sourceUrl) {
        out.sourceUrl = visit.sourceUrl;
        out.landingUrl = visit.sourceUrl;
    }
    if (visit.referrer) out.originalReferrer = visit.referrer;
    if (visit.clientIpOriginal) out.clientIpOriginal = visit.clientIpOriginal;
    if (visit.clientUserAgentOriginal || visit.userAgent) {
        out.clientUserAgentOriginal = visit.clientUserAgentOriginal || visit.userAgent;
    }
    if (tracking.external_id || visit.visitorId) out.ext_id = tracking.external_id || visit.visitorId;
    return out;
};

export const enrichOrderWithMetaAttribution = async (order, { lookbackDays = 30 } = {}) => {
    if (!order || String(order.country || '').toUpperCase() !== 'EC') {
        return { ok: false, skipped: true, reason: 'unsupported_order' };
    }
    order.tracking = order.tracking || {};
    const alreadyComplete = Boolean(
        order.tracking.sourceUrl
        && order.tracking.fbp
        && (order.tracking.fbc || order.tracking.fbclid)
        && order.tracking.clientUserAgentOriginal
    );
    if (alreadyComplete) {
        return { ok: true, skipped: true, reason: 'order_attribution_complete' };
    }

    const phoneTail = digitsOnly(order.customer?.phone || '').slice(-9);
    if (!phoneTail) return { ok: false, skipped: true, reason: 'missing_phone' };

    const since = new Date(Date.now() - Math.max(1, Number(lookbackDays) || 30) * 24 * 60 * 60 * 1000);
    const visit = await VslVisit.findOne({
        country: 'EC',
        lastSeenAt: { $gte: since },
        customerPhone: { $regex: `${phoneTail}$` },
        $or: [
            { metaLeadSentAt: { $exists: true } },
            { metaInitiateCheckoutSentAt: { $exists: true } },
            { clickCount: { $gt: 0 } }
        ]
    }).sort({
        metaLeadSentAt: -1,
        metaInitiateCheckoutSentAt: -1,
        lastClickAt: -1,
        lastSeenAt: -1
    }).lean();

    if (!visit) return { ok: false, skipped: true, reason: 'no_visit_match' };

    const attribution = metaAttributionTrackingFromVisit(visit);
    if (!hasMetaAdAttribution(attribution)) {
        return { ok: false, skipped: true, reason: 'visit_without_attribution', visitorKey: visit.visitorKey };
    }

    const enrichedKeys = [];
    for (const [key, value] of Object.entries(attribution)) {
        if (!order.tracking[key] && value) {
            order.tracking[key] = value;
            enrichedKeys.push(key);
        }
    }
    if (!enrichedKeys.length) return { ok: true, skipped: true, reason: 'order_attribution_preserved' };
    order.tracking.attributionSource = 'vsl_visit_phone_match';
    order.tracking.attributionVisitorKey = visit.visitorKey || '';
    order.tracking.attributionMatchedAt = new Date();
    order.tracking.attributionConfidence = 'phone_tail_recent_click';

    return {
        ok: true,
        enriched: true,
        enrichedKeys,
        visitorKey: visit.visitorKey || '',
        sourceUrl: attribution.sourceUrl || '',
        hasFbc: Boolean(order.tracking.fbc),
        hasFbp: Boolean(order.tracking.fbp),
        hasFbclid: Boolean(order.tracking.fbclid),
        hasUtmCampaign: Boolean(order.tracking.utm_campaign)
    };
};

export const orderHasMetaAttribution = (order = {}) => hasMetaAdAttribution(order.tracking || {});
