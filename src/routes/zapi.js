import express from 'express';
import {
    getZapiDevice,
    getZapiStatus,
    normalizeZapiDevice,
    zapiPublicStatus
} from '../services/zapiClient.js';
import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';
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

const zapiMessageTypeFromPayload = (payload = {}) => {
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
    return 'chat';
};

const recordZapiInboundPayload = async (payload = {}) => {
    const providerMessageId = zapiMessageIdFromPayload(payload);
    const providerZaapId = zapiZaapIdFromPayload(payload);
    const phone = zapiPhoneFromPayload(payload);
    const body = zapiTextFromPayload(payload);
    const type = zapiMessageTypeFromPayload(payload);
    if (!phone) return { recorded: false, reason: 'missing_phone', providerMessageId, providerZaapId };

    const chatId = `${phone}@c.us`;
    const now = new Date();
    const messageId = providerMessageId || providerZaapId || `zapi_in_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const normalizedBody = typeof body === 'string' ? body : '';

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
                type,
                hasMedia: type !== 'chat',
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

    const state = await ContactState.findOne({
        $or: [
            { chatId },
            { phoneDigits: phone },
            { phoneDigits: { $regex: `${phone}$` } },
            ...(phone.length >= 9 ? [{ phoneDigits: { $regex: `${phone.slice(-9)}$` } }] : [])
        ]
    }).sort({ updatedAt: -1 });

    const targetState = state || new ContactState({
        chatId,
        phoneDigits: phone,
        countryCode: phone.startsWith('57') ? 'CO' : 'EC'
    });
    targetState.chatId = targetState.chatId || chatId;
    targetState.phoneDigits = targetState.phoneDigits || phone;
    targetState.lastInboundText = normalizedBody || `[${type}] recebido`;
    targetState.lastInboundAt = now;
    if (!targetState.firstInboundAt) targetState.firstInboundAt = now;
    if (!targetState.firstInboundText) targetState.firstInboundText = targetState.lastInboundText;
    targetState.metadata = {
        ...(targetState.metadata || {}),
        lastProvider: 'zapi',
        lastProviderMessageId: providerMessageId,
        lastProviderZaapId: providerZaapId,
        lastSessionId: 'zapi',
        zapiInboundAt: now.toISOString()
    };
    await targetState.save();

    return { recorded: true, phone, chatId, type, providerMessageId, providerZaapId, bodyLength: normalizedBody.length };
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
    if (/read|played|view/.test(raw) || raw === '3' || raw === '4') {
        return { deliveryStatus: 'read', providerStatus: raw || 'read', ack: 3, sendError: '' };
    }
    if (/deliver|received|receive/.test(raw) || raw === '2') {
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

    const update = {
        $set: {
            provider: 'zapi',
            ...(providerMessageId ? { providerMessageId } : {}),
            ...(providerZaapId ? { providerZaapId } : {}),
            providerStatus: normalized.providerStatus,
            providerPayload: payload,
            deliveryStatus: normalized.deliveryStatus,
            ack: normalized.ack,
            sendError: normalized.sendError,
            updatedAt: now
        }
    };

    if (directOr.length) {
        const direct = await Message.updateOne({ $or: directOr }, update);
        if (direct.modifiedCount || direct.matchedCount) return { matched: true, method: 'provider_id', phone, providerMessageId, providerZaapId, ...normalized };
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
            Object.assign(recent, update.$set);
            await recent.save();
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

router.post('/webhook/delivery', async (req, res) => {
    try {
        const result = await applyZapiDeliveryPayload(req.body || {});
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
        const fromMe = zapiFromMeFromPayload(payload);
        const looksLikeDelivery = Boolean(
            payload.status
            || payload.messageStatus
            || payload.deliveryStatus
            || payload.ack
            || /delivery|message-status|status/i.test(firstString(payload.type, payload.event, payload.data?.type))
        );
        if (fromMe || looksLikeDelivery) {
            const result = await applyZapiDeliveryPayload(payload);
            console.log(`[ZAPI-WEBHOOK] delivery | matched=${result.matched} | method=${result.method || 'none'} | phone=${result.phone || ''} | status=${result.deliveryStatus} | id=${result.providerMessageId || result.providerZaapId || ''}`);
            return res.json({ ok: true, result, routed: 'delivery' });
        }
        const result = await recordZapiInboundPayload(payload);
        console.log(`[ZAPI-WEBHOOK] inbound | recorded=${result.recorded} | phone=${result.phone || ''} | type=${result.type || ''} | id=${result.providerMessageId || result.providerZaapId || ''}`);
        return res.json({ ok: true, result, routed: 'inbound' });
    } catch (error) {
        console.error('[ZAPI-WEBHOOK] error:', error?.response?.data || error.message || error);
        res.status(500).json(exposeError(error));
    }
});

router.post('/webhook/received', async (req, res) => {
    try {
        const providerMessageId = zapiMessageIdFromPayload(req.body || {});
        const phone = zapiPhoneFromPayload(req.body || {});
        const fromMe = zapiFromMeFromPayload(req.body || {});
        if (!fromMe) {
            const result = await recordZapiInboundPayload(req.body || {});
            console.log(`[ZAPI-WEBHOOK] inbound | recorded=${result.recorded} | phone=${result.phone || phone || ''} | type=${result.type || ''} | id=${result.providerMessageId || providerMessageId || ''}`);
            return res.json({ ok: true, result });
        }
        console.log(`[ZAPI-WEBHOOK] received | fromMe=${fromMe} | phone=${phone || ''} | id=${providerMessageId || ''}`);
        res.json({ ok: true });
    } catch (error) {
        console.error('[ZAPI-WEBHOOK] received error:', error?.response?.data || error.message || error);
        res.status(500).json(exposeError(error));
    }
});

export default router;
