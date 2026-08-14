import crypto from 'node:crypto';
import ContactState from '../models/ContactState.js';
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

const sendConfirmedAudio = async ({ contactStateId, orderId, sessionId, stepKey, audioName }) => {
    const claim = await claimAudioStep({ contactStateId, orderId, stepKey });
    if (!claim) return { sent: false, skipped: true, reason: 'locked' };
    if (claim.alreadySent) return { sent: false, skipped: true, reason: 'already_sent' };

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
    if (!thankYou.sent && thankYou.reason !== 'already_sent') {
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
    const safeLimit = Math.max(1, Math.min(Number(limit) || 3, 10));
    const orders = await Order.find({
        country: 'EC',
        confirmedAt: { $gte: cutoff, $lte: new Date() },
        status: { $in: [...ACTIVE_POST_SALE_STATUSES] },
        $or: [
            { 'tracking.productKey': ECUADOR_PRODUCTS.texUltra.key },
            { 'tracking.contentIds': ECUADOR_PRODUCTS.texUltra.key },
            { notes: /Produto: Tex Ultra Ecuador/i }
        ]
    }).sort({ confirmedAt: 1 }).limit(safeLimit * 8).lean();

    const candidates = [];
    for (const order of orders) {
        if (!isEligibleTexUltraOrder(order)) continue;
        const state = await contactStateForOrder(order);
        if (!state || operatorNoAutoResendState(state) || confirmedPostSaleComplete({ state, orderId: order.orderId })) continue;
        candidates.push({ order, state });
        if (candidates.length >= safeLimit) break;
    }
    if (dryRun) {
        return {
            enabled: true,
            dryRun: true,
            cutoff,
            candidates: candidates.length,
            processed: 0,
            completed: 0,
            orderIds: candidates.map(({ order }) => order.orderId),
            results: []
        };
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
        candidates: candidates.length,
        processed: results.length,
        completed: results.filter((result) => result.results?.every((step) => step.sent || step.reason === 'already_sent')).length,
        results
    };
};
