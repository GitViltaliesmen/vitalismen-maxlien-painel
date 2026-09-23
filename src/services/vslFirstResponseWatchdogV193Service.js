import crypto from 'node:crypto';
import ContactState from '../models/ContactState.js';

export const V193_WATCHDOG_BLOCKED_BUCKETS = Object.freeze(['orders', 'review', 'engagement']);

const text = (value = '') => String(value || '').trim();
const metadataOf = (state = {}) => state?.metadata && typeof state.metadata === 'object'
    ? state.metadata
    : {};

export const resolveV193OriginalIdentity = ({
    providerMessageId = '',
    providerZaapId = '',
    messageId = ''
} = {}) => text(providerMessageId) || text(providerZaapId) || text(messageId);

export const buildV193WatchdogCandidate = ({
    newMessage = false,
    vslRoutingAllowed = false,
    publicVslLeadEntry = false,
    refreshedVslAttribution = false,
    vslProductKey = '',
    type = '',
    body = '',
    providerMessageId = '',
    providerZaapId = '',
    messageId = '',
    authorizedTestRecipient = false
} = {}) => {
    const originalIdentity = resolveV193OriginalIdentity({
        providerMessageId,
        providerZaapId,
        messageId
    });
    const eligible = newMessage === true
        && vslRoutingAllowed === true
        && publicVslLeadEntry === true
        && refreshedVslAttribution === true
        && Boolean(text(vslProductKey))
        && text(type).toLowerCase() === 'chat'
        && Boolean(text(body))
        && Boolean(originalIdentity)
        && authorizedTestRecipient !== true;
    return {
        eligible,
        originalIdentity,
        watchdogKey: originalIdentity ? `zapi:${originalIdentity}` : '',
        reason: eligible
            ? 'fresh_first_vsl_entry_candidate'
            : authorizedTestRecipient === true
                ? 'authorized_qa_excluded'
                : newMessage !== true
                    ? 'not_new_message'
                    : refreshedVslAttribution !== true
                        ? 'persisted_context_without_fresh_attribution'
                        : text(type).toLowerCase() !== 'chat' || !text(body)
                            ? 'non_text_inbound'
                            : 'not_valid_vsl_entry'
    };
};

export const claimV193FirstEntryMarker = async ({
    contactStateId = '',
    candidate = {},
    providerMessageId = '',
    providerZaapId = '',
    persistedMessageId = '',
    inboundAt = new Date(),
    contactStateModel = ContactState
} = {}) => {
    if (!contactStateId || candidate?.eligible !== true || !candidate.originalIdentity || !candidate.watchdogKey) {
        return { claimed: false, reason: candidate?.reason || 'not_eligible' };
    }
    const at = inboundAt instanceof Date ? inboundAt : new Date(inboundAt);
    const claimed = await contactStateModel.findOneAndUpdate(
        {
            _id: contactStateId,
            $or: [
                { 'metadata.vslFirstEntryMessageId': { $exists: false } },
                { 'metadata.vslFirstEntryMessageId': null },
                { 'metadata.vslFirstEntryMessageId': '' }
            ]
        },
        {
            $set: {
                'metadata.vslFirstEntryMessageId': candidate.originalIdentity,
                'metadata.vslFirstEntryProviderMessageId': text(providerMessageId),
                'metadata.vslFirstEntryProviderZaapId': text(providerZaapId),
                'metadata.vslFirstEntryPersistedMessageId': text(persistedMessageId),
                'metadata.vslFirstEntryAt': at,
                'metadata.vslFirstResponseWatchdogKey': candidate.watchdogKey,
                'metadata.vslFirstResponseWatchdogStatus': 'armed',
                'metadata.vslFirstResponseWatchdogReason': 'first_vsl_entry',
                'metadata.vslFirstResponseWatchdogAt': at,
                'metadata.vslFirstResponseWatchdogAttemptCount': 0
            }
        },
        { new: true }
    ).lean();
    return claimed
        ? { claimed: true, reason: 'first_entry_marker_created', state: claimed }
        : { claimed: false, reason: 'first_entry_marker_already_exists' };
};

const currentBlockReason = (state = {}, expected = {}) => {
    if (!state) return 'contact_state_not_found';
    const metadata = metadataOf(state);
    if (text(metadata.vslFirstEntryMessageId) !== text(expected.originalIdentity)) return 'first_entry_marker_changed';
    if (text(metadata.vslFirstResponseWatchdogKey) !== text(expected.watchdogKey)) return 'watchdog_key_changed';
    if (state?.human?.mode === 'manual') return 'human_mode_manual';
    const bucket = text(state?.conversationBucket?.value).toLowerCase();
    if (V193_WATCHDOG_BLOCKED_BUCKETS.includes(bucket)) return `bucket_${bucket}`;
    return '';
};

const updateStatus = async ({
    contactStateModel,
    contactStateId,
    originalIdentity,
    watchdogKey,
    lockToken = '',
    status,
    reason,
    now = new Date()
}) => {
    const filter = {
        _id: contactStateId,
        'metadata.vslFirstEntryMessageId': originalIdentity,
        'metadata.vslFirstResponseWatchdogKey': watchdogKey,
        ...(lockToken ? { 'metadata.vslFirstResponseWatchdogLockToken': lockToken } : {})
    };
    await contactStateModel.updateOne(filter, {
        $set: {
            'metadata.vslFirstResponseWatchdogStatus': status,
            'metadata.vslFirstResponseWatchdogReason': reason,
            'metadata.vslFirstResponseWatchdogAt': now,
            ...(lockToken ? { 'metadata.vslFirstResponseWatchdogLockExpiresAt': now } : {})
        }
    });
};

export const runV193FirstResponseRecovery = async ({
    result = {},
    contactStateModel = ContactState,
    hasOutbound,
    routeMessage,
    now = () => new Date(),
    lockTtlMs = 120000
} = {}) => {
    if (
        result.eligibleForFirstResponseWatchdog !== true
        || !result.contactStateId
        || !result.vslFirstResponseWatchdogKey
        || !result.vslFirstEntryMessageId
        || typeof hasOutbound !== 'function'
        || typeof routeMessage !== 'function'
    ) {
        return { recoveryExecuted: false, reason: 'invalid_or_ineligible_result' };
    }
    const expected = {
        originalIdentity: result.vslFirstEntryMessageId,
        watchdogKey: result.vslFirstResponseWatchdogKey
    };
    const inboundAt = new Date(result.vslFirstEntryAt || result.inboundAt || Date.now());
    let state = await contactStateModel.findById(result.contactStateId).lean();
    const initialBlock = currentBlockReason(state, expected);
    if (initialBlock) return { recoveryExecuted: false, reason: initialBlock };

    if (await hasOutbound({ chatId: result.chatId, phone: result.phone, since: inboundAt })) {
        await updateStatus({
            contactStateModel,
            contactStateId: result.contactStateId,
            ...expected,
            status: 'answered',
            reason: 'outbound_found',
            now: now()
        });
        return { recoveryExecuted: false, reason: 'outbound_found', status: 'answered' };
    }

    const lockNow = now();
    const lockToken = crypto.randomUUID();
    const lockExpiresAt = new Date(lockNow.getTime() + lockTtlMs);
    const locked = await contactStateModel.findOneAndUpdate(
        {
            _id: result.contactStateId,
            'metadata.vslFirstEntryMessageId': expected.originalIdentity,
            'metadata.vslFirstResponseWatchdogKey': expected.watchdogKey,
            'human.mode': { $ne: 'manual' },
            'conversationBucket.value': { $nin: V193_WATCHDOG_BLOCKED_BUCKETS },
            $and: [
                {
                    $or: [
                        { 'metadata.vslFirstResponseWatchdogAttemptCount': { $exists: false } },
                        { 'metadata.vslFirstResponseWatchdogAttemptCount': { $lt: 1 } }
                    ]
                },
                {
                    $or: [
                        { 'metadata.vslFirstResponseWatchdogLockToken': { $exists: false } },
                        { 'metadata.vslFirstResponseWatchdogLockToken': '' },
                        { 'metadata.vslFirstResponseWatchdogLockExpiresAt': { $lte: lockNow } }
                    ]
                }
            ]
        },
        {
            $set: {
                'metadata.vslFirstResponseWatchdogLockToken': lockToken,
                'metadata.vslFirstResponseWatchdogLockExpiresAt': lockExpiresAt,
                'metadata.vslFirstResponseWatchdogStatus': 'reprocessing',
                'metadata.vslFirstResponseWatchdogReason': 'no_outbound_after_delay',
                'metadata.vslFirstResponseWatchdogAt': lockNow
            },
            $inc: { 'metadata.vslFirstResponseWatchdogAttemptCount': 1 }
        },
        { new: true }
    ).lean();
    if (!locked) return { recoveryExecuted: false, reason: 'recovery_already_claimed_or_blocked' };

    state = await contactStateModel.findById(result.contactStateId).lean();
    const boundaryBlock = currentBlockReason(state, expected);
    if (boundaryBlock) {
        await updateStatus({
            contactStateModel,
            contactStateId: result.contactStateId,
            ...expected,
            lockToken,
            status: 'blocked',
            reason: boundaryBlock,
            now: now()
        });
        return { recoveryExecuted: false, reason: boundaryBlock, lockClaimed: true };
    }
    if (await hasOutbound({ chatId: result.chatId, phone: result.phone, since: inboundAt })) {
        await updateStatus({
            contactStateModel,
            contactStateId: result.contactStateId,
            ...expected,
            lockToken,
            status: 'answered',
            reason: 'outbound_found',
            now: now()
        });
        return { recoveryExecuted: false, reason: 'outbound_found', status: 'answered', lockClaimed: true };
    }

    try {
        await routeMessage({
            id: `${result.messageId || expected.originalIdentity}:v193-first-response-recovery`,
            from: result.chatId,
            body: result.body,
            sessionId: 'zapi',
            senderPn: result.phone,
            recovered: true,
            fullMessage: { key: { senderPn: result.phone } }
        });
        const answered = await hasOutbound({ chatId: result.chatId, phone: result.phone, since: inboundAt });
        await updateStatus({
            contactStateModel,
            contactStateId: result.contactStateId,
            ...expected,
            lockToken,
            status: answered ? 'reprocessed' : 'failed',
            reason: answered ? 'outbound_after_reprocess' : 'no_outbound_after_reprocess',
            now: now()
        });
        return {
            recoveryExecuted: true,
            reason: answered ? 'outbound_after_reprocess' : 'no_outbound_after_reprocess',
            status: answered ? 'reprocessed' : 'failed'
        };
    } catch (error) {
        const answered = await hasOutbound({ chatId: result.chatId, phone: result.phone, since: inboundAt })
            .catch(() => false);
        await updateStatus({
            contactStateModel,
            contactStateId: result.contactStateId,
            ...expected,
            lockToken,
            status: answered ? 'answered' : 'failed',
            reason: answered ? 'outbound_found' : text(error?.message) || 'watchdog_error',
            now: now()
        });
        if (answered) return { recoveryExecuted: false, reason: 'outbound_found', status: 'answered' };
        throw error;
    }
};
