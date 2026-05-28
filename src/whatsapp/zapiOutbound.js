import ContactState from '../models/ContactState.js';
import { sendZapiAudio, sendZapiImage, sendZapiText, sendZapiVideo, zapiConfig } from '../services/zapiClient.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const isEnabled = () => {
    const mode = String(process.env.WHATSAPP_OUTBOUND_PROVIDER || '').trim().toLowerCase();
    return mode === 'zapi' || mode === 'hybrid';
};

const allowedZapiRecipients = () => String(
    process.env.ZAPI_OUTBOUND_ALLOWED_RECIPIENTS
    || process.env.WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS
    || ''
)
    .split(',')
    .map(digitsOnly)
    .filter(Boolean);

const isAllowedZapiRecipient = (phone = '') => {
    const allowed = allowedZapiRecipients();
    if (!allowed.length) return true;
    const normalized = digitsOnly(phone);
    return allowed.some((entry) => normalized === entry || normalized.endsWith(entry.slice(-10)));
};

const contactQueryForJid = (jid = '') => {
    const digits = digitsOnly(jid);
    const tail = digits.length >= 8 ? digits.slice(-10) : digits;
    return {
        $or: [
            { chatId: jid },
            ...(digits ? [{ phoneDigits: digits }] : []),
            ...(tail ? [{ phoneDigits: { $regex: `${tail}$` } }] : [])
        ]
    };
};

const blockedContactNamePattern = () => {
    const raw = String(process.env.WHATSAPP_BLOCKED_CONTACT_NAME_PATTERN || 'dropi|droppi|vital\\s*com|vitalcom').trim();
    return raw ? new RegExp(raw, 'i') : null;
};

const isBlockedContactState = (state) => {
    if (!state) return false;
    const pattern = blockedContactNamePattern();
    if (!pattern) return false;
    const values = [
        state.notifyName,
        state.name,
        state.metadata?.senderName,
        state.metadata?.contactName
    ].map((value) => String(value || '').trim()).filter(Boolean);
    return values.some((value) => pattern.test(value));
};

const resolveZapiContactForJid = async (jid = '') => {
    const raw = String(jid || '').trim();
    if (!raw) return { phone: '', state: null };

    const state = await ContactState.findOne(contactQueryForJid(raw)).sort({ updatedAt: -1 }).lean().catch(() => null);
    return {
        phone: digitsOnly(state?.phoneDigits || raw),
        state
    };
};

export const resolveZapiPhoneForJid = async (jid = '') => {
    const contact = await resolveZapiContactForJid(jid);
    return contact.phone;
};

export const shouldUseZapiForText = async ({ jid = '', sessionId = '' } = {}) => {
    if (!isEnabled()) return { use: false, reason: 'disabled' };
    if (!zapiConfig().enabled) return { use: false, reason: 'not_configured' };

    const requested = String(sessionId || '').trim().toLowerCase();
    const raw = String(jid || '').trim();
    const force = requested === 'zapi' || raw.endsWith('@zapi');
    const contact = await resolveZapiContactForJid(raw);
    const phone = contact.phone;
    if (!phone) return { use: false, reason: 'missing_phone' };
    if (isBlockedContactState(contact.state)) return { use: false, reason: 'blocked_contact_name', phone };
    if (!isAllowedZapiRecipient(phone)) return { use: false, reason: 'zapi_recipient_not_allowed', phone };

    const official = digitsOnly(process.env.ZAPI_CONNECTED_PHONE || process.env.WHATSAPP_DEFAULT_SESSION_ID);
    const onlyOfficial = String(process.env.ZAPI_OUTBOUND_ONLY_OFFICIAL || 'true').toLowerCase() !== 'false';
    if (onlyOfficial && !official) return { use: false, reason: 'missing_official_phone' };

    return {
        use: force || isEnabled(),
        phone,
        sessionId: official || 'zapi',
        reason: force ? 'forced_zapi' : 'provider_zapi'
    };
};

export const shouldUseZapiForMedia = shouldUseZapiForText;

export const sendTextViaZapi = async ({ jid, text, messageId = '' }) => {
    const phone = await resolveZapiPhoneForJid(jid);
    if (!phone) return { ok: false, reason: 'missing_phone' };

    const result = await sendZapiText({ phone, message: text, messageId });
    return { ok: true, phone, result };
};

export const sendAudioViaZapi = async ({ jid, audio }) => {
    const phone = await resolveZapiPhoneForJid(jid);
    if (!phone) return { ok: false, reason: 'missing_phone' };

    const result = await sendZapiAudio({ phone, audio });
    return { ok: true, phone, result };
};

export const sendImageViaZapi = async ({ jid, image, caption = '' }) => {
    const phone = await resolveZapiPhoneForJid(jid);
    if (!phone) return { ok: false, reason: 'missing_phone' };

    const result = await sendZapiImage({ phone, image, caption });
    return { ok: true, phone, result };
};

export const sendVideoViaZapi = async ({ jid, video, caption = '' }) => {
    const phone = await resolveZapiPhoneForJid(jid);
    if (!phone) return { ok: false, reason: 'missing_phone' };

    const result = await sendZapiVideo({ phone, video, caption });
    return { ok: true, phone, result };
};
