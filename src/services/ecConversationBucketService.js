import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import {
    panelWarmupManualEngagementBlockersV118,
    panelWarmupQaReplyAllowedV118,
    shouldPreservePanelWarmupManualEngagementV118
} from './panelWarmupIsolationV118Service.js';

export const EC_CONVERSATION_BUCKETS = Object.freeze({
    ATTENDANCE: 'attendance',
    ENGAGEMENT: 'engagement',
    ORDERS: 'orders',
    REVIEW: 'review'
});

const DAY_MS = 24 * 60 * 60 * 1000;
const EVIDENCE_WINDOW_DAYS = 90;
const RECENT_COMMERCIAL_DAYS = 14;
const RECENT_ENGAGEMENT_DAYS = 60;
const MAX_HISTORY_ITEMS = 50;
const VALID_BUCKETS = new Set(Object.values(EC_CONVERSATION_BUCKETS));
const CLOSED_ORDER_STATUSES = new Set(['delivered', 'cancelled', 'returned']);
const PANEL_SYSTEM_ID_REGEX = /^(?:panel_action_|zapi_watchdog_)/i;
const MEDIA_TOKEN_REGEX = /^\[(?:audio|ptt|image|video|document|sticker|media)\]$/i;
const SIMPLE_URL_REGEX = /^https?:\/\/\S+$/i;
const URL_REGEX = /https?:\/\/\S+/i;
const EMOJI_OR_PUNCTUATION_ONLY_REGEX = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}\p{Regional_Indicator}\s.,!?¿¡:;()\-_'"*]+$/u;

const COMMERCIAL_REGEX = /\b(?:precio|precios|cuanto|cuesta|valor|promocion|descuento|barato|comprar|compro|compra|quiero|deseo|tratamiento|producto|tex\s*ultra|nitrix(?:\s*oxide)?|vit\s*power|frasco|frascos|botella|botellas|cantidad|pedido|orden|pagar|pago|contraentrega|contra\s+entrega|agencia|servientrega|domicilio|direccion|provincia|ciudad|envio|entrega|guia|retirar|retiro|devolucion|reclamo|queja|no\s+llego|funciona|tomar|toma|dosis|usar)\b/i;
const SUPPORT_REGEX = /\b(?:pedido|orden|guia|envio|entrega|servientrega|agencia|retirar|retiro|devolucion|reclamo|queja|no\s+llego|donde\s+esta|seguimiento|rastreo|pago|cobro|cambio|equivocado|problema)\b/i;
const STRONG_PURCHASE_REGEX = /(?:\b(?:quiero|deseo|voy\s+a\s+comprar|compro|comprar|mande|envie|separe|confirmo|listo)\b[\s\S]{0,80}\b(?:tex\s*ultra|nitrix(?:\s*oxide)?|vit\s*power|producto|tratamiento|frasco|frascos|botella|botellas|pedido)\b)|(?:\b(?:1|2|3|6|uno|dos|tres|seis)\s*(?:frasco|frascos|botella|botellas)\b)/i;
const PRICE_OBJECTION_REGEX = /\b(?:muy\s+caro|esta\s+caro|mas\s+barato|precio\s+alto|descuento|rebaja|otra\s+oferta|vi\s+mas\s+barato)\b/i;
const RISK_REGEX = /\b(?:sexo|sexual|porn|pornografia|xxx|desnud|chup|culo|pene|vagina|meterte|metertelo|violacion|amenaz|matar|violencia|arma|droga|extors|codigo\s+de\s+verificacion|contrasena|clave\s+bancaria)\b/i;
const OPT_OUT_REGEX = /\b(?:no\s+me\s+escrib|no\s+quiero\s+mensaje|deje\s+de\s+escribir|no\s+contacte|basta|bloquear|pare|no\s+moleste)\b/i;
const GREETING_REGEX = /\b(?:hola|buenos\s+dias|buenas\s+tardes|buenas\s+noches|saludos|como\s+esta|como\s+estas|que\s+tal)\b/i;
const ACTIVE_FUNNEL_STAGE_REGEX = /^(?:awaiting_|sdr_awaiting_)/;
const TERMINAL_OR_HUMAN_STAGE_REGEX = /(?:confirmed|cancelled|closed|handoff|paused|completed|failed)/;

export const countEcEngagementPassiveInbound = ({ automation = {}, messageId = '', eligible = false } = {}) => {
    const normalizedMessageId = String(messageId || '').trim();
    const cycle = Math.max(0, Number(automation.passiveReplyCycle || 0));
    const target = [2, 3].includes(Number(automation.passiveReplyTarget))
        ? Number(automation.passiveReplyTarget)
        : 2 + (cycle % 2);
    const previousMessageId = String(automation.passiveLastCountedMessageId || '');
    const shouldCount = Boolean(eligible && normalizedMessageId && normalizedMessageId !== previousMessageId);
    return {
        passiveInboundCount: shouldCount
            ? Math.max(0, Number(automation.passiveInboundCount || 0)) + 1
            : Math.max(0, Number(automation.passiveInboundCount || 0)),
        passiveReplyTarget: target,
        passiveReplyCycle: cycle,
        passiveLastCountedMessageId: shouldCount ? normalizedMessageId : previousMessageId,
        counted: shouldCount
    };
};

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const escapeRegex = (value = '') => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const normalizeConversationText = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const asDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const messageAt = (message = {}) => {
    if (Number(message.timestamp || 0) > 0) return new Date(Number(message.timestamp) * 1000);
    return asDate(message.createdAt || message.updatedAt);
};

const realConversationMessage = (message = {}) => (
    String(message.type || '').toLowerCase() !== 'system'
    && String(message.senderRole || '').toLowerCase() !== 'system'
    && !PANEL_SYSTEM_ID_REGEX.test(String(message._id || ''))
);

const logicalMessages = (messages = []) => {
    const seenProvider = new Set();
    const seenFallback = new Set();
    const output = [];
    for (const message of Array.isArray(messages) ? messages : []) {
        if (!realConversationMessage(message)) continue;
        const providerId = String(message.providerMessageId || '').trim();
        if (providerId) {
            if (seenProvider.has(providerId)) continue;
            seenProvider.add(providerId);
        } else {
            const fallback = [
                message.isFromMe ? 'out' : 'in',
                String(message.type || 'chat'),
                normalizeConversationText(message.body),
                Number(message.timestamp || 0)
            ].join('|');
            if (seenFallback.has(fallback)) continue;
            seenFallback.add(fallback);
        }
        output.push(message);
    }
    return output.sort((left, right) => (messageAt(left)?.getTime() || 0) - (messageAt(right)?.getTime() || 0));
};

const isActiveShipment = (shipment = {}) => {
    if (shipment.outcomes?.pickedUp || shipment.outcomes?.delivered || shipment.outcomes?.returned) return false;
    const status = normalizeConversationText(shipment.logistics?.status || shipment.shippingStatus || '');
    if (!status) return true;
    return !/(?:delivered|entregado|returned|devuelto|cancel)/.test(status);
};

const isActiveOrder = (order = {}) => !CLOSED_ORDER_STATUSES.has(normalizeConversationText(order.status));

const statePhoneDigits = (state = {}) => digitsOnly(
    state.phoneDigits
    || state.metadata?.customerPhoneDigits
    || state.metadata?.customerDraft?.phone
    || state.chatId
);

export const activeEcCommercialFunnelStage = (state = {}) => {
    const productKey = String(state.metadata?.productKey || '').trim();
    if (!['tex_ultra_ec', 'nitrix_ec', 'vit_power_ec'].includes(productKey)) return '';
    const productMemory = state.metadata?.perAgentMemory?.[productKey] || {};
    const stage = normalizeConversationText(
        productMemory.stage
        || productMemory.principalSdrStage
        || productMemory.lastFunnelStage
        || state.metadata?.lastKnownFunnelStage
        || ''
    ).replace(/\s+/g, '_');
    if (!ACTIVE_FUNNEL_STAGE_REGEX.test(stage) || TERMINAL_OR_HUMAN_STAGE_REGEX.test(stage)) return '';
    return stage;
};

const phoneTails = (value = '') => {
    const digits = digitsOnly(value);
    return [...new Set([
        digits,
        digits.length >= 8 ? digits.slice(-8) : '',
        digits.length >= 9 ? digits.slice(-9) : '',
        digits.length >= 10 ? digits.slice(-10) : ''
    ].filter((tail) => tail.length >= 8))];
};

const phoneRegexes = (value = '') => phoneTails(value).map((tail) => new RegExp(`${escapeRegex(tail)}$`));

const messageLookup = (state = {}) => {
    const phone = statePhoneDigits(state);
    const regexes = phoneRegexes(phone);
    const chatId = String(state.chatId || '').trim();
    const clauses = [];
    if (chatId) clauses.push({ chatId }, { from: chatId }, { to: chatId });
    if (regexes.length) {
        clauses.push(
            { peerPhone: { $in: regexes } },
            { chatId: { $in: regexes } },
            { from: { $in: regexes } },
            { to: { $in: regexes } }
        );
    }
    return clauses;
};

const orderLookup = (state = {}) => {
    const regexes = phoneRegexes(statePhoneDigits(state));
    return regexes.length ? { 'customer.phone': { $in: regexes } } : null;
};

const shipmentLookup = (state = {}) => {
    const regexes = phoneRegexes(statePhoneDigits(state));
    return regexes.length ? { 'client.phone': { $in: regexes } } : null;
};

export const loadEcConversationEvidence = async (state, { messageLimit = 350 } = {}) => {
    const messageOr = messageLookup(state);
    const orderQuery = orderLookup(state);
    const shipmentQuery = shipmentLookup(state);
    const [messages, orders, shipments] = await Promise.all([
        messageOr.length
            ? Message.find({ $or: messageOr })
                .sort({ timestamp: -1, createdAt: -1 })
                .limit(Math.max(20, Math.min(1000, Number(messageLimit) || 350)))
                .lean()
                .catch(() => [])
            : [],
        orderQuery
            ? Order.find({ country: 'EC', ...orderQuery }).sort({ updatedAt: -1 }).limit(20).lean().catch(() => [])
            : [],
        shipmentQuery
            ? Shipment.find({ country: 'EC', ...shipmentQuery }).sort({ updatedAt: -1 }).limit(20).lean().catch(() => [])
            : []
    ]);
    return { messages, orders, shipments };
};

const messageText = (message = {}) => normalizeConversationText(message.body || '');
const hasQuestion = (value = '') => /[?¿]/.test(String(value || ''));

export const currentInboundKind = (message = {}) => {
    const type = String(message.type || 'chat').toLowerCase();
    const text = messageText(message);
    const hasMedia = Boolean(message.hasMedia) || !['chat', 'system'].includes(type) || MEDIA_TOKEN_REGEX.test(text);
    if (hasMedia && (!text || MEDIA_TOKEN_REGEX.test(text))) return 'media_only';
    if (!text) return 'empty';
    if (SIMPLE_URL_REGEX.test(text)) return 'link_only';
    if (EMOJI_OR_PUNCTUATION_ONLY_REGEX.test(text) && !/[\p{Letter}\p{Number}]/u.test(text)) return 'reaction_only';
    if (hasQuestion(text)) return 'question';
    if (GREETING_REGEX.test(text)) return 'greeting';
    return 'statement';
};

const confidenceFor = (bucket, score) => {
    if (bucket === EC_CONVERSATION_BUCKETS.REVIEW && score >= 95) return 'high';
    if (bucket === EC_CONVERSATION_BUCKETS.ENGAGEMENT && score >= 80) return 'high';
    if (score >= 85) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
};

export const classifyEcConversationSnapshot = ({
    state = {},
    messages = [],
    orders = [],
    shipments = [],
    currentMessage = null,
    now = new Date()
} = {}) => {
    const referenceNow = asDate(now) || new Date();
    const nowMs = referenceNow.getTime();
    const logical = logicalMessages(messages);
    const inbound = logical.filter((message) => !message.isFromMe);
    const outbound = logical.filter((message) => message.isFromMe);
    const latestInbound = currentMessage || [...inbound].reverse().find(Boolean) || null;
    const latestText = messageText(latestInbound || {});
    const evidenceSince = nowMs - EVIDENCE_WINDOW_DAYS * DAY_MS;
    const commercialSince = nowMs - RECENT_COMMERCIAL_DAYS * DAY_MS;
    const engagementSince = nowMs - RECENT_ENGAGEMENT_DAYS * DAY_MS;
    const evidenceInbound = inbound.filter((message) => (messageAt(message)?.getTime() || 0) >= evidenceSince);
    const recentCommercialInbound = inbound.filter((message) => (messageAt(message)?.getTime() || 0) >= commercialSince);
    const recentEngagementInbound = inbound.filter((message) => (messageAt(message)?.getTime() || 0) >= engagementSince);
    const recentEngagementOutbound = outbound.filter((message) => (messageAt(message)?.getTime() || 0) >= engagementSince);
    const evidenceText = evidenceInbound.map(messageText).filter(Boolean).join(' \n ');
    const recentCommercialText = recentCommercialInbound.map(messageText).filter(Boolean).join(' \n ');
    const activeOrders = (orders || []).filter(isActiveOrder);
    const activeShipments = (shipments || []).filter(isActiveShipment);
    const activeDays = new Set(recentEngagementInbound.map((message) => messageAt(message)?.toISOString().slice(0, 10)).filter(Boolean));
    const questions = recentEngagementInbound.filter((message) => hasQuestion(message.body)).length;
    const links = recentEngagementInbound.filter((message) => URL_REGEX.test(String(message.body || ''))).length;
    const media = recentEngagementInbound.filter((message) => (
        Boolean(message.hasMedia)
        || !['chat', 'system'].includes(String(message.type || 'chat').toLowerCase())
        || MEDIA_TOKEN_REGEX.test(String(message.body || '').trim())
    )).length;
    const conversationalTextCount = recentEngagementInbound.filter((message) => {
        const kind = currentInboundKind(message);
        return ['question', 'greeting', 'statement'].includes(kind) && messageText(message).length >= 3;
    }).length;
    const linkMediaDominant = recentEngagementInbound.length > 0
        && (links + media) / recentEngagementInbound.length >= 0.6;
    const protectedTestContact = statePhoneDigits(state).endsWith('998038637');
    const risk = RISK_REGEX.test(evidenceText) || RISK_REGEX.test(latestText);
    const optOut = OPT_OUT_REGEX.test(recentCommercialText) || OPT_OUT_REGEX.test(latestText);
    const strongPurchase = STRONG_PURCHASE_REGEX.test(latestText);
    const priceObjection = PRICE_OBJECTION_REGEX.test(latestText);
    const activeCommercialStage = activeEcCommercialFunnelStage(state);
    const inboundKind = currentInboundKind(latestInbound || {});
    const contextualFunnelReply = Boolean(activeCommercialStage)
        && !['empty', 'reaction_only', 'media_only', 'link_only'].includes(inboundKind);
    const supportIntent = SUPPORT_REGEX.test(latestText)
        || (activeOrders.length + activeShipments.length > 0 && SUPPORT_REGEX.test(recentCommercialText));
    const commercialIntent = contextualFunnelReply
        || strongPurchase
        || priceObjection
        || COMMERCIAL_REGEX.test(latestText)
        || (recentCommercialInbound.length <= 4 && COMMERCIAL_REGEX.test(recentCommercialText));
    const highConfidenceEngagement = (
        recentEngagementInbound.length >= 4
        && recentEngagementOutbound.length >= 2
        && activeDays.size >= 2
        && conversationalTextCount >= 3
        && questions >= 1
        && !linkMediaDominant
    );
    const legacyManualAllowed = state.metadata?.warmup?.allowed === true
        || (Array.isArray(state.tags) && state.tags.includes('warmup:allowed'));
    const hardExclusions = [];
    if (protectedTestContact) hardExclusions.push('protected_test_contact');
    if (risk) hardExclusions.push('safety_risk');
    if (optOut) hardExclusions.push('opt_out');
    if (activeOrders.length || activeShipments.length) hardExclusions.push('active_order_obligation');
    if (supportIntent) hardExclusions.push('support_intent');
    if (commercialIntent) hardExclusions.push('commercial_intent');

    let bucket = EC_CONVERSATION_BUCKETS.REVIEW;
    let score = 55;
    const reasons = [];
    if (protectedTestContact) {
        bucket = EC_CONVERSATION_BUCKETS.REVIEW;
        score = 100;
        reasons.push('protected_test_contact');
    } else if (risk || optOut) {
        bucket = EC_CONVERSATION_BUCKETS.REVIEW;
        score = 100;
        reasons.push(risk ? 'safety_risk' : 'opt_out');
    } else if (activeOrders.length || activeShipments.length || supportIntent) {
        bucket = EC_CONVERSATION_BUCKETS.ORDERS;
        score = 100;
        reasons.push(activeOrders.length || activeShipments.length ? 'active_order_obligation' : 'support_intent');
    } else if (commercialIntent) {
        bucket = EC_CONVERSATION_BUCKETS.ATTENDANCE;
        score = strongPurchase || contextualFunnelReply ? 100 : 95;
        reasons.push(
            contextualFunnelReply
                ? 'active_funnel_reply'
                : strongPurchase
                    ? 'strong_purchase_intent'
                    : priceObjection
                        ? 'price_objection'
                        : 'commercial_intent'
        );
    } else if (highConfidenceEngagement) {
        bucket = EC_CONVERSATION_BUCKETS.ENGAGEMENT;
        score = Math.min(98, 72 + Math.min(10, activeDays.size) + Math.min(8, recentEngagementInbound.length) + Math.min(8, questions));
        reasons.push('repeated_safe_two_way_dialogue');
    } else if (legacyManualAllowed && !linkMediaDominant && conversationalTextCount >= 2) {
        bucket = EC_CONVERSATION_BUCKETS.ENGAGEMENT;
        score = 82;
        reasons.push('manual_engagement_approval_with_safe_dialogue');
    } else {
        bucket = EC_CONVERSATION_BUCKETS.REVIEW;
        score = linkMediaDominant ? 70 : 55;
        reasons.push(linkMediaDominant ? 'media_or_links_ambiguous' : 'insufficient_high_confidence');
    }

    return {
        bucket,
        score,
        confidence: confidenceFor(bucket, score),
        reasons,
        hardExclusions,
        eligibleForEngagement: hardExclusions.length === 0 && !linkMediaDominant,
        replyEligibleByHistory: bucket === EC_CONVERSATION_BUCKETS.ENGAGEMENT && (legacyManualAllowed || highConfidenceEngagement),
        currentInboundKind: currentInboundKind(latestInbound || {}),
        currentMessageId: String(latestInbound?._id || latestInbound?.id || ''),
        metrics: {
            rawRecords: Array.isArray(messages) ? messages.length : 0,
            logicalMessages: logical.length,
            inboundMessages: inbound.length,
            outboundMessages: outbound.length,
            recentInboundMessages: recentEngagementInbound.length,
            recentOutboundMessages: recentEngagementOutbound.length,
            activeDays: activeDays.size,
            questions,
            links,
            media,
            conversationalTextCount,
            activeOrders: activeOrders.length,
            activeShipments: activeShipments.length,
            linkMediaDominant,
            risk,
            optOut,
            supportIntent,
            commercialIntent,
            contextualFunnelReply,
            activeCommercialStage,
            strongPurchase,
            priceObjection,
            legacyManualAllowed,
            protectedTestContact
        }
    };
};

const bucketTags = new Set([
    'conversation:attendance',
    'conversation:engagement',
    'conversation:orders',
    'conversation:review'
]);

const appendBucketHistory = (state, entry) => {
    const current = Array.isArray(state.conversationBucket?.history)
        ? state.conversationBucket.history.map((item) => item?.toObject?.() || item)
        : [];
    return [...current, entry].slice(-MAX_HISTORY_ITEMS);
};

const applyCompatibilityTags = (state, classification) => {
    const tagSet = new Set(Array.isArray(state.tags) ? state.tags : []);
    for (const tag of bucketTags) tagSet.delete(tag);
    tagSet.add(`conversation:${classification.bucket}`);
    if (classification.bucket === EC_CONVERSATION_BUCKETS.REVIEW && classification.metrics?.risk) {
        tagSet.delete('warmup:allowed');
        tagSet.delete('warmup:vip');
        tagSet.add('warmup:risk');
        tagSet.add('warmup:manual_only');
    }
    if (classification.bucket === EC_CONVERSATION_BUCKETS.ATTENDANCE && classification.metrics?.commercialIntent) {
        tagSet.delete('warmup:allowed');
        tagSet.delete('warmup:vip');
    }
    state.tags = [...tagSet];
};

export const persistEcConversationClassification = async ({
    state,
    classification,
    source = 'inbound_rule_v40',
    by = '',
    manual = false,
    countInbound = false,
    reason = ''
} = {}) => {
    if (!state || !classification || !VALID_BUCKETS.has(classification.bucket)) {
        throw new Error('invalid_ec_conversation_classification');
    }
    const now = new Date();
    const previousValue = String(state.conversationBucket?.value || 'attendance');
    const changed = previousValue !== classification.bucket;
    const history = changed
        ? appendBucketHistory(state, {
            from: previousValue,
            to: classification.bucket,
            source,
            reason: reason || classification.reasons?.join(',') || '',
            score: Number(classification.score || 0),
            by,
            at: now
        })
        : (state.conversationBucket?.history || []);
    state.conversationBucket = {
        ...(state.conversationBucket?.toObject?.() || state.conversationBucket || {}),
        value: classification.bucket,
        previousValue: changed ? previousValue : String(state.conversationBucket?.previousValue || ''),
        source,
        confidence: classification.confidence || 'low',
        score: Number(classification.score || 0),
        reasons: classification.reasons || [],
        classifiedAt: now,
        ...(manual ? { manualSelectedAt: now, manualSelectedBy: by || 'painel' } : {}),
        ...(classification.metrics?.commercialIntent ? { commercialInterruptedAt: now } : {}),
        ...(classification.metrics?.risk ? { riskDetectedAt: now } : {}),
        history
    };
    const previousEngagementAutomation = state.engagementAutomation?.toObject?.()
        || state.engagementAutomation
        || {};
    const currentMessageId = String(classification.currentMessageId || '').trim();
    const manuallyApprovedEngagement = classification.bucket === EC_CONVERSATION_BUCKETS.ENGAGEMENT
        && Boolean(state.conversationBucket?.manualSelectedAt)
        && state.metadata?.warmup?.allowed === true
        && state.metadata?.warmup?.blocked !== true
        && state.metadata?.warmup?.risk !== true
        && !(classification.hardExclusions || []).length;
    const countThisInbound = countInbound
        && manuallyApprovedEngagement
        && currentMessageId
        && currentMessageId !== String(previousEngagementAutomation.passiveLastCountedMessageId || '');
    const passiveCounter = countEcEngagementPassiveInbound({
        automation: previousEngagementAutomation,
        messageId: currentMessageId,
        eligible: countThisInbound
    });
    state.engagementAutomation = {
        ...previousEngagementAutomation,
        lastEvaluatedAt: now,
        lastDecision: `${classification.bucket}:${classification.reasons?.[0] || 'classified'}`,
        lastInboundMessageId: currentMessageId || previousEngagementAutomation.lastInboundMessageId || '',
        passiveInboundCount: passiveCounter.passiveInboundCount,
        passiveReplyTarget: passiveCounter.passiveReplyTarget,
        passiveReplyCycle: passiveCounter.passiveReplyCycle,
        passiveLastCountedMessageId: passiveCounter.passiveLastCountedMessageId,
        localDecisionCount: Number(previousEngagementAutomation.localDecisionCount || 0) + 1,
        modelCallCount: Number(previousEngagementAutomation.modelCallCount || 0),
        estimatedCostUsd: Number(previousEngagementAutomation.estimatedCostUsd || 0),
        ...(classification.metrics?.risk || classification.metrics?.optOut ? {
            blockedAt: now,
            blockedReason: classification.metrics?.risk ? 'safety_risk' : 'opt_out'
        } : {})
    };
    applyCompatibilityTags(state, classification);
    if (
        classification.metrics?.risk
        || classification.metrics?.optOut
        || classification.metrics?.commercialIntent
        || classification.metrics?.supportIntent
        || Number(classification.metrics?.activeOrders || 0) > 0
        || Number(classification.metrics?.activeShipments || 0) > 0
    ) {
        const reviewBlocked = classification.bucket === EC_CONVERSATION_BUCKETS.REVIEW;
        state.metadata = {
            ...(state.metadata || {}),
            warmup: {
                ...(state.metadata?.warmup || {}),
                allowed: false,
                blocked: reviewBlocked,
                risk: classification.metrics?.risk === true,
                manualOnly: reviewBlocked,
                category: reviewBlocked ? 'review' : 'returned_to_operation',
                updatedAt: now,
                updatedBy: by || 'classificador_v40',
                source
            }
        };
        state.markModified('metadata');
    }
    state.markModified('conversationBucket');
    state.markModified('engagementAutomation');
    state.markModified('tags');
    await state.save();
    return { state, classification, changed, previousValue };
};

export const classifyAndPersistEcConversation = async ({
    state,
    currentMessage = null,
    source = 'inbound_rule_v40',
    messageLimit = 350
} = {}) => {
    if (!state) throw new Error('contact_state_required');
    const evidence = await loadEcConversationEvidence(state, { messageLimit });
    const classification = classifyEcConversationSnapshot({
        state,
        ...evidence,
        currentMessage,
        now: new Date()
    });
    const manualEngagement = state.conversationBucket?.value === EC_CONVERSATION_BUCKETS.ENGAGEMENT
        && state.conversationBucket?.manualSelectedAt
        && (
            classification.hardExclusions.length === 0
            || shouldPreservePanelWarmupManualEngagementV118({
                state,
                hardExclusions: classification.hardExclusions
            })
        );
    if (manualEngagement && classification.bucket === EC_CONVERSATION_BUCKETS.REVIEW) {
        classification.bucket = EC_CONVERSATION_BUCKETS.ENGAGEMENT;
        classification.score = Math.max(80, classification.score || 0);
        classification.confidence = 'high';
        classification.reasons = [classification.hardExclusions.length
            ? 'manual_qa_panel_engagement_preserved_v118'
            : 'manual_engagement_preserved_without_exclusion'];
        classification.replyEligibleByHistory = panelWarmupQaReplyAllowedV118(state);
    }
    return persistEcConversationClassification({
        state,
        classification,
        source,
        countInbound: true
    });
};

export const setEcConversationBucketManually = async ({
    state,
    bucket,
    by = '',
    source = 'panel_bucket_selection'
} = {}) => {
    if (!state || !VALID_BUCKETS.has(bucket)) throw new Error('invalid_conversation_bucket');
    const evidence = await loadEcConversationEvidence(state);
    const evaluated = classifyEcConversationSnapshot({ state, ...evidence, now: new Date() });
    const engagementBlockers = panelWarmupManualEngagementBlockersV118({
        state,
        hardExclusions: evaluated.hardExclusions
    });
    if (bucket === EC_CONVERSATION_BUCKETS.ENGAGEMENT && engagementBlockers.length) {
        const error = new Error(`engagement_blocked:${engagementBlockers.join(',')}`);
        error.code = 'ENGAGEMENT_BLOCKED';
        error.classification = evaluated;
        throw error;
    }
    if (bucket === EC_CONVERSATION_BUCKETS.ORDERS && !evaluated.metrics.activeOrders && !evaluated.metrics.activeShipments && !evaluated.metrics.supportIntent) {
        const error = new Error('orders_bucket_requires_operational_obligation');
        error.code = 'ORDERS_BUCKET_REQUIRES_OBLIGATION';
        error.classification = evaluated;
        throw error;
    }
    const now = new Date();
    const classification = {
        ...evaluated,
        bucket,
        score: 100,
        confidence: 'high',
        reasons: [`manual_${bucket}`]
    };
    if (bucket === EC_CONVERSATION_BUCKETS.ENGAGEMENT) {
        state.metadata = {
            ...(state.metadata || {}),
            warmup: {
                ...(state.metadata?.warmup || {}),
                allowed: true,
                blocked: false,
                risk: false,
                manualOnly: false,
                category: state.metadata?.warmup?.vip ? 'vip' : 'allowed',
                updatedAt: now,
                updatedBy: by || 'painel',
                source
            }
        };
        state.engagementAutomation = {
            ...(state.engagementAutomation?.toObject?.() || state.engagementAutomation || {}),
            approvedAt: now,
            approvedBy: by || 'painel',
            approvalSource: source,
            blockedAt: null,
            blockedReason: '',
            passiveInboundCount: 0,
            passiveReplyTarget: 2,
            passiveReplyCycle: 0,
            passiveLastCountedMessageId: ''
        };
        state.markModified('metadata');
        state.markModified('engagementAutomation');
    } else {
        state.metadata = {
            ...(state.metadata || {}),
            warmup: {
                ...(state.metadata?.warmup || {}),
                allowed: false,
                blocked: bucket === EC_CONVERSATION_BUCKETS.REVIEW,
                risk: bucket === EC_CONVERSATION_BUCKETS.REVIEW && evaluated.metrics.risk,
                manualOnly: bucket === EC_CONVERSATION_BUCKETS.REVIEW,
                category: bucket === EC_CONVERSATION_BUCKETS.REVIEW ? 'review' : 'removed',
                updatedAt: now,
                updatedBy: by || 'painel',
                source
            }
        };
        state.markModified('metadata');
        state.engagementAutomation = {
            ...(state.engagementAutomation?.toObject?.() || state.engagementAutomation || {}),
            passiveInboundCount: 0,
            passiveReplyTarget: 2,
            passiveReplyCycle: 0,
            passiveLastCountedMessageId: ''
        };
        state.markModified('engagementAutomation');
    }
    return persistEcConversationClassification({
        state,
        classification,
        source,
        by,
        manual: true,
        reason: `manual_${bucket}`
    });
};

export const conversationBucketPanelView = (state = {}, { hasOperationalOrder = false } = {}) => {
    const stored = String(state.conversationBucket?.value || '').trim();
    let value = VALID_BUCKETS.has(stored) ? stored : '';
    if (hasOperationalOrder) value = EC_CONVERSATION_BUCKETS.ORDERS;
    if (!value && (state.tags || []).includes('warmup:risk')) value = EC_CONVERSATION_BUCKETS.REVIEW;
    if (!value && ((state.tags || []).includes('warmup:allowed') || state.metadata?.warmup?.allowed === true)) {
        value = EC_CONVERSATION_BUCKETS.ENGAGEMENT;
    }
    if (!value) value = EC_CONVERSATION_BUCKETS.ATTENDANCE;
    return {
        value,
        source: hasOperationalOrder ? 'active_order_projection' : state.conversationBucket?.source || 'legacy_projection',
        confidence: state.conversationBucket?.confidence || 'low',
        score: Number(state.conversationBucket?.score || 0),
        reasons: state.conversationBucket?.reasons || [],
        classifiedAt: state.conversationBucket?.classifiedAt || null,
        manualSelectedAt: state.conversationBucket?.manualSelectedAt || null,
        engagement: {
            approvedAt: state.engagementAutomation?.approvedAt || null,
            approvedBy: state.engagementAutomation?.approvedBy || '',
            lastReplyAt: state.engagementAutomation?.lastReplyAt || null,
            lastDecision: state.engagementAutomation?.lastDecision || '',
            dailyReplyCount: Number(state.engagementAutomation?.dailyReplyCount || 0),
            passiveInboundCount: Number(state.engagementAutomation?.passiveInboundCount || 0),
            passiveReplyTarget: [2, 3].includes(Number(state.engagementAutomation?.passiveReplyTarget))
                ? Number(state.engagementAutomation.passiveReplyTarget)
                : 2,
            passiveReplyCycle: Number(state.engagementAutomation?.passiveReplyCycle || 0),
            localDecisionCount: Number(state.engagementAutomation?.localDecisionCount || 0),
            modelCallCount: Number(state.engagementAutomation?.modelCallCount || 0),
            estimatedCostUsd: Number(state.engagementAutomation?.estimatedCostUsd || 0)
        }
    };
};

export const auditEcConversationContact = async (state) => {
    const evidence = await loadEcConversationEvidence(state, { messageLimit: 1000 });
    return classifyEcConversationSnapshot({ state, ...evidence, now: new Date() });
};

export const findEcContactState = async ({ phone = '', chatId = '' } = {}) => {
    const digits = digitsOnly(phone || chatId);
    const regexes = phoneRegexes(digits);
    const or = [];
    if (chatId) or.push({ chatId });
    if (digits) or.push({ phoneDigits: digits });
    if (regexes.length) or.push({ phoneDigits: { $in: regexes } });
    if (!or.length) return null;
    return ContactState.findOne({ $or: or }).sort({ updatedAt: -1 });
};
