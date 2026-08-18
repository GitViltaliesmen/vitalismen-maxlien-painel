const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');

const phoneTailCandidates = (value = '') => {
    const digits = digitsOnly(value);
    return [...new Set([
        digits,
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter((item) => item && item.length >= 9))];
};

export const panelLastReadMarkerSeconds = (states = []) => Math.max(0, ...(Array.isArray(states) ? states : [states])
    .flatMap((state) => {
        const dateSeconds = state?.metadata?.panelLastReadAt
            ? Math.floor(new Date(state.metadata.panelLastReadAt).getTime() / 1000)
            : 0;
        const messageTimestamp = Number(state?.metadata?.panelLastReadMessageTimestamp || 0);
        return [Number.isFinite(dateSeconds) ? dateSeconds : 0, Number.isFinite(messageTimestamp) ? messageTimestamp : 0];
    }));

export const panelReadIdentityQuery = ({ chatId = '', phone = '' } = {}) => {
    const rawChatId = String(chatId || '').trim();
    const digits = digitsOnly(phone || chatId);
    const tails = phoneTailCandidates(digits);
    return {
        $or: [
            ...(rawChatId ? [{ chatId: rawChatId }] : []),
            ...tails.flatMap((tail) => ([
                { phoneDigits: { $regex: `${tail}$` } },
                { chatId: { $regex: `${tail}(?:@|$)` } },
                { 'metadata.lastSenderPn': { $regex: `${tail}$` } },
                { 'metadata.customerDraft.phone': { $regex: `${tail}$` } },
                { 'metadata.customerPhoneDigits': { $regex: `${tail}$` } }
            ]))
        ]
    };
};
