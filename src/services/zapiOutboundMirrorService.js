import crypto from 'crypto';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const mirrorId = ({ providerMessageId = '', phone = '', type = '', body = '', mediaUrl = '' } = {}) => {
    const providerId = String(providerMessageId || '').trim();
    if (providerId) return `zapi_out_${providerId}`;
    const digest = crypto.createHash('sha1')
        .update(`${phone}|${type}|${body}|${mediaUrl}|${Date.now()}`)
        .digest('hex')
        .slice(0, 24);
    return `zapi_out_${digest}`;
};

export const recordZapiOutboundMirror = async ({
    phone = '',
    jid = '',
    type = 'chat',
    body = '',
    mediaUrl = '',
    response = {},
    isBot = true
} = {}) => {
    try {
        const digits = digitsOnly(phone || jid);
        if (!digits) return { ok: false, reason: 'missing_phone' };
        const chatId = String(jid || `${digits}@c.us`);
        const providerMessageId = String(response?.messageId || response?.id || '').trim();
        const providerZaapId = String(response?.zaapId || '').trim();
        const now = new Date();
        const id = mirrorId({ providerMessageId, phone: digits, type, body, mediaUrl });

        await Message.updateOne(
            { _id: id },
            {
                $setOnInsert: {
                    _id: id,
                    chatId,
                    peerPhone: digits,
                    from: 'bot',
                    to: chatId,
                    body: String(body || ''),
                    type,
                    hasMedia: type !== 'chat',
                    mediaUrl: String(mediaUrl || ''),
                    timestamp: Math.floor(now.getTime() / 1000),
                    sessionId: 'zapi',
                    isFromMe: true,
                    isBot: Boolean(isBot),
                    deliveryStatus: 'pending',
                    provider: 'zapi',
                    providerMessageId,
                    providerZaapId,
                    providerStatus: 'queued',
                    providerPayload: response
                }
            },
            { upsert: true }
        );

        await ContactState.updateOne(
            {
                $or: [
                    { chatId },
                    { phoneDigits: digits },
                    { phoneDigits: { $regex: `${digits}$` } }
                ]
            },
            {
                $set: {
                    lastOutboundAt: now,
                    'metadata.lastOutboundProvider': 'zapi',
                    'metadata.lastOutboundProviderStatus': 'queued',
                    'metadata.lastOutboundProviderMessageId': providerMessageId,
                    'metadata.lastOutboundMirroredAt': now
                }
            }
        ).catch(() => null);

        return { ok: true, id, providerMessageId };
    } catch (error) {
        console.warn(`[ZAPI-OUTBOUND-MIRROR] falha sem bloquear envio: ${error.message}`);
        return { ok: false, reason: 'mirror_failed', error: error.message };
    }
};
