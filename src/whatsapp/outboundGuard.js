const DEFAULT_BLOCKED_SESSIONS = ['5515996218208'];
const DEFAULT_BLOCKED_RECIPIENTS = ['5515996218208', '5515998038637'];
const recentOutbound = new Map();

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const parseList = (value, defaults = []) => [
    ...new Set(
        String(value || '')
            .split(',')
            .map((item) => digitsOnly(item))
            .filter(Boolean)
            .concat(defaults)
            .map((item) => digitsOnly(item))
            .filter(Boolean)
    )
];

const isSamePhone = (left, right) => {
    const a = digitsOnly(left);
    const b = digitsOnly(right);
    if (!a || !b) return false;
    return a === b || a.startsWith(b) || b.startsWith(a);
};

const normalizeText = (text) => String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const dedupeWindowMs = () => {
    const minutes = Number(process.env.WHATSAPP_DEDUPE_WINDOW_MINUTES || 30);
    return Math.max(1, minutes) * 60 * 1000;
};

const defaultAllowedSessions = () => {
    if (String(process.env.WHATSAPP_ROTATION_ENABLED || '').toLowerCase() === 'true') {
        return String(process.env.WHATSAPP_SESSION_IDS || process.env.WHATSAPP_DEFAULT_SESSION_ID || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [process.env.WHATSAPP_DEFAULT_SESSION_ID || ''];
};

const cleanupRecentOutbound = (now) => {
    const maxAge = dedupeWindowMs();
    for (const [key, sentAt] of recentOutbound.entries()) {
        if (now - sentAt > maxAge) recentOutbound.delete(key);
    }
};

export const canSendOutbound = ({ jid, text = '', sessionId = null, ownDigits = '', kind = 'text' }) => {
    const targetDigits = digitsOnly(jid);
    const normalizedSessionId = digitsOnly(sessionId);
    const blockedSessions = parseList(process.env.WHATSAPP_BLOCKED_SESSION_IDS, DEFAULT_BLOCKED_SESSIONS);
    const allowedSessions = parseList(process.env.WHATSAPP_ALLOWED_OUTBOUND_SESSION_IDS, defaultAllowedSessions());
    const blockedRecipients = parseList(process.env.WHATSAPP_BLOCKED_RECIPIENTS, DEFAULT_BLOCKED_RECIPIENTS);
    const testAllowedRecipients = parseList(process.env.WHATSAPP_TEST_ALLOWED_RECIPIENTS);
    const automationAllowedRecipients = parseList(process.env.WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS);
    const autoReplyAllowedRecipients = parseList(process.env.WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS);
    const explicitAllowedRecipients = [
        ...testAllowedRecipients,
        ...automationAllowedRecipients,
        ...autoReplyAllowedRecipients
    ];
    const isExplicitAllowedRecipient = targetDigits
        && explicitAllowedRecipients.some((allowed) => isSamePhone(targetDigits, allowed));

    if (normalizedSessionId && blockedSessions.some((blocked) => isSamePhone(normalizedSessionId, blocked))) {
        return { allowed: false, reason: `blocked_session:${normalizedSessionId}` };
    }

    if (normalizedSessionId && allowedSessions.length > 0 && !allowedSessions.some((allowed) => isSamePhone(normalizedSessionId, allowed))) {
        return { allowed: false, reason: `unauthorized_session:${normalizedSessionId}` };
    }

    if (targetDigits && blockedRecipients.some((blocked) => isSamePhone(targetDigits, blocked)) && !isExplicitAllowedRecipient) {
        return { allowed: false, reason: `blocked_recipient:${targetDigits}` };
    }

    if (ownDigits && targetDigits && isSamePhone(targetDigits, ownDigits)) {
        return { allowed: false, reason: `self_recipient:${targetDigits}` };
    }

    const comparableText = normalizeText(text);
    if (kind === 'text' && targetDigits && comparableText) {
        const now = Date.now();
        cleanupRecentOutbound(now);
        const key = `${targetDigits}:${comparableText}`;
        if (recentOutbound.has(key)) {
            return { allowed: false, reason: `duplicate_text:${targetDigits}` };
        }
        recentOutbound.set(key, now);
    }

    return { allowed: true, reason: 'ok' };
};
