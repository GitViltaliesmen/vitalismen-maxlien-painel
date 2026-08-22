import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import { currentInboundKind, EC_CONVERSATION_BUCKETS, normalizeConversationText } from './ecConversationBucketService.js';

const DEFAULT_MIN_DELAY_MS = 12000;
const DEFAULT_MAX_DELAY_MS = 25000;
const DEFAULT_COOLDOWN_MINUTES = 30;
const DEFAULT_DAILY_LIMIT = 4;
const LOCK_MS = 2 * 60 * 1000;
const MAX_REPLY_HISTORY = 50;

const GREETING_REGEX = /\b(?:hola|buenos\s+dias|buenas\s+tardes|buenas\s+noches|saludos|como\s+esta|como\s+estas|que\s+tal)\b/i;
const WELLBEING_REGEX = /\b(?:como\s+amanec|como\s+sigue|como\s+le\s+va|como\s+ha\s+estado|todo\s+bien)\b/i;
const GRATITUDE_REGEX = /\b(?:gracias|muchas\s+gracias|mil\s+gracias|agradecido|agradecida|bendiciones|dios\s+le\s+bendiga)\b/i;

const REPLY_VARIANTS = Object.freeze({
    greeting: [
        '¡Hola! 😊 Gracias por escribir. ¿Cómo está hoy?',
        '¡Hola! Qué gusto saber de usted 😊 ¿Cómo le ha ido hoy?',
        '¡Hola! 😊 Le leo con gusto. ¿Cómo sigue por allá?'
    ],
    wellbeing: [
        'Muy bien, gracias por preguntar 😊 ¿Y cómo ha estado usted?',
        'Gracias por preguntar 😊 Todo bien por aquí. ¿Cómo sigue su día?',
        'Qué amable 😊 Estoy bien. ¿Y usted, cómo se encuentra hoy?'
    ],
    question: [
        'Le leo 😊 Cuénteme un poco más, ¿qué pasó?',
        'Entiendo 😊 ¿Y cómo fue eso para usted?',
        'Gracias por contarme. ¿Qué ocurrió después?'
    ],
    statement: [
        'Entiendo 😊 Gracias por contarme. ¿Y cómo siguió todo?',
        'Imagino. Gracias por compartirlo 😊 ¿Cómo está ahora?',
        'Qué bueno saber de usted 😊 ¿Y cómo va todo por allá?'
    ],
    passive_greeting: [
        '¡Hola! 😊',
        'Buen día 🙏',
        'Saludos 😊'
    ],
    gratitude: [
        'Gracias a usted 😊',
        'Con gusto 🙏',
        'Igualmente, gracias 😊'
    ],
    passive_acknowledgement: [
        '😊🙏',
        '👍😊',
        'Gracias por compartir 😊'
    ],
    passive_thumbs_up: [
        '👍'
    ]
});

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const integerEnv = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
    const value = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
};
const autoReplyEnabled = () => String(process.env.EC_ENGAGEMENT_AUTO_REPLY_ENABLED || '').toLowerCase() === 'true';
const dayKeyInEcuador = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Guayaquil',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
};

const deterministicIndex = (seed = '', length = 1) => {
    let hash = 2166136261;
    for (const char of String(seed || '')) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0) % Math.max(1, length);
};

const manualPassiveAcknowledgementApproved = (state = {}) => (
    state.conversationBucket?.value === EC_CONVERSATION_BUCKETS.ENGAGEMENT
    && Boolean(state.conversationBucket?.manualSelectedAt)
    && state.metadata?.warmup?.allowed === true
    && state.metadata?.warmup?.blocked !== true
    && state.metadata?.warmup?.risk !== true
);

export const nextEcEngagementPassiveBatchState = (automation = {}) => {
    const nextCycle = Math.max(0, Number(automation.passiveReplyCycle || 0)) + 1;
    return {
        passiveInboundCount: 0,
        passiveReplyCycle: nextCycle,
        passiveReplyTarget: 2 + (nextCycle % 2)
    };
};

const templateCategory = (message = {}, { allowPassiveAcknowledgement = false } = {}) => {
    const kind = currentInboundKind(message);
    const text = normalizeConversationText(message.body || '');
    if (allowPassiveAcknowledgement) {
        if (kind === 'empty') return '';
        if (kind === 'question') return WELLBEING_REGEX.test(text) ? 'wellbeing' : 'question';
        if (GRATITUDE_REGEX.test(text)) return 'gratitude';
        if (kind === 'greeting' || GREETING_REGEX.test(text)) return 'passive_greeting';
        if (['media_only', 'link_only', 'reaction_only', 'statement'].includes(kind)) return 'passive_acknowledgement';
    }
    if (['empty', 'media_only', 'link_only', 'reaction_only'].includes(kind)) return '';
    if (WELLBEING_REGEX.test(text)) return 'wellbeing';
    if (GREETING_REGEX.test(text) && text.length <= 120) return 'greeting';
    if (kind === 'question') return 'question';
    if (kind === 'statement' && text.length >= 16) return 'statement';
    return '';
};

export const buildEcEngagementReplyPlan = ({ state = {}, classification = {}, message = {}, now = new Date() } = {}) => {
    if (!autoReplyEnabled()) return { send: false, reason: 'feature_disabled' };
    if (classification.bucket !== EC_CONVERSATION_BUCKETS.ENGAGEMENT) return { send: false, reason: 'not_engagement_bucket' };
    if (!classification.replyEligibleByHistory) return { send: false, reason: 'history_not_eligible' };
    if (classification.hardExclusions?.length) return { send: false, reason: `hard_exclusion:${classification.hardExclusions.join(',')}` };
    if (classification.metrics?.risk || classification.metrics?.optOut || classification.metrics?.commercialIntent || classification.metrics?.supportIntent) {
        return { send: false, reason: 'commercial_support_or_risk' };
    }
    const inboundMessageId = String(message._id || message.id || classification.currentMessageId || '').trim();
    if (!inboundMessageId) return { send: false, reason: 'missing_inbound_message_id' };
    if (message.isFromMe || String(message.senderRole || '').toLowerCase() === 'system') return { send: false, reason: 'not_customer_inbound' };
    const phone = digitsOnly(state.phoneDigits || state.chatId);
    if (!phone.startsWith('593') || phone.endsWith('998038637')) return { send: false, reason: 'phone_not_eligible' };
    const passiveAcknowledgementApproved = manualPassiveAcknowledgementApproved(state);
    let category = templateCategory(message, {
        allowPassiveAcknowledgement: passiveAcknowledgementApproved
    });
    if (!category) return { send: false, reason: `local_no_reply:${currentInboundKind(message)}` };
    const passiveReplyCycle = Math.max(0, Number(state.engagementAutomation?.passiveReplyCycle || 0));
    const passiveReplyTarget = [2, 3].includes(Number(state.engagementAutomation?.passiveReplyTarget))
        ? Number(state.engagementAutomation.passiveReplyTarget)
        : 2 + (passiveReplyCycle % 2);
    const passiveInboundCount = Math.max(0, Number(state.engagementAutomation?.passiveInboundCount || 0));
    if (passiveAcknowledgementApproved && passiveInboundCount < passiveReplyTarget) {
        return {
            send: false,
            reason: `passive_batch_wait:${passiveInboundCount}/${passiveReplyTarget}`,
            localOnly: true,
            modelCalls: 0,
            passiveBatchAcknowledgement: true,
            passiveInboundCount,
            passiveReplyTarget,
            passiveReplyCycle
        };
    }
    if (passiveAcknowledgementApproved) category = 'passive_thumbs_up';
    const referenceNow = now instanceof Date ? now : new Date(now);
    const lastManualAt = state.human?.lastManualAt ? new Date(state.human.lastManualAt) : null;
    if (lastManualAt && !Number.isNaN(lastManualAt.getTime()) && referenceNow.getTime() - lastManualAt.getTime() < 10 * 60 * 1000) {
        return { send: false, reason: 'recent_human_activity' };
    }
    const cooldownMinutes = integerEnv('EC_ENGAGEMENT_REPLY_COOLDOWN_MINUTES', DEFAULT_COOLDOWN_MINUTES, { min: 10, max: 1440 });
    const lastReplyAt = state.engagementAutomation?.lastReplyAt ? new Date(state.engagementAutomation.lastReplyAt) : null;
    if (lastReplyAt && !Number.isNaN(lastReplyAt.getTime()) && referenceNow.getTime() - lastReplyAt.getTime() < cooldownMinutes * 60 * 1000) {
        return { send: false, reason: 'reply_cooldown' };
    }
    const dailyKey = dayKeyInEcuador(referenceNow);
    const dailyLimit = integerEnv('EC_ENGAGEMENT_DAILY_REPLY_LIMIT', DEFAULT_DAILY_LIMIT, { min: 1, max: 12 });
    const currentDailyCount = state.engagementAutomation?.dailyKey === dailyKey
        ? Number(state.engagementAutomation?.dailyReplyCount || 0)
        : 0;
    if (currentDailyCount >= dailyLimit) return { send: false, reason: 'daily_reply_limit' };
    const variants = REPLY_VARIANTS[category] || [];
    if (!variants.length) return { send: false, reason: 'missing_local_template' };
    let index = deterministicIndex(`${inboundMessageId}:${phone}:${category}`, variants.length);
    const previousTemplateKey = String(state.engagementAutomation?.lastReplyTemplateKey || '');
    if (variants.length > 1 && previousTemplateKey === `${category}:${index}`) index = (index + 1) % variants.length;
    const minDelayMs = integerEnv('EC_ENGAGEMENT_REPLY_MIN_DELAY_MS', DEFAULT_MIN_DELAY_MS, { min: 1000, max: 60000 });
    const maxDelayMs = integerEnv('EC_ENGAGEMENT_REPLY_MAX_DELAY_MS', DEFAULT_MAX_DELAY_MS, { min: minDelayMs, max: 120000 });
    const delayMs = minDelayMs + deterministicIndex(`${inboundMessageId}:delay`, maxDelayMs - minDelayMs + 1);
    return {
        send: true,
        reason: 'local_template',
        category,
        templateKey: `${category}:${index}`,
        text: variants[index],
        inboundMessageId,
        phone,
        chatId: String(state.chatId || `${phone}@c.us`),
        dailyKey,
        dailyLimit,
        delayMs,
        localOnly: true,
        modelCalls: 0,
        passiveAcknowledgement: passiveAcknowledgementApproved,
        passiveBatchAcknowledgement: passiveAcknowledgementApproved,
        passiveInboundCount,
        passiveReplyTarget,
        passiveReplyCycle
    };
};

const appendHistory = async (stateId, item) => ContactState.updateOne(
    { _id: stateId },
    {
        $push: {
            'engagementAutomation.replyHistory': {
                $each: [item],
                $slice: -MAX_REPLY_HISTORY
            }
        }
    }
).catch(() => null);

const releaseReplyLock = async (stateId, values = {}) => ContactState.updateOne(
    { _id: stateId },
    {
        $set: {
            'engagementAutomation.replyLockUntil': null,
            'engagementAutomation.replyLockedForMessageId': '',
            ...values
        }
    }
).catch(() => null);

export const executeEcEngagementReply = async ({ stateId, plan, sendTextFn = null, now = new Date() } = {}) => {
    if (!stateId || !plan?.send || !plan.inboundMessageId) return { sent: false, reason: 'invalid_reply_plan' };
    const referenceNow = now instanceof Date ? now : new Date(now);
    const claimed = await ContactState.findOneAndUpdate(
        {
            _id: stateId,
            'conversationBucket.value': EC_CONVERSATION_BUCKETS.ENGAGEMENT,
            'engagementAutomation.lastInboundMessageId': plan.inboundMessageId,
            'engagementAutomation.replyHistory.inboundMessageId': { $ne: plan.inboundMessageId },
            ...(plan.passiveBatchAcknowledgement ? {
                'engagementAutomation.passiveLastCountedMessageId': plan.inboundMessageId,
                'engagementAutomation.passiveReplyTarget': plan.passiveReplyTarget,
                'engagementAutomation.passiveInboundCount': { $gte: plan.passiveReplyTarget }
            } : {}),
            $or: [
                { 'engagementAutomation.replyLockUntil': { $exists: false } },
                { 'engagementAutomation.replyLockUntil': null },
                { 'engagementAutomation.replyLockUntil': { $lte: referenceNow } }
            ]
        },
        {
            $set: {
                'engagementAutomation.replyLockUntil': new Date(referenceNow.getTime() + LOCK_MS),
                'engagementAutomation.replyLockedAt': referenceNow,
                'engagementAutomation.replyLockedForMessageId': plan.inboundMessageId,
                'engagementAutomation.lastDecision': `reply_claimed:${plan.templateKey}`
            }
        },
        { new: true }
    );
    if (!claimed) return { sent: false, reason: 'reply_claim_not_acquired' };
    const newerInbound = await Message.findOne({
        $or: [
            { chatId: claimed.chatId },
            { peerPhone: claimed.phoneDigits }
        ],
        isFromMe: false,
        type: { $ne: 'system' }
    }).sort({ timestamp: -1, createdAt: -1 }).select('_id').lean().catch(() => null);
    if (newerInbound && String(newerInbound._id) !== plan.inboundMessageId) {
        await releaseReplyLock(stateId, { 'engagementAutomation.lastDecision': 'skipped_newer_inbound_buffered' });
        await appendHistory(stateId, {
            inboundMessageId: plan.inboundMessageId,
            templateKey: plan.templateKey,
            status: 'skipped',
            reason: 'newer_inbound_buffered',
            at: referenceNow
        });
        return { sent: false, reason: 'newer_inbound_buffered' };
    }
    let result;
    try {
        const outbound = sendTextFn || (await import('../whatsapp/sendText.js')).sendText;
        result = await outbound(plan.chatId, plan.text, null, {
            sessionId: 'zapi',
            provider: 'zapi',
            country: 'EC',
            recipientDigits: plan.phone,
            sendMode: 'ec_engagement_inbound_reply',
            outboundContext: `ec_engagement_reply:${plan.templateKey}`,
            antiSpamKey: `ec_engagement:${String(stateId)}:${plan.inboundMessageId}`,
            dedupeValue: `${plan.inboundMessageId}:${plan.templateKey}`,
            humanize: false,
            returnDetails: true
        });
    } catch (error) {
        result = { ok: false, error: error.message || String(error) };
    }
    const sent = result === true || result?.ok === true;
    if (!sent) {
        const error = String(result?.error || 'send_returned_false').slice(0, 500);
        await releaseReplyLock(stateId, {
            'engagementAutomation.lastFailureAt': referenceNow,
            'engagementAutomation.lastFailure': error,
            'engagementAutomation.lastDecision': 'reply_failed_no_retry'
        });
        await appendHistory(stateId, {
            inboundMessageId: plan.inboundMessageId,
            templateKey: plan.templateKey,
            status: 'failed',
            reason: error,
            at: referenceNow
        });
        return { sent: false, reason: 'send_failed', error };
    }
    const providerMessageId = String(result?.providerMessageId || '');
    const dailyCount = claimed.engagementAutomation?.dailyKey === plan.dailyKey
        ? Number(claimed.engagementAutomation?.dailyReplyCount || 0) + 1
        : 1;
    const nextPassiveBatch = nextEcEngagementPassiveBatchState(claimed.engagementAutomation || {});
    const passiveSuccessState = plan.passiveBatchAcknowledgement ? {
        'engagementAutomation.passiveInboundCount': nextPassiveBatch.passiveInboundCount,
        'engagementAutomation.passiveReplyCycle': nextPassiveBatch.passiveReplyCycle,
        'engagementAutomation.passiveReplyTarget': nextPassiveBatch.passiveReplyTarget
    } : {};
    await ContactState.updateOne(
        { _id: stateId, 'engagementAutomation.replyLockedForMessageId': plan.inboundMessageId },
        {
            $set: {
                'engagementAutomation.replyLockUntil': null,
                'engagementAutomation.replyLockedForMessageId': '',
                'engagementAutomation.lastReplyAt': referenceNow,
                'engagementAutomation.lastReplyTemplateKey': plan.templateKey,
                'engagementAutomation.lastReplyProviderMessageId': providerMessageId,
                'engagementAutomation.lastFailure': '',
                'engagementAutomation.dailyKey': plan.dailyKey,
                'engagementAutomation.dailyReplyCount': dailyCount,
                'engagementAutomation.lastDecision': `reply_sent:${plan.templateKey}`,
                ...passiveSuccessState
            },
            $push: {
                'engagementAutomation.replyHistory': {
                    $each: [{
                        inboundMessageId: plan.inboundMessageId,
                        templateKey: plan.templateKey,
                        providerMessageId,
                        status: 'sent',
                        reason: plan.passiveBatchAcknowledgement
                            ? 'customer_inbound_local_thumbs_batch'
                            : 'customer_inbound_local_template',
                        at: referenceNow
                    }],
                    $slice: -MAX_REPLY_HISTORY
                }
            }
        }
    );
    return { sent: true, providerMessageId, templateKey: plan.templateKey };
};

export const scheduleEcEngagementReply = ({ state, classification, message, setTimeoutFn = setTimeout } = {}) => {
    const plan = buildEcEngagementReplyPlan({ state, classification, message, now: new Date() });
    if (!plan.send) return { scheduled: false, reason: plan.reason };
    const timer = setTimeoutFn(() => {
        executeEcEngagementReply({ stateId: state._id, plan }).catch((error) => {
            console.error(`[EC-ENGAGEMENT] falha inesperada no envio inbound ${plan.inboundMessageId}:`, error.message || error);
        });
    }, plan.delayMs);
    timer?.unref?.();
    return { scheduled: true, reason: plan.reason, delayMs: plan.delayMs, templateKey: plan.templateKey };
};

export const ecEngagementReplyPolicy = () => ({
    enabled: autoReplyEnabled(),
    classifier: 'deterministic_local_v40',
    modelCallsPerDecision: 0,
    estimatedCostUsdPerDecision: 0,
    dailyLimit: integerEnv('EC_ENGAGEMENT_DAILY_REPLY_LIMIT', DEFAULT_DAILY_LIMIT, { min: 1, max: 12 }),
    cooldownMinutes: integerEnv('EC_ENGAGEMENT_REPLY_COOLDOWN_MINUTES', DEFAULT_COOLDOWN_MINUTES, { min: 10, max: 1440 }),
    minDelayMs: integerEnv('EC_ENGAGEMENT_REPLY_MIN_DELAY_MS', DEFAULT_MIN_DELAY_MS, { min: 1000, max: 60000 }),
    maxDelayMs: integerEnv('EC_ENGAGEMENT_REPLY_MAX_DELAY_MS', DEFAULT_MAX_DELAY_MS, { min: DEFAULT_MIN_DELAY_MS, max: 120000 }),
    noOutboundInitiation: true,
    noBulkDispatch: true,
    noReplyKinds: ['empty', 'media_only', 'link_only', 'reaction_only'],
    manualApprovedPassiveAcknowledgements: true,
    manualPassiveTemplatesAskQuestions: false,
    passiveBatchPattern: [2, 3],
    passiveBatchText: '👍'
});
