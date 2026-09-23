import crypto from 'node:crypto';

export const V191_DEFAULT_HOURS = 24;
export const V191_FIRST_REPLY_SLA_SECONDS = 120;
export const V191_QUEUE_STALE_SECONDS = 120;
export const V191_QA_PHONE = '5515998038637';

export const V191_LEDGER_STATES = Object.freeze([
    'RECEIVED',
    'PERSISTED',
    'ROUTE_OBSERVED',
    'FIRST_OUTBOUND',
    'PROVIDER_ACCEPTED',
    'DELIVERED',
    'READ',
    'NO_OUTBOUND_AFTER_SLA',
    'AMBIGUOUS'
]);

const VSL_MESSAGE_PREFIX = 'hola quiero el tratamiento tex ultra';
const FAILED_OUTBOUND_STATES = new Set(['failed', 'error', 'final_failed']);
const PROVIDER_ACCEPTED_STATES = new Set([
    'accepted',
    'queued',
    'sent',
    'pending_confirmation',
    'delivered',
    'read',
    'played'
]);

const clean = (value = '') => String(value || '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');
const asDate = (value) => {
    if (!value) return null;
    const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
};
const iso = (value) => asDate(value)?.toISOString() || null;
const idString = (value) => clean(value?._id?.toString?.() || value?.toString?.() || value);
const sha256 = (value = '') => crypto.createHash('sha256').update(String(value || '')).digest('hex');

export const normalizeV191Message = (value = '') => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const hashV191Phone = (value = '') => {
    const digits = digitsOnly(value);
    return digits ? sha256(digits) : '';
};

export const hashV191MessageBody = (value = '') => {
    const normalized = normalizeV191Message(value);
    return normalized ? sha256(normalized) : '';
};

const phoneFromMessage = (message = {}) => {
    const candidates = [message.peerPhone, message.chatId, message.from, message.to]
        .map(digitsOnly)
        .filter(Boolean);
    return candidates.find((value) => value.length >= 8) || '';
};

const phoneTail = (value = '') => {
    const digits = digitsOnly(value);
    return digits.length >= 9 ? digits.slice(-9) : digits;
};

const validChatId = (value = '') => {
    const chatId = clean(value);
    if (!chatId || chatId === 'status@broadcast' || /@g\.us$/i.test(chatId)) return '';
    return chatId;
};

const conversationIdentity = (message = {}) => {
    const chatId = validChatId(message.chatId);
    if (chatId) return `chat:${chatId}`;
    const tail = phoneTail(phoneFromMessage(message));
    return tail ? `phone:${tail}` : '';
};

const sameConversation = (left = {}, right = {}) => {
    const leftChat = validChatId(left.chatId);
    const rightChat = validChatId(right.chatId);
    if (leftChat && rightChat) return leftChat === rightChat;
    const leftTail = phoneTail(phoneFromMessage(left));
    const rightTail = phoneTail(phoneFromMessage(right));
    return Boolean(leftTail && rightTail && leftTail === rightTail);
};

const messagePersistedAt = (message = {}) => asDate(message?.createdAt);

const messageReceivedAt = (message = {}) => {
    const numeric = Number(message.timestamp);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    return asDate(millis);
};

const isInbound = (message = {}) => (
    message.isFromMe !== true
    && message.isBot !== true
    && !/^bot$/i.test(clean(message.from))
    && Boolean(conversationIdentity(message))
);

const isOutbound = (message = {}) => message.isFromMe === true;

const isQaMessage = (message = {}) => digitsOnly(phoneFromMessage(message)) === V191_QA_PHONE;

const isExplicitProtocoloGEntry = (message = {}) => (
    normalizeV191Message(message.body).startsWith(VSL_MESSAGE_PREFIX)
);

const outboundTerminalRank = (message = {}) => {
    const status = clean(message.deliveryStatus).toLowerCase();
    const providerStatus = clean(message.providerStatus).toLowerCase();
    const ack = Number(message.ack);
    if (message.readAt || status === 'read' || status === 'played' || providerStatus === 'read' || providerStatus === 'played' || ack >= 3) return 4;
    if (message.deliveredAt || status === 'delivered' || providerStatus === 'delivered' || ack === 2) return 3;
    if (clean(message.providerMessageId) || PROVIDER_ACCEPTED_STATES.has(providerStatus) || PROVIDER_ACCEPTED_STATES.has(status) || ack === 1) return 2;
    return 1;
};

const explicitProviderAccepted = (message = {}) => Boolean(
    clean(message.providerMessageId)
    || PROVIDER_ACCEPTED_STATES.has(clean(message.providerStatus).toLowerCase())
);

const providerAcceptedAt = (message = {}) => {
    if (!explicitProviderAccepted(message)) return null;
    return asDate(message.providerAcceptedAt)
        || asDate(message.sentAt)
        || messagePersistedAt(message);
};

const deliveredAt = (message = {}) => {
    if (outboundTerminalRank(message) < 3) return null;
    return asDate(message.deliveredAt)
        || asDate(message.readAt)
        || asDate(message.updatedAt)
        || messagePersistedAt(message);
};

const readAt = (message = {}) => {
    if (outboundTerminalRank(message) < 4) return null;
    return asDate(message.readAt)
        || asDate(message.updatedAt)
        || messagePersistedAt(message);
};

const routeAttemptObservedAt = (message = {}) => (
    asDate(message.queueClaimedAt)
    || asDate(message.queueCompletedAt)
    || null
);

const normalizeStatePhone = (state = {}) => digitsOnly(
    state.phoneDigits
    || state.metadata?.customerPhoneDigits
    || state.metadata?.lastSenderPn
);

const findContactState = (message = {}, states = []) => {
    const chatId = validChatId(message.chatId);
    const tail = phoneTail(phoneFromMessage(message));
    return states.find((state) => chatId && validChatId(state.chatId) === chatId)
        || states.find((state) => tail && phoneTail(normalizeStatePhone(state)) === tail)
        || null;
};

const visitMessageValues = (visit = {}) => [
    visit.lastWhatsappMessage,
    visit.lastEntryMessage,
    visit.vslEntryMessage
].map(normalizeV191Message).filter(Boolean);

const stateVisitIdentifiers = (state = {}) => ({
    visitId: clean(state.metadata?.vslVisitId),
    visitorId: clean(state.metadata?.vslVisitorId),
    externalId: clean(
        state.metadata?.tracking?.external_id
        || state.metadata?.tracking?.externalId
    )
});

const findPersistedVisitLink = ({ message = {}, state = null, visits = [] } = {}) => {
    const identifiers = stateVisitIdentifiers(state || {});
    const tail = phoneTail(phoneFromMessage(message));
    return visits.find((visit) => identifiers.visitId && idString(visit) === identifiers.visitId)
        || visits.find((visit) => identifiers.visitorId && [visit.visitorId, visit.externalId].map(clean).includes(identifiers.visitorId))
        || visits.find((visit) => identifiers.externalId && clean(visit.externalId) === identifiers.externalId)
        || visits.find((visit) => tail && phoneTail(visit.customerPhone) === tail && Boolean(visit.customerPhone))
        || null;
};

const lateAttributionCandidates = ({ inbound = {}, visits = [] } = {}) => {
    const inboundAt = messagePersistedAt(inbound);
    const normalizedBody = normalizeV191Message(inbound.body);
    if (!inboundAt || !normalizedBody) return [];
    return visits.filter((visit) => {
        if (visit.attributionClaimedAt || digitsOnly(visit.customerPhone)) return false;
        if (!visitMessageValues(visit).includes(normalizedBody)) return false;
        const clickAt = asDate(visit.lastClickAt);
        if (!clickAt) return false;
        const deltaMs = clickAt.getTime() - inboundAt.getTime();
        return deltaMs > 30_000 && deltaMs <= 180_000;
    });
};

const millisecondsBetween = (later, earlier) => {
    const laterDate = asDate(later);
    const earlierDate = asDate(earlier);
    if (!laterDate || !earlierDate) return null;
    const difference = laterDate.getTime() - earlierDate.getTime();
    return difference >= 0 ? difference : null;
};

const percentile = (values = [], percentage = 0.5) => {
    const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
    if (!sorted.length) return null;
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentage) - 1));
    return sorted[index];
};

const percentage = (part, total) => total > 0
    ? Number(((part / total) * 100).toFixed(2))
    : 0;

const publicRow = ({
    inbound,
    state,
    firstOutbound,
    linkedVisit,
    lateCandidate,
    now,
    slaSeconds
}) => {
    const provider = clean(inbound.provider).toLowerCase();
    const providerMessageId = clean(inbound.providerMessageId);
    const persistedDate = messagePersistedAt(inbound);
    const receivedDate = messageReceivedAt(inbound);
    const routeDate = routeAttemptObservedAt(inbound);
    const firstOutboundDate = firstOutbound ? messagePersistedAt(firstOutbound) : null;
    const acceptedDate = firstOutbound ? providerAcceptedAt(firstOutbound) : null;
    const deliveredDate = firstOutbound ? deliveredAt(firstOutbound) : null;
    const readDate = firstOutbound ? readAt(firstOutbound) : null;
    const phone = phoneFromMessage(inbound);
    const ageMs = persistedDate ? now.getTime() - persistedDate.getTime() : 0;
    const noOutboundAfterSla = Boolean(
        persistedDate
        && !firstOutboundDate
        && ageMs > slaSeconds * 1000
    );
    const evidenceSources = [];
    if (receivedDate) evidenceSources.push('Message.timestamp');
    if (persistedDate) evidenceSources.push('Message.createdAt');
    if (routeDate) evidenceSources.push(inbound.queueClaimedAt ? 'Message.queueClaimedAt' : 'Message.queueCompletedAt');
    if (firstOutboundDate) evidenceSources.push('Message.isFromMe');
    if (acceptedDate) evidenceSources.push(firstOutbound.providerMessageId ? 'Message.providerMessageId' : 'Message.providerStatus');
    if (deliveredDate) evidenceSources.push(firstOutbound.deliveredAt ? 'Message.deliveredAt' : 'Message.ack');
    if (readDate) evidenceSources.push(firstOutbound.readAt ? 'Message.readAt' : 'Message.ack');
    if (linkedVisit) evidenceSources.push('PersistedVslLink');

    let classification = 'PERSISTED';
    if (!provider || !providerMessageId) classification = 'AMBIGUOUS';
    else if (readDate) classification = 'READ';
    else if (deliveredDate) classification = 'DELIVERED';
    else if (acceptedDate) classification = 'PROVIDER_ACCEPTED';
    else if (firstOutboundDate) classification = 'FIRST_OUTBOUND';
    else if (routeDate) classification = 'ROUTE_OBSERVED';
    else if (noOutboundAfterSla) classification = 'NO_OUTBOUND_AFTER_SLA';
    else if (!persistedDate && receivedDate) classification = 'RECEIVED';

    const bucket = clean(state?.conversationBucket?.value);
    const humanHeld = clean(state?.human?.mode).toLowerCase() === 'manual';
    const watchdogStatus = clean(state?.metadata?.vslFirstResponseWatchdogStatus).toLowerCase();
    const watchdogFalsePositiveCandidate = Boolean(firstOutboundDate && watchdogStatus === 'failed');

    return {
        ledgerKey: provider && providerMessageId ? `${provider}:${providerMessageId}` : null,
        provider: provider || null,
        providerMessageId: providerMessageId || null,
        phoneHash: hashV191Phone(phone),
        phoneLast4: digitsOnly(phone).slice(-4),
        messageType: clean(inbound.type) || 'chat',
        messageBodyHash: hashV191MessageBody(inbound.body),
        receivedAt: iso(receivedDate),
        persistedAt: iso(persistedDate),
        routeAttemptObservedAt: iso(routeDate),
        firstOutboundAt: iso(firstOutboundDate),
        providerAcceptedAt: iso(acceptedDate),
        deliveredAt: iso(deliveredDate),
        readAt: iso(readDate),
        classification,
        firstReplyLatencyMs: millisecondsBetween(firstOutboundDate, persistedDate),
        deliveryLatencyMs: millisecondsBetween(deliveredDate, persistedDate),
        readLatencyMs: millisecondsBetween(readDate, persistedDate),
        vslLinked: Boolean(linkedVisit),
        vslVisitIdHash: linkedVisit ? sha256(idString(linkedVisit)) : '',
        funnel: clean(linkedVisit?.funnel || state?.metadata?.funnel || state?.metadata?.vslVariant),
        productKey: clean(linkedVisit?.productKey || state?.metadata?.vslProductKey || state?.metadata?.productKey),
        bucket,
        humanHeld,
        evidenceSources: [...new Set(evidenceSources)],
        vslExplicitEntry: isExplicitProtocoloGEntry(inbound),
        lateAttributionCandidate: Boolean(lateCandidate),
        watchdogFalsePositiveCandidate,
        _conversationIdentity: conversationIdentity(inbound),
        _qa: isQaMessage(inbound),
        _persistedAtMs: persistedDate?.getTime() || 0,
        _normalizedBody: normalizeV191Message(inbound.body)
    };
};

const sanitizedLedgerRow = (row = {}) => {
    const {
        _conversationIdentity,
        _qa,
        _persistedAtMs,
        _normalizedBody,
        ...sanitized
    } = row;
    return sanitized;
};

const staleQueueCount = ({ messages = [], now, queueStaleSeconds }) => messages.filter((message) => {
    const status = clean(message.queueStatus).toUpperCase();
    if (status === 'PENDING') {
        const createdAt = messagePersistedAt(message);
        return Boolean(createdAt && now.getTime() - createdAt.getTime() > queueStaleSeconds * 1000);
    }
    if (status === 'CLAIMED') {
        const leaseUntil = asDate(message.queueLeaseUntil);
        return Boolean(leaseUntil && leaseUntil.getTime() < now.getTime());
    }
    return false;
}).length;

const failedZapiOutboundCount = (messages = []) => messages.filter((message) => (
    isOutbound(message)
    && clean(message.provider).toLowerCase() === 'zapi'
    && (
        FAILED_OUTBOUND_STATES.has(clean(message.deliveryStatus).toLowerCase())
        || Number(message.ack) < 0
    )
)).length;

const clickWithoutConfirmedInboundCount = ({ visits = [], inboundRows = [], windowStart, now }) => {
    const canonicalRows = inboundRows.filter((row) => row.ledgerKey && row._normalizedBody);
    return visits.filter((visit) => {
        const clickAt = asDate(visit.lastClickAt);
        if (!clickAt || clickAt < windowStart || clickAt > now || Number(visit.clickCount || 0) <= 0) return false;
        if (digitsOnly(visit.customerPhone) === V191_QA_PHONE) return false;
        const visitMessages = visitMessageValues(visit);
        if (!visitMessages.length) return true;
        return !canonicalRows.some((row) => (
            visitMessages.includes(row._normalizedBody)
            && Math.abs(row._persistedAtMs - clickAt.getTime()) <= 10 * 60 * 1000
        ));
    }).length;
};

export const buildVslIngressLedgerV191 = ({
    messages = [],
    queueMessages = [],
    visits = [],
    contactStates = [],
    now = new Date(),
    windowStart = new Date(Date.now() - V191_DEFAULT_HOURS * 60 * 60 * 1000),
    slaSeconds = V191_FIRST_REPLY_SLA_SECONDS,
    queueStaleSeconds = V191_QUEUE_STALE_SECONDS,
    includeQa = false
} = {}) => {
    const nowDate = asDate(now) || new Date();
    const windowStartDate = asDate(windowStart) || new Date(nowDate.getTime() - V191_DEFAULT_HOURS * 60 * 60 * 1000);
    const windowMessages = messages.filter((message) => {
        const createdAt = messagePersistedAt(message);
        return createdAt && createdAt >= windowStartDate && createdAt <= nowDate;
    });
    const inbounds = windowMessages
        .filter(isInbound)
        .filter((message) => includeQa || !isQaMessage(message))
        .sort((left, right) => messagePersistedAt(left) - messagePersistedAt(right));
    const outbounds = windowMessages
        .filter(isOutbound)
        .sort((left, right) => messagePersistedAt(left) - messagePersistedAt(right));

    const internalRows = inbounds.map((inbound) => {
        const inboundAt = messagePersistedAt(inbound);
        const firstOutbound = outbounds.find((outbound) => (
            inboundAt
            && messagePersistedAt(outbound) > inboundAt
            && sameConversation(inbound, outbound)
        )) || null;
        const state = findContactState(inbound, contactStates);
        const linkedVisit = findPersistedVisitLink({ message: inbound, state, visits });
        const lateCandidates = linkedVisit ? [] : lateAttributionCandidates({ inbound, visits });
        return publicRow({
            inbound,
            state,
            firstOutbound,
            linkedVisit,
            lateCandidate: lateCandidates.length === 1,
            now: nowDate,
            slaSeconds
        });
    });

    const vslRows = internalRows.filter((row) => row.vslExplicitEntry);
    const vslReplyLatencies = vslRows
        .map((row) => row.firstReplyLatencyMs)
        .filter(Number.isFinite);
    const watchdogConversations = new Set(
        internalRows
            .filter((row) => row.watchdogFalsePositiveCandidate)
            .map((row) => row._conversationIdentity)
            .filter(Boolean)
    );
    const lateAttributionConversations = new Set(
        internalRows
            .filter((row) => row.lateAttributionCandidate)
            .map((row) => row._conversationIdentity)
            .filter(Boolean)
    );
    const allQueueMessages = [...messages, ...queueMessages].filter((message, index, all) => {
        const identity = idString(message) || `${conversationIdentity(message)}:${iso(message.createdAt)}`;
        return all.findIndex((candidate) => (idString(candidate) || `${conversationIdentity(candidate)}:${iso(candidate.createdAt)}`) === identity) === index;
    });

    const summary = {
        TOTAL_INBOUNDS: internalRows.length,
        UNIQUE_CONVERSATIONS: new Set(internalRows.map((row) => row._conversationIdentity).filter(Boolean)).size,
        VSL_EXPLICIT_ENTRIES: vslRows.length,
        REAL_PROTOCOLO_G_ENTRIES_EX_QA: includeQa ? vslRows.filter((row) => !row._qa).length : vslRows.length,
        VSL_LINKED: vslRows.filter((row) => row.vslLinked).length,
        FIRST_OUTBOUND_FOUND: internalRows.filter((row) => row.firstOutboundAt).length,
        REAL_RESPONDED: vslRows.filter((row) => row.firstOutboundAt).length,
        PROVIDER_ACCEPTED: internalRows.filter((row) => row.providerAcceptedAt).length,
        DELIVERED: internalRows.filter((row) => row.deliveredAt).length,
        READ: internalRows.filter((row) => row.readAt).length,
        NO_OUTBOUND_AFTER_SLA: internalRows.filter((row) => row.classification === 'NO_OUTBOUND_AFTER_SLA').length,
        AMBIGUOUS: internalRows.filter((row) => row.classification === 'AMBIGUOUS').length,
        FIRST_REPLY_MIN_MS: vslReplyLatencies.length ? Math.min(...vslReplyLatencies) : null,
        FIRST_REPLY_MEDIAN_MS: percentile(vslReplyLatencies, 0.5),
        FIRST_REPLY_P95_MS: percentile(vslReplyLatencies, 0.95),
        FIRST_REPLY_MAX_MS: vslReplyLatencies.length ? Math.max(...vslReplyLatencies) : null,
        STALE_PENDING_QUEUE: staleQueueCount({ messages: allQueueMessages, now: nowDate, queueStaleSeconds }),
        FAILED_ZAPI_OUTBOUND: failedZapiOutboundCount(windowMessages),
        RESPONSE_COVERAGE_PERCENT: percentage(vslRows.filter((row) => row.firstOutboundAt).length, vslRows.length),
        UNDER_120S_PERCENT: percentage(vslRows.filter((row) => Number.isFinite(row.firstReplyLatencyMs) && row.firstReplyLatencyMs <= slaSeconds * 1000).length, vslRows.length),
        ORPHAN_INBOUND_AFTER_120S: internalRows.filter((row) => row.classification === 'NO_OUTBOUND_AFTER_SLA').length,
        WATCHDOG_FALSE_POSITIVE_CANDIDATES: watchdogConversations.size,
        LATE_ATTRIBUTION_CANDIDATES: lateAttributionConversations.size,
        CLICK_WITHOUT_CONFIRMED_INBOUND: clickWithoutConfirmedInboundCount({
            visits,
            inboundRows: internalRows,
            windowStart: windowStartDate,
            now: nowDate
        })
    };

    return {
        generatedAt: nowDate.toISOString(),
        windowStart: windowStartDate.toISOString(),
        slaSeconds,
        queueStaleSeconds,
        includeQa,
        summary,
        ledger: internalRows.map(sanitizedLedgerRow)
    };
};

const messageProjection = [
    '_id',
    'chatId',
    'peerPhone',
    'from',
    'to',
    'body',
    'type',
    'timestamp',
    'sessionId',
    'isFromMe',
    'isBot',
    'senderRole',
    'provider',
    'providerMessageId',
    'providerStatus',
    'deliveryStatus',
    'ack',
    'deliveredAt',
    'readAt',
    'queueStatus',
    'queueClaimedAt',
    'queueCompletedAt',
    'queueLeaseUntil',
    'createdAt',
    'updatedAt'
].join(' ');

const stateProjection = [
    'chatId',
    'phoneDigits',
    'human.mode',
    'conversationBucket.value',
    'metadata.customerPhoneDigits',
    'metadata.lastSenderPn',
    'metadata.vslVisitId',
    'metadata.vslVisitorId',
    'metadata.vslVariant',
    'metadata.vslProductKey',
    'metadata.productKey',
    'metadata.tracking.external_id',
    'metadata.tracking.externalId',
    'metadata.vslFirstResponseWatchdogStatus',
    'metadata.vslFirstResponseWatchdogReason',
    'metadata.vslFirstResponseWatchdogAt'
].join(' ');

const visitProjection = [
    '_id',
    'visitorKey',
    'visitorId',
    'externalId',
    'customerPhone',
    'country',
    'productKey',
    'funnel',
    'lastWhatsappMessage',
    'lastEntryMessage',
    'vslEntryMessage',
    'clickCount',
    'lastClickAt',
    'lastSeenAt',
    'attributionClaimedAt'
].join(' ');

export const collectV191ReadOnlySnapshot = async ({
    MessageModel,
    VslVisitModel,
    ContactStateModel,
    now = new Date(),
    windowStart,
    slaSeconds = V191_FIRST_REPLY_SLA_SECONDS,
    queueStaleSeconds = V191_QUEUE_STALE_SECONDS,
    includeQa = false
} = {}) => {
    if (!MessageModel || !VslVisitModel || !ContactStateModel) {
        throw new Error('V191_READ_MODELS_REQUIRED');
    }
    const nowDate = asDate(now) || new Date();
    const windowStartDate = asDate(windowStart) || new Date(nowDate.getTime() - V191_DEFAULT_HOURS * 60 * 60 * 1000);
    const scanStart = new Date(windowStartDate.getTime() - 10 * 60 * 1000);

    const messages = await MessageModel.find({
        createdAt: { $gte: scanStart, $lte: nowDate }
    }).select(messageProjection).sort({ createdAt: 1 }).lean();

    const queueMessages = await MessageModel.find({
        queueStatus: { $in: ['PENDING', 'CLAIMED', 'COMPLETED', 'FAILED'] }
    }).select(messageProjection).sort({ createdAt: 1 }).lean();

    const chatIds = [...new Set(messages.map((message) => validChatId(message.chatId)).filter(Boolean))];
    const phoneDigits = [...new Set(messages.map(phoneFromMessage).filter(Boolean))];
    const stateConditions = [];
    if (chatIds.length) stateConditions.push({ chatId: { $in: chatIds } });
    if (phoneDigits.length) stateConditions.push({ phoneDigits: { $in: phoneDigits } });
    const contactStates = stateConditions.length
        ? await ContactStateModel.find({ $or: stateConditions }).select(stateProjection).lean()
        : [];

    const linkedVisitIds = [...new Set(contactStates.map((state) => clean(state.metadata?.vslVisitId)).filter(Boolean))];
    const visitConditions = [
        { lastClickAt: { $gte: scanStart, $lte: nowDate } },
        { lastSeenAt: { $gte: scanStart, $lte: nowDate } }
    ];
    if (linkedVisitIds.length) visitConditions.push({ _id: { $in: linkedVisitIds } });
    const visits = await VslVisitModel.find({
        country: 'EC',
        $or: visitConditions
    }).select(visitProjection).sort({ lastClickAt: 1, lastSeenAt: 1 }).lean();

    return buildVslIngressLedgerV191({
        messages,
        queueMessages,
        visits,
        contactStates,
        now: nowDate,
        windowStart: windowStartDate,
        slaSeconds,
        queueStaleSeconds,
        includeQa
    });
};

export const inspectV191LedgerByPhone = (ledgerResult = {}, phone = '') => {
    const phoneHash = hashV191Phone(phone);
    if (!phoneHash) return null;
    const candidates = (ledgerResult.ledger || [])
        .filter((row) => row.phoneHash === phoneHash)
        .sort((left, right) => String(left.persistedAt).localeCompare(String(right.persistedAt)));
    return candidates.find((row) => row.vslExplicitEntry) || candidates[0] || null;
};
