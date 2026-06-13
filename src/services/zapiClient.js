import axios from 'axios';

const DEFAULT_BASE_URL = 'https://api.z-api.io';

const clean = (value) => String(value || '').trim();
const digits = (value) => String(value || '').replace(/\D/g, '');

export const zapiConfig = () => {
    const instanceId = clean(process.env.ZAPI_INSTANCE_ID);
    const instanceToken = clean(process.env.ZAPI_INSTANCE_TOKEN || process.env.ZAPI_TOKEN);
    const clientToken = clean(process.env.ZAPI_CLIENT_TOKEN || process.env.ZAPI_ACCOUNT_SECURITY_TOKEN);
    const baseUrl = (clean(process.env.ZAPI_BASE_URL) || DEFAULT_BASE_URL).replace(/\/+$/, '');

    return {
        baseUrl,
        instanceId,
        instanceToken,
        clientToken,
        enabled: Boolean(instanceId && instanceToken && clientToken)
    };
};

const endpoint = (path) => {
    const cfg = zapiConfig();
    if (!cfg.enabled) {
        const error = new Error('zapi_not_configured');
        error.statusCode = 503;
        throw error;
    }
    return `${cfg.baseUrl}/instances/${cfg.instanceId}/token/${cfg.instanceToken}/${path.replace(/^\/+/, '')}`;
};

const headers = () => ({
    'Client-Token': zapiConfig().clientToken,
    'Content-Type': 'application/json'
});

export const zapiPublicStatus = () => {
    const cfg = zapiConfig();
    return {
        enabled: cfg.enabled,
        baseUrl: cfg.baseUrl,
        instanceConfigured: Boolean(cfg.instanceId),
        tokenConfigured: Boolean(cfg.instanceToken),
        clientTokenConfigured: Boolean(cfg.clientToken)
    };
};

export const getZapiStatus = async () => {
    const response = await axios.get(endpoint('/status'), {
        headers: headers(),
        timeout: Number(process.env.ZAPI_TIMEOUT_MS || 15000)
    });
    return response.data;
};

export const getZapiDevice = async () => {
    const response = await axios.get(endpoint('/device'), {
        headers: headers(),
        timeout: Number(process.env.ZAPI_TIMEOUT_MS || 15000)
    });
    return response.data;
};

const boundedDelaySeconds = (value, fallback = null) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(15, Math.max(1, parsed));
};

export const sendZapiText = async ({ phone, message, messageId = '', delayMessage = null, delayTyping = null } = {}) => {
    const cleanPhone = digits(phone);
    const cleanMessage = clean(message);
    if (!cleanPhone || !cleanMessage) {
        const error = new Error('zapi_phone_and_message_required');
        error.statusCode = 400;
        throw error;
    }

    const payload = {
        phone: cleanPhone,
        message: cleanMessage
    };
    if (messageId) payload.messageId = clean(messageId);
    const safeDelayMessage = boundedDelaySeconds(delayMessage);
    const safeDelayTyping = boundedDelaySeconds(delayTyping);
    if (safeDelayMessage) payload.delayMessage = safeDelayMessage;
    if (safeDelayTyping) payload.delayTyping = safeDelayTyping;

    const response = await axios.post(endpoint('/send-text'), payload, {
        headers: headers(),
        timeout: Number(process.env.ZAPI_SEND_TIMEOUT_MS || process.env.ZAPI_TIMEOUT_MS || 20000)
    });
    return response.data;
};

export const normalizeZapiDevice = (device = {}) => {
    const phone = digits(device.phone || device.connectedPhone || device.device?.phone || '');
    return {
        phone,
        name: clean(device.name || device.device?.name || ''),
        isBusiness: Boolean(device.isBusiness),
        originalDevice: clean(device.originalDevice || ''),
        sessionName: clean(device.device?.sessionName || '')
    };
};
