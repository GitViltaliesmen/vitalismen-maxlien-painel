import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import { vitPowerAgent } from './agents/vitPowerAgent.js';
import { looksLikeOrderDataMessage } from './initialFunnelTriggers.js';

const OFFICIAL_AGENT = 'vit_power_ec';
const OFFICIAL_COUNTRY = 'EC';

const autoReplyEnabled = () => String(process.env.WHATSAPP_AUTO_REPLY_ENABLED || '').toLowerCase() === 'true';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const parseDigitsList = (value) => String(value || '')
    .split(',')
    .map((item) => digitsOnly(item))
    .filter(Boolean);

const isSamePhone = (left, right) => {
    const a = digitsOnly(left);
    const b = digitsOnly(right);
    if (!a || !b) return false;
    return a === b || a.endsWith(b) || b.endsWith(a);
};

const isAutoReplyAllowedForChat = (...identifiers) => {
    const allowed = parseDigitsList(process.env.WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS);
    if (allowed.length === 0) return true;
    return identifiers
        .map((item) => digitsOnly(item))
        .filter(Boolean)
        .some((candidate) => allowed.some((item) => isSamePhone(candidate, item)));
};

const normalizeText = (text) => String(text || '').trim().toLowerCase();

const hasAnyMatch = (text, patterns) => patterns.some((pattern) => pattern.test(text));

const inboundDedupeWindowMs = () => {
    const seconds = Number(process.env.WHATSAPP_INBOUND_DEDUPE_SECONDS || 90);
    return Math.max(10, seconds) * 1000;
};

const hasProcessedInbound = ({ state, messageId, body }) => {
    const metadata = state.metadata || {};
    const processedIds = Array.isArray(metadata.processedInboundMessageIds)
        ? metadata.processedInboundMessageIds
        : [];

    if (messageId && processedIds.includes(messageId)) return true;

    const lastText = normalizeText(metadata.lastProcessedInboundText || '');
    const currentText = normalizeText(body || '');
    const lastAt = metadata.lastProcessedInboundAt instanceof Date
        ? metadata.lastProcessedInboundAt.getTime()
        : new Date(metadata.lastProcessedInboundAt || 0).getTime();

    if (looksLikeOrderDataMessage(body)) {
        return false;
    }

    return Boolean(
        currentText
        && lastText === currentText
        && lastAt
        && (Date.now() - lastAt) < inboundDedupeWindowMs()
    );
};

const markInboundProcessed = ({ state, messageId, body }) => {
    const metadata = state.metadata || {};
    const processedIds = Array.isArray(metadata.processedInboundMessageIds)
        ? metadata.processedInboundMessageIds
        : [];

    state.metadata = {
        ...metadata,
        processedInboundMessageIds: messageId
            ? [...new Set([...processedIds, messageId])].slice(-80)
            : processedIds.slice(-80),
        lastProcessedInboundText: body,
        lastProcessedInboundAt: new Date()
    };
};

const saveInboundMessage = async ({ messageId, chatId, senderPn, body }) => {
    if (!body.trim()) return;
    try {
        const peerPhone = digitsOnly(senderPn) || digitsOnly(chatId);
        await Message.updateOne(
            { _id: messageId || `in_${Date.now()}` },
            {
                $setOnInsert: {
                    chatId,
                    peerPhone,
                    from: chatId,
                    to: 'bot',
                    body,
                    type: 'chat',
                    isFromMe: false,
                    isBot: false,
                    timestamp: Math.floor(Date.now() / 1000)
                }
            },
            { upsert: true }
        );
    } catch (error) {
        if (error.code !== 11000) {
            console.error('[ROUTER] falha ao salvar inbound:', error.message);
        }
    }
};

const inferCountryCode = (chatId) => {
    return OFFICIAL_COUNTRY;
};

const forcedAgent = () => {
    return OFFICIAL_AGENT;
};

const isAffirmativeConfirmation = (body) => {
    const normalized = normalizeText(body)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return /^(si|sii|ok|okay|listo|correcto|confirmo|confirmado|de acuerdo|dale|hagale|claro|perfecto|esta correcto|todo correcto)\b/.test(normalized);
};

const buildPhoneSearchTails = (...values) => {
    const tails = values
        .map((value) => digitsOnly(value))
        .filter(Boolean)
        .flatMap((digits) => {
            const candidates = [digits];
            if (digits.length >= 8) candidates.push(digits.slice(-8));
            if (digits.length >= 10) candidates.push(digits.slice(-10));
            if (digits.length >= 11) candidates.push(digits.slice(-11));
            return candidates;
        })
        .filter((digits) => digits.length >= 7);
    return [...new Set(tails)];
};

const findLatestOrderForContact = async ({ chatId, senderPn, state }) => {
    const phoneTails = buildPhoneSearchTails(senderPn, state?.phoneDigits, chatId);
    if (phoneTails.length === 0) return null;

    return Order.findOne({
        $or: phoneTails.map((tail) => ({ 'customer.phone': { $regex: tail } }))
    }).sort({ updatedAt: -1, createdAt: -1 }).lean();
};

const findRecentCommercialBotPrompt = async ({ chatId, senderPn, state }) => {
    const phoneTails = buildPhoneSearchTails(senderPn, state?.phoneDigits, chatId);
    const scope = [
        { chatId },
        ...phoneTails.map((tail) => ({ peerPhone: { $regex: tail } }))
    ];

    return Message.findOne({
        $or: scope,
        isBot: true,
        body: {
            $regex: /(todo correcto|generar tu enlace de pago|proceder[eé] a generar|confirmar tu pedido|confirmo el pedido|para confirmar)/i
        }
    }).sort({ createdAt: -1 }).lean();
};

const hasRecentCommercialMemory = (state) => {
    const perAgentMemory = (state?.metadata || {}).perAgentMemory || {};
    return Object.values(perAgentMemory).some((memory) => {
        const lastOutbound = String(memory?.lastOutboundText || '').toLowerCase();
        const lastStage = String(memory?.lastFunnelStage || '').toLowerCase();
        return /(todo correcto|generar tu enlace de pago|proceder[eé] a generar|confirmar tu pedido|confirmo el pedido|para confirmar)/i.test(lastOutbound)
            || ['collecting_customer_data', 'package_selection', 'offer_presented'].includes(lastStage);
    });
};

const detectSignals = (body) => {
    const normalizedBody = normalizeText(body);
    return {
        normalizedBody,
        wantsConsultation: false,
        showsPurchaseIntent: hasAnyMatch(normalizedBody, [/\bquiero\b/i, /\bquero\b/i, /\bcomprar\b/i, /\bllevar\b/i, /\bme interesa\b/i, /\bdeseo\b/i, /\bdesejo\b/i, /\border?nar\b/i]),
        asksPrice: hasAnyMatch(normalizedBody, [/\bprecio\b/i, /\bpreco\b/i, /\bvalor\b/i, /\bpromo\b/i, /\bpromoc/i, /\bcu[aá]nto\b/i, /\bcuanto\b/i]),
        asksProductQuestion: hasAnyMatch(normalizedBody, [/\bfunciona\b/i, /\bdiabet/i, /\bpresi/i, /\bhiperten/i, /\bcirug/i]),
        requestsQuantity: hasAnyMatch(normalizedBody, [/\b1 frasco\b/i, /\b3 frascos\b/i, /\b6 frascos\b/i, /\bun frasco\b/i, /\btres frascos\b/i, /\bseis frascos\b/i]),
        mentionsProducts: true,
        mentionsVitPower: true,
        explicitWarmupExit: false
    };
};

const ensureTag = (state, tag) => {
    if (!tag) return;
    if (!state.tags.includes(tag)) {
        state.tags.push(tag);
    }
};

const chooseAssignedAgent = ({
    state,
    body,
    countryCode,
    isFirstInbound = false,
    latestOrder = null,
    recentCommercialPrompt = null
}) => {
    return { assignedAgent: OFFICIAL_AGENT, reason: 'official_vit_power_only' };
};

const appendAgentHistory = ({ state, assignedAgent, reason }) => {
    state.agentHistory = (state.agentHistory || []).filter((entry) => entry?.agent === OFFICIAL_AGENT);
    const lastEntry = state.agentHistory[state.agentHistory.length - 1];
    if (lastEntry?.agent === assignedAgent) return;
    state.agentHistory.push({
        agent: assignedAgent,
        reason,
        at: new Date()
    });
    state.agentHistory = state.agentHistory.slice(-12);
};

const updateTagsAndMetadata = ({ state, assignedAgent, countryCode, body, reason, signals, sessionId = null }) => {
    ensureTag(state, 'COMMERCIAL_READY');
    ensureTag(state, 'VIT_POWER_EC_ONLY');

    state.countryCode = OFFICIAL_COUNTRY;
    state.assignedAgent = OFFICIAL_AGENT;
    appendAgentHistory({ state, assignedAgent, reason });
    state.metadata = {
        ...(state.metadata || {}),
        lastSessionId: sessionId || state.metadata?.lastSessionId || null,
        lastRouterDecisionAt: new Date(),
        lastRouterDecisionText: body,
        lastRouterDecisionAgent: OFFICIAL_AGENT,
        lastRouterDecisionReason: reason,
        lastDetectedSignals: {
            wantsConsultation: signals.wantsConsultation,
            showsPurchaseIntent: signals.showsPurchaseIntent,
            asksPrice: signals.asksPrice,
            asksProductQuestion: signals.asksProductQuestion,
            requestsQuantity: signals.requestsQuantity,
            mentionsProducts: signals.mentionsProducts,
            mentionsVitPower: signals.mentionsVitPower,
            explicitWarmupExit: signals.explicitWarmupExit
        },
        perAgentMemory: {
            ...((state.metadata || {}).perAgentMemory || {}),
            [OFFICIAL_AGENT]: {
                ...(((state.metadata || {}).perAgentMemory || {})[OFFICIAL_AGENT] || {}),
                lastInboundAt: new Date(),
                lastInboundText: body,
                lastReason: reason
            }
        }
    };
};

const dispatchToAgent = async ({ assignedAgent, payload }) => {
    console.log(`[ROUTER] agente selecionado -> ${OFFICIAL_AGENT} | chat=${payload.from}`);
    await vitPowerAgent.handleIncomingMessage({
        ...payload,
        agent: OFFICIAL_AGENT
    });
};

export const routeIncomingMessage = async (payload) => {
    const chatId = payload.from;
    const body = String(payload.body || '');
    const countryCode = inferCountryCode(chatId);
    const sessionId = payload.sessionId || null;
    const messageId = payload.id ? String(payload.id) : '';
    const senderPn = payload.senderPn || payload.fullMessage?.key?.senderPn || null;
    const senderPhoneDigits = digitsOnly(senderPn);

    let state = await ContactState.findOne({ chatId });
    if (!state) {
        state = new ContactState({
            chatId,
            phoneDigits: senderPhoneDigits || String(chatId || '').replace(/\D/g, ''),
            countryCode
        });
    } else if (senderPhoneDigits && !isSamePhone(state.phoneDigits, senderPhoneDigits)) {
        state.phoneDigits = senderPhoneDigits;
    }

    if (hasProcessedInbound({ state, messageId, body })) {
        console.log(`[ROUTER] inbound duplicado ignorado | chat=${chatId} | id=${messageId || 'sem_id'}`);
        return;
    }
    markInboundProcessed({ state, messageId, body });
    await saveInboundMessage({ messageId, chatId, senderPn, body });

    const isFirstInbound = !state.firstInboundText;

    if (isFirstInbound) {
        state.firstInboundText = body;
        state.firstInboundAt = new Date();
    }

    state.lastInboundText = body;
    state.lastInboundAt = new Date();
    state.metadata = {
        ...(state.metadata || {}),
        lastSessionId: sessionId,
        ...(senderPn ? { lastSenderPn: senderPn } : {})
    };

    const human = state.human || {};
    const pausedUntil = human.pausedUntil ? new Date(human.pausedUntil).getTime() : 0;
    if (human.mode === 'manual' && (!pausedUntil || pausedUntil > Date.now())) {
        state.metadata = {
            ...(state.metadata || {}),
            lastHumanHoldAt: new Date(),
            lastHumanHoldReason: 'manual_attendance_active'
        };
        await state.save();
        console.log(`[ROUTER] automacao pausada por atendimento humano | chat=${chatId} | operador=${human.assignedName || human.assignedTo || 'sem_nome'}`);
        return;
    }

    const [latestOrder, recentCommercialPrompt] = await Promise.all([
        findLatestOrderForContact({ chatId, senderPn, state }),
        findRecentCommercialBotPrompt({ chatId, senderPn, state })
    ]);
    const resolvedCountryCode = OFFICIAL_COUNTRY;

    const decision = chooseAssignedAgent({
        state,
        body,
        countryCode: resolvedCountryCode,
        isFirstInbound,
        latestOrder,
        recentCommercialPrompt
    });
    updateTagsAndMetadata({
        state,
        assignedAgent: decision.assignedAgent,
        countryCode: resolvedCountryCode,
        body,
        reason: decision.reason,
        signals: detectSignals(body),
        sessionId
    });
    await state.save();

    if (!autoReplyEnabled()) {
        console.log(`[ROUTER] auto-resposta pausada por WHATSAPP_AUTO_REPLY_ENABLED!=true | chat=${chatId}`);
        return;
    }

    if (!isAutoReplyAllowedForChat(chatId, senderPn, state.phoneDigits)) {
        console.log(`[ROUTER] auto-resposta bloqueada fora da lista permitida | chat=${chatId} | senderPn=${senderPn || 'sem_senderPn'}`);
        return;
    }

    await dispatchToAgent({
        assignedAgent: decision.assignedAgent,
        payload: {
            ...payload,
            contactStateId: state._id.toString(),
            agentDecisionReason: decision.reason,
            sessionId
        }
    });
};
