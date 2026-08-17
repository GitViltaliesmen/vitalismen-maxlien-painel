const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const dateValue = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
};

export const callAutoReplyEnabled = (env = process.env) => {
    const explicit = String(env.WHATSAPP_CALL_AUTO_REPLY_ENABLED || '').trim().toLowerCase();
    if (explicit) return explicit === 'true';
    return String(env.WHATSAPP_AUTO_REJECT_CALLS || '').trim().toLowerCase() === 'true';
};

export const normalizeCallReplyPhoneKey = (value = '') => {
    const digits = digitsOnly(String(value || '').split('@')[0].split(':')[0]);
    if (!digits) return '';
    const local = digits.startsWith('593') && digits.length >= 12 ? digits.slice(3) : digits;
    return local.length >= 9 ? local.slice(-9) : local;
};

export const zapiCallNotification = (payload = {}) => {
    const notification = String(
        payload.notification
        || payload.data?.notification
        || payload.message?.notification
        || ''
    ).trim().toUpperCase();
    if (!notification.startsWith('CALL_')) return null;
    return {
        notification,
        incoming: String(payload.callDirection || payload.data?.callDirection || 'incoming').toLowerCase() !== 'outgoing',
        fromMe: payload.fromMe === true || payload.data?.fromMe === true,
        phone: String(payload.phone || payload.data?.phone || payload.message?.phone || ''),
        callId: String(
            payload.callId
            || payload.data?.callId
            || payload.message?.callId
            || payload.messageId
            || payload.data?.messageId
            || ''
        ).trim(),
        actionable: notification === 'CALL_RECEIVED'
    };
};

export const configuredCallReplyWindowMs = (env = process.env) => {
    const hours = Number.parseInt(String(env.WHATSAPP_CALL_REPLY_WINDOW_HOURS || '24'), 10);
    return Math.max(1, Number.isFinite(hours) ? hours : 24) * 60 * 60 * 1000;
};

export const configuredCallContinuationMs = (env = process.env) => {
    const minutes = Number.parseInt(String(env.WHATSAPP_CALL_CONTINUATION_MINUTES || '15'), 10);
    return Math.max(1, Number.isFinite(minutes) ? minutes : 15) * 60 * 1000;
};

export const decideCallAutoReplyAction = (state = {}, {
    callKey = '',
    now = new Date(),
    windowMs = configuredCallReplyWindowMs(),
    continuationMs = configuredCallContinuationMs()
} = {}) => {
    const at = dateValue(now) || new Date();
    const handled = Array.isArray(state.handledCalls)
        && state.handledCalls.some((item) => String(item?.key || '') === callKey);
    if (callKey && handled) return { action: 'none', reason: 'duplicate_call_event', resetWindow: false };

    const windowStartedAt = dateValue(state.windowStartedAt);
    const resetWindow = !windowStartedAt || at.getTime() - windowStartedAt.getTime() >= windowMs;
    const lastCallAt = resetWindow ? null : dateValue(state.lastCallAt);
    if (lastCallAt && at.getTime() - lastCallAt.getTime() < continuationMs) {
        return { action: 'none', reason: 'continued_call_ignored', resetWindow };
    }

    const audioAttemptedAt = resetWindow ? null : dateValue(state.audioAttemptedAt);
    const textAttemptedAt = resetWindow ? null : dateValue(state.textAttemptedAt);
    if (!audioAttemptedAt) return { action: 'audio', reason: 'first_call_in_window', resetWindow };
    if (!textAttemptedAt) return { action: 'text', reason: 'one_followup_text_allowed', resetWindow };
    return { action: 'none', reason: 'reply_limit_reached', resetWindow };
};
