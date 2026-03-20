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

    if (country === 'CO') {
        if (!digits.startsWith('57')) digits = `57${digits}`;
        return `+${digits}`;
    }
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
    if (country === 'CO') {
        return {
            pixelId: process.env.META_PIXEL_ID_CO,
            accessToken: process.env.META_ACCESS_TOKEN_CO
        };
    }
    if (country === 'EC') {
        return {
            pixelId: process.env.META_PIXEL_ID_EC,
            accessToken: process.env.META_ACCESS_TOKEN_EC
        };
    }
    return { pixelId: null, accessToken: null };
};

export const sendPurchaseEventForOrder = async (order) => {
    const country = order?.country;
    const { pixelId, accessToken } = getConfigForCountry(country);
    if (!pixelId || !accessToken) {
        return { ok: false, error: 'META pixel config missing for country' };
    }

    const eventId = order?.orderId;
    const now = Math.floor(Date.now() / 1000);

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
        fbp: order?.tracking?.fbp || undefined
    };

    // Remove empty keys
    for (const k of Object.keys(userData)) {
        const v = userData[k];
        if (v === undefined) delete userData[k];
        if (Array.isArray(v) && v.filter(Boolean).length === 0) delete userData[k];
    }

    const payload = {
        data: [
            {
                event_name: 'Purchase',
                event_time: now,
                event_id: eventId,
                action_source: 'website',
                event_source_url: order?.tracking?.sourceUrl || undefined,
                user_data: userData,
                custom_data: {
                    currency: order?.currency,
                    value: Number(order?.total || 0),
                    contents: [
                        {
                            id: String(order?.package?.id || ''),
                            quantity: Number(order?.package?.quantity || 1)
                        }
                    ],
                    content_type: 'product'
                }
            }
        ]
    };

    try {
        const url = `https://graph.facebook.com/v20.0/${pixelId}/events`;
        const response = await axios.post(url, payload, {
            params: { access_token: accessToken },
            timeout: 15000
        });

        return { ok: true, response: response.data, eventId };
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

