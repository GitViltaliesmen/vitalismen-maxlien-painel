export const META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID = '2048099902484149';
export const PROTOCOLO_G_EVENT_SOURCE_URL = 'https://vilaliemen.shop/protocolo-g';

export const PROTOCOLO_G_TEX_ULTRA_MESSAGE_PREFIX = 'Hola, quiero el tratamiento Tex Ultra.';

export const PROTOCOLO_G_STAGE_FIELDS = Object.freeze({
    landing: 'landingAt',
    video_started: 'videoStartedAt',
    watched_25: 'watched25At',
    watched_50: 'watched50At',
    early_cta_visible: 'earlyCtaVisibleAt',
    form_opened: 'formOpenedAt',
    form_submitted: 'formSubmittedAt'
});

const PROTOCOLO_G_HOSTS = new Set(['vilaliemen.shop', 'www.vilaliemen.shop']);
const PROTOCOLO_G_PATHS = new Set(['/protocolo-g', '/protocolo-g.html']);

const firstValue = (source = {}, names = []) => {
    for (const name of names) {
        const value = source?.[name];
        if (value !== undefined && value !== null && String(value).trim()) return value;
    }
    return '';
};

export const cleanProtocoloGAttributionValue = (value, maxLength = 500) => {
    const cleaned = String(value ?? '')
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
    if (!cleaned || cleaned.includes('{{') || cleaned.includes('}}')) return '';
    return cleaned;
};

const cleanMessage = (value, maxLength = 700) => String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);

export const validMetaBrowserToken = (value) => {
    const token = cleanProtocoloGAttributionValue(value, 600);
    return /^fb\.1\.\d{10,13}\.[^\s]{1,520}$/.test(token) ? token : '';
};

export const parseAttributionCapturedAt = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const epochMilliseconds = Number(value);
    if (!Number.isInteger(epochMilliseconds) || epochMilliseconds < 1_000_000_000_000 || epochMilliseconds >= 10_000_000_000_000) {
        return null;
    }
    const capturedAt = new Date(epochMilliseconds);
    return Number.isFinite(capturedAt.getTime()) ? capturedAt : null;
};

export const parseVilaliemenProtocoloGUrl = (value) => {
    try {
        const url = new URL(String(value || ''));
        const pathname = url.pathname.replace(/\/+$/, '') || '/';
        if (url.protocol !== 'https:') return null;
        if (!PROTOCOLO_G_HOSTS.has(url.hostname.toLowerCase())) return null;
        if (!PROTOCOLO_G_PATHS.has(pathname.toLowerCase())) return null;
        return url;
    } catch {
        return null;
    }
};

export const sanitizeProtocoloGAttribution = (body = {}) => {
    const rawFbc = firstValue(body, ['fbc', '_fbc']);
    const rawFbp = firstValue(body, ['fbp', '_fbp']);
    const rawAttributionCapturedAt = firstValue(body, ['attribution_captured_at', 'attributionCapturedAt']);
    return {
        external_id: cleanProtocoloGAttributionValue(firstValue(body, ['external_id', 'externalId']), 220),
        visitorId: cleanProtocoloGAttributionValue(firstValue(body, ['visitorId', 'visitor_id']), 220),
        fbclid: cleanProtocoloGAttributionValue(body.fbclid, 600),
        fbc: validMetaBrowserToken(rawFbc),
        fbp: validMetaBrowserToken(rawFbp),
        attributionCapturedAt: parseAttributionCapturedAt(rawAttributionCapturedAt),
        rawFbcPresent: Boolean(String(rawFbc || '').trim()),
        rawFbpPresent: Boolean(String(rawFbp || '').trim()),
        rawAttributionCapturedAtPresent: Boolean(String(rawAttributionCapturedAt || '').trim()),
        utm_source: cleanProtocoloGAttributionValue(body.utm_source, 300),
        utm_medium: cleanProtocoloGAttributionValue(body.utm_medium, 300),
        utm_campaign: cleanProtocoloGAttributionValue(body.utm_campaign, 300),
        utm_content: cleanProtocoloGAttributionValue(body.utm_content, 300),
        utm_term: cleanProtocoloGAttributionValue(body.utm_term, 300),
        campaign_id: cleanProtocoloGAttributionValue(firstValue(body, ['campaign_id', 'campaignId', 'cid']), 220),
        adset_id: cleanProtocoloGAttributionValue(firstValue(body, ['adset_id', 'adsetId', 'asid']), 220),
        ad_id: cleanProtocoloGAttributionValue(firstValue(body, ['ad_id', 'adId', 'aid']), 220),
        placement: cleanProtocoloGAttributionValue(firstValue(body, ['placement', 'pl']), 220)
    };
};

const normalizedIdentity = (value) => cleanProtocoloGAttributionValue(value, 120)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizedPath = (value) => {
    const path = cleanProtocoloGAttributionValue(value, 300).toLowerCase().replace(/\/+$/, '');
    return path || '/';
};

const normalizedStage = (value) => cleanProtocoloGAttributionValue(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const protocoloGStageField = (value) => PROTOCOLO_G_STAGE_FIELDS[normalizedStage(value)] || '';

export const hasProtocoloGContractSignal = (body = {}) => {
    const sourceUrl = firstValue(body, ['event_source_url', 'eventSourceUrl', 'sourceUrl']);
    return normalizedIdentity(body.funnel) === 'PROTOCOLO_G'
        || normalizedIdentity(body.page) === 'PROTOCOLO_G'
        || PROTOCOLO_G_PATHS.has(normalizedPath(body.path))
        || Boolean(parseVilaliemenProtocoloGUrl(sourceUrl));
};

export const validateVilaliemenProtocoloGContract = (body = {}) => {
    const attribution = sanitizeProtocoloGAttribution(body);
    const sourceUrl = parseVilaliemenProtocoloGUrl(
        firstValue(body, ['event_source_url', 'eventSourceUrl', 'sourceUrl'])
    );
    const message = cleanMessage(firstValue(body, ['message', 'entryMessage', 'vslEntryMessage', 'vsl_entry_message']));
    const vslEntryMessage = cleanMessage(firstValue(body, ['vslEntryMessage', 'vsl_entry_message']));
    const errors = [];

    if (normalizedIdentity(body.country) !== 'EC') errors.push('invalid_country');
    if (normalizedIdentity(firstValue(body, ['productKey', 'product_key'])) !== 'TEX_ULTRA_EC') errors.push('invalid_product_key');
    if (normalizedIdentity(body.product) !== 'TEX_ULTRA') errors.push('invalid_product');
    if (normalizedIdentity(body.funnel) !== 'PROTOCOLO_G') errors.push('invalid_funnel');
    if (normalizedIdentity(body.page) !== 'PROTOCOLO_G') errors.push('invalid_page');
    if (normalizedPath(body.path) !== '/protocolo-g') errors.push('invalid_path');
    if (!sourceUrl) errors.push('invalid_event_source_url');
    if (!message.startsWith(PROTOCOLO_G_TEX_ULTRA_MESSAGE_PREFIX)) errors.push('invalid_message');
    if (vslEntryMessage && vslEntryMessage !== message) errors.push('conflicting_entry_message');
    if (!attribution.external_id) errors.push('missing_external_id');
    if (attribution.visitorId && attribution.visitorId !== attribution.external_id) errors.push('conflicting_visitor_id');
    if (attribution.rawFbcPresent && !attribution.fbc) errors.push('invalid_fbc');
    if (attribution.rawFbpPresent && !attribution.fbp) errors.push('invalid_fbp');
    if (attribution.rawAttributionCapturedAtPresent && !attribution.attributionCapturedAt) {
        errors.push('invalid_attribution_captured_at');
    }
    if (body.clicked !== true) errors.push('invalid_clicked');
    if (normalizedIdentity(body.intent) !== 'WHATSAPP_CLICK') errors.push('invalid_intent');
    if (body.skipMeta !== true && body.skip_meta !== true) errors.push('invalid_skip_meta');
    if (normalizedIdentity(firstValue(body, ['vslVariant', 'vsl_variant'])) !== 'PROTOCOLO_G') errors.push('invalid_vsl_variant');

    return {
        ok: errors.length === 0,
        errors,
        message,
        sourceUrl: sourceUrl?.toString() || '',
        externalId: attribution.external_id,
        attribution: {
            external_id: attribution.external_id,
            fbclid: attribution.fbclid,
            fbc: attribution.fbc,
            fbp: attribution.fbp,
            attributionCapturedAt: attribution.attributionCapturedAt,
            utm_source: attribution.utm_source,
            utm_medium: attribution.utm_medium,
            utm_campaign: attribution.utm_campaign,
            utm_content: attribution.utm_content,
            utm_term: attribution.utm_term,
            campaign_id: attribution.campaign_id,
            adset_id: attribution.adset_id,
            ad_id: attribution.ad_id,
            placement: attribution.placement
        },
        identity: {
            country: 'EC',
            productKey: 'tex_ultra_ec',
            product: 'TEX_ULTRA',
            funnel: 'PROTOCOLO_G',
            page: 'protocolo-g',
            path: '/protocolo-g'
        }
    };
};

export const validateVilaliemenProtocoloGStageContract = (body = {}) => {
    const attribution = sanitizeProtocoloGAttribution(body);
    const sourceUrl = parseVilaliemenProtocoloGUrl(
        firstValue(body, ['event_source_url', 'eventSourceUrl', 'sourceUrl'])
    );
    const stage = normalizedStage(firstValue(body, ['stage', 'vslStage', 'vsl_stage']));
    const stageField = protocoloGStageField(stage);
    const errors = [];

    if (normalizedIdentity(body.country) !== 'EC') errors.push('invalid_country');
    if (normalizedIdentity(firstValue(body, ['productKey', 'product_key'])) !== 'TEX_ULTRA_EC') errors.push('invalid_product_key');
    if (normalizedIdentity(body.product) !== 'TEX_ULTRA') errors.push('invalid_product');
    if (normalizedIdentity(body.funnel) !== 'PROTOCOLO_G') errors.push('invalid_funnel');
    if (normalizedIdentity(body.page) !== 'PROTOCOLO_G') errors.push('invalid_page');
    if (normalizedPath(body.path) !== '/protocolo-g') errors.push('invalid_path');
    if (!sourceUrl) errors.push('invalid_event_source_url');
    if (!stageField) errors.push('invalid_stage');
    if (!attribution.external_id) errors.push('missing_external_id');
    if (attribution.visitorId && attribution.visitorId !== attribution.external_id) errors.push('conflicting_visitor_id');
    if (attribution.rawFbcPresent && !attribution.fbc) errors.push('invalid_fbc');
    if (attribution.rawFbpPresent && !attribution.fbp) errors.push('invalid_fbp');
    if (attribution.rawAttributionCapturedAtPresent && !attribution.attributionCapturedAt) {
        errors.push('invalid_attribution_captured_at');
    }
    if (body.clicked !== false) errors.push('invalid_clicked');
    if (normalizedIdentity(body.intent) !== 'VSL_STAGE') errors.push('invalid_intent');
    if (body.skipMeta !== true && body.skip_meta !== true) errors.push('invalid_skip_meta');
    if (normalizedIdentity(firstValue(body, ['vslVariant', 'vsl_variant'])) !== 'PROTOCOLO_G') errors.push('invalid_vsl_variant');

    return {
        ok: errors.length === 0,
        errors,
        stage,
        stageField,
        sourceUrl: sourceUrl?.toString() || '',
        externalId: attribution.external_id,
        attribution: {
            external_id: attribution.external_id,
            fbclid: attribution.fbclid,
            fbc: attribution.fbc,
            fbp: attribution.fbp,
            attributionCapturedAt: attribution.attributionCapturedAt,
            utm_source: attribution.utm_source,
            utm_medium: attribution.utm_medium,
            utm_campaign: attribution.utm_campaign,
            utm_content: attribution.utm_content,
            utm_term: attribution.utm_term,
            campaign_id: attribution.campaign_id,
            adset_id: attribution.adset_id,
            ad_id: attribution.ad_id,
            placement: attribution.placement
        },
        identity: {
            country: 'EC',
            productKey: 'tex_ultra_ec',
            product: 'TEX_ULTRA',
            funnel: 'PROTOCOLO_G',
            page: 'protocolo-g',
            path: '/protocolo-g'
        }
    };
};

export const isEcuadorTexUltraProtocoloG = (value = {}) => {
    const tracking = value.tracking || value;
    const country = normalizedIdentity(value.country || tracking.country);
    const productKey = normalizedIdentity(tracking.productKey || tracking.product_key);
    const product = normalizedIdentity(tracking.product || tracking.productName || tracking.contentName);
    const funnel = normalizedIdentity(tracking.funnel || tracking.vslVariant || tracking.vsl_variant);
    const productMatches = productKey
        ? productKey === 'TEX_ULTRA_EC'
        : (product === 'TEX_ULTRA' || product === 'TEX_ULTRA_ECUADOR');
    return country === 'EC'
        && productMatches
        && funnel === 'PROTOCOLO_G';
};

export const protocoloGStructuredTracking = (body = {}, contract = null) => {
    const validated = contract || validateVilaliemenProtocoloGContract(body);
    const attribution = validated.attribution || sanitizeProtocoloGAttribution(body);
    return Object.fromEntries(Object.entries({
        country: 'EC',
        product: 'TEX_ULTRA',
        funnel: 'PROTOCOLO_G',
        external_id: attribution.external_id || validated.externalId || '',
        ...attribution,
        sourceUrl: validated.sourceUrl || cleanProtocoloGAttributionValue(
            firstValue(body, ['event_source_url', 'eventSourceUrl', 'sourceUrl']),
            2048
        ),
        userAgent: cleanProtocoloGAttributionValue(
            firstValue(body, ['client_user_agent', 'clientUserAgent']),
            700
        ),
        clientContextSource: 'vilaliemen_protocolo_g_server_bridge'
    }).filter(([, value]) => value !== undefined && value !== null && value !== ''));
};
