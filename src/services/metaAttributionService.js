import VslVisit from '../models/VslVisit.js';

const clean = (value) => String(value || '').trim();
const digitsOnly = (value) => clean(value).replace(/\D/g, '');
const VSL_ATTRIBUTION_REF_PATTERN = /\bTX-[A-Z0-9]{10,20}\b/i;

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

const hasDirectMetaAttribution = (tracking = {}) => Boolean(
    tracking.fbc
    || tracking.fbp
    || tracking.fbclid
);

export const buildFbcFromFbclid = (fbclid = '', date = new Date()) => {
    const click = clean(fbclid);
    if (!click) return '';
    const milliseconds = new Date(date).getTime();
    return `fb.1.${Number.isFinite(milliseconds) ? milliseconds : Date.now()}.${click}`;
};

export const normalizeVslAttributionRef = (value = '') => {
    const match = clean(value).toUpperCase().match(VSL_ATTRIBUTION_REF_PATTERN);
    return match ? match[0] : '';
};

export const extractVslAttributionRef = (message = '') => normalizeVslAttributionRef(message);

export const normalizeLegacyFbcInTracking = (tracking = {}, date = new Date()) => {
    const legacyFbc = /^fb\.1\.(\d{10})\./.exec(clean(tracking.fbc));
    if (tracking.fbclid && legacyFbc) {
        tracking.fbc = `fb.1.${Number(legacyFbc[1]) * 1000}.${clean(tracking.fbclid)}`;
    } else if (tracking.fbclid && !tracking.fbc) {
        tracking.fbc = buildFbcFromFbclid(tracking.fbclid, date);
    }
    return tracking;
};

export const metaAttributionTrackingFromVisit = (visit = {}) => {
    const tracking = visit.tracking || {};
    const out = {};
    for (const key of attributionKeys) {
        if (tracking[key]) out[key] = tracking[key];
    }
    normalizeLegacyFbcInTracking(out, visit.firstSeenAt || visit.createdAt);
    if (visit.sourceUrl) out.sourceUrl = visit.sourceUrl;
    if (visit.userAgent) out.userAgent = visit.userAgent;
    if (visit.visitorId) out.ext_id = visit.visitorId;
    return out;
};

export const linkVslVisitToCustomerByReference = async ({
    attributionRef = '',
    message = '',
    phone = '',
    lookbackDays = 30
} = {}) => {
    const reference = normalizeVslAttributionRef(attributionRef) || extractVslAttributionRef(message);
    if (!reference) return { ok: false, skipped: true, reason: 'missing_attribution_reference' };

    const phoneDigits = digitsOnly(phone).slice(-15);
    if (phoneDigits.length < 9) return { ok: false, skipped: true, reason: 'missing_phone' };

    const since = new Date(Date.now() - Math.max(1, Number(lookbackDays) || 30) * 24 * 60 * 60 * 1000);
    const linkedAt = new Date();
    const visit = await VslVisit.findOneAndUpdate(
        {
            country: 'EC',
            attributionRef: reference,
            lastSeenAt: { $gte: since },
            $or: [
                { customerPhone: '' },
                { customerPhone: phoneDigits },
                { customerPhone: { $exists: false } }
            ]
        },
        {
            $set: {
                customerPhone: phoneDigits,
                attributionLinkedAt: linkedAt
            }
        },
        { new: true }
    ).lean();

    if (!visit) return { ok: false, skipped: true, reason: 'reference_not_found', attributionRef: reference };

    const tracking = metaAttributionTrackingFromVisit(visit);
    return {
        ok: true,
        linked: true,
        claimed: true,
        confidence: 'unique_reference_inbound_match',
        claimedAt: linkedAt,
        attributionRef: reference,
        visitId: visit._id?.toString?.() || '',
        visitorKey: visit.visitorKey || '',
        visitorId: visit.visitorId || '',
        sourceUrl: visit.sourceUrl || '',
        productKey: visit.productKey || '',
        productName: visit.productName || '',
        tracking,
        hasAttribution: hasMetaAdAttribution(tracking)
    };
};

export const enrichOrderWithMetaAttribution = async (order, { lookbackDays = 30 } = {}) => {
    if (!order || String(order.country || '').toUpperCase() !== 'EC') {
        return { ok: false, skipped: true, reason: 'unsupported_order' };
    }
    order.tracking = order.tracking || {};
    normalizeLegacyFbcInTracking(order.tracking, order.confirmedAt || order.createdAt || new Date());
    if (hasDirectMetaAttribution(order.tracking)) {
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

    const attribution = metaAttributionTrackingFromVisit(visit);
    if (!hasMetaAdAttribution(attribution)) {
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

export const orderHasMetaAttribution = (order = {}) => hasMetaAdAttribution(order.tracking || {});
