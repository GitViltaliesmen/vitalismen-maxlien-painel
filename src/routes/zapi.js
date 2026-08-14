import express from 'express';
import {
    getZapiDevice,
    getZapiStatus,
    normalizeZapiDevice,
    zapiPublicStatus
} from '../services/zapiClient.js';
import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';
import { routeIncomingMessage } from '../services/agentRouter.js';
import { handleBuyLaterConfirmationReply } from '../services/buyLaterConfirmationService.js';
import { claimMetaAttributionForInboundWhatsapp } from '../services/metaAttributionBridgeService.js';
import crypto from 'crypto';

const router = express.Router();
const digits = (value) => String(value || '').replace(/\D/g, '');

const exposeError = (error) => ({
    ok: false,
    error: error?.response?.data || error.message || 'zapi_error',
    status: error?.response?.status || error.statusCode || null
});

const connectedFromStatus = (status = {}) => (
    status.connected === true
    || status.smartphoneConnected === true
    || status.session === true
    || String(status.status || '').toLowerCase() === 'connected'
);

const firstString = (...values) => values
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';

const firstPlainString = (...values) => values
    .filter((value) => ['string', 'number', 'boolean'].includes(typeof value))
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';

const countryFromPhone = (phone = '') => {
    const value = digits(phone);
    if (value.startsWith('593')) return 'EC';
    if (value.startsWith('55')) return 'BR';
    return 'OTHER';
};

export const authorizedVslTestRecipient = (phone = '', env = process.env) => {
    const target = digits(phone);
    if (!target) return false;
    const allowed = [
        env.WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS,
        env.WHATSAPP_TEST_ALLOWED_RECIPIENTS
    ]
        .flatMap((value) => String(value || '').split(','))
        .map(digits)
        .filter(Boolean);
    return allowed.includes(target);
};

const looksLikePublicVslLeadText = (text = '') => {
    const value = String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    return /acabo de ver el video|vi el video|ver el video/.test(value)
        && (/nombre completo|telefono|tel[eé]fono/.test(value));
};

const EC_TEX_ULTRA_VSL_AB_TEST_ID = 'ab-6a5976494d4b86598b3690f9';
const EC_TEX_ULTRA_VSL_AB_MESSAGES = {
    a: 'Hola, quiero saber mas sobre Tex Ultra.',
    b: 'Hola, deseo recibir mas informacion sobre el producto.'
};
const EC_TEX_ULTRA_CURRENT_MESSAGES = [
    'Hola, vengo de la presentacion de Tex Ultra',
    'Hola, quiero conocer la promocion de Tex Ultra',
    'Hola, vi la informacion de Tex Ultra',
    'Hola, deseo saber mas sobre Tex Ultra'
];

const EC_VSL_PRODUCT_PROFILES = Object.freeze({
    tex_ultra_ec: {
        productKey: 'tex_ultra_ec',
        productName: 'Tex Ultra Ecuador',
        productMedia: '/media/sales/ec/tex_ultra.png',
        productTag: 'TEX_ULTRA_EC'
    },
    nitrix_ec: {
        productKey: 'nitrix_ec',
        productName: 'Nitrix Oxide Ecuador',
        productMedia: '/media/sales/ec/nitrix_bottle.png',
        productTag: 'NITRIX_EC'
    },
    vit_power_ec: {
        productKey: 'vit_power_ec',
        productName: 'Vit Power Ecuador',
        productMedia: '/media/sales/ec/vit_power.jpeg',
        productTag: 'VIT_POWER_EC'
    }
});
const EC_VSL_PRODUCT_TAGS = new Set(Object.values(EC_VSL_PRODUCT_PROFILES).map((profile) => profile.productTag));
const AUTOMATED_EC_VSL_PRODUCT_KEYS = new Set(['tex_ultra_ec', 'nitrix_ec', 'vit_power_ec']);

export const automatedEcVslProductKey = (productKey = '') => (
    AUTOMATED_EC_VSL_PRODUCT_KEYS.has(String(productKey || '').trim().toLowerCase())
);

export const canPromoteAutomatedVslEntry = ({
    isNewState = false,
    automatedVslProduct = false,
    humanMode = '',
    lastManualBy = '',
    storedProductKey = '',
    incomingProductKey = ''
} = {}) => {
    if (isNewState || !automatedVslProduct || humanMode !== 'manual') return false;
    if (!['vsl_ec', 'nitrix_vsl_entry_ready', 'tex_ultra_vsl_entry_ready', 'zapi_watchdog'].includes(lastManualBy)) {
        return false;
    }
    const stored = String(storedProductKey || '').trim().toLowerCase();
    const incoming = String(incomingProductKey || '').trim().toLowerCase();
    return Boolean(incoming) && (!stored || stored === incoming);
};

const normalizeVslText = (text = '') => String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ACTIVE_VSL_GENERIC_ENTRY_PATTERNS = Object.freeze([
    /^hola quiero el tratamiento(?: buenos dias| buenas tardes| buenas noches)?$/,
    /^hola deseo el tratamiento(?: buenos dias| buenas tardes| buenas noches)?$/,
    /^hola (?:quiero|deseo) el tratamiento(?: buenos dias| buenas tardes| buenas noches)? (?:de )?[1236] frascos?(?: \d{1,3}(?: \d{1,2})?)?$/
]);

export const activeEcVslProductContextFromText = (text = '', env = process.env) => {
    const value = normalizeVslText(text);
    if (!ACTIVE_VSL_GENERIC_ENTRY_PATTERNS.some((pattern) => pattern.test(value))) return null;
    const productKey = String(env.VITALISMEN_ACTIVE_VSL_PRODUCT || '').trim().toLowerCase();
    const profile = EC_VSL_PRODUCT_PROFILES[productKey];
    if (!profile) return null;
    return {
        ...profile,
        productSource: 'active_vsl_generic_entry',
        vslTestId: '',
        vslVariant: 'active_product',
        vslEntryMessage: String(text || '').trim()
    };
};

export const explicitEcVslProductContextFromText = (text = '') => {
    const value = normalizeVslText(text);
    if (!value) return null;
    if (/\bnitrix\b|oxido nitrico/.test(value)) {
        return {
            ...EC_VSL_PRODUCT_PROFILES.nitrix_ec,
            productSource: 'zapi_explicit_product_text',
            vslTestId: '',
            vslVariant: '',
            vslEntryMessage: String(text || '').trim()
        };
    }
    if (/\bvit power\b|\bvitpower\b/.test(value)) {
        return {
            ...EC_VSL_PRODUCT_PROFILES.vit_power_ec,
            productSource: 'zapi_explicit_product_text',
            vslTestId: '',
            vslVariant: '',
            vslEntryMessage: String(text || '').trim()
        };
    }
    const normalizedMessages = Object.entries(EC_TEX_ULTRA_VSL_AB_MESSAGES)
        .map(([variant, message]) => [variant, normalizeVslText(message)]);
    const abMatch = normalizedMessages.find(([, message]) => value === message || value.startsWith(`${message} `));
    if (abMatch) {
        const [variant] = abMatch;
        return {
            ...EC_VSL_PRODUCT_PROFILES.tex_ultra_ec,
            productSource: 'zapi_public_tex_ultra_entry',
            vslTestId: EC_TEX_ULTRA_VSL_AB_TEST_ID,
            vslVariant: variant,
            vslEntryMessage: EC_TEX_ULTRA_VSL_AB_MESSAGES[variant]
        };
    }
    const currentMessage = EC_TEX_ULTRA_CURRENT_MESSAGES.find((message) => normalizeVslText(message) === value);
    if (currentMessage || /\btex ultra\b/.test(value)) {
        return {
            ...EC_VSL_PRODUCT_PROFILES.tex_ultra_ec,
            productSource: 'zapi_explicit_product_text',
            vslTestId: '',
            vslVariant: '',
            vslEntryMessage: currentMessage || String(text || '').trim()
        };
    }
    const activeProductContext = activeEcVslProductContextFromText(text);
    if (activeProductContext) return activeProductContext;
    return null;
};

export const ecTexUltraVslContextFromText = (text = '') => {
    const context = explicitEcVslProductContextFromText(text);
    return context?.productKey === 'tex_ultra_ec' ? context : null;
};

export const freshPersistedEcVslProductContext = (state = {}, now = new Date()) => {
    const productKey = String(state?.metadata?.vslProductKey || '').trim().toLowerCase();
    const profile = EC_VSL_PRODUCT_PROFILES[productKey];
    if (!profile) return null;
    const attributionAt = new Date(state?.metadata?.vslEntryPanelLeadAt || 0);
    if (Number.isNaN(attributionAt.getTime())) return null;
    const configuredHours = Number.parseFloat(process.env.VSL_PRODUCT_ATTRIBUTION_TTL_HOURS || '72');
    const ttlHours = Number.isFinite(configuredHours) && configuredHours > 0 ? configuredHours : 72;
    if (now.getTime() - attributionAt.getTime() > ttlHours * 60 * 60 * 1000) return null;
    return {
        ...profile,
        productName: String(state?.metadata?.vslProductName || profile.productName).trim(),
        productSource: 'persisted_authoritative_vsl_attribution',
        vslTestId: String(state?.metadata?.vslTestId || '').trim(),
        vslVariant: String(state?.metadata?.vslVariant || '').trim(),
        vslEntryMessage: String(state?.metadata?.vslEntryMessage || '').trim()
    };
};

const zapiRawChatIdentifiers = (payload = {}) => [
    payload.chatId,
    payload.remoteJid,
    payload.from,
    payload.phone,
    payload.sender,
    payload.to,
    payload.message?.chatId,
    payload.message?.remoteJid,
    payload.message?.from,
    payload.message?.phone,
    payload.message?.sender,
    payload.data?.chatId,
    payload.data?.remoteJid,
    payload.data?.from,
    payload.data?.phone,
    payload.data?.sender
].map((value) => String(value || '').trim()).filter(Boolean);

export const zapiPayloadCountry = (payload = {}) => {
    const candidates = [
        ...zapiRawChatIdentifiers(payload),
        payload.senderPhone,
        payload.customerPhone,
        payload.chat?.phone,
        payload.message?.senderPhone,
        payload.data?.senderPhone
    ];
    for (const candidate of candidates) {
        const country = countryFromPhone(candidate);
        if (country === 'EC') return country;
    }
    return countryFromPhone(zapiPhoneFromPayload(payload));
};

const isAllowedEcuadorInboundPayload = (payload = {}) => {
    if (zapiPayloadCountry(payload) === 'EC') return true;
    return authorizedVslTestRecipient(zapiPhoneFromPayload(payload));
};

const isLikelyWhatsAppGroupIdentifier = (value = '') => {
    const raw = String(value || '').trim();
    const numeric = digits(raw);
    return raw.includes('@g.us') || /^120363\d{6,}$/.test(numeric);
};

const zapiInboundLooksLikeGroup = (payload = {}, phone = '') => (
    payload.isGroup === true
    || payload.group === true
    || payload.chat?.isGroup === true
    || payload.message?.isGroup === true
    || payload.data?.isGroup === true
    || isLikelyWhatsAppGroupIdentifier(phone)
    || zapiRawChatIdentifiers(payload).some(isLikelyWhatsAppGroupIdentifier)
);

const zapiMessageIdFromPayload = (payload = {}) => firstString(
    payload.messageId,
    payload.id,
    payload.key?.id,
    payload.message?.messageId,
    payload.message?.id,
    payload.message?.key?.id,
    payload.data?.messageId,
    payload.data?.id
);

const zapiZaapIdFromPayload = (payload = {}) => firstString(
    payload.zaapId,
    payload.message?.zaapId,
    payload.data?.zaapId
);

const zapiPhoneFromPayload = (payload = {}) => digits(firstString(
    payload.phone,
    payload.from,
    payload.to,
    payload.sender,
    payload.chatId,
    payload.remoteJid,
    payload.message?.phone,
    payload.message?.from,
    payload.message?.to,
    payload.data?.phone,
    payload.data?.from,
    payload.data?.to
));

const zapiFromMeFromPayload = (payload = {}) => (
    payload.fromMe === true
    || payload.message?.fromMe === true
    || payload.data?.fromMe === true
    || payload.key?.fromMe === true
    || payload.message?.key?.fromMe === true
);

const zapiTextFromPayload = (payload = {}) => firstPlainString(
    payload.text?.message,
    payload.text,
    payload.caption,
    payload.image?.caption,
    payload.video?.caption,
    payload.document?.caption,
    payload.sticker?.caption,
    payload.message?.text?.message,
    payload.message?.text,
    payload.message?.body,
    payload.body,
    payload.message,
    payload.data?.text?.message,
    payload.data?.text,
    payload.data?.body,
    payload.data?.message
);

const zapiMediaUrlFromPayload = (payload = {}) => firstString(
    payload.mediaUrl,
    payload.media?.url,
    payload.url,
    payload.fileUrl,
    payload.downloadUrl,
    payload.image?.imageUrl,
    payload.image?.url,
    payload.image?.mediaUrl,
    payload.photo?.url,
    payload.audio?.audioUrl,
    payload.audio?.url,
    payload.audio?.mediaUrl,
    payload.video?.videoUrl,
    payload.video?.url,
    payload.video?.mediaUrl,
    payload.document?.documentUrl,
    payload.document?.url,
    payload.document?.mediaUrl,
    payload.sticker?.stickerUrl,
    payload.sticker?.url,
    payload.sticker?.mediaUrl,
    payload.message?.mediaUrl,
    payload.message?.image?.imageUrl,
    payload.message?.image?.url,
    payload.message?.audio?.audioUrl,
    payload.message?.audio?.url,
    payload.message?.video?.videoUrl,
    payload.message?.video?.url,
    payload.message?.document?.documentUrl,
    payload.message?.document?.url,
    payload.message?.sticker?.stickerUrl,
    payload.message?.sticker?.url,
    payload.data?.mediaUrl,
    payload.data?.image?.imageUrl,
    payload.data?.image?.url,
    payload.data?.audio?.audioUrl,
    payload.data?.audio?.url,
    payload.data?.video?.videoUrl,
    payload.data?.video?.url,
    payload.data?.document?.documentUrl,
    payload.data?.document?.url,
    payload.data?.sticker?.stickerUrl,
    payload.data?.sticker?.url
);

const zapiMediaMimeTypeFromPayload = (payload = {}) => firstString(
    payload.mimeType,
    payload.mimetype,
    payload.media?.mimeType,
    payload.media?.mimetype,
    payload.image?.mimeType,
    payload.image?.mimetype,
    payload.audio?.mimeType,
    payload.audio?.mimetype,
    payload.video?.mimeType,
    payload.video?.mimetype,
    payload.document?.mimeType,
    payload.document?.mimetype,
    payload.message?.mimeType,
    payload.message?.mimetype,
    payload.message?.image?.mimeType,
    payload.message?.image?.mimetype,
    payload.message?.audio?.mimeType,
    payload.message?.audio?.mimetype,
    payload.message?.video?.mimeType,
    payload.message?.video?.mimetype,
    payload.message?.document?.mimeType,
    payload.message?.document?.mimetype,
    payload.data?.mimeType,
    payload.data?.mimetype,
    payload.data?.image?.mimeType,
    payload.data?.image?.mimetype,
    payload.data?.audio?.mimeType,
    payload.data?.audio?.mimetype,
    payload.data?.video?.mimeType,
    payload.data?.video?.mimetype,
    payload.data?.document?.mimeType,
    payload.data?.document?.mimetype
);

const zapiMediaTypeFromUrlOrMime = (url = '', mime = '') => {
    const mediaUrl = String(url || '').toLowerCase();
    const mediaMime = String(mime || '').toLowerCase();
    if (/^audio\//.test(mediaMime) || /\.(mp3|ogg|opus|webm|m4a|aac|wav)(\?|#|$)/.test(mediaUrl)) return 'audio';
    if (/^image\//.test(mediaMime) || /\.(jpe?g|png|webp|gif|heic|heif)(\?|#|$)/.test(mediaUrl)) return 'image';
    if (/^video\//.test(mediaMime) || /\.(mp4|mov|m4v|avi|mkv)(\?|#|$)/.test(mediaUrl)) return 'video';
    if (/^(application|text)\//.test(mediaMime) || /\.(pdf|docx?|xlsx?|csv|txt)(\?|#|$)/.test(mediaUrl)) return 'document';
    return '';
};

const zapiBodyLooksLikeMediaToken = (body = '') => (
    /^\s*\[(audio|ptt|image|imagem|video|media|midia|document|documento|sticker|figurinha)\]\s*$/i.test(String(body || ''))
);

const zapiMessageTypeFromPayload = (payload = {}) => {
    const mediaType = zapiMediaTypeFromUrlOrMime(zapiMediaUrlFromPayload(payload), zapiMediaMimeTypeFromPayload(payload));
    if (mediaType) return mediaType;
    if (payload.sticker || payload.message?.sticker || payload.data?.sticker) return 'image';
    if (payload.image || payload.photo || payload.message?.image || payload.data?.image) return 'image';
    if (payload.audio || payload.message?.audio || payload.data?.audio) return 'audio';
    if (payload.video || payload.message?.video || payload.data?.video) return 'video';
    if (payload.document || payload.file || payload.message?.document || payload.data?.document) return 'document';
    const raw = firstString(
        payload.type,
        payload.messageType,
        payload.mediaType,
        payload.message?.type,
        payload.message?.messageType,
        payload.data?.type,
        payload.data?.messageType
    ).toLowerCase();
    if (/audio|ptt/.test(raw)) return 'audio';
    if (/image|photo/.test(raw)) return 'image';
    if (/video/.test(raw)) return 'video';
    if (/document|file/.test(raw)) return 'document';
    if (/sticker|figurinha/.test(raw)) return 'image';
    return 'chat';
};

const vslFirstResponseWatchdogEnabled = () => (
    String(process.env.VSL_FIRST_RESPONSE_WATCHDOG_ENABLED || 'true').toLowerCase() !== 'false'
);

const vslFirstResponseWatchdogDelayMs = () => {
    const parsed = Number.parseInt(String(process.env.VSL_FIRST_RESPONSE_WATCHDOG_DELAY_MS || '75000'), 10);
    return Number.isFinite(parsed) && parsed >= 15000 ? parsed : 75000;
};

export const hasOutboundMarkerSince = (value, since = new Date()) => {
    const sinceMs = since instanceof Date ? since.getTime() : new Date(since).getTime();
    if (!Number.isFinite(sinceMs) || !value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, nested]) => {
        if (/(?:sent|outbound)At$/i.test(key)) {
            const markerMs = new Date(nested || 0).getTime();
            if (Number.isFinite(markerMs) && markerMs >= sinceMs) return true;
        }
        if (!nested || typeof nested !== 'object') return false;
        return hasOutboundMarkerSince(nested, since);
    });
};

const hasRecentOutboundForZapiLead = async ({ chatId = '', phone = '', since = new Date() } = {}) => {
    const tail = phone && phone.length >= 9 ? phone.slice(-9) : '';
    const or = [
        chatId ? { chatId } : null,
        phone ? { peerPhone: phone } : null,
        phone ? { to: { $regex: phone } } : null,
        phone ? { chatId: { $regex: phone } } : null,
        tail ? { peerPhone: { $regex: `${tail}$` } } : null,
        tail ? { to: { $regex: tail } } : null,
        tail ? { chatId: { $regex: tail } } : null
    ].filter(Boolean);
    if (!or.length) return false;
    const state = await ContactState.findOne({ $or: [
        chatId ? { chatId } : null,
        phone ? { phoneDigits: phone } : null,
        tail ? { phoneDigits: { $regex: `${tail}$` } } : null
    ].filter(Boolean) })
        .sort({ updatedAt: -1 })
        .select({ 'metadata.perAgentMemory': 1 })
        .lean()
        .catch(() => null);
    if (hasOutboundMarkerSince(state?.metadata?.perAgentMemory, since)) return true;
    const sinceDate = since instanceof Date ? since : new Date(since);
    const sinceTimestamp = Math.floor(sinceDate.getTime() / 1000);
    const found = await Message.exists({
        $and: [
            { $or: or },
            { $or: [{ isFromMe: true }, { isBot: true }, { from: 'bot' }] },
            {
                $or: [
                    { createdAt: { $gte: sinceDate } },
                    { timestamp: { $gte: sinceTimestamp } }
                ]
            }
        ]
    }).catch(() => null);
    return Boolean(found);
};

const deliveryRank = (status = '', ack = 0) => {
    const value = String(status || '').toLowerCase();
    const numericAck = Number(ack);
    if (value === 'read' || value === 'played' || numericAck >= 3) return 3;
    if (value === 'delivered' || numericAck === 2) return 2;
    if (['sent', 'pending_confirmation'].includes(value) || numericAck === 1) return 1;
    if (['failed', 'error', 'final_failed'].includes(value) || numericAck < 0) return -1;
    return 0;
};

const shouldPreserveExistingDelivery = (message, normalized) => {
    const existingRank = deliveryRank(message?.deliveryStatus, message?.ack);
    const incomingRank = deliveryRank(normalized?.deliveryStatus, normalized?.ack);
    return existingRank >= 2 && existingRank > incomingRank;
};

const applyDeliveryUpdateToMessage = async (message, updateSet, normalized, now) => {
    if (!message) return false;
    const preserveExisting = shouldPreserveExistingDelivery(message, normalized);
    const existingRank = deliveryRank(message.deliveryStatus, message.ack);
    const incomingRank = deliveryRank(normalized.deliveryStatus, normalized.ack);
    Object.assign(message, {
        ...updateSet,
        providerStatus: preserveExisting ? (message.providerStatus || updateSet.providerStatus) : updateSet.providerStatus,
        deliveryStatus: preserveExisting ? message.deliveryStatus : normalized.deliveryStatus,
        ack: Math.max(Number(message.ack || 0), Number(normalized.ack || 0)),
        sendError: preserveExisting ? (message.sendError || '') : normalized.sendError
    });
    if (incomingRank >= 2 || existingRank >= 2) {
        message.deliveredAt = message.deliveredAt || now;
    }
    if (incomingRank >= 3 || existingRank >= 3) {
        message.readAt = message.readAt || now;
    }
    await message.save();
    return true;
};

const markPreviousOutboundReadFromCustomerReply = async ({ chatId = '', phone = '', inboundAt = new Date() } = {}) => {
    const tail = phone && phone.length >= 9 ? phone.slice(-9) : '';
    const or = [
        chatId ? { chatId } : null,
        phone ? { peerPhone: phone } : null,
        phone ? { to: { $regex: phone } } : null,
        tail ? { peerPhone: { $regex: `${tail}$` } } : null,
        tail ? { to: { $regex: tail } } : null,
        tail ? { chatId: { $regex: tail } } : null
    ].filter(Boolean);
    if (!or.length) return { matched: 0, modified: 0 };
    const result = await Message.updateMany(
        {
            $or: or,
            isFromMe: true,
            createdAt: {
                $gte: new Date(inboundAt.getTime() - 14 * 24 * 60 * 60 * 1000),
                $lte: inboundAt
            },
            deliveryStatus: {
                $nin: ['read', 'played', 'failed', 'error', 'final_failed', 'unconfirmed', 'local_only', 'system']
            }
        },
        {
            $set: {
                deliveryStatus: 'read',
                providerStatus: 'inferred_read_from_customer_reply',
                ack: 3,
                readAt: inboundAt,
                readInferredAt: inboundAt
            },
            $setOnInsert: {}
        }
    ).catch((error) => {
        console.warn(`[ZAPI-READ-INFER] falha ao marcar leitura inferida -> ${chatId || phone}: ${error.message}`);
        return { matchedCount: 0, modifiedCount: 0 };
    });
    return {
        matched: result.matchedCount || 0,
        modified: result.modifiedCount || 0
    };
};

const markVslWatchdogStatus = async ({ chatId = '', phone = '', status = '', reason = '' } = {}) => {
    const now = new Date();
    const tail = phone && phone.length >= 9 ? phone.slice(-9) : '';
    const or = [
        chatId ? { chatId } : null,
        phone ? { phoneDigits: phone } : null,
        phone ? { phoneDigits: { $regex: `${phone}$` } } : null,
        tail ? { phoneDigits: { $regex: `${tail}$` } } : null
    ].filter(Boolean);
    if (!or.length) return;
    await ContactState.updateOne(
        { $or: or },
        {
            $set: {
                'metadata.vslFirstResponseWatchdogAt': now,
                'metadata.vslFirstResponseWatchdogStatus': status,
                'metadata.vslFirstResponseWatchdogReason': reason
            },
            ...(status === 'reprocessed'
                ? { $inc: { 'metadata.vslFirstResponseWatchdogReprocessCount': 1 } }
                : {})
        }
    ).catch((error) => console.warn(`[ZAPI-WATCHDOG] falha ao registrar status ${chatId}: ${error.message}`));
};

const scheduleVslFirstResponseWatchdog = (result = {}) => {
    if (!vslFirstResponseWatchdogEnabled() || !result.publicVslLeadEntry || !result.routeToBot) return;
    const startedAt = new Date();
    const delayMs = vslFirstResponseWatchdogDelayMs();
    setTimeout(async () => {
        try {
            const alreadyAnswered = await hasRecentOutboundForZapiLead({
                chatId: result.chatId,
                phone: result.phone,
                since: startedAt
            });
            if (alreadyAnswered) {
                await markVslWatchdogStatus({
                    chatId: result.chatId,
                    phone: result.phone,
                    status: 'answered',
                    reason: 'outbound_found'
                });
                return;
            }

            console.warn(`[ZAPI-WATCHDOG] lead VSL sem resposta; reprocessando por Z-API -> ${result.chatId} | delayMs=${delayMs}`);
            await markVslWatchdogStatus({
                chatId: result.chatId,
                phone: result.phone,
                status: 'reprocessing',
                reason: 'no_outbound_after_delay'
            });
            await routeIncomingMessage({
                id: `${result.messageId || 'zapi_vsl'}_watchdog_${Date.now()}`,
                from: result.chatId,
                body: result.body,
                sessionId: 'zapi',
                senderPn: result.phone,
                recovered: true,
                fullMessage: { key: { senderPn: result.phone } }
            });
            const answeredAfterRecovery = await hasRecentOutboundForZapiLead({
                chatId: result.chatId,
                phone: result.phone,
                since: startedAt
            });
            await markVslWatchdogStatus({
                chatId: result.chatId,
                phone: result.phone,
                status: answeredAfterRecovery ? 'reprocessed' : 'failed',
                reason: answeredAfterRecovery ? 'outbound_after_reprocess' : 'no_outbound_after_reprocess'
            });
        } catch (error) {
            console.error('[ZAPI-WATCHDOG] erro ao recuperar primeira resposta VSL:', error?.response?.data || error.message || error);
            await markVslWatchdogStatus({
                chatId: result.chatId,
                phone: result.phone,
                status: 'failed',
                reason: error.message || 'watchdog_error'
            });
        }
    }, delayMs).unref?.();
};

const recordZapiInboundPayload = async (payload = {}) => {
    const providerMessageId = zapiMessageIdFromPayload(payload);
    const providerZaapId = zapiZaapIdFromPayload(payload);
    const phone = zapiPhoneFromPayload(payload);
    const body = zapiTextFromPayload(payload);
    const type = zapiMessageTypeFromPayload(payload);
    const mediaUrl = zapiMediaUrlFromPayload(payload);
    if (!phone) return { recorded: false, reason: 'missing_phone', providerMessageId, providerZaapId };
    if (zapiInboundLooksLikeGroup(payload, phone)) {
        return { recorded: false, reason: 'group_or_community_ignored', phone, providerMessageId, providerZaapId };
    }

    const chatId = `${phone}@c.us`;
    const now = new Date();
    const messageId = providerMessageId || providerZaapId || `zapi_in_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const bodyText = typeof body === 'string' ? body.trim() : '';
    const typeByFile = zapiMediaTypeFromUrlOrMime(mediaUrl, zapiMediaMimeTypeFromPayload(payload));
    const effectiveType = typeByFile || (!mediaUrl && bodyText && type !== 'chat' && !zapiBodyLooksLikeMediaToken(bodyText) ? 'chat' : type);
    const hasDeclaredMedia = Boolean(mediaUrl) || effectiveType !== 'chat';
    const normalizedBody = typeof body === 'string' && body.trim()
        ? body
        : hasDeclaredMedia
            ? `[${effectiveType === 'image' && (payload.sticker || payload.message?.sticker || payload.data?.sticker) ? 'sticker' : effectiveType}]`
            : '';
    if (!normalizedBody && !mediaUrl) {
        return {
            recorded: false,
            reason: 'missing_message_content',
            phone,
            chatId,
            type: effectiveType,
            providerMessageId,
            providerZaapId,
            body: '',
            bodyLength: 0,
            routeToBot: false
        };
    }

    await Message.updateOne(
        { _id: messageId },
        {
            $setOnInsert: {
                _id: messageId,
                chatId,
                peerPhone: phone,
                from: chatId,
                to: 'zapi',
                body: normalizedBody,
                type: effectiveType,
                hasMedia: Boolean(mediaUrl) || effectiveType !== 'chat',
                mediaUrl,
                mediaPreviewUrl: mediaUrl,
                timestamp: Math.floor(now.getTime() / 1000),
                sessionId: 'zapi',
                ownerPhoneDigits: '',
                isFromMe: false,
                isBot: false,
                notifyName: firstString(payload.senderName, payload.notifyName, payload.name, payload.pushName, payload.message?.senderName, payload.data?.senderName),
                deliveryStatus: 'received',
                provider: 'zapi',
                providerMessageId,
                providerZaapId,
                providerStatus: 'received',
                providerPayload: payload
            }
        },
        { upsert: true }
    );
    const readInference = await markPreviousOutboundReadFromCustomerReply({ chatId, phone, inboundAt: now });

    const state = await ContactState.findOne({
        $or: [
            { chatId },
            { phoneDigits: phone },
            { phoneDigits: { $regex: `${phone}$` } },
            ...(phone.length >= 9 ? [{ phoneDigits: { $regex: `${phone.slice(-9)}$` } }] : [])
        ]
    }).sort({ updatedAt: -1 });

    const isNewState = !state;
    const inferredCountry = countryFromPhone(phone);
    const authorizedTestRecipient = authorizedVslTestRecipient(phone);
    const vslRoutingAllowed = inferredCountry === 'EC' || authorizedTestRecipient;
    const persistedVslProductContext = freshPersistedEcVslProductContext(state, now);
    const hasPersistedVslProduct = Boolean(String(state?.metadata?.vslProductKey || '').trim());
    const explicitTextProductContext = hasPersistedVslProduct || !vslRoutingAllowed
        ? null
        : explicitEcVslProductContextFromText(normalizedBody);
    const vslProductContext = persistedVslProductContext || explicitTextProductContext;
    const vslAttribution = vslRoutingAllowed
        ? await claimMetaAttributionForInboundWhatsapp({
            country: inferredCountry,
            phone,
            message: normalizedBody,
            inboundAt: now
        }).catch((error) => ({
            ok: false,
            skipped: true,
            reason: 'attribution_bridge_error',
            error: error.message || String(error)
        }))
        : { ok: false, skipped: true, reason: 'vsl_routing_not_allowed' };
    const automatedVslProduct = automatedEcVslProductKey(vslProductContext?.productKey);
    const publicVslLeadEntry = vslRoutingAllowed
        && Boolean(vslProductContext)
        && (looksLikePublicVslLeadText(normalizedBody) || Boolean(vslProductContext));
    const targetState = state || new ContactState({
        chatId,
        phoneDigits: phone,
        countryCode: inferredCountry
    });
    targetState.chatId = targetState.chatId || chatId;
    targetState.phoneDigits = targetState.phoneDigits || phone;
    targetState.countryCode = targetState.countryCode || inferredCountry;
    if (vslProductContext) targetState.assignedAgent = vslProductContext.productKey;
    targetState.lastInboundText = normalizedBody || `[${effectiveType}] recebido`;
    targetState.lastInboundAt = now;
    if (!targetState.firstInboundAt) targetState.firstInboundAt = now;
    if (!targetState.firstInboundText) targetState.firstInboundText = targetState.lastInboundText;
    const promoteRegisteredVslEntry = canPromoteAutomatedVslEntry({
        isNewState,
        automatedVslProduct,
        humanMode: targetState.human?.mode,
        lastManualBy: targetState.human?.lastManualBy,
        storedProductKey: targetState.metadata?.productKey || targetState.assignedAgent || '',
        incomingProductKey: vslProductContext?.productKey || ''
    });
    if (isNewState || promoteRegisteredVslEntry) {
        targetState.human = {
            ...(targetState.human || {}),
            mode: publicVslLeadEntry && automatedVslProduct ? 'auto' : 'manual',
            pausedUntil: null,
            assignedName: publicVslLeadEntry && automatedVslProduct ? 'Entrada VSL' : 'Captura Z-API',
            note: publicVslLeadEntry && automatedVslProduct
                ? 'Entrada VSL EC capturada pela Z-API; bot liberado para primeira resposta.'
                : 'Contato capturado do WhatsApp conectado. Revisar no painel antes de qualquer automacao.',
            lastManualAt: now,
            lastManualBy: 'zapi'
        };
    }
    targetState.tags = [...new Set([
        ...(Array.isArray(targetState.tags) ? targetState.tags.filter((tag) => !EC_VSL_PRODUCT_TAGS.has(tag)) : []),
        'ZAPI_INBOUND_CAPTURED',
        ...(publicVslLeadEntry ? ['VSL_EC', 'WHATSAPP_CLICK'] : []),
        ...(vslProductContext ? [vslProductContext.productTag] : []),
        ...(vslProductContext?.productKey === 'tex_ultra_ec' ? ['TEX_ULTRA_VSL_AB_ENTRY'] : []),
        ...(authorizedTestRecipient ? ['AUTHORIZED_VSL_TEST_RECIPIENT'] : []),
        ...(inferredCountry === 'BR' ? ['BR_CAPTURADO_CELULAR'] : [])
    ])];
    targetState.metadata = {
        ...(targetState.metadata || {}),
        lastProvider: 'zapi',
        lastProviderMessageId: providerMessageId,
        lastProviderZaapId: providerZaapId,
        lastSessionId: 'zapi',
        zapiInboundAt: now.toISOString(),
        zapiCapturedContact: true,
        zapiCapturedAt: targetState.metadata?.zapiCapturedAt || now.toISOString(),
        zapiCapturedCountry: inferredCountry,
        zapiCapturedSource: publicVslLeadEntry ? 'public_vsl_whatsapp_entry' : 'connected_phone_inbound',
        publicVslLeadEntry,
        ...(vslAttribution.ok && vslAttribution.claimed ? {
            vslVisitId: vslAttribution.visitId,
            vslVisitorId: vslAttribution.visitorId,
            vslSourceUrl: vslAttribution.sourceUrl,
            metaAttributionBridge: {
                source: 'zapi_exact_message_unique_120s',
                confidence: vslAttribution.confidence,
                claimedAt: vslAttribution.claimedAt
            },
            tracking: {
                ...(targetState.metadata?.tracking || {}),
                ...(vslAttribution.tracking || {})
            }
        } : {}),
        ...(vslProductContext ? {
            vslEntryPanelLead: true,
            vslPhonePending: false,
            vslEntryPanelLeadAt: targetState.metadata?.vslEntryPanelLeadAt || now.toISOString(),
            vslTestId: vslProductContext.vslTestId,
            vslVariant: vslProductContext.vslVariant,
            vslEntryMessage: vslProductContext.vslEntryMessage || normalizedBody,
            productKey: vslProductContext.productKey,
            productName: vslProductContext.productName,
            productSource: vslProductContext.productSource || 'zapi_public_vsl_entry',
            vslProductKey: vslProductContext.productKey,
            vslProductName: vslProductContext.productName,
            productRouteLock: targetState.metadata?.productRouteLock?.active === true
                && targetState.metadata?.productRouteLock?.productKey === vslProductContext.productKey
                ? targetState.metadata.productRouteLock
                : {
                    active: true,
                    productKey: vslProductContext.productKey,
                    productName: vslProductContext.productName,
                    lockedAt: now.toISOString(),
                    source: vslProductContext.productSource || 'zapi_public_vsl_entry',
                    reason: 'authoritative_vsl_product_attribution'
                },
            customerDraft: {
                ...(targetState.metadata?.customerDraft || {}),
                phone: `+${phone}`,
                country: 'EC',
                status: targetState.metadata?.customerDraft?.status || 'novo',
                entryAt: targetState.metadata?.customerDraft?.entryAt || now.toISOString(),
                source: 'public_vsl_whatsapp_entry',
                productKey: vslProductContext.productKey,
                productName: vslProductContext.productName,
                productMedia: vslProductContext.productMedia,
                message: normalizedBody,
                vslTestId: vslProductContext.vslTestId,
                vslVariant: vslProductContext.vslVariant,
                vslEntryMessage: vslProductContext.vslEntryMessage || normalizedBody,
                updatedAt: now.toISOString()
            }
        } : {})
    };
    await targetState.save();

    return {
        recorded: true,
        phone,
        chatId,
        type: effectiveType,
        providerMessageId,
        providerZaapId,
        messageId,
        body: normalizedBody,
        bodyLength: normalizedBody.length,
        readInference,
        publicVslLeadEntry,
        routeToBot: Boolean(normalizedBody)
            && targetState.human?.mode !== 'manual'
            && (inferredCountry === 'EC' || (authorizedTestRecipient && publicVslLeadEntry))
    };
};

const normalizeDeliveryStatus = (payload = {}) => {
    const raw = firstString(
        payload.status,
        payload.messageStatus,
        payload.deliveryStatus,
        payload.ack,
        payload.type,
        payload.event,
        payload.data?.status
    ).toLowerCase();
    const errorText = firstString(payload.error, payload.reason, payload.data?.error);
    if (errorText || /error|fail|failed|undeliver/.test(raw)) {
        return { deliveryStatus: 'failed', providerStatus: raw || 'failed', ack: -1, sendError: errorText || raw || 'zapi_delivery_failed' };
    }
    if (/read|played|view|seen|opened|blue|visualiz/.test(raw) || raw === '3' || raw === '4') {
        return { deliveryStatus: 'read', providerStatus: raw || 'read', ack: 3, sendError: '' };
    }
    if (/deliver|deliverycallback|received|receive/.test(raw) || raw === '2') {
        return { deliveryStatus: 'delivered', providerStatus: raw || 'delivered', ack: 2, sendError: '' };
    }
    if (/sent|send|server|queue/.test(raw) || raw === '1') {
        return { deliveryStatus: 'sent', providerStatus: raw || 'sent', ack: 1, sendError: '' };
    }
    return { deliveryStatus: 'sent', providerStatus: raw || 'delivery_callback', ack: 1, sendError: '' };
};

const applyZapiDeliveryPayload = async (payload = {}) => {
    const providerMessageId = zapiMessageIdFromPayload(payload);
    const providerZaapId = zapiZaapIdFromPayload(payload);
    const phone = zapiPhoneFromPayload(payload);
    const normalized = normalizeDeliveryStatus(payload);
    const now = new Date();

    const directOr = [
        providerMessageId ? { providerMessageId } : null,
        providerZaapId ? { providerZaapId } : null
    ].filter(Boolean);

    const updateSet = {
        provider: 'zapi',
        ...(providerMessageId ? { providerMessageId } : {}),
        ...(providerZaapId ? { providerZaapId } : {}),
        providerStatus: normalized.providerStatus,
        providerPayload: payload,
        deliveryStatus: normalized.deliveryStatus,
        ack: normalized.ack,
        sendError: normalized.sendError,
        ...(normalized.ack >= 2 ? { deliveredAt: now } : {}),
        ...(normalized.ack >= 3 ? { readAt: now } : {}),
        updatedAt: now
    };

    if (directOr.length) {
        const directMessage = await Message.findOne({ $or: directOr });
        if (directMessage) {
            await applyDeliveryUpdateToMessage(directMessage, updateSet, normalized, now);
            return { matched: true, method: 'provider_id', phone, providerMessageId, providerZaapId, ...normalized };
        }
    }

    if (phone) {
        const recent = await Message.findOne({
            isFromMe: true,
            $or: [
                { peerPhone: phone },
                { chatId: { $regex: phone } },
                { to: { $regex: phone } }
            ],
            createdAt: { $gte: new Date(Date.now() - 20 * 60 * 1000) }
        }).sort({ createdAt: -1 });
        if (recent) {
            await applyDeliveryUpdateToMessage(recent, updateSet, normalized, now);
            return { matched: true, method: 'recent_phone', phone, messageId: recent._id, providerMessageId, providerZaapId, ...normalized };
        }
    }

    return { matched: false, phone, providerMessageId, providerZaapId, ...normalized };
};

router.get('/config', (_req, res) => {
    res.json({
        ok: true,
        zapi: zapiPublicStatus()
    });
});

router.get('/status', async (_req, res) => {
    try {
        const status = await getZapiStatus();
        const connected = connectedFromStatus(status);
        let device = null;
        if (connected) {
            try {
                device = normalizeZapiDevice(await getZapiDevice());
            } catch {
                device = null;
            }
        }

        res.json({
            ok: connected,
            status: {
                ...status,
                source: 'zapi_status',
                phone: digits(device?.phone || status.phone || status.connectedPhone || '')
            },
            device
        });
    } catch (error) {
        res.status(error?.response?.status || error.statusCode || 500).json(exposeError(error));
    }
});

router.get('/device', async (_req, res) => {
    try {
        const device = normalizeZapiDevice(await getZapiDevice());
        res.json({
            ok: Boolean(device.phone),
            device
        });
    } catch (error) {
        res.status(error?.response?.status || error.statusCode || 500).json(exposeError(error));
    }
});

router.get('/whatsapp-link', async (req, res) => {
    try {
        const message = firstPlainString(req.query?.message);
        const status = await getZapiStatus();
        const connected = connectedFromStatus(status);
        if (!connected) {
            return res.status(503).json({
                ok: false,
                error: 'zapi_not_connected'
            });
        }
        let device = null;
        try {
            device = normalizeZapiDevice(await getZapiDevice());
        } catch {
            device = null;
        }
        const phone = digits(device?.phone || status.phone || status.connectedPhone || '');
        if (!phone) {
            return res.status(503).json({
                ok: false,
                error: 'zapi_phone_not_found'
            });
        }
        const encoded = encodeURIComponent(message || '');
        return res.json({
            ok: true,
            phone,
            url: `https://wa.me/${phone}${encoded ? `?text=${encoded}` : ''}`,
            source: 'zapi_device'
        });
    } catch (error) {
        res.status(error?.response?.status || error.statusCode || 500).json(exposeError(error));
    }
});

export const classifyZapiGenericWebhookPayload = (payload = {}) => {
    const fromMe = zapiFromMeFromPayload(payload);
    const callbackType = firstString(payload.type, payload.event, payload.data?.type);
    // O callback oficial de entrada da Z-API traz `status: RECEIVED`.
    // Classificar qualquer status como entrega impedia a mensagem real do
    // cliente de chegar ao funil. Identificamos a entrada antes da entrega.
    const receivedInboundCallback = !fromMe && (
        /receivedcallback/i.test(callbackType)
        || (
            String(firstString(payload.status, payload.data?.status)).toUpperCase() === 'RECEIVED'
            && Boolean(zapiTextFromPayload(payload) || zapiMediaUrlFromPayload(payload))
        )
    );
    const looksLikeDelivery = Boolean(
        payload.status
        || payload.messageStatus
        || payload.deliveryStatus
        || payload.ack
        || /delivery|message-status|status/i.test(callbackType)
    );
    return {
        kind: fromMe || (looksLikeDelivery && !receivedInboundCallback) ? 'delivery' : 'inbound',
        fromMe,
        callbackType,
        receivedInboundCallback,
        looksLikeDelivery
    };
};

router.post('/webhook/delivery', async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await applyZapiDeliveryPayload(payload);
        console.log(`[ZAPI-WEBHOOK] delivery | matched=${result.matched} | method=${result.method || 'none'} | phone=${result.phone || ''} | status=${result.deliveryStatus} | id=${result.providerMessageId || result.providerZaapId || ''}`);
        res.json({ ok: true, result });
    } catch (error) {
        console.error('[ZAPI-WEBHOOK] delivery error:', error?.response?.data || error.message || error);
        res.status(500).json(exposeError(error));
    }
});

router.post('/webhook', async (req, res) => {
    try {
        const payload = req.body || {};
        const classification = classifyZapiGenericWebhookPayload(payload);
        if (classification.kind === 'delivery') {
            const result = await applyZapiDeliveryPayload(payload);
            console.log(`[ZAPI-WEBHOOK] delivery | matched=${result.matched} | method=${result.method || 'none'} | phone=${result.phone || ''} | status=${result.deliveryStatus} | id=${result.providerMessageId || result.providerZaapId || ''}`);
            return res.json({ ok: true, result, routed: 'delivery' });
        }
        if (!isAllowedEcuadorInboundPayload(payload)) {
            console.log('[ZAPI-WEBHOOK] inbound ignorado fora da operacao Ecuador');
            return res.json({ ok: true, skipped: true, reason: 'outside_ec_operation' });
        }
        const result = await recordZapiInboundPayload(payload);
        const buyLaterReply = result.body
            ? await handleBuyLaterConfirmationReply({
                phone: result.phone,
                chatId: result.chatId,
                body: result.body,
                messageId: result.messageId,
                sessionId: 'zapi'
            })
            : { handled: false };
        if (result.routeToBot) {
            scheduleVslFirstResponseWatchdog(result);
            if (!buyLaterReply.handled) {
                await routeIncomingMessage({
                    id: result.messageId,
                    from: result.chatId,
                    body: result.body,
                    sessionId: 'zapi',
                    senderPn: result.phone,
                    fullMessage: { key: { senderPn: result.phone } }
                });
            }
        }
        console.log(`[ZAPI-WEBHOOK] inbound | recorded=${result.recorded} | phone=${result.phone || ''} | type=${result.type || ''} | id=${result.providerMessageId || result.providerZaapId || ''}`);
        return res.json({ ok: true, result, routed: 'inbound' });
    } catch (error) {
        console.error('[ZAPI-WEBHOOK] error:', error?.response?.data || error.message || error);
        res.status(500).json(exposeError(error));
    }
});

router.post('/webhook/received', async (req, res) => {
    try {
        const payload = req.body || {};
        const providerMessageId = zapiMessageIdFromPayload(payload);
        const phone = zapiPhoneFromPayload(payload);
        const fromMe = zapiFromMeFromPayload(payload);
        if (!fromMe) {
            if (!isAllowedEcuadorInboundPayload(payload)) {
                console.log('[ZAPI-WEBHOOK] received ignorado fora da operacao Ecuador');
                return res.json({ ok: true, skipped: true, reason: 'outside_ec_operation' });
            }
            const result = await recordZapiInboundPayload(payload);
            const buyLaterReply = result.body
                ? await handleBuyLaterConfirmationReply({
                    phone: result.phone,
                    chatId: result.chatId,
                    body: result.body,
                    messageId: result.messageId,
                    sessionId: 'zapi'
                })
                : { handled: false };
            if (result.routeToBot) {
                scheduleVslFirstResponseWatchdog(result);
                if (!buyLaterReply.handled) {
                    await routeIncomingMessage({
                        id: result.messageId,
                        from: result.chatId,
                        body: result.body,
                        sessionId: 'zapi',
                        senderPn: result.phone,
                        fullMessage: { key: { senderPn: result.phone } }
                    });
                }
            }
            console.log(`[ZAPI-WEBHOOK] inbound | recorded=${result.recorded} | phone=${result.phone || phone || ''} | type=${result.type || ''} | id=${result.providerMessageId || providerMessageId || ''}`);
            return res.json({ ok: true, result });
        }
        const result = await applyZapiDeliveryPayload({
            ...payload,
            status: firstString(payload.status, payload.messageStatus, payload.deliveryStatus, 'sent')
        });
        console.log(`[ZAPI-WEBHOOK] received | fromMe=${fromMe} | matched=${result.matched} | method=${result.method || 'none'} | phone=${phone || result.phone || ''} | id=${providerMessageId || result.providerMessageId || ''}`);
        res.json({ ok: true, result });
    } catch (error) {
        console.error('[ZAPI-WEBHOOK] received error:', error?.response?.data || error.message || error);
        res.status(500).json(exposeError(error));
    }
});

export default router;
