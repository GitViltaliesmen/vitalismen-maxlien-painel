import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const phoneTailCandidates = (value = '') => {
    const digits = digitsOnly(value);
    return [...new Set([
        digits,
        digits.length >= 8 ? digits.slice(-8) : '',
        digits.length >= 9 ? digits.slice(-9) : '',
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 11 ? digits.slice(-11) : ''
    ].filter((item) => item && item.length >= 7))];
};

const contactQueryForPhone = (phoneE164 = '') => {
    const digits = digitsOnly(phoneE164);
    const tails = phoneTailCandidates(digits);
    return {
        $or: [
            { phoneDigits: digits },
            { chatId: `${digits}@s.whatsapp.net` },
            { chatId: `${digits}@c.us` },
            ...tails.map((tail) => ({ phoneDigits: { $regex: `${tail}$` } })),
            ...tails.map((tail) => ({ 'metadata.lastSenderPn': { $regex: `${tail}` } })),
            ...tails.map((tail) => ({ 'metadata.customerDraft.phone': { $regex: `${tail}` } }))
        ]
    };
};

const messageQueryForPhone = (phoneE164 = '', state = null) => {
    const digits = digitsOnly(phoneE164);
    const tails = phoneTailCandidates(digits);
    return {
        $or: [
            { chatId: state?.chatId },
            { peerPhone: digits },
            { from: `${digits}@s.whatsapp.net` },
            { to: `${digits}@s.whatsapp.net` },
            { from: `${digits}@c.us` },
            { to: `${digits}@c.us` },
            ...tails.map((tail) => ({ peerPhone: { $regex: `${tail}$` } }))
        ].filter((item) => Object.values(item)[0])
    };
};

const messageToRole = (message) => ({
    role: message.isFromMe || message.isBot || message.from === 'bot' ? 'assistant' : 'user',
    content: String(message.body || '').trim()
});

const normalizeHistory = (history = []) => (history || [])
    .map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: String(item.content || '').trim()
    }))
    .filter((item) => item.content)
    .slice(-30);

export async function getMemory(phoneE164) {
    const digits = digitsOnly(phoneE164);
    const state = digits ? await ContactState.findOne(contactQueryForPhone(digits)).sort({ updatedAt: -1 }).lean() : null;
    const savedHistory = normalizeHistory(state?.metadata?.aiMemory?.history || []);

    const rows = digits
        ? await Message.find(messageQueryForPhone(digits, state))
            .sort({ createdAt: -1, timestamp: -1 })
            .limit(30)
            .lean()
        : [];

    const dbHistory = normalizeHistory(rows.reverse().map(messageToRole));
    const history = normalizeHistory([...savedHistory, ...dbHistory]);

    return {
        phoneE164: digits ? `+${digits}` : phoneE164,
        phoneDigits: digits,
        chatId: state?.chatId || '',
        customerName: state?.metadata?.customerDraft?.name || state?.metadata?.profileName || '',
        lastKnownFunnelStage: state?.metadata?.lastKnownFunnelStage || '',
        lastInboundAt: state?.lastInboundAt || null,
        lastOutboundAt: state?.lastOutboundAt || null,
        history
    };
}

export async function pushHistory(phoneE164, userText, botText) {
    const digits = digitsOnly(phoneE164);
    const cur = await getMemory(phoneE164);
    const history = normalizeHistory([
        ...(cur.history || []),
        { role: 'user', content: userText },
        { role: 'assistant', content: botText }
    ]);

    if (digits) {
        await ContactState.updateOne(
            contactQueryForPhone(digits),
            {
                $set: {
                    phoneDigits: digits,
                    'metadata.aiMemory.history': history,
                    'metadata.aiMemory.updatedAt': new Date(),
                    lastInboundText: String(userText || '').trim(),
                    lastOutboundAt: new Date()
                },
                $setOnInsert: {
                    chatId: `${digits}@s.whatsapp.net`,
                    countryCode: digits.startsWith('593') ? 'EC' : '',
                    assignedAgent: 'vit_power_ec',
                    firstInboundText: String(userText || '').trim(),
                    firstInboundAt: new Date()
                }
            },
            { upsert: true }
        );
    }

    return { ...cur, history };
}
