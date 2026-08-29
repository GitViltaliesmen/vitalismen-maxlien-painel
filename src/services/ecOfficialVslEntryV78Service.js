export const EC_OFFICIAL_VSL_V78_URL = 'https://vilaliemen.shop/protocolo';
export const EC_OFFICIAL_VSL_V78_WHATSAPP = '5515991418416';
export const EC_OFFICIAL_VSL_V78_PRODUCT_KEY = 'tex_ultra_ec';
export const EC_OFFICIAL_VSL_V78_MARKER = 'EC-TEX-ULTRA-PROTOCOLO';
export const EC_OFFICIAL_VSL_V78_MESSAGE = `Hola, vengo de la presentación oficial de Tex Ultra. Ref: ${EC_OFFICIAL_VSL_V78_MARKER}`;

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
    const normalizedText = normalize(text);
    const expectedText = normalize(EC_OFFICIAL_VSL_V78_MESSAGE);
    if (normalizedText !== expectedText) {
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
        reason: 'official_vsl_signature_exact',
        sourceUrl: EC_OFFICIAL_VSL_V78_URL,
        destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP,
        productKey: EC_OFFICIAL_VSL_V78_PRODUCT_KEY,
        marker: EC_OFFICIAL_VSL_V78_MARKER
    });
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
