import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { assertTransportPersistenceAllowed } from './strictReadOnlyObservationService.js';
import { assertCanaryV75Recipient } from './canaryIsolationV75Service.js';
import { assertEcBotCoreExternalEffectAllowedV78 } from './ecBotCoreRuntimeIntegrationV78Service.js';

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

export const getZapiChats = async ({ page = 1, pageSize = 80 } = {}) => {
    const response = await axios.get(endpoint('/chats'), {
        headers: headers(),
        timeout: Number(process.env.ZAPI_TIMEOUT_MS || 15000),
        params: {
            page: Math.max(1, Number.parseInt(String(page || 1), 10) || 1),
            pageSize: Math.min(200, Math.max(1, Number.parseInt(String(pageSize || 80), 10) || 80))
        }
    });
    return response.data;
};

const boundedDelaySeconds = (value, fallback = null) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(15, Math.max(1, parsed));
};

export const sendZapiText = async ({ phone, message, messageId = '', delayMessage = null, delayTyping = null } = {}) => {
    assertEcBotCoreExternalEffectAllowedV78('zapi_outbound_reply');
    assertTransportPersistenceAllowed({ transport: 'zapi', operation: 'send_text' });
    const cleanPhone = digits(phone);
    const cleanMessage = clean(message);
    if (!cleanPhone || !cleanMessage) {
        const error = new Error('zapi_phone_and_message_required');
        error.statusCode = 400;
        throw error;
    }
    assertCanaryV75Recipient(cleanPhone, { surface: 'zapi_provider_text' });

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

const mimeFromFilePath = (filePath = '', fallback = 'application/octet-stream') => {
    const ext = path.extname(String(filePath || '')).toLowerCase();
    const map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.heic': 'image/heic',
        '.heif': 'image/heif',
        '.mp3': 'audio/mpeg',
        '.mpeg': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.opus': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.wav': 'audio/wav',
        '.webm': 'video/webm',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return map[ext] || fallback;
};

const mediaValue = ({ media = '', filePath = '', mime = '' } = {}) => {
    const value = clean(media);
    if (/^https?:\/\//i.test(value)) {
        try {
            const parsed = new URL(value);
            if (parsed.protocol !== 'https:' || !parsed.hostname) throw new Error('invalid');
        } catch {
            const error = new Error('zapi_media_url_invalid_or_insecure');
            error.statusCode = 400;
            throw error;
        }
        return value;
    }
    if (value.startsWith('data:')) {
        if (!/^data:[^;,]+;base64,[a-z0-9+/]+=*$/i.test(value)) {
            const error = new Error('zapi_media_data_url_invalid');
            error.statusCode = 400;
            throw error;
        }
        return value;
    }
    const resolved = filePath || value;
    if (!resolved || !fs.existsSync(resolved)) {
        const error = new Error('zapi_media_file_not_found');
        error.statusCode = 400;
        throw error;
    }
    const finalMime = clean(mime) || mimeFromFilePath(resolved);
    return `data:${finalMime};base64,${fs.readFileSync(resolved).toString('base64')}`;
};

const assertMediaKind = (options = {}, expectedKind = '') => {
    const rawMedia = clean(options.media);
    if (/^https:\/\//i.test(rawMedia)) return;
    let mime = clean(options.mime).split(';')[0].toLowerCase();
    if (!mime && rawMedia.startsWith('data:')) mime = clean(rawMedia.slice(5).split(/[;,]/)[0]).toLowerCase();
    const localPath = options.filePath || (!rawMedia.startsWith('data:') ? rawMedia : '');
    if (!mime && localPath) mime = mimeFromFilePath(localPath);
    if (!mime.startsWith(`${expectedKind}/`)) {
        const error = new Error('zapi_media_mime_mismatch');
        error.statusCode = 400;
        throw error;
    }
};

const sendZapiMedia = async ({
    pathName,
    payloadKey,
    phone,
    media = '',
    filePath = '',
    mime = '',
    caption = '',
    fileName = '',
    extension = '',
    messageId = '',
    delayMessage = null,
    delayTyping = null,
    viewOnce = false,
    waveform = false,
    async = false
} = {}) => {
    assertEcBotCoreExternalEffectAllowedV78('zapi_outbound_reply');
    assertTransportPersistenceAllowed({ transport: 'zapi', operation: `send_${payloadKey || 'media'}` });
    const cleanPhone = digits(phone);
    if (!cleanPhone) {
        const error = new Error('zapi_phone_required');
        error.statusCode = 400;
        throw error;
    }
    assertCanaryV75Recipient(cleanPhone, { surface: `zapi_provider_${payloadKey || 'media'}` });
    const payload = {
        phone: cleanPhone,
        [payloadKey]: mediaValue({ media, filePath, mime })
    };
    if (caption) payload.caption = clean(caption);
    if (fileName) payload.fileName = clean(fileName);
    if (messageId) payload.messageId = clean(messageId);
    const safeDelayMessage = boundedDelaySeconds(delayMessage);
    const safeDelayTyping = boundedDelaySeconds(delayTyping);
    if (safeDelayMessage) payload.delayMessage = safeDelayMessage;
    if (safeDelayTyping) payload.delayTyping = safeDelayTyping;
    if (viewOnce) payload.viewOnce = true;
    if (waveform) payload.waveform = true;
    if (async) payload.async = true;

    const response = await axios.post(endpoint(pathName.replace('{extension}', clean(extension))), payload, {
        headers: headers(),
        timeout: Number(process.env.ZAPI_SEND_TIMEOUT_MS || process.env.ZAPI_TIMEOUT_MS || 20000)
    });
    return response.data;
};

export const sendZapiAudio = (options = {}) => {
    assertMediaKind(options, 'audio');
    return sendZapiMedia({
        ...options,
        pathName: '/send-audio',
        payloadKey: 'audio'
    });
};

export const sendZapiImage = (options = {}) => {
    assertMediaKind(options, 'image');
    return sendZapiMedia({
        ...options,
        pathName: '/send-image',
        payloadKey: 'image'
    });
};

export const sendZapiVideo = (options = {}) => {
    assertMediaKind(options, 'video');
    return sendZapiMedia({
        ...options,
        pathName: '/send-video',
        payloadKey: 'video'
    });
};

export const sendZapiDocument = (options = {}) => {
    const extension = clean(options.extension || path.extname(String(options.filePath || options.media || '')).slice(1) || 'bin');
    return sendZapiMedia({
        ...options,
        extension,
        pathName: '/send-document/{extension}',
        payloadKey: 'document'
    });
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
