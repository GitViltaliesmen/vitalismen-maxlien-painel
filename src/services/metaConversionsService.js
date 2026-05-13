import axios from 'axios';
import crypto from 'crypto';

const normalize = (value) => String(value || '').trim().toLowerCase();

const sha256hex = (value) => {
    const v = normalize(value);
    if (!v) return null;
    return crypto.createHash('sha256').update(v).digest('hex');
};

const normalizePhoneE164 = ({ phone, country }) => {
    let digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;

    if (country === 'EC') {
        // If local starts with 0 (10 digits), drop 0
        if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
        if (!digits.startsWith('593')) digits = `593${digits}`;
        return `+${digits}`;
    }

    return `+${digits}`;
};

const splitName = (fullName) => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: null, lastName: null };
    if (parts.length === 1) return { firstName: parts[0], lastName: null };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const getConfigForCountry = (country) => {
    if (country === 'EC') {
        return {
            pixelId: process.env.META_PIXEL_ID_EC,
            accessToken: process.env.META_ACCESS_TOKEN_EC
        };
    }
    return { pixelId: null, accessToken: null };
};

const getActionSourceForOrder = (order) => (
    order?.source === 'whatsapp' ? 'business_messaging' : 'website'
);

export const getMetaConfigForCountry = getConfigForCountry;

export const hashMetaUserValue = sha256hex;

export const normalizeMetaPhoneE164 = normalizePhoneE164;

const cleanObject = (obj) => {
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value === undefined || value === null || value === '') delete obj[key];
        if (Array.isArray(value) && value.filter(Boolean).length === 0) delete obj[key];
    }
    return obj;
};

const toUnixSeconds = (value) => {
    if (!value) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 100000000000 ? Math.floor(value / 1000) : Math.floor(value);
    }
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    return Number.isFinite(time) ? Math.floor(time / 1000) : null;
};

export const buildPurchaseEventPayloadForOrder = (order, options = {}) => {
    const country = order?.country;
    const eventId = order?.orderId || order?._id?.toString();
    if (!eventId) {
        return { ok: false, error: 'META Purchase missing event_id' };
    }

    const value = Number(order?.total || 0);
    if (!Number.isFinite(value) || value <= 0) {
        return { ok: false, eventId, error: 'META Purchase missing positive value' };
    }

    const eventTime = toUnixSeconds(options.eventTime) || Math.floor(Date.now() / 1000);
    const actionSource = options.actionSource || getActionSourceForOrder(order);
    const quantity = Number(order?.package?.quantity || order?.package?.id || 1) || 1;
    const currency = order?.currency || 'USD';

    const { firstName, lastName } = splitName(order?.customer?.name);
    const phoneE164 = normalizePhoneE164({ phone: order?.customer?.phone, country });

    const userData = {
        fn: firstName ? [sha256hex(firstName)] : undefined,
        ln: lastName ? [sha256hex(lastName)] : undefined,
        ph: phoneE164 ? [sha256hex(phoneE164)] : undefined,
        ct: order?.customer?.city ? [sha256hex(order.customer.city)] : undefined,
        st: order?.customer?.province ? [sha256hex(order.customer.province)] : undefined,
        country: country ? [sha256hex(country)] : undefined,
        client_ip_address: order?.tracking?.ip || undefined,
        client_user_agent: order?.tracking?.userAgent || undefined,
        fbc: order?.tracking?.fbc || undefined,
        fbp: order?.tracking?.fbp || undefined,
        external_id: order?.tracking?.ext_id ? [sha256hex(order.tracking.ext_id)] : undefined
    };

    cleanObject(userData);

    if (!Object.keys(userData).length) {
        return { ok: false, eventId, error: 'META Purchase missing user_data' };
    }

    const payload = {
        data: [
            {
                event_name: 'Purchase',
                event_time: eventTime,
                event_id: eventId,
                action_source: actionSource,
                event_source_url: actionSource === 'website' ? order?.tracking?.sourceUrl || undefined : undefined,
                user_data: userData,
                custom_data: {
                    currency,
                    value,
                    order_id: order?.orderId,
                    content_name: 'Vit Power Ecuador',
                    content_ids: ['vit_power_ec'],
                    contents: [
                        {
                            id: 'vit_power_ec',
                            quantity,
                            item_price: Number((value / quantity).toFixed(2))
                        }
                    ],
                    content_type: 'product'
                }
            }
        ]
    };

    const testEventCode = String(options.testEventCode || process.env.META_TEST_EVENT_CODE_EC || process.env.META_TEST_EVENT_CODE || '').trim();
    if (testEventCode) payload.test_event_code = testEventCode;

    return { ok: true, payload, eventId, eventTime };
};

export const sendPurchaseEventForOrder = async (order, options = {}) => {
    const country = order?.country;
    const { pixelId, accessToken } = getConfigForCountry(country);
    if (!pixelId || !accessToken) {
        return { ok: false, error: 'META pixel config missing for country' };
    }

    const built = buildPurchaseEventPayloadForOrder(order, options);
    if (!built.ok) return built;
    const { payload, eventId, eventTime } = built;

    if (options.dryRun) {
        return { ok: true, dryRun: true, payload, eventId, eventTime };
    }

    try {
        const apiVersion = process.env.META_CAPI_API_VERSION || 'v20.0';
        const url = `https://graph.facebook.com/${apiVersion}/${pixelId}/events`;
        const response = await axios.post(url, payload, {
            params: { access_token: accessToken },
            timeout: 15000
        });

        return { ok: true, response: response.data, eventId, eventTime };
    } catch (e) {
        const status = e?.response?.status;
        const data = e?.response?.data;
        return {
            ok: false,
            eventId,
            error: 'META CAPI request failed',
            status,
            data
        };
    }
};
