import crypto from 'node:crypto';

export const EC_OFFICIAL_VSL_V78_URL = 'https://vilaliemen.shop/protocolo-g';
export const EC_OFFICIAL_VSL_V78_WHATSAPP = '5515991418416';
export const EC_OFFICIAL_VSL_V78_PRODUCT_KEY = 'tex_ultra_ec';
export const EC_OFFICIAL_VSL_V78_MARKER = 'EC-TEX-ULTRA-PROTOCOLO-G';
export const EC_OFFICIAL_VSL_V78_MESSAGE = [
    'Hola, quiero el tratamiento Tex Ultra.',
    'Nombre: Cliente Protocolo G'
].join('\n');

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const normalize = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const canonicalUrl = (value = '') => {
    try {
        const parsed = new URL(String(value || '').trim());
        parsed.hash = '';
        parsed.search = '';
        return parsed.toString().replace(/\/$/, '');
    } catch {
        return '';
    }
};

const structuredProtocoloGMessage = (text = '', prefix = 'Hola, quiero el tratamiento Tex Ultra.') => {
    const lines = String(text || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length < 2 || lines.length > 4) return false;
    if (normalize(lines[0]) !== normalize(prefix)) return false;

    const fields = lines.slice(1).map((line) => {
        const match = line.match(/^\s*([^:]+)\s*:\s*(.*)$/u);
        return match ? { label: normalize(match[1]), value: String(match[2] || '').trim() } : null;
    });
    if (fields.some((field) => !field)) return false;
    const allowedLabels = new Set(['nombre', 'ciudad', 'provincia']);
    if (fields.some((field) => !allowedLabels.has(field.label))) return false;
    if (new Set(fields.map((field) => field.label)).size !== fields.length) return false;
    return fields.some((field) => field.label === 'nombre' && field.value);
};

export const officialEcVslDestinationPhoneV78 = (env = process.env) => {
    const configured = [
        env.ZAPI_PHONE,
        env.ZAPI_DEFAULT_PHONE,
        env.ZAPI_OPERATION_PHONE,
        env.ZAPI_CONNECTED_PHONE,
        env.WHATSAPP_OFFICIAL_PHONE
    ].map(digitsOnly).filter(Boolean);
    const unique = [...new Set(configured)];
    if (!unique.length) return EC_OFFICIAL_VSL_V78_WHATSAPP;
    return unique.length === 1 ? unique[0] : '';
};

export const recognizeOfficialEcVslEntryV78 = ({
    text = '',
    destinationPhone = '',
    sourceUrl = ''
} = {}) => {
    if (!structuredProtocoloGMessage(text)) {
        return Object.freeze({ recognized: false, reason: 'official_vsl_signature_mismatch' });
    }
    if (digitsOnly(destinationPhone) !== EC_OFFICIAL_VSL_V78_WHATSAPP) {
        return Object.freeze({ recognized: false, reason: 'official_vsl_destination_mismatch' });
    }
    if (sourceUrl && canonicalUrl(sourceUrl) !== canonicalUrl(EC_OFFICIAL_VSL_V78_URL)) {
        return Object.freeze({ recognized: false, reason: 'official_vsl_source_mismatch' });
    }
    return Object.freeze({
        recognized: true,
        reason: 'official_vsl_protocolo_g_structured',
        sourceUrl: EC_OFFICIAL_VSL_V78_URL,
        destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP,
        productKey: EC_OFFICIAL_VSL_V78_PRODUCT_KEY,
        marker: EC_OFFICIAL_VSL_V78_MARKER
    });
};

// This additional contract is restricted to a previously persisted, uniquely
// claimed Vit QA inbound. Text alone is never sufficient authority.
export const recognizeClaimedVitEcQaEntryV78 = ({
    text = '', messageId = '', phone = '', connectedPhone = '',
    state = {}, inbound = {}, visit = {}
} = {}) => {
    const reject = (reason) => Object.freeze({ recognized: false, reason });
    if (!structuredProtocoloGMessage(text, 'Hola, vengo del video')) {
        return reject('official_vsl_signature_mismatch');
    }
    if (phone !== '5515998038637' || state.phoneDigits !== phone
        || state.metadata?.testOnly !== true || state.metadata?.botTestEnabled !== true
        || state.metadata?.fullFunnelTestEnabled !== true) return reject('vit_qa_identity_mismatch');
    // Public CTA and the Z-API connected identity are distinct, exact values.
    if (connectedPhone !== '553171862958' || inbound.connectedPhone !== connectedPhone
        || visit.assignedSeller !== '5531971862958') return reject('vit_qa_audience_mismatch');
    if (!messageId || String(inbound._id || '') !== messageId
        || inbound.provider !== 'zapi' || inbound.isFromMe !== false
        || inbound.peerPhone !== phone || inbound.body !== text) return reject('vit_qa_inbound_mismatch');
    const visitId = String(visit._id || '');
    if (!/^[a-f0-9]{24}$/.test(visitId) || String(state.metadata?.vslVisitId || '') !== visitId
        || visit.customerPhone !== phone) return reject('vit_qa_visit_mismatch');
    if (visit.country !== 'EC' || visit.productKey !== 'vit_power_ec'
        || visit.productSource !== 'ec_vit_power_vsl' || visit.funnel !== 'VIT_POWER') {
        return reject('vit_qa_product_contract_mismatch');
    }
    if (visit.path !== '/exutra' || canonicalUrl(visit.sourceUrl) !== 'https://maxlien.shop/exutra') {
        return reject('vit_qa_origin_mismatch');
    }
    const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
    if (visit.attributionClaimSource !== 'canonical_provider_exact_message_unique_120s'
        || !visit.attributionClaimedAt || visit.attributionClaimPhoneHash !== hash(phone)
        || visit.attributionClaimMessageHash !== hash(normalize(text))
        || ![visit.lastWhatsappMessage, visit.vslEntryMessage, visit.lastEntryMessage].includes(text)) {
        return reject('vit_qa_claim_mismatch');
    }
    const inboundAt = new Date(inbound.createdAt).getTime();
    const clickAt = new Date(visit.lastClickAt).getTime();
    const claimInboundAt = new Date(visit.attributionClaimInboundAt).getTime();
    const claimedAt = new Date(visit.attributionClaimedAt).getTime();
    if (!Number.isFinite(inboundAt) || !Number.isFinite(clickAt) || !Number.isFinite(claimedAt)
        || !Number.isFinite(claimInboundAt) || claimInboundAt > inboundAt || inboundAt > claimedAt
        || claimInboundAt - clickAt > 120000 || clickAt - claimInboundAt > 30000) {
        return reject('vit_qa_claim_time_mismatch');
    }
    return Object.freeze({ recognized: true, reason: 'official_vsl_vit_claimed_qa',
        productKey: 'vit_power_ec', sourceUrl: 'https://maxlien.shop/exutra',
        destinationPhone: '5531971862958', marker: 'EC-VIT-POWER-CLAIMED-QA',
        signature: 'Hola, vengo del video', visitId, messageId });
};

export const validateOfficialEcVslOriginContractV78 = ({
    sourceUrl,
    destinationPhone,
    message
} = {}) => {
    const recognition = recognizeOfficialEcVslEntryV78({
        text: message,
        destinationPhone,
        sourceUrl
    });
    if (!recognition.recognized) throw new Error(`official_vsl_origin_invalid:${recognition.reason}`);
    return recognition;
};
