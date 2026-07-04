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
    'utm_term'
];

const hasAttribution = (tracking = {}) => Boolean(
    tracking.fbc
    || tracking.fbp
    || tracking.fbclid
    || tracking.utm_campaign
    || tracking.sourceUrl
);

const buildFbcFromFbclid = (fbclid = '', date = new Date()) => {
    const click = clean(fbclid);
    if (!click) return '';
    const seconds = Math.floor(new Date(date).getTime() / 1000);
    return `fb.1.${Number.isFinite(seconds) ? seconds : Math.floor(Date.now() / 1000)}.${click}`;
};

const trackingFromVisit = (visit = {}) => {
    const tracking = visit.tracking || {};
    const out = {};
    for (const key of attributionKeys) {
        if (tracking[key]) out[key] = tracking[key];
    }
    if (!out.fbc && out.fbclid) out.fbc = buildFbcFromFbclid(out.fbclid, visit.firstSeenAt || visit.createdAt);
    if (visit.sourceUrl) out.sourceUrl = visit.sourceUrl;
    if (visit.userAgent) out.userAgent = visit.userAgent;
    if (visit.visitorId) out.ext_id = visit.visitorId;
    return out;
};

export const enrichOrderWithMetaAttribution = async (order, { lookbackDays = 30 } = {}) => {
    if (!order || String(order.country || '').toUpperCase() !== 'EC') {
        return { ok: false, skipped: true, reason: 'unsupported_order' };
    }
    order.tracking = order.tracking || {};
    if (hasAttribution(order.tracking)) {
        return { ok: true, skipped: true, reason: 'order_already_has_attribution' };
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

    const attribution = trackingFromVisit(visit);
    if (!hasAttribution(attribution)) {
        return { ok: false, skipped: true, reason: 'visit_without_attribution', visitorKey: visit.visitorKey };
    }

    for (const [key, value] of Object.entries(attribution)) {
        if (!order.tracking[key] && value) order.tracking[key] = value;
    }
    order.tracking.attributionSource = 'vsl_visit_phone_match';
    order.tracking.attributionVisitorKey = visit.visitorKey || '';
    order.tracking.attributionMatchedAt = new Date();
    order.tracking.attributionConfidence = 'phone_tail_recent_click';

    return {
        ok: true,
        enriched: true,
        visitorKey: visit.visitorKey || '',
        sourceUrl: attribution.sourceUrl || '',
        hasFbc: Boolean(order.tracking.fbc),
        hasFbp: Boolean(order.tracking.fbp),
        hasFbclid: Boolean(order.tracking.fbclid),
        hasUtmCampaign: Boolean(order.tracking.utm_campaign)
    };
};

export const orderHasMetaAttribution = (order = {}) => hasAttribution(order.tracking || {});
