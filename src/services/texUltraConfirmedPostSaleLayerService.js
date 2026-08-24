import crypto from 'node:crypto';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { resolveCountryAudio } from './audioTemplateService.js';
import { ECUADOR_PRODUCTS, resolveEcuadorProductInfo } from './ecuadorProductService.js';
import { operatorNoAutoResendState } from './operatorNoAutoResendService.js';

export const TEX_ULTRA_CONFIRMED_POSTSALE_LAYER_ID = 'tex_ultra_confirmed_postsale_v1';
export const TEX_ULTRA_CONFIRMED_POSTSALE_AUDIO_NAMES = Object.freeze([
    'AGRADECIMENTO_AGENCIA_DE_ENTREGA',
    'BONUS_RETIRADA'
]);
export const texUltraConfirmedPostSaleEnabled = (env = process.env) => (
    String(env.TEX_ULTRA_CONFIRMED_POSTSALE_AUDIO_ENABLED || 'false').toLowerCase() === 'true'
);

const AGENT_KEY = 'tex_ultra_ec';
const ACTIVE_POST_SALE_STATUSES = new Set(['confirmed', 'processing', 'shipped']);
const LOCK_STALE_MS = 10 * 60 * 1000;
const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const chatIdOf = (state = {}) => state.chatId || (state.phoneDigits ? `${digitsOnly(state.phoneDigits)}@c.us` : '');
const memoryPath = `metadata.perAgentMemory.${AGENT_KEY}.confirmedPostSale`;
const nowIso = () => new Date().toISOString();
const escapeRegex = (value = '') => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const postSaleStepOf = ({ state = {}, orderId = '', stepKey = '' }) => (
    state?.metadata?.perAgentMemory?.[AGENT_KEY]?.confirmedPostSale?.[orderId]?.[stepKey] || {}
);

const claimAudioStep = async ({ contactStateId, orderId, stepKey }) => {
    const lockId = crypto.randomUUID();
    const sentAtPath = `${memoryPath}.${orderId}.${stepKey}.sentAt`;
    const lockAtPath = `${memoryPath}.${orderId}.${stepKey}.lockAt`;
    const lockIdPath = `${memoryPath}.${orderId}.${stepKey}.lockId`;
    const staleBefore = new Date(Date.now() - LOCK_STALE_MS).toISOString();
    const state = await ContactState.findOneAndUpdate(
        {
            _id: contactStateId,
            $and: [
                {
                    $or: [
                        { [sentAtPath]: { $in: ['', null] } },
                        { [sentAtPath]: { $exists: false } }
                    ]
                },
                {
                    $or: [
                        { [lockAtPath]: { $in: ['', null] } },
                        { [lockAtPath]: { $exists: false } },
                        { [lockAtPath]: { $lt: staleBefore } }
                    ]
                }
            ]
        },
        {
            $set: {
                [`${memoryPath}.${orderId}.orderId`]: orderId,
                [`${memoryPath}.${orderId}.${stepKey}.lockId`]: lockId,
                [`${memoryPath}.${orderId}.${stepKey}.lockAt`]: nowIso(),
                [`${memoryPath}.${orderId}.${stepKey}.failedAt`]: '',
                [`${memoryPath}.${orderId}.${stepKey}.lastError`]: ''
            }
        },
        { new: true }
    );
    if (state) return { state, lockId, lockIdPath, alreadySent: false };
    const existingState = await ContactState.findById(contactStateId).lean();
    return postSaleStepOf({ state: existingState, orderId, stepKey }).sentAt
        ? { state: existingState, lockId: '', lockIdPath, alreadySent: true }
        : null;
};

const finishAudioStep = async ({ contactStateId, orderId, stepKey, lockId, sent, error = '' }) => {
    const finishedAt = nowIso();
    await ContactState.updateOne(
        {
            _id: contactStateId,
            [`${memoryPath}.${orderId}.${stepKey}.lockId`]: lockId
        },
        {
            $set: {
                [`${memoryPath}.${orderId}.${stepKey}.lockId`]: '',
                [`${memoryPath}.${orderId}.${stepKey}.lockAt`]: '',
                [`${memoryPath}.${orderId}.${stepKey}.sentAt`]: sent ? finishedAt : '',
                [`${memoryPath}.${orderId}.${stepKey}.failedAt`]: sent ? '' : finishedAt,
                [`${memoryPath}.${orderId}.${stepKey}.lastError`]: sent ? '' : String(error || 'audio_send_failed').slice(0, 500),
                [`${memoryPath}.${orderId}.updatedAt`]: finishedAt
            }
        }
    );
};

const confirmedAudioHistory = async ({ state = {}, audioName = '' } = {}) => {
    if (!audioName || Message?.db?.readyState !== 1) return null;
    const chatId = chatIdOf(state);
    const phone = digitsOnly(state.phoneDigits || chatId);
    const tail = phone.length >= 9 ? phone.slice(-9) : '';
    const identityClauses = [
        chatId ? { chatId } : null,
        chatId ? { to: chatId } : null,
        phone ? { peerPhone: phone } : null,
        tail ? { peerPhone: { $regex: `${tail}$` } } : null
    ].filter(Boolean);
    if (!identityClauses.length) return null;
    const audioPattern = new RegExp(escapeRegex(audioName), 'i');
    return Message.findOne({
        $and: [
            { $or: identityClauses },
            { $or: [{ isFromMe: true }, { isBot: true }, { from: 'bot' }] },
            {
                $or: [
                    { body: audioPattern },
                    { mediaUrl: audioPattern },
                    { mediaPreviewUrl: audioPattern }
                ]
            }
        ]
    }).sort({ createdAt: -1, timestamp: -1 }).lean().catch(() => null);
};

const finishAudioStepFromHistory = async ({ contactStateId, orderId, stepKey, lockId, history }) => {
    const matchedAt = history?.createdAt || history?.updatedAt || (history?.timestamp ? new Date(history.timestamp * 1000) : new Date());
    await ContactState.updateOne(
        {
            _id: contactStateId,
            [`${memoryPath}.${orderId}.${stepKey}.lockId`]: lockId
        },
        {
            $set: {
                [`${memoryPath}.${orderId}.${stepKey}.lockId`]: '',
                [`${memoryPath}.${orderId}.${stepKey}.lockAt`]: '',
                [`${memoryPath}.${orderId}.${stepKey}.sentAt`]: matchedAt,
                [`${memoryPath}.${orderId}.${stepKey}.historyMatchedAt`]: nowIso(),
                [`${memoryPath}.${orderId}.${stepKey}.historyMessageId`]: String(history?._id || ''),
                [`${memoryPath}.${orderId}.${stepKey}.failedAt`]: '',
                [`${memoryPath}.${orderId}.${stepKey}.lastError`]: '',
                [`${memoryPath}.${orderId}.updatedAt`]: nowIso()
            }
        }
    );
};

const sendConfirmedAudio = async ({ contactStateId, orderId, sessionId, stepKey, audioName }) => {
    const claim = await claimAudioStep({ contactStateId, orderId, stepKey });
    if (!claim) return { sent: false, skipped: true, reason: 'locked' };
    if (claim.alreadySent) return { sent: false, skipped: true, reason: 'already_sent' };

    const history = await confirmedAudioHistory({ state: claim.state, audioName });
    if (history) {
        await finishAudioStepFromHistory({
            contactStateId,
            orderId,
            stepKey,
            lockId: claim.lockId,
            history
        });
        return { sent: false, skipped: true, reason: 'history_already_sent' };
    }

    let sent = false;
    let error = '';
    try {
        const audioPath = await resolveCountryAudio({ country: 'EC', baseName: audioName });
        if (!audioPath) throw new Error(`approved_audio_not_found:${audioName}`);
        sent = Boolean(await sendAudio(chatIdOf(claim.state), audioPath, true, {
            sessionId: sessionId || claim.state?.metadata?.lastSessionId || null,
            country: 'EC',
            allowExistingDropiOrder: true,
            outboundContext: `${TEX_ULTRA_CONFIRMED_POSTSALE_LAYER_ID}_${stepKey}`,
            dedupeValue: `${TEX_ULTRA_CONFIRMED_POSTSALE_LAYER_ID}:${orderId}:${stepKey}`
        }));
        if (!sent) error = 'send_audio_returned_false';
    } catch (sendError) {
        error = sendError.message || 'audio_send_failed';
    }

    await finishAudioStep({ contactStateId, orderId, stepKey, lockId: claim.lockId, sent, error });
    return { sent, skipped: false, reason: sent ? 'sent' : error };
};

export const sendTexUltraConfirmedPostSaleAudios = async ({ contactStateId, orderId, sessionId = null } = {}) => {
    if (!texUltraConfirmedPostSaleEnabled() || !contactStateId || !orderId) {
        return { handled: false, reason: 'disabled_or_missing_context', results: [] };
    }
    const currentState = await ContactState.findById(contactStateId).lean();
    if (!currentState) return { handled: false, reason: 'contact_state_missing', results: [] };
    if (operatorNoAutoResendState(currentState)) {
        return { handled: false, reason: 'operator_no_auto_resend', results: [] };
    }

    const results = [];
    const thankYou = await sendConfirmedAudio({
        contactStateId,
        orderId,
        sessionId,
        stepKey: 'thankYouAgency',
        audioName: TEX_ULTRA_CONFIRMED_POSTSALE_AUDIO_NAMES[0]
    });
    results.push(thankYou);
    if (!thankYou.sent && !['already_sent', 'history_already_sent'].includes(thankYou.reason)) {
        return { handled: true, reason: 'thank_you_not_confirmed', results };
    }
    results.push(await sendConfirmedAudio({
        contactStateId,
        orderId,
        sessionId,
        stepKey: 'pickupBonus',
        audioName: TEX_ULTRA_CONFIRMED_POSTSALE_AUDIO_NAMES[1]
    }));

    return { handled: true, results };
};

const confirmedPostSaleComplete = ({ state = {}, orderId = '' } = {}) => {
    const orderMemory = state?.metadata?.perAgentMemory?.[AGENT_KEY]?.confirmedPostSale?.[orderId] || {};
    return Boolean(orderMemory.thankYouAgency?.sentAt && orderMemory.pickupBonus?.sentAt);
};

const confirmedPostSaleStaleSuppressed = ({ state = {}, orderId = '' } = {}) => (
    state?.metadata?.perAgentMemory?.[AGENT_KEY]?.confirmedPostSale?.[orderId]?.historicalRecoveryStatus
    === 'stale_missing_not_replayed'
);

const reconcileConfirmedAudioStepFromHistoryOnly = async ({
    state,
    contactStateId,
    orderId,
    stepKey,
    audioName
}) => {
    if (postSaleStepOf({ state, orderId, stepKey }).sentAt) {
        return { stepKey, reconciled: false, reason: 'already_sent' };
    }
    const history = await confirmedAudioHistory({ state, audioName });
    if (!history) return { stepKey, reconciled: false, reason: 'history_missing' };
    const claim = await claimAudioStep({ contactStateId, orderId, stepKey });
    if (!claim) return { stepKey, reconciled: false, reason: 'locked' };
    if (claim.alreadySent) return { stepKey, reconciled: false, reason: 'already_sent' };
    await finishAudioStepFromHistory({
        contactStateId,
        orderId,
        stepKey,
        lockId: claim.lockId,
        history
    });
    return { stepKey, reconciled: true, reason: 'history_already_sent' };
};

const reconcileStaleConfirmedPostSaleHistory = async ({ state, orderId }) => {
    const steps = [
        ['thankYouAgency', TEX_ULTRA_CONFIRMED_POSTSALE_AUDIO_NAMES[0]],
        ['pickupBonus', TEX_ULTRA_CONFIRMED_POSTSALE_AUDIO_NAMES[1]]
    ];
    const results = [];
    for (const [stepKey, audioName] of steps) {
        results.push(await reconcileConfirmedAudioStepFromHistoryOnly({
            state,
            contactStateId: state._id,
            orderId,
            stepKey,
            audioName
        }));
    }
    if (results.some((result) => result.reason === 'locked')) {
        return { status: 'pending_lock', results };
    }
    const refreshed = await ContactState.findById(state._id).lean();
    const complete = confirmedPostSaleComplete({ state: refreshed, orderId });
    const checkedAt = nowIso();
    const status = complete ? 'complete_from_history' : 'stale_missing_not_replayed';
    await ContactState.updateOne(
        { _id: state._id },
        {
            $set: {
                [`${memoryPath}.${orderId}.historicalRecoveryCheckedAt`]: checkedAt,
                [`${memoryPath}.${orderId}.historicalRecoveryStatus`]: status,
                [`${memoryPath}.${orderId}.historicalRecoveryMissingSteps`]: complete
                    ? []
                    : results.filter((result) => result.reason === 'history_missing').map((result) => result.stepKey),
                [`${memoryPath}.${orderId}.updatedAt`]: checkedAt
            }
        }
    );
    return { status, results };
};

const contactStateForOrder = async (order = {}) => {
    const phone = digitsOnly(order?.customer?.phone);
    const tail = phone.slice(-9);
    if (!/^5939\d{8}$/.test(phone) || !tail) return null;
    return ContactState.findOne({
        $or: [
            { phoneDigits: { $regex: `${tail}$` } },
            { chatId: { $regex: tail } }
        ]
    }).sort({ updatedAt: -1 });
};

const isEligibleTexUltraOrder = (order = {}) => {
    if (!order?.orderId || !order?.confirmedAt) return false;
    if (!ACTIVE_POST_SALE_STATUSES.has(String(order.status || '').toLowerCase())) return false;
    const phone = digitsOnly(order?.customer?.phone);
    if (!/^5939\d{8}$/.test(phone) || phone.startsWith('59355')) return false;
    return resolveEcuadorProductInfo(order)?.key === ECUADOR_PRODUCTS.texUltra.key;
};

export const sendTexUltraConfirmedPostSaleForOrder = async ({ orderId, sessionId = null } = {}) => {
    const order = await Order.findOne({ orderId }).lean();
    if (!isEligibleTexUltraOrder(order)) {
        return { handled: false, orderId, reason: 'ineligible_order', results: [] };
    }
    const state = await contactStateForOrder(order);
    if (!state) return { handled: false, orderId, reason: 'contact_state_missing', results: [] };
    if (confirmedPostSaleComplete({ state, orderId })) {
        return { handled: true, orderId, reason: 'already_complete', results: [] };
    }
    const result = await sendTexUltraConfirmedPostSaleAudios({
        contactStateId: state._id,
        orderId,
        sessionId: sessionId || state.metadata?.lastSessionId || null
    });
    return { ...result, orderId, contactStateId: state._id };
};

const queueStartAt = (value = process.env.TEX_ULTRA_CONFIRMED_POSTSALE_QUEUE_START_AT) => {
    const parsed = new Date(String(value || ''));
    return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export const texUltraConfirmedPostSaleQueuePolicy = ({
    env = process.env,
    now = new Date(),
    batchLimit = 3
} = {}) => {
    const parsedScanLimit = Number.parseInt(String(env.TEX_ULTRA_CONFIRMED_POSTSALE_QUEUE_SCAN_LIMIT || '500'), 10);
    const parsedMaxAgeHours = Number.parseInt(String(env.TEX_ULTRA_CONFIRMED_POSTSALE_QUEUE_MAX_AGE_HOURS || '72'), 10);
    const parsedReconcileLimit = Number.parseInt(String(env.TEX_ULTRA_CONFIRMED_POSTSALE_HISTORY_RECONCILE_LIMIT || '25'), 10);
    const safeBatchLimit = Math.max(1, Math.min(Number(batchLimit) || 3, 10));
    const scanLimit = Math.max(
        safeBatchLimit * 8,
        Math.min(Number.isFinite(parsedScanLimit) ? parsedScanLimit : 500, 2000)
    );
    const maxAgeHours = Math.max(1, Math.min(Number.isFinite(parsedMaxAgeHours) ? parsedMaxAgeHours : 72, 24 * 30));
    const historyReconcileLimit = Math.max(1, Math.min(Number.isFinite(parsedReconcileLimit) ? parsedReconcileLimit : 25, 100));
    return Object.freeze({
        batchLimit: safeBatchLimit,
        scanLimit,
        maxAgeHours,
        historyReconcileLimit,
        oldestAutomaticSendAt: new Date(now.getTime() - (maxAgeHours * 60 * 60 * 1000))
    });
};

export const processTexUltraConfirmedPostSaleQueue = async ({
    limit = 3,
    dryRun = false,
    confirmedAfter = null
} = {}) => {
    if (!texUltraConfirmedPostSaleEnabled()) {
        return { enabled: false, dryRun, candidates: 0, processed: 0, completed: 0, results: [] };
    }
    const cutoff = confirmedAfter ? new Date(confirmedAfter) : queueStartAt();
    if (!cutoff || !Number.isFinite(cutoff.getTime())) {
        return { enabled: true, dryRun, candidates: 0, processed: 0, completed: 0, reason: 'missing_valid_cutoff', results: [] };
    }
    const now = new Date();
    const queuePolicy = texUltraConfirmedPostSaleQueuePolicy({ now, batchLimit: limit });
    const safeLimit = queuePolicy.batchLimit;
    const orders = await Order.find({
        country: 'EC',
        confirmedAt: { $gte: cutoff, $lte: now },
        status: { $in: [...ACTIVE_POST_SALE_STATUSES] },
        $or: [
            { 'tracking.productKey': ECUADOR_PRODUCTS.texUltra.key },
            { 'tracking.contentIds': ECUADOR_PRODUCTS.texUltra.key },
            { notes: /Produto: Tex Ultra Ecuador/i }
        ]
    }).sort({ confirmedAt: 1 }).limit(queuePolicy.scanLimit).lean();

    const candidates = [];
    const stalePendingReconciliation = [];
    let staleCandidates = 0;
    let staleSuppressedCandidates = 0;
    for (const order of orders) {
        if (!isEligibleTexUltraOrder(order)) continue;
        const state = await contactStateForOrder(order);
        if (!state || operatorNoAutoResendState(state) || confirmedPostSaleComplete({ state, orderId: order.orderId })) continue;
        const confirmedAt = new Date(order.confirmedAt);
        if (confirmedAt.getTime() < queuePolicy.oldestAutomaticSendAt.getTime()) {
            staleCandidates += 1;
            if (confirmedPostSaleStaleSuppressed({ state, orderId: order.orderId })) {
                staleSuppressedCandidates += 1;
            } else {
                stalePendingReconciliation.push({ order, state });
            }
            continue;
        }
        candidates.push({ order, state });
        if (candidates.length >= safeLimit) break;
    }
    if (dryRun) {
        return {
            enabled: true,
            dryRun: true,
            cutoff,
            scanned: orders.length,
            staleCandidates,
            staleSuppressedCandidates,
            stalePendingReconciliation: stalePendingReconciliation.length,
            maxAgeHours: queuePolicy.maxAgeHours,
            candidates: candidates.length,
            processed: 0,
            completed: 0,
            orderIds: candidates.map(({ order }) => order.orderId),
            results: []
        };
    }

    const staleReconciliationResults = [];
    for (const { order, state } of stalePendingReconciliation.slice(0, queuePolicy.historyReconcileLimit)) {
        staleReconciliationResults.push({
            orderId: order.orderId,
            ...(await reconcileStaleConfirmedPostSaleHistory({ state, orderId: order.orderId }))
        });
    }

    const results = [];
    for (const { order, state } of candidates) {
        const result = await sendTexUltraConfirmedPostSaleAudios({
            contactStateId: state._id,
            orderId: order.orderId,
            sessionId: state.metadata?.lastSessionId || null
        });
        results.push({ orderId: order.orderId, ...result });
    }
    return {
        enabled: true,
        dryRun: false,
        cutoff,
        scanned: orders.length,
        staleCandidates,
        staleSuppressedCandidates,
        stalePendingReconciliation: stalePendingReconciliation.length,
        staleReconciled: staleReconciliationResults.filter((item) => item.status === 'complete_from_history').length,
        staleSuppressed: staleReconciliationResults.filter((item) => item.status === 'stale_missing_not_replayed').length,
        staleReconciliationResults,
        maxAgeHours: queuePolicy.maxAgeHours,
        candidates: candidates.length,
        processed: results.length,
        completed: results.filter((result) => result.results?.every((step) => step.sent || ['already_sent', 'history_already_sent'].includes(step.reason))).length,
        results
    };
};
