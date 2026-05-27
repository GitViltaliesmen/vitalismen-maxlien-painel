import mongoose from 'mongoose';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';

const digits = (value) => String(value || '').replace(/\D/g, '');
const clean = (value) => String(value || '').trim();

const zapiWebhookEventSchema = new mongoose.Schema({
    eventType: { type: String, index: true, default: '' },
    phone: { type: String, index: true, default: '' },
    messageId: { type: String, index: true, default: '' },
    skipped: { type: String, default: '' },
    normalized: { type: mongoose.Schema.Types.Mixed, default: {} },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const ZapiWebhookEvent = mongoose.models.ZapiWebhookEvent
    || mongoose.model('ZapiWebhookEvent', zapiWebhookEventSchema);

const ackFromStatus = (status) => {
    const normalized = clean(status).toUpperCase();
    const map = {
        PENDING: 0,
        SENT: 1,
        RECEIVED: 2,
        DELIVERED: 2,
        READ: 3,
        PLAYED: 4
    };
    return Object.prototype.hasOwnProperty.call(map, normalized) ? map[normalized] : undefined;
};

const pickText = (body = {}) => {
    if (typeof body.text === 'string') return body.text;
    return clean(
        body.text?.message
        || body.message?.text
        || body.message?.body
        || body.body
        || body.caption
        || body.image?.caption
        || body.video?.caption
        || body.document?.caption
        || ''
    );
};

const pickPhone = (body = {}) => digits(
    body.phone
    || body.senderPhone
    || body.participantPhone
    || body.message?.phone
    || body.message?.senderPhone
    || body.message?.participantPhone
    || body.chat?.phone
    || body.contact?.phone
    || body.sender?.phone
    || body.from
    || body.remoteJid
    || body.key?.remoteJid
);

const pickMessageType = (body = {}) => {
    if (body.notification) return 'notification';
    if (body.text) return 'chat';
    if (body.image) return 'image';
    if (body.audio) return 'audio';
    if (body.video) return 'video';
    if (body.document) return 'document';
    if (body.sticker) return 'sticker';
    return clean(body.messageType || body.type || 'chat').toLowerCase();
};

const rawType = (body = {}) => clean(body.type || body.event || body.messageType).toLowerCase();

const isStatusEvent = (body = {}) => {
    const type = rawType(body);
    return [
        'deliverycallback',
        'messagestatuscallback',
        'statuscallback',
        'ack',
        'receipt'
    ].includes(type);
};

const isDirectCustomerChat = (body = {}, normalized = {}) => {
    const rawPhone = clean(body.phone || body.remoteJid || body.key?.remoteJid);
    if (body.isNewsletter || rawPhone.includes('@newsletter')) return false;
    if (body.isGroup || rawPhone.includes('@g.us')) return false;
    if (isStatusEvent(body)) return false;
    if (normalized.isFromMe) return false;
    if (!normalized.text) return false;
    if (!normalized.phone) return false;

    // E.164 numbers have up to 15 digits. Larger ids are usually groups/channels/LIDs.
    if (normalized.phone.length < 8 || normalized.phone.length > 15) return false;
    return true;
};

const skipReason = (body = {}, normalized = {}) => {
    const rawPhone = clean(body.phone || body.remoteJid || body.key?.remoteJid);
    if (!normalized.phone) return 'missing_phone';
    if (body.isNewsletter || rawPhone.includes('@newsletter')) return 'newsletter';
    if (body.isGroup || rawPhone.includes('@g.us')) return 'group';
    if (isStatusEvent(body)) return 'status_event';
    if (normalized.isFromMe) return 'from_me';
    if (!normalized.text) return 'empty_text';
    if (normalized.phone.length < 8 || normalized.phone.length > 15) return 'non_customer_phone';
    return '';
};

const findExistingContactStateForPhone = async (phone) => {
    const phoneDigits = digits(phone);
    if (!phoneDigits) return null;

    const tail = phoneDigits.length > 10 ? phoneDigits.slice(-10) : phoneDigits;
    const candidates = await ContactState.find({
        $or: [
            { phoneDigits },
            ...(tail ? [{ phoneDigits: { $regex: `${tail}$` } }] : [])
        ]
    }).sort({ updatedAt: -1 }).limit(10);

    return candidates.find((state) => !String(state.chatId || '').endsWith('@zapi'))
        || candidates[0]
        || null;
};

export const normalizeZapiWebhookPayload = (body = {}) => {
    const phone = pickPhone(body);
    const connectedPhone = digits(body.connectedPhone || body.to || process.env.ZAPI_CONNECTED_PHONE);
    const messageId = clean(body.messageId || body.id || body.message?.id)
        || `zapi_${phone || 'unknown'}_${Date.now()}`;
    const isFromMe = Boolean(body.fromMe);
    const text = pickText(body);
    const timestamp = Number(body.momment || body.moment || body.timestamp || Date.now());
    const type = pickMessageType(body);

    return {
        raw: body,
        messageId: `zapi_${messageId}`,
        providerMessageId: messageId,
        phone,
        connectedPhone,
        chatId: phone ? `${phone}@zapi` : '',
        from: isFromMe ? `${connectedPhone || 'zapi'}@zapi` : `${phone || 'unknown'}@zapi`,
        to: isFromMe ? `${phone || 'unknown'}@zapi` : `${connectedPhone || 'zapi'}@zapi`,
        text,
        type,
        isFromMe,
        timestamp: Math.floor(timestamp / (timestamp > 9999999999 ? 1000 : 1)),
        notifyName: clean(body.senderName || body.chatName),
        shouldProcessAsInbound: false
    };
};

export const persistZapiWebhook = async (body = {}) => {
    const normalized = normalizeZapiWebhookPayload(body);
    normalized.shouldProcessAsInbound = isDirectCustomerChat(body, normalized);

    const rawEvent = await ZapiWebhookEvent.create({
        eventType: normalized.type || clean(body.type),
        phone: normalized.phone,
        messageId: normalized.providerMessageId,
        normalized,
        raw: body
    });

    const skipped = skipReason(body, normalized);
    if (skipped) {
        rawEvent.skipped = skipped;
        await rawEvent.save();
        return {
            ok: true,
            skipped,
            normalized
        };
    }

    await Message.updateOne(
        { _id: normalized.messageId },
        {
            $setOnInsert: {
                chatId: normalized.chatId,
                peerPhone: normalized.phone,
                from: normalized.from,
                to: normalized.to,
                body: normalized.text || `[${normalized.type}]`,
                type: normalized.type,
                hasMedia: !['chat', 'notification'].includes(normalized.type),
                timestamp: normalized.timestamp,
                isFromMe: normalized.isFromMe,
                isBot: normalized.isFromMe,
                notifyName: normalized.notifyName,
                ack: ackFromStatus(body.status)
            }
        },
        { upsert: true }
    );

    const set = {
        phoneDigits: normalized.phone,
        'metadata.provider': 'zapi',
        'metadata.lastZapiWebhookAt': new Date(),
        'metadata.lastZapiMessageId': normalized.providerMessageId,
        'metadata.lastZapiType': normalized.type,
        'metadata.lastZapiStatus': clean(body.status),
        'metadata.connectedPhone': normalized.connectedPhone,
        'metadata.zapiChatId': normalized.chatId,
        'metadata.senderName': normalized.notifyName
    };
    if (normalized.isFromMe) {
        set.lastOutboundAt = new Date();
    } else {
        set.lastInboundText = normalized.text;
        set.lastInboundAt = new Date();
    }

    const existingState = await findExistingContactStateForPhone(normalized.phone);
    const contactChatId = existingState?.chatId || normalized.chatId;

    const state = await ContactState.findOneAndUpdate(
        { chatId: contactChatId },
        {
            $setOnInsert: {
                chatId: contactChatId,
                countryCode: process.env.ZAPI_DEFAULT_COUNTRY || 'EC',
                assignedAgent: 'vit_power_ec'
            },
            $set: set,
            $addToSet: {
                tags: { $each: ['ZAPI', 'VIT_POWER_EC_ONLY'] }
            }
        },
        { upsert: true, new: true }
    );

    if (
        normalized.shouldProcessAsInbound
        && String(process.env.ZAPI_ROUTE_INBOUND_TO_BOT || '').toLowerCase() === 'true'
    ) {
        const { routeIncomingMessage } = await import('./agentRouter.js');
        await routeIncomingMessage({
            id: normalized.messageId,
            from: contactChatId,
            senderPn: normalized.phone,
            body: normalized.text,
            fullMessage: { zapi: body },
            sessionId: 'zapi'
        });
    }

    return {
        ok: true,
        normalized,
        eventId: rawEvent._id.toString(),
        contactStateId: state?._id?.toString()
    };
};
