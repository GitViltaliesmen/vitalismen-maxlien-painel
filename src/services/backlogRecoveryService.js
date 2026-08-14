import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';
import { vitPowerAgent } from './agents/vitPowerAgent.js';
import { getAllStatuses } from '../whatsapp/connection.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const priorityBotTestPhones = () => [
    '5515998038637',
    process.env.WHATSAPP_PRIORITY_TEST_PHONES
]
    .join(',')
    .split(',')
    .map((item) => digitsOnly(item))
    .filter(Boolean);

const isPriorityBotTestPhone = (...values) => {
    const allowed = priorityBotTestPhones();
    if (!allowed.length) return false;
    return values
        .map((item) => digitsOnly(item))
        .filter(Boolean)
        .some((candidate) => allowed.some((allowedPhone) => (
            candidate === allowedPhone
            || candidate.endsWith(allowedPhone)
            || allowedPhone.endsWith(candidate)
        )));
};

const parseNumber = (name, fallback) => {
    const parsed = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

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

const realPhoneFor = ({ row = {}, state = null } = {}) => {
    if (isPriorityBotTestPhone(row.peerPhone, row._id, row.chatId, state?.phoneDigits, state?.metadata?.lastSenderPn)) {
        return priorityBotTestPhones()[0] || digitsOnly(state?.phoneDigits) || digitsOnly(row.peerPhone);
    }
    const sender = digitsOnly(state?.metadata?.lastSenderPn);
    if (sender.startsWith('593')) return sender;
    const peer = digitsOnly(row.peerPhone);
    if (peer.startsWith('593')) return peer;
    const statePhone = digitsOnly(state?.phoneDigits);
    if (statePhone.startsWith('593')) return statePhone;
    const chat = digitsOnly(row._id || row.chatId);
    return chat.startsWith('593') ? chat : '';
};

const buildMessageScopeForContact = ({ chatId = '', peerPhone = '', state = null } = {}) => {
    const tails = [...new Set([
        peerPhone,
        state?.phoneDigits,
        state?.metadata?.lastSenderPn,
        chatId
    ].filter(Boolean).flatMap((value) => phoneTailCandidates(value)))];

    return [
        { chatId },
        ...tails.flatMap((tail) => [
            { peerPhone: { $regex: `${tail}$` } },
            { to: { $regex: `${tail}@` } },
            { chatId: { $regex: `${tail}@` } }
        ])
    ];
};

const findContactStateForRow = async (row = {}) => {
    const tails = [...new Set([
        row._id,
        row.chatId,
        row.peerPhone
    ].filter(Boolean).flatMap((value) => phoneTailCandidates(value)))];
    const query = {
        $or: [
            { chatId: row._id || row.chatId },
            ...tails.flatMap((tail) => [
                { phoneDigits: { $regex: `${tail}$` } },
                { 'metadata.lastSenderPn': { $regex: `${tail}` } },
                { chatId: { $regex: `${tail}@` } }
            ])
        ].filter((item) => Object.values(item)[0])
    };
    const states = await ContactState.find(query).sort({ updatedAt: -1 }).limit(8).lean();
    if (isPriorityBotTestPhone(row._id, row.chatId, row.peerPhone, ...states.flatMap((state) => [
        state?.phoneDigits,
        state?.metadata?.lastSenderPn,
        ...(Array.isArray(state?.metadata?.linkedChatIds) ? state.metadata.linkedChatIds : [])
    ]))) {
        return states.find((state) => state?.metadata?.priorityFrozen && state?.metadata?.noDropiEver)
            || states.find((state) => state?.metadata?.botTestEnabled)
            || states[0]
            || null;
    }
    return states.find((state) => digitsOnly(state?.metadata?.lastSenderPn).startsWith('593'))
        || states.find((state) => String(state?.chatId || '').endsWith('@lid'))
        || states.find((state) => digitsOnly(state?.phoneDigits).startsWith('593'))
        || states[0]
        || null;
};

const hasConnectedWhatsApp = () => getAllStatuses()
    .some((status) => status?.isReady && status?.status === 'connected');

const attemptedRecently = ({ state = null, lastInboundAt, cooldownMs }) => {
    const recovery = state?.metadata?.backlogRecovery || {};
    const lastAttemptAt = recovery.lastAttemptAt ? new Date(recovery.lastAttemptAt).getTime() : 0;
    const attemptedInboundAt = recovery.lastInboundAt ? new Date(recovery.lastInboundAt).getTime() : 0;
    const inboundAt = lastInboundAt ? new Date(lastInboundAt).getTime() : 0;
    return Boolean(
        lastAttemptAt
        && inboundAt
        && attemptedInboundAt >= inboundAt
        && Date.now() - lastAttemptAt < cooldownMs
    );
};

const markRecoveryAttempt = async ({ state = null, row = {}, status = 'attempted' } = {}) => {
    if (!state?._id) return;
    await ContactState.updateOne(
        { _id: state._id },
        {
            $set: {
                'metadata.backlogRecovery.lastAttemptAt': new Date(),
                'metadata.backlogRecovery.lastInboundAt': row.lastInboundAt,
                'metadata.backlogRecovery.lastMessageId': String(row.messageId || ''),
                'metadata.backlogRecovery.lastStatus': status
            },
            $inc: {
                'metadata.backlogRecovery.attempts': 1
            }
        }
    );
};

export const findBacklogRecoveryCandidates = async ({
    since = new Date(Date.now() - parseNumber('WHATSAPP_BACKLOG_RECOVERY_LOOKBACK_HOURS', 12) * 60 * 60 * 1000),
    limit = parseNumber('WHATSAPP_BACKLOG_RECOVERY_BATCH_LIMIT', 2),
    cooldownMs = parseNumber('WHATSAPP_BACKLOG_RECOVERY_COOLDOWN_MINUTES', 360) * 60 * 1000
} = {}) => {
    const inbound = await Message.aggregate([
        {
            $match: {
                createdAt: { $gte: since },
                isFromMe: false,
                isBot: false,
                chatId: { $not: /newsletter|broadcast|@g\.us/ },
                $or: [
                    { peerPhone: { $not: /^55/ } },
                    { peerPhone: { $in: priorityBotTestPhones() } }
                ]
            }
        },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: '$chatId',
                messageId: { $first: '$_id' },
                lastInboundAt: { $first: '$createdAt' },
                peerPhone: { $first: '$peerPhone' },
                body: { $first: '$body' }
            }
        },
        { $sort: { lastInboundAt: 1 } }
    ]);

    const byPhone = new Map();
    for (const row of inbound) {
        if (!String(row.body || '').trim()) continue;
        const state = await findContactStateForRow(row);
        const realPhone = realPhoneFor({ row, state });
        if (!realPhone.startsWith('593') && !isPriorityBotTestPhone(realPhone, row.peerPhone, state?.phoneDigits)) continue;

        const scope = buildMessageScopeForContact({ chatId: row._id, peerPhone: row.peerPhone, state });
        const outbound = await Message.findOne({
            isFromMe: true,
            createdAt: { $gte: row.lastInboundAt },
            $or: scope
        }).sort({ createdAt: -1 }).lean();
        const stateOutboundAfter = state?.lastOutboundAt && new Date(state.lastOutboundAt) >= new Date(row.lastInboundAt);
        if (outbound || stateOutboundAfter) continue;
        if (attemptedRecently({ state, lastInboundAt: row.lastInboundAt, cooldownMs })) continue;

        const current = byPhone.get(realPhone);
        if (!current || new Date(row.lastInboundAt) > new Date(current.row.lastInboundAt)) {
            byPhone.set(realPhone, { row, state, realPhone });
        }
    }

    return [...byPhone.values()]
        .sort((a, b) => new Date(a.row.lastInboundAt) - new Date(b.row.lastInboundAt))
        .slice(0, limit);
};

export const processBacklogRecovery = async ({
    since = new Date(Date.now() - parseNumber('WHATSAPP_BACKLOG_RECOVERY_LOOKBACK_HOURS', 12) * 60 * 60 * 1000),
    limit = parseNumber('WHATSAPP_BACKLOG_RECOVERY_BATCH_LIMIT', 2),
    delayMs = parseNumber('WHATSAPP_BACKLOG_RECOVERY_DELAY_MS', 15000),
    dryRun = false
} = {}) => {
    if (!hasConnectedWhatsApp()) {
        return { ok: true, skipped: 'no_connected_whatsapp_session', processed: 0, candidates: 0, items: [] };
    }

    const candidates = await findBacklogRecoveryCandidates({ since, limit });
    const items = candidates.map(({ row, realPhone }) => ({
        chatId: row._id,
        peerPhone: realPhone || row.peerPhone,
        at: row.lastInboundAt,
        preview: String(row.body || '').slice(0, 120)
    }));

    if (dryRun) {
        return { ok: true, dryRun: true, candidates: candidates.length, processed: 0, items };
    }

    let processed = 0;
    for (const { row, state, realPhone } of candidates) {
        const senderPn = state?.metadata?.lastSenderPn || `${realPhone}@s.whatsapp.net`;
        console.log(`[RECOVERY] backlog-auto -> ${row._id} | senderPn=${senderPn} | preview="${String(row.body || '').slice(0, 80)}"`);
        await markRecoveryAttempt({ state, row, status: 'started' });
        await vitPowerAgent.handleIncomingMessage({
            id: `recovery_${String(row.messageId).replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            from: row._id,
            to: 'bot',
            body: row.body,
            senderPn,
            sessionId: null,
            contactStateId: state?._id || null,
            fromMe: false,
            recovered: true
        });
        await markRecoveryAttempt({ state, row, status: 'processed' });
        processed += 1;
        if (delayMs && processed < candidates.length) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    return { ok: true, dryRun: false, candidates: candidates.length, processed, items };
};
