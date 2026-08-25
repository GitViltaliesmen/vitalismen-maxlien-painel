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
    'campaign_id',
    'adset_id',
    'ad_id',
    'placement',
    'attributionCapturedAt'
];

export const hasMetaAdAttribution = (tracking = {}) => Boolean(
    tracking.fbc
    || tracking.fbclid
    || tracking.utm_source
    || tracking.utm_medium
    || tracking.utm_campaign
    || tracking.utm_content
    || tracking.utm_term
    || tracking.campaign_id
    || tracking.adset_id
    || tracking.ad_id
    || tracking.placement
);

const buildFbcFromFbclid = (fbclid = '', date = new Date()) => {
    const click = clean(fbclid);
    if (!click) return '';
    const seconds = Math.floor(new Date(date).getTime() / 1000);
    return `fb.1.${Number.isFinite(seconds) ? seconds : Math.floor(Date.now() / 1000)}.${click}`;
};

export const metaAttributionTrackingFromVisit = (visit = {}) => {
    const tracking = visit.tracking || {};
    const out = {};
    for (const key of attributionKeys) {
        if (tracking[key]) out[key] = tracking[key];
    }
    const protocoloGVisit = String(visit.country || tracking.country || '').trim().toUpperCase() === 'EC'
        && String(visit.productKey || tracking.productKey || '').trim().toLowerCase() === 'tex_ultra_ec'
        && String(visit.funnel || tracking.funnel || '').trim().toUpperCase() === 'PROTOCOLO_G';
    if (!out.fbc && out.fbclid && !protocoloGVisit) {
        out.fbc = buildFbcFromFbclid(out.fbclid, visit.firstSeenAt || visit.createdAt);
    }
    if (visit.sourceUrl) out.sourceUrl = visit.sourceUrl;
    if (visit.userAgent) {
        out.userAgent = visit.userAgent;
        out.clientContextSource = tracking.clientContextSource
            || (String(visit.funnel || tracking.funnel || '').toUpperCase() === 'PROTOCOLO_G'
                ? 'vilaliemen_protocolo_g_server_bridge'
                : 'vsl_client_transport');
    }
    const externalId = tracking.external_id || visit.externalId || visit.visitorId;
    if (externalId) {
        out.external_id = externalId;
        out.ext_id = externalId;
    }
    if (visit.country || tracking.country) out.country = visit.country || tracking.country;
    if (tracking.product) out.product = tracking.product;
    if (visit.productKey || tracking.productKey) out.productKey = visit.productKey || tracking.productKey;
    if (visit.productName || tracking.productName) out.productName = visit.productName || tracking.productName;
    if (visit.funnel || tracking.funnel) out.funnel = visit.funnel || tracking.funnel;
    if (!out.campaign_id && visit.campaignId) out.campaign_id = visit.campaignId;
    if (!out.adset_id && visit.adsetId) out.adset_id = visit.adsetId;
    if (!out.ad_id && visit.adId) out.ad_id = visit.adId;
    if (!out.placement && visit.placement) out.placement = visit.placement;
    if (!out.attributionCapturedAt && visit.attributionCapturedAt) {
        out.attributionCapturedAt = visit.attributionCapturedAt;
    }
    return out;
};

export const applyVisitAttributionToOrder = (order, visit, { matchedAt = new Date() } = {}) => {
    if (!order || !visit) return { ok: false, skipped: true, reason: 'missing_order_or_visit' };
    order.tracking = order.tracking || {};
    const attribution = metaAttributionTrackingFromVisit(visit);
    if (!hasMetaAdAttribution(attribution)) {
        return { ok: false, skipped: true, reason: 'visit_without_attribution', visitorKey: visit.visitorKey || '' };
    }

    for (const [key, value] of Object.entries(attribution)) {
        if (!order.tracking[key] && value) order.tracking[key] = value;
    }
    order.tracking.attributionSource = 'vsl_visit_phone_match';
    order.tracking.attributionVisitorKey = visit.visitorKey || '';
    order.tracking.attributionMatchedAt = matchedAt;
    order.tracking.attributionConfidence = 'phone_tail_recent_claimed_click';
    order.tracking.attributionCorrelationStatus = 'CLAIMED';
    order.tracking.attributionCorrelationReason = visit.attributionClaimSource || 'zapi_exact_message_unique_120s';

    return {
        ok: true,
        enriched: true,
        visitorKey: visit.visitorKey || '',
        sourceUrl: attribution.sourceUrl || '',
        hasFbc: Boolean(order.tracking.fbc),
        hasFbp: Boolean(order.tracking.fbp),
        hasFbclid: Boolean(order.tracking.fbclid),
        hasUtmCampaign: Boolean(order.tracking.utm_campaign),
        campaignId: order.tracking.campaign_id || '',
        adsetId: order.tracking.adset_id || '',
        adId: order.tracking.ad_id || '',
        placement: order.tracking.placement || ''
    };
};

export const enrichOrderWithMetaAttribution = async (order, {
    lookbackDays = 30,
    VisitModel = VslVisit,
    now = () => new Date()
} = {}) => {
    if (!order || String(order.country || '').toUpperCase() !== 'EC') {
        return { ok: false, skipped: true, reason: 'unsupported_order' };
    }
    order.tracking = order.tracking || {};
    if (hasMetaAdAttribution(order.tracking)) {
        return { ok: true, skipped: true, reason: 'order_already_has_attribution' };
    }

    const phoneTail = digitsOnly(order.customer?.phone || '').slice(-9);
    if (!phoneTail) return { ok: false, skipped: true, reason: 'missing_phone' };

    const matchedAt = now();
    const since = new Date(matchedAt.getTime() - Math.max(1, Number(lookbackDays) || 30) * 24 * 60 * 60 * 1000);
    const visit = await VisitModel.findOne({
        country: 'EC',
        lastSeenAt: { $gte: since },
        customerPhone: { $regex: `${phoneTail}$` },
        attributionClaimedAt: { $exists: true, $ne: null },
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
    return applyVisitAttributionToOrder(order, visit, { matchedAt });
};

export const orderHasMetaAttribution = (order = {}) => hasMetaAdAttribution(order.tracking || {});
