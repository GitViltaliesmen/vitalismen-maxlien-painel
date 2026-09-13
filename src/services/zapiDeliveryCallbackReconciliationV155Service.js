const pendingCallbacks = new Map();

const clean = (value = '') => String(value || '').trim();
const digits = (value = '') => clean(value).replace(/\D/g, '');
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_PENDING_CALLBACKS = 1000;

const rank = (status = '', ack = 0) => {
    const value = clean(status).toLowerCase();
    const numericAck = Number(ack);
    if (value === 'read' || value === 'played' || numericAck >= 3) return 3;
    if (value === 'delivered' || numericAck === 2) return 2;
    if (['sent', 'pending_confirmation'].includes(value) || numericAck === 1) return 1;
    if (['failed', 'error', 'final_failed'].includes(value) || numericAck < 0) return -1;
    return 0;
};

const callbackKeys = ({ providerMessageId = '', providerZaapId = '' } = {}) => [
    clean(providerMessageId),
    clean(providerZaapId)
].filter(Boolean).map((value) => `provider:${value}`);

const removeReceipt = (receipt) => {
    for (const [key, value] of pendingCallbacks.entries()) {
        if (value === receipt) pendingCallbacks.delete(key);
    }
};

const prune = (nowMs = Date.now()) => {
    for (const receipt of new Set(pendingCallbacks.values())) {
        if (receipt.expiresAtMs <= nowMs) removeReceipt(receipt);
    }
    while (new Set(pendingCallbacks.values()).size >= MAX_PENDING_CALLBACKS) {
        const oldest = [...new Set(pendingCallbacks.values())]
            .sort((left, right) => (left.receivedAtMs || left.observedAtMs) - (right.receivedAtMs || right.observedAtMs))[0];
        if (!oldest) break;
        removeReceipt(oldest);
    }
};

export const rememberUnmatchedZapiDeliveryV155 = ({
    providerMessageId = '',
    providerZaapId = '',
    phone = '',
    deliveryStatus = '',
    providerStatus = '',
    ack = 0,
    sendError = '',
    observedAt = new Date(),
    receivedAt = new Date(),
    ttlMs = DEFAULT_TTL_MS
} = {}) => {
    const keys = callbackKeys({ providerMessageId, providerZaapId });
    if (!keys.length) return { remembered: false, reason: 'provider_identity_missing' };
    const observedAtMs = new Date(observedAt).getTime();
    const receivedAtMs = new Date(receivedAt).getTime();
    const safeReceivedAtMs = Number.isFinite(receivedAtMs) ? receivedAtMs : Date.now();
    const safeObservedAtMs = Number.isFinite(observedAtMs) ? observedAtMs : safeReceivedAtMs;
    prune(safeReceivedAtMs);
    const previous = keys.map((key) => pendingCallbacks.get(key)).find(Boolean);
    const incoming = {
        providerMessageId: clean(providerMessageId),
        providerZaapId: clean(providerZaapId),
        phone: digits(phone),
        deliveryStatus: clean(deliveryStatus),
        providerStatus: clean(providerStatus),
        ack: Number(ack || 0),
        sendError: clean(sendError).slice(0, 240),
        observedAtMs: safeObservedAtMs,
        receivedAtMs: safeReceivedAtMs,
        expiresAtMs: safeReceivedAtMs + Math.max(1000, Number(ttlMs) || DEFAULT_TTL_MS)
    };
    const receipt = previous && rank(previous.deliveryStatus, previous.ack) > rank(incoming.deliveryStatus, incoming.ack)
        ? previous
        : incoming;
    for (const key of new Set([
        ...keys,
        ...callbackKeys(previous || {}),
        ...callbackKeys(receipt)
    ])) pendingCallbacks.set(key, receipt);
    return { remembered: true, retainedStatus: receipt.deliveryStatus, retainedAck: receipt.ack };
};

export const reconcilePendingZapiDeliveryV155 = async (message, { now = new Date() } = {}) => {
    if (!message || clean(message.provider).toLowerCase() !== 'zapi') {
        return { reconciled: false, reason: 'not_zapi_message', message };
    }
    prune(new Date(now).getTime());
    const receipt = callbackKeys(message).map((key) => pendingCallbacks.get(key)).find(Boolean);
    if (!receipt) return { reconciled: false, reason: 'pending_callback_not_found', message };

    const messagePhone = digits(message.peerPhone || message.chatId || message.to);
    if (receipt.phone && messagePhone && receipt.phone !== messagePhone) {
        return { reconciled: false, reason: 'phone_mismatch', message };
    }

    removeReceipt(receipt);
    const currentRank = rank(message.deliveryStatus, message.ack);
    const incomingRank = rank(receipt.deliveryStatus, receipt.ack);
    const preserveCurrent = currentRank >= 2 && currentRank > incomingRank;
    const deliveryStatus = preserveCurrent ? message.deliveryStatus : receipt.deliveryStatus;
    const ack = Math.max(Number(message.ack || 0), Number(receipt.ack || 0));
    const observedAt = new Date(receipt.observedAtMs);
    const patch = {
        providerStatus: preserveCurrent ? (message.providerStatus || receipt.providerStatus) : receipt.providerStatus,
        deliveryStatus,
        ack,
        sendError: preserveCurrent ? (message.sendError || '') : receipt.sendError
    };
    if (ack >= 2) patch.deliveredAt = message.deliveredAt || observedAt;
    if (ack >= 3) patch.readAt = message.readAt || observedAt;
    if (typeof message.set === 'function') message.set(patch);
    else Object.assign(message, patch);
    if (typeof message.save === 'function') await message.save();
    return { reconciled: true, deliveryStatus, ack, message };
};

export const zapiDeliveryEvidenceFromLogV155 = (logText = '', providerIdentity = '') => {
    const expected = clean(providerIdentity);
    if (!expected) return { found: false, occurrences: 0, reason: 'provider_identity_missing' };
    const lines = String(logText || '').split(/\r?\n/);
    let requestAt = null;
    const evidence = [];
    for (const line of lines) {
        const requestMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[^ ]+) \| POST \/api\/zapi\/webhook(?:\/delivery)?$/);
        if (requestMatch) requestAt = requestMatch[1];
        const callback = line.match(/^\[ZAPI-WEBHOOK\] delivery \| matched=false \| method=none \| phone=(\d+) \| status=([^ |]+) \| id=([^ |]+)$/);
        if (!callback || callback[3] !== expected) continue;
        evidence.push({
            phone: digits(callback[1]),
            deliveryStatus: clean(callback[2]).toLowerCase(),
            providerStatus: clean(callback[2]).toLowerCase(),
            ack: rank(callback[2], callback[2] === 'delivered' ? 2 : callback[2] === 'read' ? 3 : callback[2] === 'sent' ? 1 : 0),
            observedAt: requestAt || ''
        });
    }
    if (!evidence.length) return { found: false, occurrences: 0, reason: 'exact_unmatched_callback_not_found' };
    const strongest = evidence.reduce((best, current) => (
        rank(current.deliveryStatus, current.ack) > rank(best.deliveryStatus, best.ack) ? current : best
    ));
    return { found: true, occurrences: evidence.length, strongest };
};

export const resetPendingZapiDeliveryV155ForTests = () => pendingCallbacks.clear();
