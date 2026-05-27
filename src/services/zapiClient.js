import axios from 'axios';
import fs from 'fs';
import path from 'path';

const DEFAULT_BASE_URL = 'https://api.z-api.io';

const clean = (value) => String(value || '').trim();
const digits = (value) => String(value || '').replace(/\D/g, '');

export const zapiConfig = () => {
    const instanceId = clean(process.env.ZAPI_INSTANCE_ID);
    const instanceToken = clean(process.env.ZAPI_INSTANCE_TOKEN || process.env.ZAPI_TOKEN);
    const clientToken = clean(process.env.ZAPI_CLIENT_TOKEN || process.env.ZAPI_ACCOUNT_SECURITY_TOKEN);
    const baseUrl = clean(process.env.ZAPI_BASE_URL) || DEFAULT_BASE_URL;

    return {
        baseUrl: baseUrl.replace(/\/+$/, ''),
        instanceId,
        instanceToken,
        clientToken,
        enabled: Boolean(instanceId && instanceToken && clientToken)
    };
};

const endpoint = (path) => {
    const cfg = zapiConfig();
    if (!cfg.enabled) {
        throw new Error('zapi_not_configured');
    }
    return `${cfg.baseUrl}/instances/${cfg.instanceId}/token/${cfg.instanceToken}/${path.replace(/^\/+/, '')}`;
};

const headers = () => ({
    'Client-Token': zapiConfig().clientToken,
    'Content-Type': 'application/json'
});

const normalizePhone = (phone) => {
    const value = digits(phone);
    if (!value) throw new Error('phone_required');
    return value;
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

export const sendZapiText = async ({ phone, message, messageId = '' }) => {
    const text = clean(message);
    if (!text) throw new Error('message_required');

    const payload = {
        phone: normalizePhone(phone),
        message: text
    };
    if (messageId) payload.messageId = clean(messageId);

    const response = await axios.post(endpoint('/send-text'), payload, {
        headers: headers(),
        timeout: Number(process.env.ZAPI_TIMEOUT_MS || 20000)
    });

    return response.data;
};

const mimeFromPath = (filePath = '') => {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.opus': 'audio/ogg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.webm': 'audio/webm',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime'
    };
    return map[ext] || 'application/octet-stream';
};

const asMediaPayload = (value) => {
    const source = clean(value);
    if (!source) throw new Error('media_required');
    if (/^https?:\/\//i.test(source) || /^data:/i.test(source)) return source;
    if (!fs.existsSync(source)) throw new Error(`media_not_found:${source}`);

    const b64 = fs.readFileSync(source).toString('base64');
    return `data:${mimeFromPath(source)};base64,${b64}`;
};

const sendZapiMedia = async ({ phone, endpointPath, mediaKey, media, caption = '', options = {} }) => {
    const payload = {
        phone: normalizePhone(phone),
        [mediaKey]: asMediaPayload(media)
    };
    if (caption) payload.caption = clean(caption);
    Object.assign(payload, options);

    const response = await axios.post(endpoint(endpointPath), payload, {
        headers: headers(),
        timeout: Number(process.env.ZAPI_MEDIA_TIMEOUT_MS || 60000)
    });

    return response.data;
};

export const sendZapiAudio = async ({ phone, audio, waveform = true, async = true }) => sendZapiMedia({
    phone,
    endpointPath: '/send-audio',
    mediaKey: 'audio',
    media: audio,
    options: { waveform, async }
});

export const sendZapiImage = async ({ phone, image, caption = '' }) => sendZapiMedia({
    phone,
    endpointPath: '/send-image',
    mediaKey: 'image',
    media: image,
    caption
});

export const sendZapiVideo = async ({ phone, video, caption = '' }) => sendZapiMedia({
    phone,
    endpointPath: '/send-video',
    mediaKey: 'video',
    media: video,
    caption
});

export const zapiPublicStatus = () => {
    const cfg = zapiConfig();
    const connectedPhone = digits(process.env.ZAPI_CONNECTED_PHONE);
    return {
        configured: cfg.enabled,
        baseUrl: cfg.baseUrl,
        instanceId: cfg.instanceId ? `${cfg.instanceId.slice(0, 6)}...${cfg.instanceId.slice(-4)}` : '',
        hasInstanceToken: Boolean(cfg.instanceToken),
        hasClientToken: Boolean(cfg.clientToken),
        connectedPhone: connectedPhone ? `${connectedPhone.slice(0, 4)}...${connectedPhone.slice(-4)}` : ''
    };
};
