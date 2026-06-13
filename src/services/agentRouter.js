import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import { vitPowerAgent } from './agents/vitPowerAgent.js';
import { looksLikeOrderDataMessage } from './initialFunnelTriggers.js';
import { syncContactDraftToOnlineAdminPanel } from './adminPanelStatusService.js';

const OFFICIAL_AGENT = 'vit_power_ec';
const OFFICIAL_COUNTRY = 'EC';

const autoReplyEnabled = () => String(process.env.WHATSAPP_AUTO_REPLY_ENABLED || '').toLowerCase() === 'true';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const countryRestrictedInboundEnabled = () => String(process.env.WHATSAPP_EC_ONLY_INBOUND || 'true').toLowerCase() !== 'false';

const isBlockedBroadcastOrGroup = (chatId = '') => {
    const id = String(chatId || '');
    return !id || id === 'status@broadcast' || id.includes('@g.us') || id.includes('@newsletter') || id.includes('@broadcast');
};

const countryCodeFromDigits = (value = '') => {
    const digits = digitsOnly(value);
    if (digits.startsWith('593')) return 'EC';
    if (digits.startsWith('57')) return 'CO';
    return '';
};

const isAllowedCustomerCountry = ({ chatId = '', senderPn = '', phoneDigits = '' } = {}) => {
    const id = String(chatId || '');
    if (isBlockedBroadcastOrGroup(id)) return false;

    const senderDigits = digitsOnly(senderPn);
    if (senderDigits) return Boolean(countryCodeFromDigits(senderDigits));

    const phone = digitsOnly(phoneDigits);
    if (phone) return Boolean(countryCodeFromDigits(phone));

    const chatDigits = digitsOnly(id);
    if (id.endsWith('@s.whatsapp.net') || id.endsWith('@c.us')) return Boolean(countryCodeFromDigits(chatDigits));
    if (id.endsWith('@lid')) return false;
    return false;
};

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

const isInboundTestOnlyPhone = (...identifiers) => {
    const allowed = parseDigitsList(process.env.WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS);
    if (!allowed.length) return false;
    return identifiers
        .map((item) => digitsOnly(item))
        .filter(Boolean)
        .some((candidate) => allowed.some((item) => isSamePhone(candidate, item)));
};

const operationalPanelPhones = () => [
    process.env.WHATSAPP_DEFAULT_SESSION_ID,
    process.env.WHATSAPP_SESSION_IDS,
    process.env.WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS,
    process.env.WHATSAPP_PANEL_OPERATIONAL_NUMBERS
].flatMap(parseDigitsList);

const priorityBotTestPhones = () => [
    '5515998038637',
    process.env.WHATSAPP_PRIORITY_TEST_PHONES
].flatMap(parseDigitsList);

const isOperationalPanelPhone = (...identifiers) => {
    const allowed = operationalPanelPhones();
    if (!allowed.length) return false;
    return identifiers
        .map((item) => digitsOnly(item))
        .filter(Boolean)
        .some((candidate) => allowed.some((item) => isSamePhone(candidate, item)));
};

const isPriorityBotTestPhone = (...identifiers) => {
    const allowed = priorityBotTestPhones();
    return identifiers
        .map((item) => digitsOnly(item))
        .filter(Boolean)
        .some((candidate) => allowed.some((item) => isSamePhone(candidate, item)));
};

const normalizeText = (text) => String(text || '').trim().toLowerCase();

const hasAnyMatch = (text, patterns) => patterns.some((pattern) => pattern.test(text));

const normalizeForDecision = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const inboundDedupeWindowMs = () => {
    const seconds = Number(process.env.WHATSAPP_INBOUND_DEDUPE_SECONDS || 180);
    return Math.max(10, seconds) * 1000;
};

const processingLockMs = () => {
    const seconds = Number(process.env.WHATSAPP_CONTACT_PROCESSING_LOCK_SECONDS || 180);
    return Math.max(30, seconds) * 1000;
};

const manualAutoReturnMs = () => {
    const minutes = Number.parseInt(String(process.env.WHATSAPP_MANUAL_AUTO_RETURN_MINUTES || '2'), 10);
    return Math.max(1, Number.isFinite(minutes) ? minutes : 2) * 60 * 1000;
};

const firstReplyWindowMs = () => {
    const minSeconds = Number.parseInt(String(process.env.WHATSAPP_FIRST_REPLY_MIN_SECONDS || '20'), 10);
    const maxSeconds = Number.parseInt(String(process.env.WHATSAPP_FIRST_REPLY_MAX_SECONDS || '59'), 10);
    const minMs = Math.max(0, (Number.isFinite(minSeconds) ? minSeconds : 20) * 1000);
    const maxMs = Math.max(minMs, (Number.isFinite(maxSeconds) ? maxSeconds : 59) * 1000);
    return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForFirstReplyWindow = async ({ state, isFirstInbound, recovered, chatId }) => {
    if (!isFirstInbound || recovered) return 0;
    const targetMs = firstReplyWindowMs();
    const inboundAt = state?.firstInboundAt ? new Date(state.firstInboundAt).getTime() : Date.now();
    const elapsedMs = Number.isFinite(inboundAt) ? Math.max(0, Date.now() - inboundAt) : 0;
    const waitMs = Math.max(0, targetMs - elapsedMs);
    if (waitMs > 0) {
        console.log(`[FIRST_REPLY_WINDOW] aguardando ${Math.ceil(waitMs / 1000)}s antes da primeira resposta -> ${chatId}`);
        await sleep(waitMs);
    }
    return waitMs;
};

const acquireContactProcessingLock = async ({ stateId, messageId }) => {
    const now = new Date();
    const expiresAt = new Date(Date.now() + processingLockMs());
    const result = await ContactState.updateOne(
        {
            _id: stateId,
            $or: [
                { 'metadata.processingLock.expiresAt': { $exists: false } },
                { 'metadata.processingLock.expiresAt': { $lte: now } }
            ]
        },
        {
            $set: {
                'metadata.processingLock': {
                    messageId: messageId || '',
                    acquiredAt: now,
                    expiresAt
                }
            }
        }
    );
    return result.modifiedCount > 0;
};

const releaseContactProcessingLock = async ({ stateId, messageId }) => {
    const query = messageId
        ? { _id: stateId, 'metadata.processingLock.messageId': messageId }
        : { _id: stateId };
    await ContactState.updateOne(query, { $unset: { 'metadata.processingLock': '' } }).catch(() => null);
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

const hasProcessedInboundMessageId = ({ state, messageId }) => {
    if (!messageId) return false;
    const metadata = state.metadata || {};
    const processedIds = Array.isArray(metadata.processedInboundMessageIds)
        ? metadata.processedInboundMessageIds
        : [];
    return processedIds.includes(messageId);
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

const resetPriorityBotTestConversationMemory = (state) => {
    const metadata = state.metadata || {};
    const perAgentMemory = metadata.perAgentMemory || {};
    state.metadata = {
        ...metadata,
        perAgentMemory: {
            ...perAgentMemory,
            [OFFICIAL_AGENT]: {}
        },
        lastKnownFunnelStage: '',
        lastKnownFunnelBucket: '',
        automationHandoffSuggestedReason: '',
        automationHandoffSuggestedNote: '',
        lastHumanHoldReason: '',
        cleanTestResetAt: new Date(),
        cleanTestResetReason: 'auto_reset_8637_before_each_test_message'
    };
    delete state.metadata.customerDraft;
    delete state.metadata.automationHoldAt;
    delete state.metadata.automationHoldReason;
    delete state.metadata.automationHandoffSuggestedAt;
    delete state.metadata.processingLock;
    delete state.metadata.lastProcessedInboundText;
    delete state.metadata.lastProcessedInboundAt;
    delete state.metadata.lastComplementAt;
    delete state.metadata.lastComplementKey;
    if (state.metadata.perAgentMemory?.[OFFICIAL_AGENT]) {
        delete state.metadata.perAgentMemory[OFFICIAL_AGENT].audioComplements;
        delete state.metadata.perAgentMemory[OFFICIAL_AGENT].lastComplementAt;
        delete state.metadata.perAgentMemory[OFFICIAL_AGENT].lastComplementKey;
        delete state.metadata.perAgentMemory[OFFICIAL_AGENT].lastInterruptAnsweredAt;
        delete state.metadata.perAgentMemory[OFFICIAL_AGENT].lastInterruptKey;
        delete state.metadata.perAgentMemory[OFFICIAL_AGENT].resumeFunnelStageAfterInterrupt;
        delete state.metadata.perAgentMemory[OFFICIAL_AGENT].resumeConversationStageAfterInterrupt;
    }
    state.firstInboundText = '';
    state.firstInboundAt = null;
    state.lastOutboundAt = null;
    state.stage = 'inicio';
    state.quantity = '';
    state.total = '';
    state.buyer_score = '';
};

const saveInboundMessage = async ({ messageId, chatId, senderPn, body, sessionId }) => {
    if (!body.trim()) return;
    try {
        const peerPhone = digitsOnly(senderPn) || digitsOnly(chatId);
        const ownerSet = sessionId
            ? {
                sessionId,
                ownerPhoneDigits: digitsOnly(sessionId)
            }
            : {};
        await Message.updateOne(
            { _id: messageId || `in_${Date.now()}` },
            {
                ...(Object.keys(ownerSet).length ? { $set: ownerSet } : {}),
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

const inferCountryCode = (...values) => {
    for (const value of values) {
        const country = countryCodeFromDigits(value);
        if (country) return country;
    }
    return OFFICIAL_COUNTRY;
};

const realAllowedPhoneForState = ({ chatId = '', senderPn = '', state = null } = {}) => {
    const sender = digitsOnly(senderPn);
    if (countryCodeFromDigits(sender)) return sender;
    const metadataSender = digitsOnly(state?.metadata?.lastSenderPn);
    if (countryCodeFromDigits(metadataSender)) return metadataSender;
    const statePhone = digitsOnly(state?.phoneDigits);
    if (countryCodeFromDigits(statePhone)) return statePhone;
    const chatDigits = digitsOnly(chatId);
    return countryCodeFromDigits(chatDigits) ? chatDigits : '';
};

const ensureInboundContactInAdminPanel = ({ chatId = '', senderPn = '', state = null, countryCode = OFFICIAL_COUNTRY } = {}) => {
    const phone = realAllowedPhoneForState({ chatId, senderPn, state });
    if (!phone) return { ok: false, skipped: true, reason: 'no_allowed_phone' };
    const country = countryCodeFromDigits(phone) || countryCode || OFFICIAL_COUNTRY;
    const draft = state?.metadata?.customerDraft || {};
    const manualActive = state?.human?.mode === 'manual' || country === 'CO';
    const result = syncContactDraftToOnlineAdminPanel({
        ...draft,
        phone: draft.phone || phone,
        country: draft.country || country,
        status: manualActive ? 'atendendo' : (draft.status || 'novo')
    }, {
        country: draft.country || country,
        note: country === 'CO'
            ? 'Entrada WhatsApp CO: contato enviado direto para atendimento humano'
            : 'Entrada WhatsApp: contato criado automaticamente no Painel Unificado',
        action: 'whatsapp_inbound_contact_guard',
        adminStatus: manualActive ? 'atendendo' : 'novo'
    });
    if (!result?.ok && !result?.skipped) {
        console.warn('[ROUTER] falha ao garantir contato no Painel Unificado:', result);
    }
    return result;
};

const BOT_ATTENDING_PROTECTED_STATUSES = new Set([
    'comprar_depois',
    'confirmado',
    'pedido_enviado',
    'enviado',
    'entregue',
    'recompra',
    'devolvido',
    'cancelado',
    'conferir_pedidos',
    'finalizado'
]);

const normalizeStatusToken = (value) => normalizeForDecision(value).replace(/\s+/g, '_');

const markBotAttendanceInAdminPanel = ({ chatId = '', senderPn = '', state = null, countryCode = OFFICIAL_COUNTRY } = {}) => {
    const phone = realAllowedPhoneForState({ chatId, senderPn, state });
    if (!phone) return { ok: false, skipped: true, reason: 'no_allowed_phone' };
    const country = countryCodeFromDigits(phone) || countryCode || OFFICIAL_COUNTRY;
    if (country !== OFFICIAL_COUNTRY) return { ok: false, skipped: true, reason: 'country_not_auto_panel' };

    const draft = state?.metadata?.customerDraft || {};
    const draftStatus = normalizeStatusToken(draft.status || '');
    if (BOT_ATTENDING_PROTECTED_STATUSES.has(draftStatus)) {
        return { ok: false, skipped: true, reason: 'protected_status' };
    }

    const result = syncContactDraftToOnlineAdminPanel({
        ...draft,
        phone: draft.phone || phone,
        country: draft.country || country,
        status: 'atendendo'
    }, {
        country: draft.country || country,
        note: 'Bot respondeu automaticamente; cliente em atendimento',
        action: 'whatsapp_bot_auto_reply_attending',
        adminStatus: 'atendendo'
    });
    if (!result?.ok && !result?.skipped) {
        console.warn('[ROUTER] falha ao marcar atendimento do bot no Painel Unificado:', result);
    }
    return result;
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

const contactIdentityQuery = ({ chatId = '', senderPn = '', phoneDigits = '' } = {}) => {
    const tails = buildPhoneSearchTails(senderPn, phoneDigits, chatId);
    const or = [];
    if (chatId) {
        or.push({ chatId });
        or.push({ 'metadata.linkedChatIds': chatId });
    }
    for (const tail of tails) {
        or.push({ phoneDigits: tail });
        or.push({ phoneDigits: { $regex: `${tail}$` } });
        or.push({ 'metadata.lastSenderPn': { $regex: tail } });
        or.push({ 'metadata.customerPhoneDigits': { $regex: `${tail}$` } });
    }
    return or.length ? { $or: or } : { chatId };
};

const stateContinuityRank = (state, currentChatId = '') => {
    const memory = state?.metadata?.perAgentMemory?.[OFFICIAL_AGENT] || {};
    let score = 0;
    if (state?.chatId === currentChatId) score += 20;
    if (state?.human?.mode === 'manual') score += 80;
    if (memory.lastFunnelStage) score += 20;
    if (memory.initialProductPresentationSentAt || memory.initialProductPresentationSteps?.length) score += 50;
    if (memory.orderClosedThankYouSentAt || memory.lastFunnelStage === 'order_closed') score += 70;
    if (state?.updatedAt) score += Math.min(10, Math.max(0, Date.now() - new Date(state.updatedAt).getTime()) / -86400000 + 10);
    return score;
};

const findContinuityContactState = async ({ chatId, senderPn }) => {
    const senderPhoneDigits = digitsOnly(senderPn);
    const exactState = chatId ? await ContactState.findOne({ chatId }) : null;
    const candidates = await ContactState.find(contactIdentityQuery({
        chatId,
        senderPn,
        phoneDigits: senderPhoneDigits || exactState?.phoneDigits || exactState?.metadata?.customerPhoneDigits || exactState?.metadata?.lastSenderPn
    })).sort({ updatedAt: -1 }).limit(12);
    const allCandidates = [
        ...(exactState ? [exactState] : []),
        ...candidates
    ].filter((item, index, arr) => item && arr.findIndex((other) => String(other._id) === String(item._id)) === index);
    if (!allCandidates.length) return null;
    return allCandidates.sort((a, b) => stateContinuityRank(b, chatId) - stateContinuityRank(a, chatId))[0];
};

const findPriorityFrozenContactState = async ({ chatId, senderPn, phoneDigits }) => {
    const query = contactIdentityQuery({ chatId, senderPn, phoneDigits });
    return ContactState.findOne({
        ...query,
        'metadata.priorityFrozen': true
    }).sort({ updatedAt: -1 });
};

const rememberContactChannel = ({ state, chatId, senderPn, sessionId }) => {
    const senderPhoneDigits = digitsOnly(senderPn);
    const metadata = state.metadata || {};
    const linkedChatIds = Array.isArray(metadata.linkedChatIds) ? metadata.linkedChatIds : [];
    const now = new Date();
    const continuity = metadata.sessionContinuity || {};
    const continuityHistory = Array.isArray(continuity.history) ? continuity.history : [];
    const inboundEvent = {
        at: now,
        direction: 'inbound',
        chatId,
        sessionId: sessionId || '',
        senderPn: senderPn || '',
        phoneDigits: senderPhoneDigits || digitsOnly(chatId)
    };
    state.metadata = {
        ...metadata,
        linkedChatIds: [...new Set([...(linkedChatIds || []), state.chatId, chatId].filter(Boolean))].slice(-20),
        lastActiveChatId: chatId,
        lastSessionId: sessionId || metadata.lastSessionId || null,
        sessionContinuity: {
            ...continuity,
            lastInboundAt: now,
            lastInboundSessionId: sessionId || continuity.lastInboundSessionId || '',
            lastInboundChatId: chatId || continuity.lastInboundChatId || '',
            history: [...continuityHistory, inboundEvent].slice(-80)
        },
        ...(senderPn ? { lastSenderPn: senderPn } : {}),
        ...(senderPhoneDigits ? { customerPhoneDigits: senderPhoneDigits } : {})
    };
    if (senderPhoneDigits && !isSamePhone(state.phoneDigits, senderPhoneDigits)) {
        state.phoneDigits = senderPhoneDigits;
    }
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
    const decisionBody = normalizeForDecision(body);
    const asksGuide = hasAnyMatch(decisionBody, [/\bguia\b/i, /\brastreo\b/i, /\bcodigo\b/i, /\bnumero de guia\b/i]);
    const asksPickup = hasAnyMatch(decisionBody, [/\bretirar\b/i, /\bretiro\b/i, /\bagencia\b/i, /\bservientrega\b/i, /\blisto para retirar\b/i]);
    const asksProof = hasAnyMatch(decisionBody, [/\bfunciona\b/i, /\bsirve\b/i, /\bresultado\b/i, /\btestimonio\b/i, /\bprueba\b/i, /\breal\b/i, /\bconfianza\b/i]);
    const asksComposition = hasAnyMatch(decisionBody, [/\bcomposicion\b/i, /\bingrediente\b/i, /\bque tiene\b/i, /\bcontiene\b/i]);
    const asksLiquid = hasAnyMatch(decisionBody, [/\bliquido\b/i, /\borina\b/i, /\bprostata\b/i]);
    const mentionsAddress = hasAnyMatch(decisionBody, [/\bnombre\b/i, /\bapellido\b/i, /\bdireccion\b/i, /\bciudad\b/i, /\bprovincia\b/i, /\bdepartamento\b/i, /\breferencia\b/i]);
    const priceResistance = hasAnyMatch(decisionBody, [/\bcaro\b/i, /\bcostoso\b/i, /\bmucho\b/i, /\bdescuento\b/i, /\brebaja\b/i]);
    const closing = hasAnyMatch(decisionBody, [/\bconfirmo\b/i, /\bconfirmado\b/i, /\benvialo\b/i, /\benvie\b/i, /\bmande\b/i, /\bhagale\b/i, /\blisto\b/i, /\bde una\b/i]);
    const postSale = hasAnyMatch(decisionBody, [/\bgracias\b/i, /\brecibi\b/i, /\bme llego\b/i, /\bya tengo\b/i]);
    const requestsQuantity = hasAnyMatch(normalizedBody, [/\b1 frasco\b/i, /\b3 frascos\b/i, /\b6 frascos\b/i, /\bun frasco\b/i, /\btres frascos\b/i, /\bseis frascos\b/i, /\buno\b/i, /\btres\b/i, /\bseis\b/i]);
    const showsPurchaseIntent = hasAnyMatch(normalizedBody, [/\bquiero\b/i, /\bquero\b/i, /\bcomprar\b/i, /\bllevar\b/i, /\bme interesa\b/i, /\bdeseo\b/i, /\bdesejo\b/i, /\border?nar\b/i]);
    const asksPrice = hasAnyMatch(normalizedBody, [/\bprecio\b/i, /\bpreco\b/i, /\bvalor\b/i, /\bpromo\b/i, /\bpromoc/i, /\bcu[aá]nto\b/i, /\bcuanto\b/i]);
    const asksProductQuestion = hasAnyMatch(normalizedBody, [/\bfunciona\b/i, /\bdiabet/i, /\bpresi/i, /\bhiperten/i, /\bcirug/i]);
    const funnelBucket = (() => {
        if (postSale) return '08_POSVENDA';
        if (asksGuide || asksPickup) return '07_LOGISTICA';
        if (closing || mentionsAddress || requestsQuantity || looksLikeOrderDataMessage(body)) return '06_FECHAMENTO';
        if (showsPurchaseIntent) return '05_OFERTA';
        if (priceResistance) return '04_OBJECAO';
        if (asksProof) return '03_PROVA';
        if (asksPrice || asksProductQuestion || asksComposition || asksLiquid) return '02_QUALIFICACAO';
        return '01_ENTRADA';
    })();
    const buyerScore = (() => {
        if (postSale || asksGuide || asksPickup) return 100;
        let score = 10;
        if (asksPrice || asksProductQuestion || asksComposition || asksLiquid) score += 20;
        if (showsPurchaseIntent) score += 30;
        if (requestsQuantity) score += 35;
        if (mentionsAddress || closing || looksLikeOrderDataMessage(body)) score += 50;
        if (priceResistance) score -= 10;
        return Math.max(0, Math.min(100, score));
    })();
    return {
        normalizedBody,
        wantsConsultation: false,
        showsPurchaseIntent,
        asksPrice,
        asksProductQuestion,
        asksProof,
        asksComposition,
        asksLiquid,
        asksGuide,
        asksPickup,
        mentionsAddress,
        priceResistance,
        closing,
        postSale,
        requestsQuantity,
        funnelBucket,
        buyerScore,
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
    if (countryCode === 'EC') ensureTag(state, 'VIT_POWER_EC_ONLY');
    if (signals.asksPrice) ensureTag(state, 'ASKS_PRICE');
    if (signals.asksProof) ensureTag(state, 'ASKS_PROOF');
    if (signals.requestsQuantity || signals.closing) ensureTag(state, 'HOT_LEAD');
    if (signals.mentionsAddress || looksLikeOrderDataMessage(body)) ensureTag(state, 'HAS_ORDER_DATA');
    if (signals.asksGuide || signals.asksPickup) ensureTag(state, 'LOGISTICS');
    if (signals.postSale) ensureTag(state, 'POST_SALE');

    state.countryCode = countryCode || OFFICIAL_COUNTRY;
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
            asksProof: signals.asksProof,
            asksComposition: signals.asksComposition,
            asksLiquid: signals.asksLiquid,
            asksGuide: signals.asksGuide,
            asksPickup: signals.asksPickup,
            mentionsAddress: signals.mentionsAddress,
            priceResistance: signals.priceResistance,
            closing: signals.closing,
            postSale: signals.postSale,
            requestsQuantity: signals.requestsQuantity,
            mentionsProducts: signals.mentionsProducts,
            mentionsVitPower: signals.mentionsVitPower,
            explicitWarmupExit: signals.explicitWarmupExit,
            funnelBucket: signals.funnelBucket,
            buyerScore: signals.buyerScore
        },
        lastKnownFunnelBucket: signals.funnelBucket,
        buyerScore: signals.buyerScore,
        perAgentMemory: {
            ...((state.metadata || {}).perAgentMemory || {}),
            [OFFICIAL_AGENT]: {
                ...(((state.metadata || {}).perAgentMemory || {})[OFFICIAL_AGENT] || {}),
                lastInboundAt: new Date(),
                lastInboundText: body,
                lastReason: reason,
                lastFunnelBucket: signals.funnelBucket,
                buyerScore: signals.buyerScore
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
    const sessionId = payload.sessionId || null;
    const messageId = payload.id ? String(payload.id) : '';
    const senderPn = payload.senderPn || payload.fullMessage?.key?.senderPn || null;
    const senderPhoneDigits = digitsOnly(senderPn);
    let state = await findContinuityContactState({ chatId, senderPn });
    let countryCode = inferCountryCode(senderPn, state?.phoneDigits, state?.metadata?.lastSenderPn, state?.metadata?.customerPhoneDigits, chatId);
    const inboundTestOnly = isInboundTestOnlyPhone(chatId, senderPn, senderPhoneDigits, state?.phoneDigits, state?.metadata?.customerPhoneDigits);
    const operationalPanelPhone = isOperationalPanelPhone(chatId, senderPn, senderPhoneDigits, state?.phoneDigits, state?.metadata?.customerPhoneDigits);
    const priorityBotTestPhone = isPriorityBotTestPhone(chatId, senderPn, senderPhoneDigits, state?.phoneDigits, state?.metadata?.customerPhoneDigits);

    if (priorityBotTestPhone) {
        const frozenState = await findPriorityFrozenContactState({
            chatId,
            senderPn,
            phoneDigits: senderPhoneDigits || state?.phoneDigits || state?.metadata?.customerPhoneDigits || state?.metadata?.lastSenderPn
        });
        if (frozenState && (!state || String(frozenState._id) !== String(state._id))) {
            console.log(`[ROUTER] estado congelado priorizado para teste 8637 | antigo=${state?._id || 'novo'} | atual=${frozenState._id}`);
            state = frozenState;
            countryCode = inferCountryCode(senderPn, state?.phoneDigits, state?.metadata?.lastSenderPn, state?.metadata?.customerPhoneDigits, chatId);
        }
    }

    if (isBlockedBroadcastOrGroup(chatId)) {
        console.log(`[ROUTER] inbound bloqueado: grupo/broadcast/newsletter | chat=${chatId}`);
        return;
    }

    if (countryRestrictedInboundEnabled() && !priorityBotTestPhone && !operationalPanelPhone && !isAllowedCustomerCountry({ chatId, senderPn, phoneDigits: senderPhoneDigits || state?.phoneDigits || state?.metadata?.lastSenderPn })) {
        console.log(`[ROUTER] inbound bloqueado: somente clientes EC/CO 593/57 | chat=${chatId} | senderPn=${senderPn || 'sem_senderPn'}`);
        return;
    }

    if (!state) {
        state = new ContactState({
            chatId,
            phoneDigits: senderPhoneDigits || String(chatId || '').replace(/\D/g, ''),
            countryCode
        });
    }
    rememberContactChannel({ state, chatId, senderPn, sessionId });
    const adminContactSync = operationalPanelPhone
        ? { ok: false, skipped: true, reason: 'operational_panel_phone' }
        : ensureInboundContactInAdminPanel({ chatId, senderPn, state, countryCode });
    if (adminContactSync?.mode === 'created') {
        state.metadata = {
            ...(state.metadata || {}),
            adminPanelLeadId: adminContactSync.lead_id,
            adminPanelInboundGuardAt: new Date()
        };
    }

    const inboundAlreadyProcessed = priorityBotTestPhone
        ? hasProcessedInboundMessageId({ state, messageId })
        : hasProcessedInbound({ state, messageId, body });
    if ((!operationalPanelPhone || priorityBotTestPhone) && inboundAlreadyProcessed) {
        console.log(`[ROUTER] inbound duplicado ignorado | chat=${chatId} | id=${messageId || 'sem_id'}`);
        return;
    }
    markInboundProcessed({ state, messageId, body });
    await saveInboundMessage({ messageId, chatId, senderPn, body, sessionId });

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
        lastActiveChatId: chatId,
        ...(senderPn ? { lastSenderPn: senderPn } : {})
    };

    if (operationalPanelPhone && !priorityBotTestPhone) {
        state.countryCode = 'BR';
        state.human = {
            ...(state.human || {}),
            mode: 'manual',
            pausedUntil: null,
            assignedName: inboundTestOnly ? 'Teste envio' : 'Numero operacional',
            note: inboundTestOnly
                ? 'TESTE ENVIO: contato interno usado apenas para envio/teste. Nao tratar como lead real.'
                : 'NUMERO OPERACIONAL: liberado para enviar/receber no painel. Nao tratar como lead real.',
            lastManualAt: new Date(),
            lastManualBy: 'sistema'
        };
        state.tags = [...new Set([
            ...(state.tags || []),
            inboundTestOnly ? 'TESTE_ENVIO' : 'NUMERO_OPERACIONAL',
            'BR_OPERACIONAL'
        ])];
        state.metadata = {
            ...(state.metadata || {}),
            testOnly: true,
            outboundTestOnly: true,
            lastHumanHoldAt: new Date(),
            lastHumanHoldReason: inboundTestOnly ? 'inbound_test_only' : 'operational_panel_phone'
        };
        await state.save();
        console.log(`[ROUTER] inbound operacional salvo sem automacao | chat=${chatId} | senderPn=${senderPn || 'sem_senderPn'} | session=${sessionId || 'sem_session'}`);
        return;
    }

    if (priorityBotTestPhone) {
        if (!state.metadata?.fullFunnelTestEnabled) {
            resetPriorityBotTestConversationMemory(state);
        }
        state.countryCode = OFFICIAL_COUNTRY;
        state.human = {
            ...(state.human || {}),
            mode: 'auto',
            pausedUntil: null,
            assignedName: 'Teste 8637',
            note: 'TESTE 8637: prioridade fixa no painel com bot liberado.'
        };
        state.tags = [...new Set([
            ...(state.tags || []),
            'TESTE_8637_PRIORIDADE',
            'TESTE_FIXO_NAO_MEXER',
            'BOT_TESTE_LIBERADO'
        ])];
        state.metadata = {
            ...(state.metadata || {}),
            testOnly: true,
            outboundTestOnly: true,
            priorityFrozen: true,
            priorityFrozenReason: 'NUMERO_8637_TESTE_PERMANENTE_NAO_MEXER',
            botTestEnabled: true,
            fullFunnelTestEnabled: true,
            lastHumanHoldReason: ''
        };
    }

    if (countryCode === 'CO') {
        state.countryCode = 'CO';
        state.human = {
            ...(state.human || {}),
            mode: 'manual',
            pausedUntil: null,
            assignedName: state.human?.assignedName || 'Atendimento CO',
            note: 'Cliente CO: direcionado automaticamente para atendimento humano. Bot comercial nao responde.',
            lastManualAt: new Date(),
            lastManualBy: 'sistema'
        };
        state.tags = [...new Set([
            ...(state.tags || []),
            'CO_ATENDIMENTO_MANUAL',
            'BOT_BLOQUEADO_CO',
            'ATENDENDO'
        ])];
        state.metadata = {
            ...(state.metadata || {}),
            lastHumanHoldAt: new Date(),
            lastHumanHoldReason: 'co_direct_to_human',
            coDirectToHuman: true
        };
        await state.save();
        ensureInboundContactInAdminPanel({ chatId, senderPn, state, countryCode: 'CO' });
        console.log(`[ROUTER] cliente CO enviado direto para atendimento humano | chat=${chatId} | senderPn=${senderPn || 'sem_senderPn'} | session=${sessionId || 'sem_session'}`);
        return;
    }

    const human = state.human || {};
    const pausedUntil = human.pausedUntil ? new Date(human.pausedUntil).getTime() : 0;
    const lastManualAt = human.lastManualAt ? new Date(human.lastManualAt).getTime() : 0;
    const manualExpired = human.mode === 'manual' && (
        (pausedUntil && pausedUntil <= Date.now())
        || (!pausedUntil && lastManualAt && Date.now() - lastManualAt >= manualAutoReturnMs())
    );
    if (manualExpired) {
        state.human = {
            ...human,
            mode: 'auto',
            pausedUntil: null,
            note: human.note || 'Atendimento manual expirado; automacao retomada.'
        };
        state.metadata = {
            ...(state.metadata || {}),
            lastHumanAutoReleaseAt: new Date(),
            lastHumanAutoReleaseReason: 'manual_timeout'
        };
        await state.save();
        console.log(`[ROUTER] atendimento manual expirado; automacao retomada | chat=${chatId}`);
    } else if (human.mode === 'manual' && (!pausedUntil || pausedUntil > Date.now())) {
        const manualReason = String(
            state.metadata?.automationPausedReason
            || state.metadata?.automationHandoffSuggestedReason
            || state.metadata?.lastHumanHoldReason
            || ''
        );
        if (manualReason === 'order_closed_human_handoff') {
            state.metadata = {
                ...(state.metadata || {}),
                postOrderAutomationAllowedAt: new Date(),
                postOrderAutomationAllowedReason: 'answer_doubts_without_reopening_funnel'
            };
            await state.save();
            console.log(`[ROUTER] pos-fechamento liberado para duvidas sem reabrir funil | chat=${chatId}`);
        } else {
        state.metadata = {
            ...(state.metadata || {}),
            lastHumanHoldAt: new Date(),
            lastHumanHoldReason: 'manual_attendance_active'
        };
        await state.save();
        console.log(`[ROUTER] automacao pausada por atendimento humano | chat=${chatId} | operador=${human.assignedName || human.assignedTo || 'sem_nome'}`);
        return;
        }
    }

    const [latestOrder, recentCommercialPrompt] = await Promise.all([
        findLatestOrderForContact({ chatId, senderPn, state }),
        findRecentCommercialBotPrompt({ chatId, senderPn, state })
    ]);
    const resolvedCountryCode = countryCode || OFFICIAL_COUNTRY;

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

    const lockAcquired = await acquireContactProcessingLock({ stateId: state._id, messageId });
    if (!lockAcquired) {
        console.log(`[ROUTER] cliente ja em processamento; resposta paralela bloqueada | chat=${chatId} | id=${messageId || 'sem_id'}`);
        return;
    }

    try {
        if (!priorityBotTestPhone) {
            await waitForFirstReplyWindow({
                state,
                isFirstInbound,
                recovered: Boolean(payload.recovered),
                chatId
            });
        }
        const outboundFrom = priorityBotTestPhone && senderPhoneDigits
            ? `${senderPhoneDigits}@s.whatsapp.net`
            : chatId;
        await dispatchToAgent({
            assignedAgent: decision.assignedAgent,
            payload: {
                ...payload,
                from: outboundFrom,
                inboundChatId: chatId,
                senderPn,
                contactStateId: state._id.toString(),
                agentDecisionReason: decision.reason,
                sessionId
            }
        });
        if (!operationalPanelPhone) {
            markBotAttendanceInAdminPanel({ chatId, senderPn, state, countryCode: resolvedCountryCode });
        }
    } finally {
        await releaseContactProcessingLock({ stateId: state._id, messageId });
    }
};
