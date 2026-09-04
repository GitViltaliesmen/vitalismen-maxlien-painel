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
        // Automatic handoffs also write lastManualAt. Accept it only when the
        // actor matches the persisted operator assignment, never a bot handoff.
        const human = state?.human || {};
        const operatorAttendance = human.assignedTo && human.assignedName
            && human.lastManualBy === human.assignedName;
        const manualSeconds = operatorAttendance && human.lastManualAt
            ? Math.floor(new Date(human.lastManualAt).getTime() / 1000)
            : 0;
        return [dateSeconds, messageTimestamp, manualSeconds].map((value) => Number.isFinite(value) ? value : 0);
    }));

export const panelHandledThroughSeconds = ({ states = [], lastOutboundAt = 0, readThrough = 0 } = {}) => {
    const contacts = Array.isArray(states) ? states : [states];
    const outboundSeconds = contacts.map((state) => state?.lastOutboundAt
        ? Math.floor(new Date(state.lastOutboundAt).getTime() / 1000) : 0);
    return Math.max(panelLastReadMarkerSeconds(contacts), ...[readThrough, lastOutboundAt, ...outboundSeconds]
        .map((value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0));
};

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
