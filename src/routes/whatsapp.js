import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { listAudioTemplates, resolveCountryAudio } from '../services/audioTemplateService.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';
import VslVisit from '../models/VslVisit.js';
import { getSalesMedia } from '../services/salesMediaCatalog.js';
import { disconnectWhatsApp, getAllStatuses, getOwnPhoneDigits, getSock, getStatus, registerWhatsAppSession, startWhatsApp } from '../whatsapp/connection.js';
import { sendText } from '../whatsapp/sendText.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { sendVideo } from '../whatsapp/sendVideo.js';
import { canSendOutbound } from '../whatsapp/outboundGuard.js';
import { getSenderPoolStatus } from '../whatsapp/sessionRouter.js';
import { toWhatsAppChatId } from '../utils/phone.js';
import {
    listReengagementCandidates,
    sendReengagementToChat
} from '../services/reengagementService.js';
import { syncContactDraftToOnlineAdminPanel } from '../services/adminPanelStatusService.js';
import { processBacklogRecovery } from '../services/backlogRecoveryService.js';
import { reconcileAdminPanelAtendimento } from '../services/adminPanelLeadReconciliationService.js';
import { nextSellerForNewLead, sellerIsActive, sellerRotationPreview } from '../services/sellerRotationService.js';
import { sendBrowserMetaEvent } from '../services/metaConversionsService.js';

const router = express.Router();
const debugRoutesEnabled = String(process.env.ENABLE_WHATSAPP_DEBUG_ROUTES || '') === '1';

const resolveChatId = (phone, country) => (
    String(phone || '').includes('@') ? String(phone) : toWhatsAppChatId(phone, country)
);

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const manualAutoReturnMinutes = () => {
    const parsed = Number.parseInt(String(process.env.WHATSAPP_MANUAL_AUTO_RETURN_MINUTES || '10'), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
};

const manualAutoReturnUntil = (minutes = manualAutoReturnMinutes()) => (
    new Date(Date.now() + Math.max(1, Number(minutes) || manualAutoReturnMinutes()) * 60 * 1000)
);

const normalizePanelCountry = (value, fallback = 'EC') => {
    const normalized = String(value || '').trim().toUpperCase();
    return ['EC', 'CO'].includes(normalized) ? normalized : fallback;
};

const countryPrefixFromDigits = (value) => {
    const digits = digitsOnly(value);
    if (digits.startsWith('593')) return 'EC';
    if (digits.startsWith('55')) return 'BR';
    if (digits.startsWith('57')) return 'CO';
    return '';
};

const inferCountryFromPhoneDigits = (value, fallback = 'EC') => {
    const inferred = countryPrefixFromDigits(value);
    return ['EC', 'CO', 'BR'].includes(inferred) ? inferred : fallback;
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

const operationalPanelPhones = () => [
    '553183002800',
    '553171862958',
    '5515991418416',
    process.env.WHATSAPP_DEFAULT_SESSION_ID,
    process.env.WHATSAPP_SESSION_IDS,
    process.env.WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS,
    process.env.WHATSAPP_PANEL_OPERATIONAL_NUMBERS
].flatMap(parseDigitsList);

const brazilPanelTestPhones = () => [
    '5515998038637',
    '553171862958',
    '5531971862958',
    '553183002800',
    '5531983002800',
    process.env.WHATSAPP_TEST_ALLOWED_RECIPIENTS,
    process.env.WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS,
    process.env.WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS,
    process.env.WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS,
    process.env.WHATSAPP_PANEL_OPERATIONAL_NUMBERS,
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

const matchBrazilPanelTestPhone = (...identifiers) => {
    const allowed = brazilPanelTestPhones();
    const candidates = identifiers
        .map((item) => digitsOnly(item))
        .filter(Boolean);
    for (const candidate of candidates) {
        const match = allowed.find((item) => item.startsWith('55') && isSamePhone(candidate, item));
        if (match) return match;
    }
    return '';
};

const isBrazilPanelTestPhone = (...identifiers) => Boolean(matchBrazilPanelTestPhone(...identifiers));

const isAllowedPanelPhoneForCountry = (phone = '', country = 'EC') => {
    const digits = normalizeClientPhoneDigits(phone, country);
    if (matchBrazilPanelTestPhone(phone, digits)) return true;
    if (digits.startsWith('55')) return isBrazilPanelTestPhone(digits);
    if (isOperationalPanelPhone(digits)) return true;
    const normalizedCountry = normalizePanelCountry(country);
    if (normalizedCountry === 'EC') return /^5939\d{8}$/.test(digits);
    if (normalizedCountry === 'CO') return /^573\d{9}$/.test(digits);
    return true;
};

const normalizeClientPhoneDigits = (phone = '', country = 'EC') => {
    const digits = digitsOnly(phone);
    const normalizedCountry = normalizePanelCountry(country);
    if (normalizedCountry === 'EC') {
        if (digits.startsWith('593')) return digits;
        if (digits.startsWith('09') && digits.length === 10) return `593${digits.slice(1)}`;
        if (digits.startsWith('9') && digits.length === 9) return `593${digits}`;
    }
    if (normalizedCountry === 'CO') {
        if (digits.startsWith('57')) return digits;
        if (digits.startsWith('3') && digits.length === 10) return `57${digits}`;
    }
    return digits;
};

const isBrazilTestOnly = ({ phone = '', country = '' } = {}) => {
    const normalizedCountry = String(country || '').trim().toUpperCase();
    const phoneDigits = digitsOnly(phone);
    if (normalizedCountry !== 'BR' && !phoneDigits.startsWith('55')) return false;
    return isBrazilPanelTestPhone(phoneDigits);
};

const isOperationalOrTestPanelContact = ({ phone = '', country = '', state = null } = {}) => {
    const tags = Array.isArray(state?.tags) ? state.tags.map((tag) => String(tag || '').toUpperCase()) : [];
    const phoneDigits = digitsOnly(phone);
    const stateDigits = digitsOnly(state?.phoneDigits || state?.chatId || state?.metadata?.lastSenderPn || state?.metadata?.customerDraft?.phone);
    const brazilLike = String(country || '').trim().toUpperCase() === 'BR'
        || phoneDigits.startsWith('55')
        || stateDigits.startsWith('55');
    return Boolean(
        isBrazilTestOnly({ phone, country })
        || (!brazilLike && isOperationalPanelPhone(phone, state?.phoneDigits, state?.chatId, state?.metadata?.lastSenderPn, state?.metadata?.customerDraft?.phone))
        || state?.metadata?.operationalPanelPhone
        || state?.metadata?.outboundTestOnly
        || state?.metadata?.testOnly
        || tags.some((tag) => ['NUMERO_OPERACIONAL', 'TESTE_ENVIO', 'BR_OPERACIONAL', 'NAO_CLIENTE'].includes(tag))
    );
};

const markPanelContactAsTestOnly = (state, { phone = '', note = '', user = null, mode = 'manual' } = {}) => {
    const tags = Array.isArray(state.tags) ? state.tags : [];
    state.countryCode = 'BR';
    state.human = {
        ...(state.human || {}),
        mode: mode === 'auto' ? 'auto' : 'manual',
        assignedTo: user?._id?.toString?.() || state.human?.assignedTo || '',
        assignedName: user?.name || user?.email || state.human?.assignedName || 'Teste painel',
        assignedAt: new Date(),
        pausedUntil: mode === 'auto' ? null : manualAutoReturnUntil(),
        lastManualAt: new Date(),
        lastManualBy: user?.name || user?.email || 'painel',
        note: String(note || 'Numero de atendente/teste. Nao sincronizar como cliente real.').trim()
    };
    state.tags = [...new Set([...tags, 'TESTE_ENVIO', 'NUMERO_OPERACIONAL', 'NAO_CLIENTE'])];
    state.metadata = {
        ...(state.metadata || {}),
        operationalPanelPhone: true,
        outboundTestOnly: true,
        testOnly: true,
        panelTestOnlyAt: new Date(),
        panelTestOnlyReason: 'operator_or_brazil_phone',
        customerDraft: {
            ...(state.metadata?.customerDraft || {}),
            phone: String(phone || state.phoneDigits || '').trim(),
            country: 'BR',
            status: 'teste',
            updatedAt: new Date().toISOString()
        }
    };
    return state;
};

const MANUAL_ACTION_TAGS = {
    atendimento_iniciado: 'Atendimento iniciado',
    humano_no_comando: 'Humano no comando',
    bot_liberado: 'Bot liberado',
    repetidas_limpas: 'Mensagens repetidas limpas',
    dados_pedidos: 'Dados pedidos',
    dados_recebidos: 'Dados recebidos',
    audio_enviado: 'Audio enviado',
    prova_enviada: 'Prova enviada',
    preco_enviado: 'Preco enviado',
    aguardando_cliente: 'Aguardando cliente',
    pedido_confirmado: 'Pedido confirmado',
    enviado_dropi: 'Enviado Dropi',
    guia_enviada: 'Guia enviada',
    resolvido: 'Resolvido',
    revisar: 'Revisar'
};

const MANUAL_CLOSE_COMMANDS = new Set([
    '#fechado',
    '/fechado',
    '#pedido_confirmado',
    '/pedido_confirmado',
    '#venda_concluida',
    '/venda_concluida'
]);

const MANUAL_ATTENDING_COMMANDS = new Set([
    '#atendendo',
    '/atendendo',
    '#atendimento',
    '/atendimento',
    '#humano',
    '/humano'
]);

const normalizeManualAction = (value = '') => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_');

const normalizeOperatorCommand = (value = '') => String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

const isManualCloseCommand = (value = '') => MANUAL_CLOSE_COMMANDS.has(normalizeOperatorCommand(value));
const isManualAttendingCommand = (value = '') => MANUAL_ATTENDING_COMMANDS.has(normalizeOperatorCommand(value));

const longManualHoldUntil = () => new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000);

const registerPanelAction = async ({
    state,
    action,
    label,
    by = '',
    detail = '',
    chatId = '',
    phone = ''
} = {}) => {
    if (!state) return null;
    const normalizedAction = normalizeManualAction(action || 'acao_manual');
    const finalLabel = label || MANUAL_ACTION_TAGS[normalizedAction] || normalizedAction.replace(/_/g, ' ');
    const at = new Date();
    const operator = by || 'painel';
    const entry = {
        action: normalizedAction,
        label: finalLabel,
        at,
        by: operator,
        detail: String(detail || '').trim()
    };
    const tags = Array.isArray(state.tags) ? state.tags : [];
    state.tags = [...new Set([...tags, `manual:${normalizedAction}`])];
    state.metadata = {
        ...(state.metadata || {}),
        lastManualAction: entry,
        manualActions: [
            ...(((state.metadata || {}).manualActions || []).slice(-49)),
            entry
        ]
    };
    const resolvedChatId = state.chatId || chatId || (digitsOnly(phone || state.phoneDigits) ? `${digitsOnly(phone || state.phoneDigits)}@c.us` : '');
    if (resolvedChatId) {
        await Message.create({
            _id: `panel_action_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            chatId: resolvedChatId,
            peerPhone: state.phoneDigits || digitsOnly(phone),
            from: 'system',
            to: resolvedChatId,
            body: `[PAINEL] ${finalLabel}${entry.detail ? ` - ${entry.detail}` : ''}`,
            type: 'system',
            isFromMe: true,
            isBot: false,
            timestamp: Math.floor(at.getTime() / 1000)
        }).catch((error) => {
            if (error.code !== 11000) console.warn('[PAINEL] falha ao registrar acao:', error.message);
        });
    }
    return entry;
};

const findOrCreateContactStateForPanel = async ({ chatId = '', phone = '', country = 'EC' } = {}) => {
    const digits = digitsOnly(phone);
    const stateOr = [];
    if (chatId) stateOr.push({ chatId });
    if (digits) {
        stateOr.push({ phoneDigits: digits });
        stateOr.push({ phoneDigits: { $regex: `${digits}$` } });
        if (digits.length >= 9) stateOr.push({ phoneDigits: { $regex: `${digits.slice(-9)}$` } });
    }
    const existing = stateOr.length
        ? await ContactState.findOne({ $or: stateOr }).sort({ updatedAt: -1 })
        : null;
    if (existing) return existing;
    return new ContactState({
        chatId: chatId || (digits ? `${digits}@c.us` : `manual_${Date.now()}`),
        phoneDigits: digits,
        countryCode: normalizePanelCountry(country)
    });
};

const getPanelSessionScope = (requestedSessionId = '') => {
    const requested = String(requestedSessionId || '').trim();
    const statuses = getAllStatuses();
    const connected = statuses.filter((status) => status?.isReady || status?.status === 'connected');
    const configured = [
        requested,
        process.env.WHATSAPP_DEFAULT_SESSION_ID,
        ...(String(process.env.WHATSAPP_SESSION_IDS || '').split(','))
    ].map((item) => String(item || '').trim()).filter(Boolean);
    const sessionIds = [...new Set([
        ...configured,
        ...connected.map((status) => status.sessionId).filter(Boolean),
        ...connected.map((status) => status.ownPhoneDigits).filter(Boolean)
    ])];
    return { statuses, sessionIds };
};

const isValidPanelChatId = (chatId = '') => {
    const value = String(chatId || '');
    return Boolean(value && value !== 'status@broadcast' && !value.includes('@g.us'));
};

const realPhoneFromState = (state = {}) => {
    const sender = digitsOnly(state.metadata?.lastSenderPn);
    if (sender.length >= 9) return sender;
    const draftPhone = digitsOnly(state.metadata?.customerDraft?.phone);
    if (draftPhone.length >= 9) return draftPhone;
    const phone = digitsOnly(state.phoneDigits);
    const chatDigits = digitsOnly(state.chatId);
    if (phone.length >= 9 && !(String(state.chatId || '').endsWith('@lid') && phone === chatDigits)) return phone;
    return '';
};

const dateValueMs = (value) => {
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
};

const stableContactEntryAt = (state = {}) => (
    state.firstInboundAt
    || state.metadata?.customerDraft?.entryAt
    || state.metadata?.customerDraft?.createdAt
    || state.createdAt
    || state.metadata?.firstSeenAt
    || state.updatedAt
    || null
);

const stableOrderEntryAt = (order = {}) => (
    order.entryAt
    || order.createdAt
    || order.draftCreatedAt
    || null
);

const stableChatEntryMs = (chat = {}) => {
    const entryMs = dateValueMs(chat.entryAt);
    if (entryMs) return entryMs;
    const messageMs = Number(chat.lastMessage?.timestamp || 0) * 1000;
    return Number.isFinite(messageMs) ? messageMs : 0;
};

const CONNECTION_OPERATOR_SLOTS = [
    { sessionId: '553183002800', code: 'AL', name: 'Ana Lopez' },
    { sessionId: '553171862958', code: 'GA', name: 'Gabriela Ambrosio' },
    { sessionId: '5515991418416', code: 'VR', name: 'Valentina Rojas' }
];

const connectionOperatorSlots = () => {
    const configured = String(process.env.WHATSAPP_CONNECTION_OPERATORS || '').trim();
    if (!configured) return CONNECTION_OPERATOR_SLOTS;
    const parsed = configured.split(/[;\n]+/)
        .map((item) => {
            const [sessionId, code, ...nameParts] = item.split(':').map((part) => part.trim());
            const digits = digitsOnly(sessionId);
            const name = nameParts.join(':').trim();
            return digits && name ? { sessionId: digits, code: code || digits.slice(-4), name } : null;
        })
        .filter(Boolean);
    return parsed.length ? parsed : CONNECTION_OPERATOR_SLOTS;
};

const sessionMatches = (left = '', right = '') => {
    const a = digitsOnly(left);
    const b = digitsOnly(right);
    if (!a || !b) return false;
    return a === b || a.endsWith(b) || b.endsWith(a);
};

const connectionStageLabel = (contact = {}) => {
    const draft = contact.metadata?.customerDraft || {};
    const tags = Array.isArray(contact.tags) ? contact.tags : [];
    const raw = String(draft.status || contact.metadata?.funnelStage || contact.metadata?.lastFunnelStage || '').trim().toLowerCase();
    if (/delivered|entregue|retirada/.test(raw) || tags.some((tag) => /guia|dropi|enviado/i.test(String(tag)))) return 'GUIA';
    if (/confirmed|confirmado|processing|pedido/.test(raw)) return 'CONFIRMADO';
    if (/dados|address|agency|customer_name|delivery/.test(raw)) return 'DADOS';
    if (/offer|oferta|price|preco|precio/.test(raw)) return 'OFERTA';
    if (/proof|prova/.test(raw)) return 'PROVA';
    if (/qualifica/.test(raw)) return 'QUALIFICACAO';
    if (contact.human?.mode === 'manual') return 'HUMANO';
    return raw ? raw.replace(/[_-]+/g, ' ').toUpperCase().slice(0, 18) : 'NOVO';
};

const contactDisplayName = (contact = {}) => {
    const draft = contact.metadata?.customerDraft || {};
    return String(draft.name || contact.metadata?.notifyName || contact.phoneDigits || realPhoneFromState(contact) || 'Cliente').trim();
};

const contactActivityAt = (contact = {}, latestMessage = null) => {
    const values = [
        contact.lastInboundAt,
        contact.lastOutboundAt,
        latestMessage?.createdAt,
        latestMessage?.timestamp ? new Date(Number(latestMessage.timestamp) * 1000) : null,
        contact.createdAt
    ].filter(Boolean).map((value) => new Date(value)).filter((date) => !Number.isNaN(date.getTime()));
    return values.sort((a, b) => b.getTime() - a.getTime())[0] || null;
};

const contactIsWaiting = (contact = {}) => {
    const inbound = contact.lastInboundAt ? new Date(contact.lastInboundAt) : null;
    const outbound = contact.lastOutboundAt ? new Date(contact.lastOutboundAt) : null;
    if (!inbound || Number.isNaN(inbound.getTime())) return false;
    if (!outbound || Number.isNaN(outbound.getTime())) return true;
    return inbound.getTime() > outbound.getTime();
};

const buildConnectionWorkload = async ({ country = 'EC' } = {}) => {
    const slots = connectionOperatorSlots();
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const waitingMs = Number.parseInt(process.env.CONNECTION_WAITING_MINUTES || '8', 10) * 60 * 1000;
    const staleMs = Number.parseInt(process.env.CONNECTION_STALE_MINUTES || '30', 10) * 60 * 1000;

    const dayMessages = await Message.find({
        createdAt: { $gte: startOfDay },
        chatId: { $exists: true, $nin: ['', 'status@broadcast'], $not: /@g\.us$/ }
    }, {
        chatId: 1,
        peerPhone: 1,
        sessionId: 1,
        ownerPhoneDigits: 1,
        isFromMe: 1,
        body: 1,
        timestamp: 1,
        createdAt: 1,
        notifyName: 1
    }).sort({ createdAt: -1 }).limit(1500).lean().catch(() => []);

    const latestMessageByTail = new Map();
    for (const message of dayMessages) {
        const tail = digitsOnly(message.peerPhone || message.chatId).slice(-9);
        if (!tail || latestMessageByTail.has(tail)) continue;
        latestMessageByTail.set(tail, message);
    }

    const contacts = await ContactState.find({
        $and: [
            { chatId: { $exists: true, $nin: ['', 'status@broadcast'], $not: /@g\.us$/ } },
            { countryCode: normalizePanelCountry(country || 'EC') },
            {
                $or: [
                    { createdAt: { $gte: startOfDay } },
                    { firstInboundAt: { $gte: startOfDay } },
                    { lastInboundAt: { $gte: startOfDay } },
                    { lastOutboundAt: { $gte: startOfDay } }
                ]
            }
        ]
    }, {
        chatId: 1,
        phoneDigits: 1,
        countryCode: 1,
        human: 1,
        tags: 1,
        metadata: 1,
        firstInboundAt: 1,
        lastInboundAt: 1,
        lastOutboundAt: 1,
        createdAt: 1,
        updatedAt: 1
    }).sort({ updatedAt: -1 }).limit(800).lean().catch(() => []);

    const bySession = new Map(slots.map((slot) => [slot.sessionId, {
        sessionId: slot.sessionId,
        attendant: slot.name,
        code: slot.code,
        activeCustomers: 0,
        newToday: 0,
        waitingResponse: 0,
        stale: 0,
        alert: 'idle',
        customers: []
    }]));

    const sessionForContact = (contact, latestMessage) => {
        const candidates = [
            contact.metadata?.senderWallet?.assignedSessionId,
            latestMessage?.ownerPhoneDigits,
            latestMessage?.sessionId,
            contact.metadata?.lastSessionId
        ].filter(Boolean);
        for (const candidate of candidates) {
            const slot = slots.find((item) => sessionMatches(candidate, item.sessionId));
            if (slot) return slot.sessionId;
        }
        return '';
    };

    for (const contact of contacts) {
        const phone = realPhoneFromState(contact);
        if (!phone || isOperationalOrTestPanelContact({ phone, country, state: contact })) continue;
        const tail = digitsOnly(phone).slice(-9);
        const latestMessage = latestMessageByTail.get(tail) || null;
        const sessionId = sessionForContact(contact, latestMessage);
        if (!sessionId || !bySession.has(sessionId)) continue;
        const bucket = bySession.get(sessionId);
        const activeAt = contactActivityAt(contact, latestMessage);
        const firstAt = contact.firstInboundAt || contact.createdAt ? new Date(contact.firstInboundAt || contact.createdAt) : null;
        const waiting = contactIsWaiting(contact);
        const waitingAge = waiting && contact.lastInboundAt ? now.getTime() - new Date(contact.lastInboundAt).getTime() : 0;
        const isStale = waiting && waitingAge >= staleMs;
        bucket.activeCustomers += 1;
        if (firstAt && !Number.isNaN(firstAt.getTime()) && firstAt >= startOfDay) bucket.newToday += 1;
        if (waiting && waitingAge >= waitingMs) bucket.waitingResponse += 1;
        if (isStale) bucket.stale += 1;
        bucket.customers.push({
            name: contactDisplayName(contact).slice(0, 42),
            phoneTail: tail.slice(-4),
            stage: connectionStageLabel(contact),
            lastInteractionAt: activeAt ? activeAt.toISOString() : '',
            status: isStale ? 'PARADO' : waiting ? 'AGUARDANDO' : 'ATIVO'
        });
    }

    return {
        generatedAt: now.toISOString(),
        country: normalizePanelCountry(country || 'EC'),
        sessions: [...bySession.values()].map((item) => {
            const alert = item.stale > 0
                ? 'stale'
                : item.waitingResponse > 0
                    ? 'waiting'
                    : item.newToday > 0
                        ? 'new'
                        : item.activeCustomers > 0
                            ? 'active'
                            : 'idle';
            return {
                ...item,
                alert,
                customers: item.customers
                    .sort((a, b) => new Date(b.lastInteractionAt || 0) - new Date(a.lastInteractionAt || 0))
                    .slice(0, 10)
            };
        })
    };
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

const resolveMessageLookupForPhone = async (phone, { fastMode = true } = {}) => {
    const chatId = String(phone || '').includes('@') ? String(phone) : `${phone}@c.us`;
    const digits = digitsOnly(phone);
    const isLidChat = chatId.endsWith('@lid');
    const tails = phoneTailCandidates(digits);

    const stateQuery = fastMode && !String(phone || '').includes('@') && digits
        ? {
            $or: [
                { phoneDigits: digits },
                { chatId: `${digits}@c.us` },
                { chatId: `${digits}@s.whatsapp.net` }
            ]
        }
        : String(phone || '').includes('@')
        ? { chatId }
        : {
            $or: [
                ...(digits ? [{ phoneDigits: digits }, { chatId: { $regex: digits } }] : []),
                ...tails.map((tail) => ({ phoneDigits: { $regex: `${tail}$` } })),
                ...tails.map((tail) => ({ 'metadata.lastSenderPn': { $regex: tail } })),
                ...tails.map((tail) => ({ 'metadata.customerDraft.phone': { $regex: tail } }))
            ]
        };
    const states = await ContactState.find(stateQuery).sort({ updatedAt: -1 }).limit(20).lean().catch(() => []);
    const linkedChatIds = [...new Set([
        chatId,
        ...states.map((state) => state.chatId).filter(Boolean)
    ].filter(isValidPanelChatId))];

    const lastLinkedMessage = await Message.findOne({
        $or: linkedChatIds.flatMap((id) => ([{ chatId: id }, { from: id }, { to: id }])),
        peerPhone: { $exists: true, $ne: '' }
    }).sort({ timestamp: -1 }).lean().catch(() => null);
    const state = states[0] || null;
    const realDigits = isLidChat
        ? (state?.phoneDigits || lastLinkedMessage?.peerPhone || '')
        : digits;

    const realPhones = [...new Set([
        realDigits,
        digits,
        ...states.map(realPhoneFromState),
        ...states.map((item) => digitsOnly(item.metadata?.customerDraft?.phone)),
        digitsOnly(lastLinkedMessage?.peerPhone)
    ].filter((item) => item && item.length >= 8))];

    const or = linkedChatIds.flatMap((id) => ([
        { chatId: id },
        { from: id },
        { to: id }
    ]));
    realPhones.forEach((item) => or.push({ peerPhone: item }));
    if (!fastMode) {
        phoneTailCandidates(realPhones[0] || digits).forEach((tail) => {
            or.push({ peerPhone: { $regex: `${tail}$` } });
        });
    }

    return { or, states, linkedChatIds, realPhones };
};

const normalizeBotDuplicateKey = (message = {}) => {
    const body = String(message.body || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    const mediaUrl = String(message.mediaUrl || '').trim();
    if (!body && !mediaUrl) return '';
    return [
        String(message.type || 'chat').toLowerCase(),
        body,
        mediaUrl
    ].join('|');
};

const isBotMessageForDeduplication = (message = {}) => (
    message.isBot === true
    || String(message.from || '') === 'bot'
);

const duplicateBotMessageIds = (messages = [], { windowMinutes = 1440 } = {}) => {
    const windowMs = Math.max(1, Number(windowMinutes) || 1440) * 60 * 1000;
    const seen = new Map();
    const duplicates = [];
    for (const message of messages) {
        if (!isBotMessageForDeduplication(message)) continue;
        const key = normalizeBotDuplicateKey(message);
        if (!key) continue;
        const at = message.timestamp
            ? Number(message.timestamp) * 1000
            : new Date(message.createdAt || message.updatedAt || Date.now()).getTime();
        const previous = seen.get(key);
        if (previous && Math.abs(at - previous.at) <= windowMs) {
            duplicates.push({
                _id: message._id,
                body: message.body || '',
                type: message.type || 'chat',
                timestamp: message.timestamp || null,
                keptId: previous._id
            });
            continue;
        }
        seen.set(key, { _id: message._id, at });
    }
    return duplicates;
};

const canDeletePanelMessage = (message = {}) => (
    message.isFromMe === true
    || message.isBot === true
    || ['bot', 'system'].includes(String(message.from || '').toLowerCase())
);

const quotedBodyFromRecord = (message = null) => String(message?.body || message?.type || '').slice(0, 4000) || 'Mensagem';

const buildQuotedMessageFromRecord = (message = null) => {
    if (!message?._id || !message?.chatId) return null;
    const body = quotedBodyFromRecord(message);
    return {
        key: {
            remoteJid: message.chatId,
            id: message._id,
            fromMe: Boolean(message.isFromMe)
        },
        message: {
            conversation: body
        }
    };
};

const isLocalRequest = (req) => {
    const host = String(req.hostname || req.headers.host || '').split(':')[0];
    const ip = String(req.ip || req.socket?.remoteAddress || '');
    return ['localhost', '127.0.0.1', '::1'].includes(host)
        || ip === '127.0.0.1'
        || ip === '::1'
        || ip === '::ffff:127.0.0.1';
};

const cleanText = (value) => String(value || '').trim();

const requestIp = (req) => cleanText(
    req.get?.('cf-connecting-ip')
    || req.get?.('x-real-ip')
    || String(req.headers?.['x-forwarded-for'] || '').split(',')[0]
    || req.ip
    || req.socket?.remoteAddress
);

const shortHash = (value = '') => crypto.createHash('sha256')
    .update(String(value || ''))
    .digest('hex')
    .slice(0, 24);

const vslVisitorKey = ({ country = 'EC', body = {}, req }) => {
    const normalizedCountry = normalizePanelCountry(country);
    const ipHash = shortHash(requestIp(req));
    const userAgent = cleanText(body.client_user_agent || body.clientUserAgent || req.get?.('user-agent'));
    const visitorId = cleanText(body.visitorId || body.visitor_id || body.external_id || body.externalId);
    const sessionId = cleanText(body.sessionId || body.session_id);
    const base = visitorId || sessionId || `${ipHash}:${shortHash(userAgent)}`;
    if (body.testEntry && body.forceNewLead) {
        return `${normalizedCountry}:test:${Date.now()}:${shortHash(base || Math.random())}`;
    }
    return `${normalizedCountry}:${shortHash(base || `${Date.now()}:${Math.random()}`)}`;
};

const vslPageViewEventId = ({ visitorKey, body = {} }) => cleanText(
    body.pageViewEventId
    || body.page_view_event_id
    || body.event_id_page_view
    || `PageView:${visitorKey}`
).slice(0, 220);

const vslLeadEventId = ({ body = {} }) => cleanText(
    body.leadEventId
    || body.lead_event_id
    || body.eventId
    || body.event_id
).slice(0, 220);

const metaEventResponseSnapshot = (result = {}, fallbackEventId = '') => ({
    ok: Boolean(result.ok),
    status: result.status || null,
    data: result.data || null,
    error: result.error || null,
    eventId: result.eventId || fallbackEventId || ''
});

const sendVslPageViewForVisit = async ({ visit, body, req, country, visitorKey }) => {
    if (!visit || visit.metaPageViewSentAt) {
        return { alreadySent: Boolean(visit?.metaPageViewSentAt), eventId: visit?.metaPageViewEventId || '' };
    }

    const tracking = visit.tracking || {};
    const eventId = vslPageViewEventId({ visitorKey, body });
    const result = await sendBrowserMetaEvent({
        country,
        eventName: 'PageView',
        event_id: eventId,
        event_source_url: visit.sourceUrl || body.event_source_url || body.eventSourceUrl || body.sourceUrl,
        client_user_agent: visit.userAgent || body.client_user_agent || body.clientUserAgent,
        fbc: tracking.fbc || body.fbc,
        fbp: tracking.fbp || body.fbp,
        external_id: tracking.external_id || visit.visitorId || body.external_id || body.externalId
    }, req);

    const metaUpdate = {
        metaPageViewEventId: result.eventId || eventId,
        metaPageViewResponse: result.response || metaEventResponseSnapshot(result, eventId)
    };
    if (result.ok) metaUpdate.metaPageViewSentAt = new Date();
    await VslVisit.updateOne({ visitorKey }, { $set: metaUpdate });
    return { ...result, eventId: result.eventId || eventId };
};

const sendVslLeadForVisit = async ({ visit, body, req, country, visitorKey }) => {
    if (!visit || visit.metaLeadSentAt) {
        return { alreadySent: Boolean(visit?.metaLeadSentAt), eventId: visit?.metaLeadEventId || '' };
    }

    const eventId = vslLeadEventId({ body });
    if (!eventId) return null;

    const tracking = visit.tracking || {};
    const result = await sendBrowserMetaEvent({
        country,
        eventName: 'Lead',
        event_id: eventId,
        event_source_url: visit.sourceUrl || body.event_source_url || body.eventSourceUrl || body.sourceUrl,
        client_user_agent: visit.userAgent || body.client_user_agent || body.clientUserAgent,
        fbc: tracking.fbc || body.fbc,
        fbp: tracking.fbp || body.fbp,
        external_id: tracking.external_id || visit.visitorId || body.external_id || body.externalId,
        funnel_entry_message: visit.lastEntryMessage || body.message || body.funnel_entry_message,
        customer_name: visit.customerName || body.customerName || body.customer_name
    }, req);

    const metaUpdate = {
        metaLeadEventId: result.eventId || eventId,
        metaLeadResponse: result.response || metaEventResponseSnapshot(result, eventId)
    };
    if (result.ok) metaUpdate.metaLeadSentAt = new Date();
    await VslVisit.updateOne({ visitorKey }, { $set: metaUpdate });
    return { ...result, eventId: result.eventId || eventId };
};

const publicMediaUrlFromPath = (filePath = '') => {
    const value = String(filePath || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value) || value.startsWith('/media/')) return value;
    const publicDir = path.join(process.cwd(), 'public');
    const resolved = path.resolve(value);
    if (!resolved.startsWith(publicDir)) return '';
    return `/${path.relative(publicDir, resolved).split(path.sep).join('/')}`;
};

const audioPreviewUrlFor = (mediaUrl = '') => {
    const value = String(mediaUrl || '');
    if (!value.toLowerCase().endsWith('.ogg')) return '';
    const mp3Path = path.join(process.cwd(), 'public', value.replace(/^\//, '').replace(/\.ogg$/i, '.mp3'));
    return fs.existsSync(mp3Path) ? value.replace(/\.ogg$/i, '.mp3') : '';
};

const mediaAttachment = ({ type, label, mediaUrl, previewUrl = '' }) => {
    if (!mediaUrl) return null;
    return {
        type,
        label: String(label || '').trim(),
        mediaUrl,
        mediaPreviewUrl: previewUrl || audioPreviewUrlFor(mediaUrl)
    };
};

const resolveMessageMediaAttachments = async (message = {}) => {
    const attachments = [];
    const push = (attachment) => {
        if (!attachment?.mediaUrl) return;
        if (attachments.some((item) => item.mediaUrl === attachment.mediaUrl)) return;
        attachments.push(attachment);
    };

    if (message.mediaUrl) {
        push(mediaAttachment({
            type: message.type || 'media',
            label: message.body || message.type || 'midia',
            mediaUrl: message.mediaUrl,
            previewUrl: message.mediaPreviewUrl || ''
        }));
    }

    const body = String(message.body || '');
    const explicitMediaMatches = [...body.matchAll(/\b(audio|áudio|image|imagem|video|vídeo)\s*:\s*(\/media\/[^\s]+)/gi)];
    for (const match of explicitMediaMatches) {
        const rawType = String(match[1] || '').toLowerCase();
        const mediaUrl = String(match[2] || '').trim();
        const type = rawType.includes('audio') || rawType.includes('áudio')
            ? 'audio'
            : rawType.includes('video') || rawType.includes('vídeo')
                ? 'video'
                : 'image';
        push(mediaAttachment({ type, label: type, mediaUrl }));
    }

    const audioMatches = [...body.matchAll(/\[AUDIO\]\s*([A-Za-z0-9_ÁÉÍÓÚáéíóúÑñ-]+)/gi)];
    for (const match of audioMatches) {
        const baseName = match[1];
        const audioPath = await resolveCountryAudio({ country: 'EC', baseName }).catch(() => null);
        const mediaUrl = publicMediaUrlFromPath(audioPath);
        push(mediaAttachment({ type: 'audio', label: baseName, mediaUrl }));
    }

    const imageMatches = [...body.matchAll(/\[(?:IMAGEM|IMAGE|VIDEO)\]\s*([A-Za-z0-9_-]+)/gi)];
    for (const match of imageMatches) {
        const key = match[1];
        const media = getSalesMedia(key);
        const mediaUrl = publicMediaUrlFromPath(media?.path);
        push(mediaAttachment({ type: media?.type || 'image', label: key, mediaUrl }));
    }

    return attachments;
};

const enrichMessagesWithMedia = async (messages = []) => Promise.all((messages || []).map(async (message) => {
    const item = typeof message.toObject === 'function' ? message.toObject() : { ...message };
    const mediaAttachments = await resolveMessageMediaAttachments(item);
    if (mediaAttachments.length && !item.mediaUrl) {
        item.mediaUrl = mediaAttachments[0].mediaUrl;
        item.mediaPreviewUrl = mediaAttachments[0].mediaPreviewUrl || '';
        item.type = item.type === 'chat' ? mediaAttachments[0].type : item.type;
        item.hasMedia = true;
    }
    if (mediaAttachments.length) item.mediaAttachments = mediaAttachments;
    return item;
}));

const profilePictureJidCandidates = ({ primaryId = '', linkedIds = [], phoneDigits = '' } = {}) => {
    const candidates = new Set();
    [primaryId, ...linkedIds].filter(Boolean).forEach((id) => {
        const value = String(id || '');
        candidates.add(value);
        if (value.endsWith('@c.us')) candidates.add(value.replace('@c.us', '@s.whatsapp.net'));
    });
    const digits = digitsOnly(phoneDigits);
    if (digits.length >= 9) {
        candidates.add(`${digits}@s.whatsapp.net`);
        candidates.add(`${digits}@c.us`);
    }
    return [...candidates].filter((jid) => jid && jid !== 'status@broadcast' && !jid.includes('@g.us'));
};

const resolveProfilePictureUrl = async ({ sock, contactState, primaryId, linkedIds, phoneDigits }) => {
    const cachedUrl = String(contactState?.metadata?.profilePictureUrl || '');
    const fetchedAt = contactState?.metadata?.profilePictureFetchedAt
        ? new Date(contactState.metadata.profilePictureFetchedAt).getTime()
        : 0;
    const cacheFresh = fetchedAt && Date.now() - fetchedAt < 24 * 60 * 60 * 1000;
    if (cachedUrl && cacheFresh) return cachedUrl;
    if (!sock?.profilePictureUrl) return cachedUrl;

    const candidates = profilePictureJidCandidates({ primaryId, linkedIds, phoneDigits });
    for (const jid of candidates) {
        try {
            const url = await sock.profilePictureUrl(jid, 'image');
            if (url) {
                if (contactState?._id) {
                    await ContactState.updateOne(
                        { _id: contactState._id },
                        {
                            $set: {
                                'metadata.profilePictureUrl': url,
                                'metadata.profilePictureFetchedAt': new Date()
                            }
                        }
                    ).catch(() => null);
                }
                return url;
            }
        } catch (_error) {
            // Foto indisponivel, privada ou JID alternativo. Tentamos o proximo candidato.
        }
    }

    if (contactState?._id) {
        await ContactState.updateOne(
            { _id: contactState._id },
            { $set: { 'metadata.profilePictureFetchedAt': new Date() } }
        ).catch(() => null);
    }
    return cachedUrl;
};

const syncCustomerDraftFromState = (state, { action = 'contact_draft_sync' } = {}) => {
    const draft = state?.metadata?.customerDraft || {};
    const draftPhone = draft.phone || state?.phoneDigits || '';
    const draftCountry = draft.country || state?.countryCode || 'EC';
    if (isOperationalOrTestPanelContact({ phone: draftPhone, country: draftCountry, state })) {
        return { ok: false, skipped: true, reason: 'operator_or_test_contact' };
    }
    if (!isAllowedPanelPhoneForCountry(draftPhone, draftCountry)) {
        return { ok: false, skipped: true, reason: 'invalid_client_phone' };
    }
    const result = syncContactDraftToOnlineAdminPanel(draft, {
        country: draftCountry,
        note: state?.human?.note || '',
        action,
        adminStatus: state?.human?.mode === 'manual' && !statusVisualClosed(draft.status)
            ? 'atendendo'
            : ''
    });
    if (!result?.ok && !result?.skipped) {
        console.warn('Painel Unificado contact sync failed:', result);
    }
    return result;
};

const statusVisualClosed = (status = '') => {
    const value = String(status || '').trim().toLowerCase().replace(/-/g, '_');
    return [
        'confirmed',
        'processing',
        'pedido_enviado',
        'shipped',
        'delivered',
        'comprar_depois',
        'confirmado',
        'enviado',
        'entregue',
        'recompra',
        'cancelado',
        'devolvido'
    ].includes(value);
};

const PANEL_STATUS_ALIASES = {
    '': 'novo',
    draft: 'novo',
    pending: 'novo',
    manual: 'atendendo',
    in_service: 'atendendo',
    buy_later: 'comprar_depois',
    confirmed: 'confirmado',
    processing: 'pedido_enviado',
    shipped: 'pedido_enviado',
    enviado: 'pedido_enviado',
    delivered: 'entregue',
    cancelled: 'cancelado',
    canceled: 'cancelado',
    returned: 'devolvido'
};

const PANEL_STATUSES = new Set(['novo', 'atendendo', 'comprar_depois', 'confirmado', 'pedido_enviado', 'entregue', 'recompra', 'cancelado', 'devolvido']);

const normalizePanelStatus = (status = '') => {
    const value = String(status || '').trim().toLowerCase().replace(/-/g, '_');
    const normalized = PANEL_STATUS_ALIASES[value] || value;
    return PANEL_STATUSES.has(normalized) ? normalized : 'novo';
};

const orderStatusFromPanelStatus = (status = '') => ({
    confirmado: 'confirmed',
    pedido_enviado: 'processing',
    entregue: 'delivered',
    recompra: 'delivered',
    cancelado: 'cancelled',
    devolvido: 'returned'
})[normalizePanelStatus(status)] || '';

const scopedContactQuery = ({ country = 'EC', sessionId = '' } = {}) => {
    const { sessionIds } = getPanelSessionScope(sessionId);
    const operationalPhones = operationalPanelPhones();
    const and = [{
        chatId: { $exists: true, $nin: ['', 'status@broadcast'], $not: /@g\.us$/ }
    }];
    if (country && country !== 'all') {
        and.push({
            $or: [
                { countryCode: country },
                { 'metadata.operationalPanelPhone': true },
                ...(operationalPhones.length ? [{ phoneDigits: { $in: operationalPhones } }] : [])
            ]
        });
    }
    if (sessionIds.length) {
        and.push({
            $or: [
                { 'metadata.lastSessionId': { $in: sessionIds } },
                { 'metadata.operationalPanelPhone': true },
                ...(operationalPhones.length ? [{ phoneDigits: { $in: operationalPhones } }] : [])
            ]
        });
    }
    return and.length === 1 ? and[0] : { $and: and };
};

const sendWhatsAppMessage = async (phone, content, options = {}) => {
    const chatId = resolveChatId(phone, options.country);
    if (!chatId) return false;
    const sendMode = options.sendMode === 'manual_panel' ? 'manual_panel' : '';
    const allowAudioDedupeBypass = options.allowAudioDedupeBypass === true;

    if (options.isMedia) {
        if (typeof content !== 'string' || !fs.existsSync(content)) return false;
        const ext = content.split('.').pop()?.toLowerCase() || '';
        const isAudioFile = ['ogg', 'opus', 'mp3', 'wav', 'm4a', 'aac', 'webm'].includes(ext);
        if (isAudioFile) {
            return sendAudio(chatId, content, options.isPtt !== false, {
                sessionId: options.sessionId,
                sendMode,
                allowAudioDedupeBypass
            });
        }

        const mediaType = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)
            ? 'image'
            : ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)
                ? 'video'
                : 'document';

        if (mediaType === 'image') {
            return sendImage(chatId, content, '', { sessionId: options.sessionId, sendMode });
        }
        if (mediaType === 'video') {
            return sendVideo(chatId, content, '', { sessionId: options.sessionId, sendMode });
        }

        const sock = getSock(options.sessionId);
        if (!sock) return false;
        const guard = canSendOutbound({
            jid: chatId,
            text: content,
            sessionId: options.sessionId,
            ownDigits: getOwnPhoneDigits(options.sessionId),
            kind: 'media'
        });
        if (!guard.allowed) {
            console.log(`[LOG_SEND_BLOCKED] media bloqueada -> ${chatId} | reason=${guard.reason}`);
            return false;
        }
        await sock.sendMessage(chatId, { document: { url: content }, fileName: path.basename(content) });
        return true;
    }

    return sendText(chatId, content, options.quotedMsg || null, {
        sessionId: options.sessionId,
        sendMode,
        country: options.country,
        returnDetails: options.returnDetails === true
    });
};

const buildLeadRecoveryTemplates = () => ([
    {
        id: 'social_bonus_1',
        label: 'Prueba social + bono',
        text: 'Hola 😊 Le escribo porque varios clientes que estaban con la misma duda ya recibieron su pedido y hoy estan felices con el resultado. Si quiere, le separo su tratamiento con un bono sorpresa para ayudarle a empezar.'
    },
    {
        id: 'social_bonus_2',
        label: 'Abastecer sistema',
        text: 'Hola 😊 Estoy cerrando el abastecimiento del sistema de hoy y todavia alcanzo a incluirle un bono sorpresa. Si quiere, le envio nuevamente la condicion para que no se quede por fuera.'
    },
    {
        id: 'social_delivery',
        label: 'Prueba social de entrega',
        text: 'Hola 😊 Le comparto que seguimos entregando pedidos normalmente y varios clientes ya retiraron o recibieron su tratamiento sin problema. Si quiere, todavia le aparto el suyo con un bono especial.'
    },
    {
        id: 'social_reactivation',
        label: 'Reactivacion suave',
        text: 'Hola 😊 Paso por aqui porque no quiero que deje esto para despues. Si todavia quiere resolverlo, puedo ayudarle hoy con una condicion especial y un bono sorpresa para facilitar su compra.'
    }
]);

const findOrCreateContactState = async (rawPhoneOrChatId) => {
    const raw = String(rawPhoneOrChatId || '');
    const chatId = raw.includes('@') ? raw : `${raw.replace(/\D/g, '')}@c.us`;
    const digits = raw.replace(/\D/g, '');
    const state = await ContactState.findOne({
        $or: [
            { chatId },
            ...(digits ? [
                { phoneDigits: digits },
                { phoneDigits: { $regex: `${digits}$` } }
            ] : [])
        ]
    });
    if (state) return state;
    return new ContactState({
        chatId,
        phoneDigits: digits,
        countryCode: 'EC'
    });
};

const recordManualOutboundMessage = async ({
    phone,
    body,
    type = 'chat',
    mediaUrl = '',
    user,
    sessionId = '',
    quotedMessage = null,
    deliveryStatus = 'sent',
    sendError = '',
    provider = '',
    providerMessageId = '',
    providerZaapId = '',
    providerStatus = '',
    providerPayload = null
}) => {
    const chatId = resolveChatId(phone);
    const digits = String(phone || '').replace(/\D/g, '');
    if (!chatId) return;

    await Message.create({
        _id: `manual_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        chatId,
        peerPhone: digits,
        from: 'bot',
        to: chatId,
        body,
        type,
        mediaUrl,
        timestamp: Math.floor(Date.now() / 1000),
        isFromMe: true,
        isBot: false,
        sessionId: sessionId || '',
        ownerPhoneDigits: digitsOnly(sessionId),
        notifyName: user?.name || user?.email || '',
        quotedMessageId: quotedMessage?._id || '',
        quotedBody: quotedMessage ? quotedBodyFromRecord(quotedMessage).slice(0, 500) : '',
        quotedFromMe: quotedMessage ? Boolean(quotedMessage.isFromMe) : undefined,
        deliveryStatus,
        sendError: String(sendError || '').slice(0, 240),
        provider,
        providerMessageId,
        providerZaapId,
        providerStatus,
        providerPayload
    }).catch(() => null);
};

const applyManualSendHold = (state, { phone = '', user = null } = {}) => {
    if (isOperationalOrTestPanelContact({ phone, country: state.countryCode, state })) {
        return markPanelContactAsTestOnly(state, {
            phone,
            note: state.human?.note || 'Envio manual para numero interno/teste; nao entra como cliente real.',
            user,
            mode: 'manual'
        });
    }
    state.human = {
        ...(state.human || {}),
        mode: 'manual',
        assignedTo: user?._id?.toString?.() || state.human?.assignedTo || '',
        assignedName: user?.name || user?.email || state.human?.assignedName || '',
        pausedUntil: manualAutoReturnUntil(),
        lastManualAt: new Date(),
        lastManualBy: user?.name || user?.email || 'painel'
    };
    return state;
};

const applyManualCloseCommand = async ({ phone, message, user, sessionId = '' }) => {
    const state = await findOrCreateContactState(phone);
    const tags = Array.isArray(state.tags) ? state.tags : [];
    const draft = state.metadata?.customerDraft || {};
    state.tags = [...new Set([...tags, 'manual:pedido_confirmado', 'manual:resolvido'])];
    state.human = {
        ...(state.human || {}),
        mode: 'manual',
        assignedTo: user?._id?.toString?.() || state.human?.assignedTo || '',
        assignedName: user?.name || user?.email || state.human?.assignedName || 'Atendimento humano',
        pausedUntil: longManualHoldUntil(),
        lastManualAt: new Date(),
        lastManualBy: user?.name || user?.email || 'painel',
        note: 'Venda marcada como fechada pelo operador; automacao pausada para nao retomar o funil.'
    };
    state.metadata = {
        ...(state.metadata || {}),
        customerDraft: {
            ...draft,
            phone: draft.phone || digitsOnly(phone),
            country: draft.country || state.countryCode || 'EC',
            status: 'confirmed'
        },
        lastKnownFunnelStage: 'order_closed',
        automationHoldReason: 'manual_close_command',
        automationHoldAt: new Date(),
        lastManualAction: {
            action: 'pedido_confirmado',
            label: MANUAL_ACTION_TAGS.pedido_confirmado,
            at: new Date(),
            by: user?.name || user?.email || ''
        },
        manualCloseCommand: {
            command: String(message || '').trim(),
            at: new Date(),
            by: user?.name || user?.email || '',
            sessionId
        },
        perAgentMemory: {
            ...((state.metadata || {}).perAgentMemory || {}),
            vit_power_ec: {
                ...(((state.metadata || {}).perAgentMemory || {}).vit_power_ec || {}),
                lastFunnelStage: 'order_closed',
                orderClosedThankYouSentAt: new Date(),
                humanHandoffAt: new Date(),
                humanHandoffReason: 'manual_close_command'
            }
        }
    };
    await state.save();
    syncCustomerDraftFromState(state, { action: 'manual_close_command' });
    await recordManualOutboundMessage({ phone, body: String(message || '').trim(), type: 'system', user, sessionId });
    return state;
};

const applyManualAttendingCommand = async ({ phone, message, user, sessionId = '' }) => {
    const state = await findOrCreateContactState(phone);
    const tags = Array.isArray(state.tags) ? state.tags : [];
    const draft = state.metadata?.customerDraft || {};
    state.tags = [...new Set([...tags, 'manual:atendimento_iniciado', 'manual:humano_no_comando'])];
    state.human = {
        ...(state.human || {}),
        mode: 'manual',
        assignedTo: user?._id?.toString?.() || state.human?.assignedTo || '',
        assignedName: user?.name || user?.email || state.human?.assignedName || 'Atendimento humano',
        assignedAt: new Date(),
        pausedUntil: longManualHoldUntil(),
        lastManualAt: new Date(),
        lastManualBy: user?.name || user?.email || 'painel',
        note: 'Atendimento humano marcado por comando #ATENDENDO; bot nao retoma ate liberar auto.'
    };
    state.metadata = {
        ...(state.metadata || {}),
        customerDraft: {
            ...draft,
            phone: draft.phone || state.phoneDigits || digitsOnly(phone),
            country: draft.country || state.countryCode || 'EC',
            status: statusVisualClosed(draft.status) ? draft.status : 'atendendo',
            updatedAt: new Date().toISOString()
        },
        lastHumanActionAt: new Date(),
        lastHumanAction: 'manual_attending_command',
        manualAttendingCommand: {
            command: String(message || '').trim(),
            at: new Date(),
            by: user?.name || user?.email || '',
            sessionId
        }
    };
    await state.save();
    const unifiedSync = syncCustomerDraftFromState(state, { action: 'manual_attending_command' });
    await recordManualOutboundMessage({ phone, body: String(message || '').trim(), type: 'system', user, sessionId });
    return { state, unifiedSync };
};

// GET /api/whatsapp/status - PUBLIC for QR Code
router.get('/status', (req, res) => {
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    if (sessionId) {
        return res.json(getStatus(sessionId));
    }
    return res.json({
        defaultSessionId: process.env.WHATSAPP_DEFAULT_SESSION_ID || 'default',
        sessions: getAllStatuses()
    });
});

router.get('/vsl-seller-rotation', (req, res) => {
    const country = normalizePanelCountry(req.query.country || 'EC');
    return res.json({ ok: true, ...sellerRotationPreview({ country }) });
});

router.post('/vsl-entry', async (req, res) => {
    try {
        const body = req.body || {};
        const country = normalizePanelCountry(body.country || 'EC');
        const now = new Date();
        const visitorKey = vslVisitorKey({ country, body, req });
        const ipHash = shortHash(requestIp(req));
        const visitorId = cleanText(body.visitorId || body.visitor_id || body.external_id || body.externalId);
        const intent = cleanText(body.intent || body.action).toLowerCase();
        const clicked = body.clicked === false
            ? false
            : (body.clicked === true || ['whatsapp_click', 'whatsapp_open', 'lead_click'].includes(intent) || body.clicked !== false);
        const existing = await VslVisit.findOne({ visitorKey });
        let assignment = null;
        let assignedSeller = digitsOnly(existing?.assignedSeller || '');

        if (!assignedSeller || !sellerIsActive({ seller: assignedSeller, country }) || (body.testEntry && body.forceNewLead)) {
            assignment = await nextSellerForNewLead({ country, source: 'public_lead' });
            assignedSeller = digitsOnly(assignment.seller || '');
        }

        const update = {
            $set: {
                visitorId,
                sessionId: cleanText(body.sessionId || body.session_id),
                country,
                page: cleanText(body.page),
                path: cleanText(body.path),
                sourceUrl: cleanText(body.event_source_url || body.eventSourceUrl || body.sourceUrl),
                referrer: cleanText(body.referrer),
                userAgent: cleanText(body.client_user_agent || body.clientUserAgent || req.get?.('user-agent')),
                ipHash,
                device: cleanText(body.device),
                customerName: cleanText(body.customerName || body.customer_name || body.name).slice(0, 180),
                tracking: {
                    utm_source: cleanText(body.utm_source),
                    utm_medium: cleanText(body.utm_medium),
                    utm_campaign: cleanText(body.utm_campaign),
                    utm_content: cleanText(body.utm_content),
                    utm_term: cleanText(body.utm_term),
                    fbclid: cleanText(body.fbclid),
                    fbc: cleanText(body.fbc),
                    fbp: cleanText(body.fbp),
                    external_id: cleanText(body.external_id || body.externalId)
                },
                assignedSeller,
                assignedSellerAt: existing?.assignedSellerAt || now,
                assignmentReason: assignment?.reason || existing?.assignmentReason || 'existing_assignment',
                lastClickAt: clicked ? now : existing?.lastClickAt,
                lastEntryMessage: clicked ? cleanText(body.message || body.entryMessage || body.funnel_entry_message).slice(0, 500) : existing?.lastEntryMessage || '',
                lastSeenAt: now
            },
            $setOnInsert: {
                visitorKey,
                firstSeenAt: now
            },
            $inc: {
                visits: existing ? 1 : 0,
                clickCount: clicked ? 1 : 0
            }
        };

        const visit = await VslVisit.findOneAndUpdate(
            { visitorKey },
            update,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();

        const pageView = clicked
            ? null
            : await sendVslPageViewForVisit({ visit, body, req, country, visitorKey });
        const lead = clicked
            ? await sendVslLeadForVisit({ visit, body, req, country, visitorKey })
            : null;

        return res.json({
            ok: true,
            assignedSeller,
            seller: assignedSeller,
            reusedAssignment: Boolean(existing?.assignedSeller && !assignment),
            seller_rotation: assignment,
            visitId: visit?._id?.toString?.() || '',
            sequence: assignment?.sequence || sellerRotationPreview({ country }).sequence,
            meta: {
                pageView: pageView ? {
                    ok: Boolean(pageView.ok || pageView.alreadySent),
                    alreadySent: Boolean(pageView.alreadySent),
                    eventId: pageView.eventId || null,
                    error: pageView.ok || pageView.alreadySent ? null : (pageView.error || 'META PageView send failed')
                } : null,
                lead: lead ? {
                    ok: Boolean(lead.ok || lead.alreadySent),
                    alreadySent: Boolean(lead.alreadySent),
                    eventId: lead.eventId || null,
                    error: lead.ok || lead.alreadySent ? null : (lead.error || 'META Lead send failed')
                } : null
            }
        });
    } catch (error) {
        console.error('[VSL_ENTRY] falha ao registrar entrada:', error);
        return res.status(500).json({ ok: false, error: 'vsl_entry_failed' });
    }
});

router.post('/internal/recover-backlog', async (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'local_only' });
    }

    try {
        const since = req.body?.since ? new Date(req.body.since) : new Date(Date.now() - 12 * 60 * 60 * 1000);
        const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.body?.limit || '20'), 10) || 20));
        const delayMs = Math.min(60000, Math.max(0, Number.parseInt(String(req.body?.delayMs || '8000'), 10) || 8000));
        const dryRun = Boolean(req.body?.dryRun);
        const result = await processBacklogRecovery({ since, limit, delayMs, dryRun });
        return res.json({ ...result, since, selected: result.items?.length || 0 });
    } catch (error) {
        console.error('[RECOVERY] falha ao recuperar backlog:', error);
        return res.status(500).json({ error: error.message });
    }
});

router.post('/internal/reconcile-atendimento', async (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'local_only' });
    }

    try {
        const fromId = Math.max(1, Number.parseInt(String(req.body?.fromId || process.env.ADMIN_PANEL_ATENDIMENTO_FROM_ID || '1725'), 10) || 1725);
        const createMissing = req.body?.createMissing !== false;
        const result = await reconcileAdminPanelAtendimento({ fromId, createMissing });
        return res.json(result);
    } catch (error) {
        console.error('[ADMIN_ATENDIMENTO] falha ao reconciliar atendimento:', error);
        return res.status(500).json({ error: error.message });
    }
});

router.post('/internal/admin-status-sync', async (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'local_only' });
    }

    try {
        const body = req.body || {};
        const status = normalizePanelStatus(body.status);
        const oldStatus = normalizePanelStatus(body.old_status);
        const country = normalizePanelCountry(body.country || 'EC');
        const phone = cleanText(body.phone_e164 || body.phone);
        const phoneDigits = normalizeClientPhoneDigits(phone, country);
        if (!phoneDigits || phoneDigits.length < 8) {
            return res.status(400).json({ ok: false, error: 'phone_required' });
        }

        const state = await findOrCreateContactStateForPanel({ phone: phoneDigits, country });
        const draft = state.metadata?.customerDraft || {};
        state.phoneDigits = state.phoneDigits || phoneDigits;
        state.countryCode = country;
        state.metadata = {
            ...(state.metadata || {}),
            customerDraft: {
                ...draft,
                name: cleanText(body.name) || draft.name || '',
                phone: phone.startsWith('+') ? phone : `+${phoneDigits}`,
                country,
                status,
                buyLaterFollowupAt: cleanText(body.buy_later_followup_at || draft.buyLaterFollowupAt || ''),
                updatedAt: new Date().toISOString()
            },
            adminPanelStatus: {
                leadId: body.id || body.lead_id || '',
                oldStatus,
                status,
                country,
                syncedAt: new Date().toISOString()
            }
        };
        await state.save();
        await registerPanelAction({
            state,
            action: 'status_painel_unificado',
            label: 'Status alterado no Painel Unificado',
            detail: `${oldStatus || 'sem_status'} -> ${status}`,
            phone: phoneDigits
        });

        let orderUpdated = false;
        const orderStatus = orderStatusFromPanelStatus(status);
        if (orderStatus) {
            const tails = phoneTailCandidates(phoneDigits);
            const order = await Order.findOne({
                country,
                $or: tails.map((tail) => ({ 'customer.phone': { $regex: `${tail}\\D*$`, $options: 'i' } }))
            }).sort({ entryAt: -1, createdAt: -1 });
            if (order && String(order.status || '').toLowerCase() !== orderStatus) {
                order.status = orderStatus;
                await order.save();
                orderUpdated = true;
            }
        }

        return res.json({ ok: true, status, contactStateId: state._id?.toString?.() || '', orderUpdated });
    } catch (error) {
        console.error('[ADMIN_STATUS_SYNC] falha ao espelhar status:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
});

// Protect all WhatsApp routes (except status)
router.use(authMiddleware);

router.get('/sessions', adminOnly, (req, res) => {
    res.json({
        defaultSessionId: process.env.WHATSAPP_DEFAULT_SESSION_ID || 'default',
        sessions: getAllStatuses()
    });
});

router.get('/connection-workload', adminOnly, async (req, res) => {
    try {
        const country = normalizePanelCountry(req.query.country || 'EC');
        const workload = await buildConnectionWorkload({ country });
        return res.json({ ok: true, ...workload });
    } catch (error) {
        console.error('[CONNECTION_WORKLOAD] falha ao calcular camada operacional:', error);
        return res.status(500).json({ error: error.message });
    }
});

router.get('/sender-pool', adminOnly, (_req, res) => {
    res.json(getSenderPoolStatus());
});

router.get('/dashboard-metrics', async (req, res) => {
    try {
        const country = normalizePanelCountry(req.query.country);
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 6);
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const closedStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];

        const contactQuery = scopedContactQuery({ country, sessionId: req.query.sessionId });
        const orderQuery = { country };
        const [contacts, orders] = await Promise.all([
            ContactState.find(contactQuery, {
                createdAt: 1,
                updatedAt: 1,
                firstInboundAt: 1,
                lastInboundAt: 1,
                lastOutboundAt: 1,
                human: 1,
                chatId: 1,
                phoneDigits: 1,
                metadata: 1
            }).lean(),
            Order.find({
                ...orderQuery,
                $or: [
                    { createdAt: { $gte: startOfMonth } },
                    { updatedAt: { $gte: startOfMonth } },
                    { status: { $in: closedStatuses } }
                ]
            }, { createdAt: 1, updatedAt: 1, status: 1, total: 1 }).lean()
        ]);

        const contactDate = (contact, kind) => {
            if (kind === 'entered') return new Date(contact.firstInboundAt || contact.createdAt || 0);
            return new Date(contact.lastInboundAt || contact.lastOutboundAt || contact.updatedAt || contact.createdAt || 0);
        };
        const inPeriod = (date, start) => date instanceof Date && !Number.isNaN(date.getTime()) && date >= start;
        const contactCounts = (start) => ({
            entered: contacts.filter((contact) => realPhoneFromState(contact) && inPeriod(contactDate(contact, 'entered'), start)).length,
            active: contacts.filter((contact) => realPhoneFromState(contact) && inPeriod(contactDate(contact, 'active'), start)).length
        });
        const orderCounts = (start) => {
            const periodOrders = orders.filter((order) => (
                closedStatuses.includes(String(order.status || '').toLowerCase())
                && inPeriod(new Date(order.updatedAt || order.createdAt || 0), start)
            ));
            return {
                closed: periodOrders.length,
                revenue: periodOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
            };
        };

        res.json({
            country,
            generatedAt: now.toISOString(),
            manualNow: contacts.filter((contact) => realPhoneFromState(contact) && contact.human?.mode === 'manual').length,
            today: { ...contactCounts(startOfDay), ...orderCounts(startOfDay) },
            week: { ...contactCounts(startOfWeek), ...orderCounts(startOfWeek) },
            month: { ...contactCounts(startOfMonth), ...orderCounts(startOfMonth) }
        });
    } catch (error) {
        console.error('Dashboard metrics error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
    }
});

router.post('/chats/action', async (req, res) => {
    try {
        const action = normalizeManualAction(req.body?.action);
        if (!MANUAL_ACTION_TAGS[action]) {
            return res.status(400).json({ error: 'Acao invalida' });
        }
        const chatId = String(req.body?.chatId || '').trim();
        const phone = String(req.body?.phone || '').trim();
        const country = normalizePanelCountry(req.body?.country || 'EC');
        const state = await findOrCreateContactStateForPanel({ chatId, phone, country });
        await registerPanelAction({
            state,
            action,
            label: MANUAL_ACTION_TAGS[action],
            by: req.user?.name || req.user?.email || '',
            chatId,
            phone
        });
        await state.save();
        res.json({
            success: true,
            tags: state.tags,
            action: state.metadata.lastManualAction
        });
    } catch (error) {
        console.error('Chat action tag error:', error);
        res.status(500).json({ error: error.message || 'Failed to update chat action' });
    }
});

router.post('/sessions/:sessionId/start', adminOnly, async (req, res) => {
    try {
        const sessionId = registerWhatsAppSession(req.params.sessionId);
        await startWhatsApp(sessionId);
        res.json({ success: true, session: getStatus(sessionId) });
    } catch (error) {
        console.error('Start WhatsApp session error:', error);
        res.status(500).json({ error: error.message || 'Failed to start session' });
    }
});

router.post('/sessions/:sessionId/disconnect', adminOnly, async (req, res) => {
    try {
        const sessionId = registerWhatsAppSession(req.params.sessionId);
        const logout = String(req.body?.logout ?? 'true').toLowerCase() !== 'false';
        const session = await disconnectWhatsApp(sessionId, { logout });
        res.json({ success: true, session });
    } catch (error) {
        console.error('Disconnect WhatsApp session error:', error);
        res.status(500).json({ error: error.message || 'Failed to disconnect session' });
    }
});

// GET /api/whatsapp/chats
router.get('/chats', async (req, res) => {
    try {
        const onlyLinked = String(req.query.onlyLinked || '').toLowerCase() === 'true' || String(req.query.onlyLinked || '') === '1';
        const allCountries = String(req.query.allCountries || '').toLowerCase() === 'true' || String(req.query.allCountries || '') === '1';
        const fastMode = String(req.query.fast || '').toLowerCase() === 'true' || String(req.query.fast || '') === '1';
        const countryFilter = allCountries ? null : normalizePanelCountry(req.query.country);
        const pictureSock = fastMode ? null : getSock(req.query.sessionId);

        const buildPhoneKeys = ({ digits, country }) => {
            const d = String(digits || '').replace(/\D/g, '');
            const keys = new Set();
            const inferredCountry = inferCountryFromPhoneDigits(d, country);
            const last10 = d.length >= 10 ? d.slice(-10) : '';
            const last9 = d.length >= 9 ? d.slice(-9) : '';
            if (last10) keys.add(last10);
            if (!last10 && last9) keys.add(last9);
            if (inferredCountry === 'EC' && last10) keys.add(`593${last10}`);
            if (inferredCountry === 'CO' && last10) keys.add(`57${last10}`);
            if (d.length >= 10 && d.length <= 15) keys.add(d);
            return Array.from(keys);
        };

        const fuzzyDigitsPattern = (digits) => {
            const d = String(digits || '').replace(/\D/g, '');
            if (!d) return null;
            return d.split('').join('\\D*');
        };

        const usableChatId = (value) => {
            const id = String(value || '');
            if (!id || id === 'bot' || !isValidPanelChatId(id)) return null;
            return id;
        };

        const conversations = new Map();
        const addConversationId = (message, rawId) => {
            const id = usableChatId(rawId);
            if (!id) return;
            const idDigits = digitsOnly(id);
            const rawPeerPhone = digitsOnly(message.peerPhone);
            const peerPhone = id.endsWith('@lid') && rawPeerPhone === idDigits ? '' : rawPeerPhone;
            const key = peerPhone || id;
            if (!conversations.has(key)) {
                conversations.set(key, {
                    key,
                    phone: peerPhone,
                    ids: new Set(),
                    primaryId: id,
                    timestamp: message.timestamp || 0
                });
            }

            const conversation = conversations.get(key);
            conversation.ids.add(id);
            if (peerPhone && !conversation.phone) conversation.phone = peerPhone;
            if ((message.timestamp || 0) >= (conversation.timestamp || 0)) {
                conversation.primaryId = id;
                conversation.timestamp = message.timestamp || 0;
            }
        };

        const recentStateQuery = allCountries
            ? { chatId: { $exists: true, $nin: ['', 'status@broadcast'], $not: /@g\.us$/ } }
            : scopedContactQuery({ country: countryFilter || 'EC', sessionId: req.query.sessionId });
        const recentStates = await ContactState.find(
            recentStateQuery,
            {
                chatId: 1,
                phoneDigits: 1,
                countryCode: 1,
                assignedAgent: 1,
                tags: 1,
                human: 1,
                firstInboundAt: 1,
                createdAt: 1,
                updatedAt: 1,
                metadata: 1
            }
        )
            .sort({ updatedAt: -1 })
            .limit(fastMode ? 180 : 500)
            .lean()
            .catch(() => []);

        recentStates.forEach((state) => {
            const realPhone = realPhoneFromState(state);
            if (!realPhone) return;
            addConversationId({
                peerPhone: realPhone,
                timestamp: state.updatedAt ? Math.floor(new Date(state.updatedAt).getTime() / 1000) : 0
            }, state.chatId);
        });

        const byPrimaryId = new Map();
        for (const [key, conversation] of Array.from(conversations.entries())) {
            const primaryId = conversation.primaryId;
            if (!primaryId) continue;
            const existing = byPrimaryId.get(primaryId);
            if (!existing) {
                byPrimaryId.set(primaryId, { key, conversation });
                continue;
            }

            conversation.ids.forEach((id) => existing.conversation.ids.add(id));
            if (!existing.conversation.phone && conversation.phone) existing.conversation.phone = conversation.phone;
            if ((conversation.timestamp || 0) > (existing.conversation.timestamp || 0)) {
                existing.conversation.timestamp = conversation.timestamp || 0;
            }
            conversations.delete(key);
        }

        for (const [key, conversation] of Array.from(conversations.entries())) {
            if (conversation.phone) continue;
            if (fastMode) {
                conversations.delete(key);
                continue;
            }
            const lidIds = Array.from(conversation.ids).filter((id) => String(id).endsWith('@lid'));
            if (!lidIds.length) continue;

            const stateByLid = await ContactState.findOne({ chatId: { $in: lidIds } }).lean().catch(() => null);
            const messageWithPhone = await Message.findOne({
                $or: lidIds.flatMap((id) => ([{ chatId: id }, { from: id }, { to: id }])),
                peerPhone: { $exists: true, $ne: '' }
            }).sort({ timestamp: -1 }).lean().catch(() => null);
            const resolvedPhone = realPhoneFromState(stateByLid || {}) || digitsOnly(messageWithPhone?.peerPhone);
            if (!resolvedPhone) continue;

            const target = conversations.get(resolvedPhone);
            conversations.delete(key);
            if (target) {
                conversation.ids.forEach((id) => target.ids.add(id));
                if ((conversation.timestamp || 0) > (target.timestamp || 0)) {
                    target.primaryId = conversation.primaryId;
                    target.timestamp = conversation.timestamp || 0;
                }
            } else {
                conversation.key = resolvedPhone;
                conversation.phone = resolvedPhone;
                conversations.set(resolvedPhone, conversation);
            }
        }

        const allChats = Array.from(conversations.values())
            .filter((conversation) => usableChatId(conversation.primaryId) && !String(conversation.primaryId).includes('@g.us') && conversation.phone)
            .map((conversation) => ({
                conversationKey: conversation.key,
                linkedIds: Array.from(conversation.ids),
                phoneHint: conversation.phone,
                id: {
                    _serialized: conversation.primaryId,
                    user: conversation.phone || String(conversation.primaryId).replace(/\D/g, '') || conversation.primaryId
                },
                name: null,
                lastMessage: null,
                isGroup: String(conversation.primaryId).includes('@g.us')
            }));

        if (fastMode) {
            const statesByPhone = new Map();
            const statesByChatId = new Map();
            recentStates.forEach((state) => {
                const phone = realPhoneFromState(state);
                if (phone && !statesByPhone.has(phone)) statesByPhone.set(phone, state);
                if (state.chatId && !statesByChatId.has(state.chatId)) statesByChatId.set(state.chatId, state);
            });

            const recentMessages = await Message.find({
                chatId: { $exists: true, $nin: ['', 'status@broadcast'], $not: /@g\.us$/ }
            }, {
                body: 1,
                timestamp: 1,
                isFromMe: 1,
                type: 1,
                chatId: 1,
                from: 1,
                to: 1,
                peerPhone: 1,
                notifyName: 1
            })
                .sort({ timestamp: -1, createdAt: -1 })
                .limit(700)
                .lean()
                .catch(() => []);

            const lastMessageByKey = new Map();
            recentMessages.forEach((message) => {
                const peerPhone = digitsOnly(message.peerPhone);
                const ids = [message.chatId, message.from, message.to].filter(Boolean);
                for (const chat of allChats) {
                    if (lastMessageByKey.has(chat.conversationKey)) continue;
                    const chatPhone = digitsOnly(chat.phoneHint || chat.id?.user);
                    if ((peerPhone && chatPhone && peerPhone === chatPhone) || ids.some((id) => chat.linkedIds.includes(id))) {
                        lastMessageByKey.set(chat.conversationKey, message);
                    }
                }
            });

            const fastChats = allChats.map((c) => {
                const phoneDigits = digitsOnly(c.phoneHint || c.id.user);
                const contactState = statesByPhone.get(phoneDigits) || statesByChatId.get(c.id._serialized) || null;
                const customerDraft = contactState?.metadata?.customerDraft || {};
                const lastMessage = lastMessageByKey.get(c.conversationKey) || null;
                const entryAt = stableContactEntryAt(contactState) || (lastMessage?.timestamp ? new Date(lastMessage.timestamp * 1000) : null);
                return {
                    id: c.id._serialized,
                    name: customerDraft.name || lastMessage?.notifyName || c.name || c.id.user,
                    phone: customerDraft.phone || c.phoneHint || c.id.user,
                    entryAt,
                    profilePictureUrl: String(contactState?.metadata?.profilePictureUrl || ''),
                    unreadCount: 0,
                    lastMessage: lastMessage ? {
                        body: lastMessage.body,
                        timestamp: lastMessage.timestamp,
                        isFromMe: lastMessage.isFromMe,
                        type: lastMessage.type
                    } : null,
                    isGroup: c.isGroup,
                    country: contactState?.countryCode || null,
                    city: customerDraft.city || null,
                    province: customerDraft.province || null,
                    address: customerDraft.address || null,
                    reference: customerDraft.reference || null,
                    flowDataOk: customerDraft.flowDataOk || {},
                    orderId: null,
                    orderStatus: customerDraft.status || null,
                    quantity: customerDraft.quantity || null,
                    packageLabel: null,
                    total: customerDraft.total ?? null,
                    currency: null,
                    notes: contactState?.human?.note || '',
                    assignedAgent: contactState?.assignedAgent || null,
                    tags: contactState?.tags || [],
                    human: contactState?.human || { mode: 'auto' }
                };
            })
                .filter((c) => !c.isGroup && digitsOnly(c.phone).length >= 9)
                .filter((c) => !countryFilter || isAllowedPanelPhoneForCountry(c.phone, countryFilter))
                .sort((a, b) => stableChatEntryMs(b) - stableChatEntryMs(a));

            res.json(onlyLinked ? [] : fastChats);
            return;
        }

        // Enrich chats with Order data
        const enrichedChats = await Promise.all(allChats.map(async (c) => {
            let phone = c.phoneHint || c.id.user; // default
            const isLid = c.id._serialized.endsWith('@lid');
            const linkedIds = Array.isArray(c.linkedIds) && c.linkedIds.length ? c.linkedIds : [c.id._serialized];
            const linkedConditions = linkedIds.flatMap((id) => ([
                { chatId: id },
                { from: id },
                { to: id }
            ]));
            const lastMessageForChat = await Message.findOne({
                $or: linkedConditions
            }).sort({ timestamp: -1 }).lean().catch(() => null);

            // If it's an LID, use the phone captured by the dispatcher instead of the opaque WhatsApp id.
            if (isLid) {
                const candidates = new Set();
                if (c.phoneHint) candidates.add(c.phoneHint);
                if (lastMessageForChat?.peerPhone) candidates.add(lastMessageForChat.peerPhone);
                const stateByLid = fastMode ? null : await ContactState.findOne({ chatId: { $in: linkedIds } }).lean().catch(() => null);
                if (stateByLid?.phoneDigits) candidates.add(stateByLid.phoneDigits);

                const found = Array.from(candidates)
                    .map((value) => String(value || '').replace(/\D/g, ''))
                    .find((value) => value.length >= 9);

                if (found) {
                    phone = found;
                }
            }

            const phoneDigits = String(phone || '').replace(/\D/g, '');
            const phoneCountryPrefix = countryPrefixFromDigits(phoneDigits);
            const keys = buildPhoneKeys({ digits: phoneDigits, country: countryFilter });

            const baseQuery = {};
            if (countryFilter) baseQuery.country = countryFilter;

            let order = null;
            const canMatchEcuadorOrder = phoneCountryPrefix !== 'BR';
            if (!fastMode && canMatchEcuadorOrder && keys.length) {
                const sortedKeys = [...keys].sort((a, b) => b.length - a.length);
                const orConditions = sortedKeys
                    .map((k) => fuzzyDigitsPattern(k))
                    .filter(Boolean)
                    .map((pattern) => ({ 'customer.phone': { $regex: `${pattern}\\D*$`, $options: 'i' } }));

                if (orConditions.length > 0) {
                    order = await Order.findOne({
                        ...baseQuery,
                        $or: orConditions
                    }).sort({ entryAt: -1, createdAt: -1 });
                }
            }
            if (!fastMode && canMatchEcuadorOrder && !order && keys.length) {
                const sortedKeys = [...keys].sort((a, b) => b.length - a.length);
                const orConditions = sortedKeys
                    .map((k) => fuzzyDigitsPattern(k))
                    .filter(Boolean)
                    .map((pattern) => ({ 'customer.phone': { $regex: pattern, $options: 'i' } }));

                if (orConditions.length > 0) {
                    order = await Order.findOne({
                        ...baseQuery,
                        $or: orConditions
                    }).sort({ entryAt: -1, createdAt: -1 });
                }
            }

            // If we matched an order, force the phone to match the order for consistency
            if (order && order.customer && order.customer.phone) {
                // Format it nicely or just use digits?
                // phone = order.customer.phone; 
            }

            const stateOr = linkedIds.map((id) => ({ chatId: id }));
            if (phoneDigits) {
                stateOr.push({ phoneDigits: phoneDigits });
                stateOr.push({ phoneDigits: { $regex: `${phoneDigits}$` } });
            }
            const contactState = await ContactState.findOne({ $or: stateOr }).sort({ updatedAt: -1 }).lean().catch(() => null);
            const customerDraft = contactState?.metadata?.customerDraft || {};
            const panelLastReadAt = contactState?.metadata?.panelLastReadAt
                ? Math.floor(new Date(contactState.metadata.panelLastReadAt).getTime() / 1000)
                : 0;

            const lastMessage = lastMessageForChat || await Message.findOne({
                $or: [
                    ...linkedConditions,
                    ...(phoneDigits ? [{ peerPhone: phoneDigits }] : [])
                ]
            }).sort({ timestamp: -1 }).lean().catch(() => null);
            const unreadCount = await Message.countDocuments({
                $or: [
                    ...linkedConditions,
                    ...(phoneDigits ? [{ peerPhone: phoneDigits }] : [])
                ],
                isFromMe: false,
                timestamp: { $gt: panelLastReadAt || 0 }
            }).catch(() => 0);
            const profilePictureUrl = fastMode
                ? String(contactState?.metadata?.profilePictureUrl || '')
                : await resolveProfilePictureUrl({
                    sock: pictureSock,
                    contactState,
                    primaryId: c.id._serialized,
                    linkedIds,
                    phoneDigits
                });

            return {
                id: c.id._serialized,
                name: order?.customer?.name || customerDraft.name || c.name || c.id.user,
                phone: order?.customer?.phone || customerDraft.phone || phone, // This is now the real phone number (resolved)
                entryAt: stableOrderEntryAt(order) || stableContactEntryAt(contactState) || (lastMessage?.timestamp ? new Date(lastMessage.timestamp * 1000) : null),
                profilePictureUrl,
                unreadCount,
                lastMessage: lastMessage ? {
                    body: lastMessage.body,
                    timestamp: lastMessage.timestamp,
                    isFromMe: lastMessage.isFromMe,
                    type: lastMessage.type
                } : null,
                isGroup: c.isGroup,
                // Enriched Fields
                country: order ? order.country : contactState?.countryCode || null,
                city: order?.customer?.city || customerDraft.city || null,
                province: order?.customer?.province || customerDraft.province || null,
                address: order?.customer?.address || customerDraft.address || null,
                reference: order?.customer?.reference || customerDraft.reference || null,
                flowDataOk: customerDraft.flowDataOk || {},
                orderId: order ? order.orderId : null,
                orderStatus: order ? order.status : customerDraft.status || null,
                quantity: order?.package?.quantity || customerDraft.quantity || null,
                packageLabel: order?.package?.label || null,
                total: order?.total ?? customerDraft.total ?? null,
                currency: order?.currency || null,
                notes: order?.notes || contactState?.human?.note || '',
                assignedAgent: contactState?.assignedAgent || null,
                tags: contactState?.tags || [],
                human: contactState?.human || { mode: 'auto' }
            };
        }));

        const filtered = (onlyLinked ? enrichedChats.filter((c) => !!c.orderId) : enrichedChats)
            .filter((c) => !c.isGroup && digitsOnly(c.phone).length >= 9)
            .filter((c) => !countryFilter || isAllowedPanelPhoneForCountry(c.phone, countryFilter));

        filtered.sort((a, b) => stableChatEntryMs(b) - stableChatEntryMs(a));

        res.json(filtered);
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
});

// GET /api/whatsapp/messages/:phone
router.get('/messages/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const sync = String(req.query.sync || '').toLowerCase() === 'true' || String(req.query.sync || '') === '1';
        const fastMode = String(req.query.fast || '').toLowerCase() === 'true' || String(req.query.fast || '') === '1';
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit || (fastMode ? '80' : '150'), 10) || 150, 20), 300);
        const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
        const digits = phone.replace(/\D/g, '');
        const isLidChat = chatId.endsWith('@lid');
        const tails = phoneTailCandidates(digits);

        const stateQuery = fastMode && !phone.includes('@') && digits
            ? {
                $or: [
                    { phoneDigits: digits },
                    { chatId: `${digits}@c.us` },
                    { chatId: `${digits}@s.whatsapp.net` }
                ]
            }
            : phone.includes('@')
            ? { chatId }
            : {
                $or: [
                    ...(digits ? [{ phoneDigits: digits }, { chatId: { $regex: digits } }] : []),
                    ...tails.map((tail) => ({ phoneDigits: { $regex: `${tail}$` } })),
                    ...tails.map((tail) => ({ 'metadata.lastSenderPn': { $regex: tail } })),
                    ...tails.map((tail) => ({ 'metadata.customerDraft.phone': { $regex: tail } }))
                ]
            };
        const states = await ContactState.find(stateQuery).sort({ updatedAt: -1 }).limit(20).lean().catch(() => []);
        const linkedChatIds = [...new Set([
            chatId,
            ...states.map((state) => state.chatId).filter(Boolean)
        ].filter(isValidPanelChatId))];

        const lastLinkedMessage = await Message.findOne({
            $or: linkedChatIds.flatMap((id) => ([{ chatId: id }, { from: id }, { to: id }])),
            peerPhone: { $exists: true, $ne: '' }
        }).sort({ timestamp: -1 }).lean().catch(() => null);
        const state = states[0] || null;
        const realDigits = isLidChat
            ? (state?.phoneDigits || lastLinkedMessage?.peerPhone || '')
            : digits;

        const realPhones = [...new Set([
            realDigits,
            digits,
            ...states.map(realPhoneFromState),
            ...states.map((item) => digitsOnly(item.metadata?.customerDraft?.phone)),
            digitsOnly(lastLinkedMessage?.peerPhone)
        ].filter((item) => item && item.length >= 8))];

        const or = linkedChatIds.flatMap((id) => ([
            { chatId: id },
            { from: id },
            { to: id }
        ]));
        realPhones.forEach((item) => or.push({ peerPhone: item }));
        if (!fastMode) {
            phoneTailCandidates(realPhones[0] || digits).forEach((tail) => {
                or.push({ peerPhone: { $regex: `${tail}$` } });
            });
        }

        const messages = (await Message.find({ $or: or })
            .sort({ timestamp: -1, createdAt: -1 })
            .limit(limit)
            .lean())
            .reverse();

        if (sync || messages.length < 5) {
            try {
                // No direct history sync is available on the Baileys runtime today.
            } catch {
                // ignore
            }
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.json(await enrichMessagesWithMedia(messages));
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

router.post('/messages/:phone/deduplicate-bot', async (req, res) => {
    try {
        const { phone } = req.params;
        const dryRun = req.body?.dryRun === true || String(req.query.dryRun || '') === '1';
        const limit = Math.min(Math.max(Number.parseInt(String(req.body?.limit || req.query.limit || '300'), 10) || 300, 20), 600);
        const windowMinutes = Math.min(
            Math.max(Number.parseInt(String(req.body?.windowMinutes || req.query.windowMinutes || '1440'), 10) || 1440, 1),
            30 * 24 * 60
        );
        const { or, states } = await resolveMessageLookupForPhone(phone, { fastMode: true });
        if (!or.length) {
            return res.json({
                success: true,
                dryRun,
                scanned: 0,
                duplicates: 0,
                deleted: 0,
                removed: []
            });
        }

        const messages = (await Message.find({ $or: or })
            .sort({ timestamp: 1, createdAt: 1 })
            .limit(limit)
            .lean());
        const duplicates = duplicateBotMessageIds(messages, { windowMinutes });
        const ids = [...new Set(duplicates.map((item) => item._id).filter(Boolean))];
        let deleted = 0;
        if (!dryRun && ids.length) {
            const result = await Message.deleteMany({
                _id: { $in: ids },
                $or: [
                    { isBot: true },
                    { from: 'bot' }
                ]
            });
            deleted = result.deletedCount || 0;
            const state = states?.[0]?._id
                ? await ContactState.findById(states[0]._id).catch(() => null)
                : null;
            if (state) {
                await registerPanelAction({
                    state,
                    action: 'repetidas_limpas',
                    label: MANUAL_ACTION_TAGS.repetidas_limpas,
                    by: req.user?.name || req.user?.email || '',
                    detail: `${deleted} removida(s)`
                });
                await state.save();
            }
        }

        res.json({
            success: true,
            dryRun,
            scanned: messages.length,
            duplicates: ids.length,
            deleted,
            windowMinutes,
            removed: duplicates.slice(0, 30)
        });
    } catch (error) {
        console.error('Deduplicate bot messages error:', error);
        res.status(500).json({ error: 'Failed to deduplicate bot messages' });
    }
});

router.post('/messages/:phone/delete', async (req, res) => {
    try {
        const { phone } = req.params;
        const messageId = String(req.body?.messageId || '').trim();
        if (!messageId) return res.status(400).json({ error: 'messageId required' });
        const { or, states } = await resolveMessageLookupForPhone(phone, { fastMode: true });
        if (!or.length) return res.status(404).json({ error: 'Conversa nao encontrada' });
        const message = await Message.findOne({ _id: messageId, $or: or }).lean();
        if (!message) return res.status(404).json({ error: 'Mensagem nao encontrada neste atendimento' });
        if (!canDeletePanelMessage(message)) {
            return res.status(403).json({ error: 'Por seguranca, so apago mensagens do bot/atendente/sistema no painel.' });
        }
        const result = await Message.deleteOne({ _id: messageId });
        const state = states?.[0]?._id
            ? await ContactState.findById(states[0]._id).catch(() => null)
            : null;
        if (state) {
            await registerPanelAction({
                state,
                action: 'repetidas_limpas',
                label: 'Mensagem apagada no painel',
                by: req.user?.name || req.user?.email || '',
                detail: String(message.body || message.type || '').slice(0, 120)
            });
            await state.save();
        }
        res.json({ success: true, deleted: result.deletedCount || 0 });
    } catch (error) {
        console.error('Delete panel message error:', error);
        res.status(500).json({ error: 'Failed to delete panel message' });
    }
});

router.post('/chats/read', async (req, res) => {
    try {
        const { chatId = '', phone = '' } = req.body || {};
        const rawChatId = String(chatId || '');
        const digits = digitsOnly(phone || chatId);
        const query = {
            $or: [
                ...(rawChatId ? [{ chatId: rawChatId }] : []),
                ...(digits ? [
                    { phoneDigits: digits },
                    { phoneDigits: { $regex: `${digits}$` } },
                    { 'metadata.lastSenderPn': { $regex: digits } }
                ] : [])
            ]
        };
        if (!query.$or.length) {
            return res.status(400).json({ error: 'Chat ou telefone obrigatorio' });
        }

        const result = await ContactState.updateMany(query, {
            $set: {
                'metadata.panelLastReadAt': new Date()
            }
        });
        res.json({ success: true, matched: result.matchedCount || 0, modified: result.modifiedCount || 0 });
    } catch (error) {
        console.error('Mark chat read error:', error);
        res.status(500).json({ error: 'Failed to mark chat as read' });
    }
});

router.get('/customer-profile/:phone', async (req, res) => {
    try {
        const raw = String(req.params.phone || '');
        const digits = digitsOnly(raw);
        const tails = phoneTailCandidates(digits);
        const stateQuery = raw.includes('@')
            ? { chatId: raw }
            : {
                $or: [
                    ...(digits ? [{ phoneDigits: digits }, { chatId: { $regex: digits } }] : []),
                    ...tails.map((tail) => ({ phoneDigits: { $regex: `${tail}$` } })),
                    ...tails.map((tail) => ({ 'metadata.lastSenderPn': { $regex: tail } }))
                ]
            };

        const states = await ContactState.find(stateQuery).sort({ updatedAt: -1 }).limit(20).lean();
        const realPhones = [...new Set([
            digits,
            ...states.map(realPhoneFromState),
            ...states.map((state) => digitsOnly(state.metadata?.customerDraft?.phone))
        ].filter((item) => item && item.length >= 8))];
        const chatIds = [...new Set(states.map((state) => state.chatId).filter(Boolean))];
        const messageOr = [
            ...chatIds.flatMap((chatId) => ([{ chatId }, { from: chatId }, { to: chatId }])),
            ...realPhones.map((phone) => ({ peerPhone: phone })),
            ...phoneTailCandidates(realPhones[0] || digits).map((tail) => ({ peerPhone: { $regex: `${tail}$` } }))
        ];

        const messages = messageOr.length
            ? await Message.find({ $or: messageOr }).sort({ timestamp: -1 }).limit(80).lean()
            : [];
        const allOwnerPhones = [...new Set(messages.map((message) => digitsOnly(message.ownerPhoneDigits || message.sessionId)).filter(Boolean))];
        const inboundCount = messages.filter((message) => !message.isFromMe).length;
        const outboundCount = messages.filter((message) => message.isFromMe).length;
        const lastInbound = messages.find((message) => !message.isFromMe) || null;
        const lastOutbound = messages.find((message) => message.isFromMe) || null;
        const latestState = states[0] || null;
        const customerDraft = latestState?.metadata?.customerDraft || {};
        const primaryPhone = realPhones.find((phone) => phone.startsWith('55') || phone.startsWith('593') || phone.startsWith('57')) || realPhones[0] || digits || '';

        const canMatchOrders = countryPrefixFromDigits(primaryPhone) !== 'BR';
        const orderTails = canMatchOrders ? [...new Set(realPhones.flatMap(phoneTailCandidates))] : [];
        const orderOr = orderTails.map((tail) => ({ 'customer.phone': { $regex: tail } }));
        const orders = orderOr.length
            ? await Order.find({ $or: orderOr }).sort({ updatedAt: -1, createdAt: -1 }).limit(10).lean()
            : [];
        const activeOrder = orders.find((order) => !['delivered', 'cancelled', 'returned'].includes(String(order.status || '').toLowerCase())) || orders[0] || null;
        const allChannels = [...new Set([
            ...chatIds,
            ...realPhones,
            ...allOwnerPhones.map((phone) => `atendido por ${phone}`)
        ].filter(Boolean))];

        const events = [
            ...messages.slice(0, 12).map((message) => ({
                at: message.timestamp ? new Date(message.timestamp * 1000) : message.createdAt,
                type: message.isFromMe ? 'saida' : 'entrada',
                label: message.isFromMe
                    ? `Mensagem enviada${message.ownerPhoneDigits ? ` por ${message.ownerPhoneDigits}` : ''}`
                    : 'Mensagem recebida',
                detail: String(message.body || message.type || '').slice(0, 120)
            })),
            ...orders.slice(0, 5).map((order) => ({
                at: order.updatedAt || order.createdAt,
                type: 'pedido',
                label: `${order.orderId || 'Pedido'} · ${order.status || 'sem status'}`,
                detail: [
                    order.customer?.name,
                    order.package?.quantity ? `${order.package.quantity} frasco(s)` : '',
                    order.total ? `${order.total} ${order.currency || 'USD'}` : ''
                ].filter(Boolean).join(' · ')
            }))
        ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()).slice(0, 12);

        res.json({
            primaryPhone,
            displayName: activeOrder?.customer?.name || customerDraft.name || latestState?.metadata?.profileName || primaryPhone || raw,
            countryCode: latestState?.countryCode || countryPrefixFromDigits(primaryPhone) || activeOrder?.country || '',
            channels: allChannels,
            stats: {
                inboundCount,
                outboundCount,
                orderCount: orders.length,
                lastInboundAt: lastInbound?.timestamp ? new Date(lastInbound.timestamp * 1000) : null,
                lastOutboundAt: lastOutbound?.timestamp ? new Date(lastOutbound.timestamp * 1000) : null
            },
            activeOrder: activeOrder ? {
                orderId: activeOrder.orderId,
                status: activeOrder.status,
                quantity: activeOrder.package?.quantity || null,
                total: activeOrder.total ?? null,
                currency: activeOrder.currency || 'USD',
                dropiOrderId: activeOrder.dropiOrderId || '',
                shippingStatus: activeOrder.shippingStatus || '',
                customer: activeOrder.customer || {}
            } : null,
            continuity: {
                canContinueAcrossNumbers: true,
                lastSessionId: latestState?.metadata?.lastSessionId || '',
                currentOwnerPhoneDigits: latestState?.metadata?.senderWallet?.assignedSessionId || '',
                failoverFromSessionId: latestState?.metadata?.senderWallet?.failoverFromSessionId || '',
                lastFailoverAt: latestState?.metadata?.senderWallet?.lastFailoverAt || null,
                walletHistory: Array.isArray(latestState?.metadata?.senderWallet?.history)
                    ? latestState.metadata.senderWallet.history
                    : [],
                sessionHistory: Array.isArray(latestState?.metadata?.sessionContinuity?.history)
                    ? latestState.metadata.sessionContinuity.history
                    : []
            },
            events
        });
    } catch (error) {
        console.error('Customer profile error:', error);
        res.status(500).json({ error: 'Failed to fetch customer profile' });
    }
});

router.get('/contact-state/:phone', async (req, res) => {
    try {
        const raw = String(req.params.phone || '');
        const digits = raw.replace(/\D/g, '');

        const query = raw.includes('@')
            ? { chatId: raw }
            : {
                $or: [
                    { phoneDigits: digits },
                    { phoneDigits: { $regex: `${digits}$` } },
                    { chatId: { $regex: digits } }
                ]
            };

        const state = await ContactState.findOne(query).sort({ updatedAt: -1 }).lean();
        if (!state) {
            return res.status(404).json({ error: 'Contact state not found' });
        }

        res.json(state);
    } catch (error) {
        console.error('Get contact state error:', error);
        res.status(500).json({ error: 'Failed to fetch contact state' });
    }
});

router.post('/contacts', async (req, res) => {
    try {
        const {
            name = '',
            phone = '',
            note = '',
            country = 'EC',
            mode = 'manual'
        } = req.body || {};
        const digits = digitsOnly(phone);
        if (digits.length < 8) {
            return res.status(400).json({ error: 'Telefone invalido' });
        }
        const matchedBrazilTestPhone = matchBrazilPanelTestPhone(digits);
        const effectiveCountry = digits.startsWith('55') || matchedBrazilTestPhone
            ? 'BR'
            : (String(country || 'EC').toUpperCase() || 'EC');
        const internalOrTest = digits.startsWith('55') || matchedBrazilTestPhone
            ? isBrazilTestOnly({ phone: digits, country: effectiveCountry })
            : isOperationalPanelPhone(digits);
        const normalizedDigits = matchedBrazilTestPhone || (internalOrTest ? digits : normalizeClientPhoneDigits(digits, effectiveCountry));
        if (!internalOrTest && !isAllowedPanelPhoneForCountry(normalizedDigits, effectiveCountry)) {
            return res.status(400).json({ error: 'Cliente precisa ser EC +593 ou CO +57. Para teste BR, use somente os numeros liberados com DDD 15 ou 31.' });
        }

        const state = await findOrCreateContactState(normalizedDigits);
        const alreadyExisted = !state.isNew;
        state.phoneDigits = normalizedDigits;
        state.countryCode = internalOrTest ? 'BR' : effectiveCountry;
        if (internalOrTest) {
            markPanelContactAsTestOnly(state, {
                phone: normalizedDigits,
                note: note || 'Contato criado no painel como teste/interno; nao entra como cliente real.',
                user: req.user,
                mode
            });
            await state.save();
            return res.json({
                success: true,
                state,
                duplicate: alreadyExisted,
                unifiedSync: { ok: false, skipped: true, reason: 'operator_or_test_contact' },
                message: alreadyExisted
                    ? 'Cliente ja cadastrado como teste/interno; nao duplicou no painel unificado.'
                    : 'Numero de atendente/teste adicionado sem criar cliente real.'
            });
        }
        state.human = {
            ...(state.human || {}),
            mode: mode === 'auto' ? 'auto' : 'manual',
            assignedTo: req.user?._id?.toString?.() || state.human?.assignedTo || '',
            assignedName: req.user?.name || req.user?.email || state.human?.assignedName || 'Atendimento',
            assignedAt: new Date(),
            pausedUntil: mode === 'auto' ? null : manualAutoReturnUntil(),
            lastManualAt: new Date(),
            lastManualBy: req.user?.name || req.user?.email || 'painel',
            note: String(note || state.human?.note || '').trim()
        };
        state.metadata = {
            ...(state.metadata || {}),
            manuallyCreatedAt: new Date().toISOString(),
            manuallyCreatedBy: req.user?.name || req.user?.email || 'painel',
            customerDraft: {
                ...(state.metadata?.customerDraft || {}),
                name: String(name || '').trim(),
                country: effectiveCountry,
                phone: normalizedDigits ? `+${normalizedDigits}` : String(phone || '').trim(),
                updatedAt: new Date().toISOString()
            }
        };
        await state.save();
        const unifiedSync = syncCustomerDraftFromState(state, { action: 'contact_created_from_whatsapp_panel' });
        res.json({
            success: true,
            state,
            duplicate: alreadyExisted || unifiedSync?.mode === 'updated',
            unifiedSync,
            message: alreadyExisted || unifiedSync?.mode === 'updated'
                ? 'Cliente ja cadastrado; ficha atualizada sem duplicar.'
                : 'Cliente novo adicionado.'
        });
    } catch (error) {
        console.error('Create WhatsApp contact error:', error);
        res.status(500).json({ error: 'Failed to create contact' });
    }
});

router.post('/contact-state/:phone/claim', async (req, res) => {
    try {
        const state = await findOrCreateContactState(req.params.phone);
        const minutes = Math.max(1, Number.parseInt(String(req.body?.minutes || manualAutoReturnMinutes()), 10) || manualAutoReturnMinutes());
        const claimPhone = state.phoneDigits || digitsOnly(req.params.phone);
        const internalOrTest = isOperationalOrTestPanelContact({
            phone: claimPhone,
            country: state.countryCode,
            state
        });
        if (internalOrTest) {
            markPanelContactAsTestOnly(state, {
                phone: claimPhone,
                note: state.human?.note || 'Atendente/teste assumido no painel; nao entra como cliente real.',
                user: req.user,
                mode: 'manual'
            });
            await state.save();
            return res.json({
                success: true,
                state,
                unifiedSync: { ok: false, skipped: true, reason: 'operator_or_test_contact' },
                message: 'Numero interno/teste assumido sem criar cliente real.'
            });
        }
        state.human = {
            ...(state.human || {}),
            mode: 'manual',
            assignedTo: req.user._id.toString(),
            assignedName: req.user.name || req.user.email,
            assignedAt: new Date(),
            pausedUntil: manualAutoReturnUntil(minutes),
            lastManualAt: new Date(),
            lastManualBy: req.user.name || req.user.email,
            note: req.body?.note || state.human?.note || ''
        };
        state.metadata = {
            ...(state.metadata || {}),
            lastHumanActionAt: new Date(),
            lastHumanAction: 'claim',
            customerDraft: {
                ...(state.metadata?.customerDraft || {}),
                phone: state.metadata?.customerDraft?.phone || state.phoneDigits || digitsOnly(req.params.phone),
                country: state.metadata?.customerDraft?.country || state.countryCode || 'EC',
                status: statusVisualClosed(state.metadata?.customerDraft?.status) ? state.metadata.customerDraft.status : 'atendendo',
                updatedAt: new Date().toISOString()
            }
        };
        const tags = Array.isArray(state.tags) ? state.tags : [];
        if (!tags.some((tag) => String(tag || '').startsWith('manual:'))) {
            state.tags = [...new Set([...tags, 'manual:atendimento_iniciado'])];
        }
        await registerPanelAction({
            state,
            action: 'humano_no_comando',
            label: MANUAL_ACTION_TAGS.humano_no_comando,
            by: req.user?.name || req.user?.email || '',
            detail: `pausa por ${minutes} minutos`,
            phone: claimPhone
        });
        await state.save();
        const unifiedSync = syncCustomerDraftFromState(state, { action: 'whatsapp_claim_atendendo' });
        res.json({ success: true, state, unifiedSync });
    } catch (error) {
        console.error('Claim contact error:', error);
        res.status(500).json({ error: 'Failed to claim contact' });
    }
});

router.post('/contact-state/:phone/release', async (req, res) => {
    try {
        const state = await findOrCreateContactState(req.params.phone);
        state.human = {
            ...(state.human || {}),
            mode: 'auto',
            pausedUntil: null,
            lastManualAt: new Date(),
            lastManualBy: req.user.name || req.user.email
        };
        state.metadata = {
            ...(state.metadata || {}),
            lastHumanActionAt: new Date(),
            lastHumanAction: 'release'
        };
        await registerPanelAction({
            state,
            action: 'bot_liberado',
            label: MANUAL_ACTION_TAGS.bot_liberado,
            by: req.user?.name || req.user?.email || '',
            detail: 'automacao retomada'
        });
        await state.save();
        res.json({ success: true, state });
    } catch (error) {
        console.error('Release contact error:', error);
        res.status(500).json({ error: 'Failed to release contact' });
    }
});

router.patch('/contact-state/:phone', async (req, res) => {
    try {
        const state = await findOrCreateContactState(req.params.phone);
        const { note, mode, assignedName, country, customerDraft } = req.body || {};
        state.human = {
            ...(state.human || {}),
            ...(mode === 'auto' || mode === 'manual' ? { mode } : {}),
            ...(mode === 'manual' ? { pausedUntil: manualAutoReturnUntil() } : {}),
            ...(mode === 'auto' ? { pausedUntil: null } : {}),
            ...(typeof note === 'string' ? { note } : {}),
            ...(typeof assignedName === 'string' ? { assignedName } : {}),
            lastManualAt: new Date(),
            lastManualBy: req.user.name || req.user.email
        };
        if (customerDraft && typeof customerDraft === 'object') {
            const draftPhoneDigits = String(customerDraft.phone || '').replace(/\D/g, '');
            const matchedBrazilTestPhone = matchBrazilPanelTestPhone(draftPhoneDigits || state.phoneDigits || req.params.phone);
            const effectiveCountry = draftPhoneDigits.startsWith('55') || matchedBrazilTestPhone
                ? 'BR'
                : (String(customerDraft.country || country || state.countryCode || 'EC').toUpperCase() || 'EC');
            const internalOrTest = draftPhoneDigits.startsWith('55') || matchedBrazilTestPhone || effectiveCountry === 'BR'
                ? isBrazilTestOnly({ phone: draftPhoneDigits || state.phoneDigits || req.params.phone, country: effectiveCountry })
                : isOperationalOrTestPanelContact({
                    phone: draftPhoneDigits || state.phoneDigits || req.params.phone,
                    country: effectiveCountry,
                    state
                });
            const normalizedDraftPhoneDigits = internalOrTest
                ? (matchedBrazilTestPhone || draftPhoneDigits || digitsOnly(req.params.phone))
                : normalizeClientPhoneDigits(draftPhoneDigits, effectiveCountry);
            if (!internalOrTest && normalizedDraftPhoneDigits && !isAllowedPanelPhoneForCountry(normalizedDraftPhoneDigits, effectiveCountry)) {
                return res.status(400).json({ error: 'Cliente precisa ser EC +593 ou CO +57. Para teste BR, use somente os numeros liberados com DDD 15 ou 31.' });
            }
            const cleanDraft = {
                name: String(customerDraft.name || '').trim(),
                phone: normalizedDraftPhoneDigits && !internalOrTest
                    ? `+${normalizedDraftPhoneDigits}`
                    : String(customerDraft.phone || '').trim(),
                city: String(customerDraft.city || '').trim(),
                province: String(customerDraft.province || '').trim(),
                address: String(customerDraft.address || '').trim(),
                reference: String(customerDraft.reference || '').trim(),
                status: normalizePanelStatus(customerDraft.status),
                quantity: String(customerDraft.quantity || '').trim(),
                total: String(customerDraft.total || '').trim(),
                country: internalOrTest ? 'BR' : effectiveCountry,
                updatedAt: new Date().toISOString()
            };
            const flowDataOk = {
                ...(String(cleanDraft.name || '').trim() ? { nome_completo: { ok: true, value: cleanDraft.name, label: 'Nome OK' } } : {}),
                ...(String(cleanDraft.city || '').trim() ? { ciudad: { ok: true, value: cleanDraft.city, label: 'Cidade OK' } } : {}),
                ...(String(cleanDraft.address || '').trim() ? { agencia: { ok: true, value: cleanDraft.address, label: 'Agencia OK' } } : {}),
                ...(String(cleanDraft.province || '').trim() ? { provincia: { ok: true, value: cleanDraft.province, label: 'Provincia OK' } } : {}),
                ...(String(cleanDraft.quantity || '').trim() ? { quantidade: { ok: true, value: cleanDraft.quantity, label: 'Quantidade OK' } } : {}),
                ...(String(cleanDraft.status || '').trim() ? { venda_finalizada: { ok: ['confirmado', 'confirmed', 'pedido_enviado', 'entregue', 'recompra', 'finalizado'].includes(normalizePanelStatus(cleanDraft.status)), value: cleanDraft.status, label: 'Venda finalizada' } } : {})
            };
            cleanDraft.flowDataOk = flowDataOk;
            if (normalizedDraftPhoneDigits.length >= 9) {
                state.phoneDigits = normalizedDraftPhoneDigits;
            }
            state.countryCode = cleanDraft.country;
            const agentKey = state.assignedAgent || 'vit_power_ec';
            const agentMemory = ((state.metadata || {}).perAgentMemory || {})[agentKey] || {};
            const pendingOrder = agentMemory.pendingCheckoutOrder || null;
            if (pendingOrder && typeof pendingOrder === 'object') {
                const previousCity = String(pendingOrder.city || '').trim();
                const previousProvince = String(pendingOrder.province || '').trim();
                const correctedCity = cleanDraft.city || previousCity;
                const correctedProvince = cleanDraft.province || previousProvince;
                const locationChanged = Boolean(
                    (cleanDraft.city && cleanDraft.city !== previousCity)
                    || (cleanDraft.province && cleanDraft.province !== previousProvince)
                );
                const agencyAddress = cleanDraft.address || pendingOrder.agencyAddress || pendingOrder.address || '';
                const looksLikeAgency = /servientrega|agencia|oficina|retiro/i.test(agencyAddress);
                const mergedPendingOrder = {
                    ...pendingOrder,
                    ...(cleanDraft.name ? { name: cleanDraft.name } : {}),
                    ...(correctedCity ? { city: correctedCity } : {}),
                    ...(correctedProvince ? { province: correctedProvince } : {}),
                    ...(cleanDraft.address ? { address: cleanDraft.address } : {}),
                    ...(cleanDraft.reference ? { reference: cleanDraft.reference } : {}),
                    ...(cleanDraft.quantity ? { quantity: Number(cleanDraft.quantity) || cleanDraft.quantity } : {}),
                    ...(cleanDraft.total ? { total: Number(cleanDraft.total) || cleanDraft.total } : {}),
                    ...(looksLikeAgency ? {
                        deliveryMode: 'agency',
                        deliveryType: 'SERVIENTREGA',
                        agencyAddress,
                        agencyName: pendingOrder.agencyName || cleanDraft.address,
                        agency: pendingOrder.agency || cleanDraft.address
                    } : {})
                };
                if (locationChanged) {
                    mergedPendingOrder.agencyOptions = [];
                    mergedPendingOrder.agencyOptionsPage = 0;
                    mergedPendingOrder.agencyValidated = false;
                    mergedPendingOrder.hasCorrection = true;
                    mergedPendingOrder.correctionSource = 'panel_customer_draft';
                }
                state.metadata = {
                    ...(state.metadata || {}),
                    customerDraft: cleanDraft,
                    perAgentMemory: {
                        ...((state.metadata || {}).perAgentMemory || {}),
                        [agentKey]: {
                            ...agentMemory,
                            pendingCheckoutOrder: mergedPendingOrder,
                            lastPanelResumeDraftAt: new Date()
                        }
                    }
                };
            } else {
                state.metadata = {
                    ...(state.metadata || {}),
                    customerDraft: cleanDraft
                };
            }
            if (internalOrTest) {
                markPanelContactAsTestOnly(state, {
                    phone: normalizedDraftPhoneDigits,
                    note: note || state.human?.note || 'Ficha salva como teste/interno; nao entra como cliente real.',
                    user: req.user,
                    mode: state.human?.mode || 'manual'
                });
            }
        }
        await state.save();
        const unifiedSync = customerDraft && typeof customerDraft === 'object'
            ? syncCustomerDraftFromState(state, { action: 'contact_saved_from_whatsapp_panel' })
            : { ok: false, skipped: true, reason: 'no_customer_draft' };
        res.json({ success: true, state, unifiedSync });
    } catch (error) {
        console.error('Update contact state error:', error);
        res.status(500).json({ error: 'Failed to update contact state' });
    }
});

// GET /api/whatsapp/templates
router.get('/templates', async (req, res) => {
    try {
        const country = normalizePanelCountry(req.query.country);
        const templates = await listAudioTemplates(country);
        res.json({ templates });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

router.get('/reengagement/preview', adminOnly, async (req, res) => {
    try {
        const hours = Number.parseInt(String(req.query.hours || '48'), 10);
        const limit = Number.parseInt(String(req.query.limit || '50'), 10);
        const candidates = await listReengagementCandidates({ hours, limit });
        res.json({ candidates });
    } catch (error) {
        console.error('Reengagement preview error:', error);
        res.status(500).json({ error: 'Failed to build reengagement preview' });
    }
});

router.post('/reengagement/send', adminOnly, async (req, res) => {
    try {
        const { chatId, phone = '', text, sessionId = null } = req.body || {};
        if (!chatId || !text) {
            return res.status(400).json({ error: 'chatId and text are required' });
        }

        const result = await sendReengagementToChat({ chatId, phone, text, sessionId });
        res.json(result);
    } catch (error) {
        console.error('Reengagement send error:', error);
        res.status(500).json({ error: error.message || 'Failed to send reengagement' });
    }
});

router.get('/reengagement/templates', adminOnly, async (_req, res) => {
    res.json({ templates: buildLeadRecoveryTemplates() });
});

// POST /api/whatsapp/send
router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { phone, message, isMedia, sessionId, fileName = '', quotedMessageId = '', country = '' } = req.body;
        const sendMode = req.body?.sendMode === 'manual_panel' ? 'manual_panel' : '';
        const allowAudioDedupeBypass = req.body?.allowAudioDedupeBypass === true;
        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone and message required' });
        }

        if (!isMedia && isManualCloseCommand(message)) {
            const state = await applyManualCloseCommand({
                phone,
                message,
                user: req.user,
                sessionId
            });
            return res.json({
                success: true,
                handled: 'manual_close_command',
                sent: false,
                message: 'Venda marcada como fechada e automacao pausada para este cliente.',
                state
            });
        }

        if (!isMedia && isManualAttendingCommand(message)) {
            const { state, unifiedSync } = await applyManualAttendingCommand({
                phone,
                message,
                user: req.user,
                sessionId
            });
            return res.json({
                success: true,
                handled: 'manual_attending_command',
                sent: false,
                message: 'Atendimento humano marcado. Bot pausado ate liberar auto.',
                state,
                unifiedSync
            });
        }

        if (isMedia) {
            if (typeof message !== 'string') {
                return res.status(400).json({ error: 'For media, message must be a string' });
            }

            if (message.startsWith('data:')) {
                const match = message.match(/^data:([^;]+);base64,(.+)$/);
                if (!match) {
                    return res.status(400).json({ error: 'Invalid data URL (expected base64)' });
                }

                const rawMime = match[1];
                const originalFileName = String(fileName || '').trim();
                const extFromName = path.extname(originalFileName).slice(1).toLowerCase();
                const mimeFromExt = (ext) => {
                    const map = {
                        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                        webp: 'image/webp', gif: 'image/gif', heic: 'image/heic',
                        heif: 'image/heif', mp3: 'audio/mpeg', mpeg: 'audio/mpeg',
                        ogg: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4',
                        aac: 'audio/aac', wav: 'audio/wav', webm: 'video/webm',
                        mp4: 'video/mp4', mov: 'video/quicktime'
                    };
                    return map[ext] || '';
                };
                const mime = rawMime === 'application/octet-stream' || rawMime === 'application/bin'
                    ? (mimeFromExt(extFromName) || rawMime)
                    : rawMime;
                const b64 = match[2];
                const buf = Buffer.from(b64, 'base64');
                if (!buf?.length) {
                    return res.status(400).json({ error: 'Empty media payload' });
                }

                const uploadsDir = path.join(process.cwd(), 'public', 'media', 'uploads');
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

                const extFromMime = (m, fallbackName = '') => {
                    const map = {
                        'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
                        'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
                        'image/heif': 'heif', 'audio/mpeg': 'mp3',
                        'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
                        'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/x-m4a': 'm4a',
                        'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
                        'video/x-msvideo': 'avi', 'video/x-matroska': 'mkv'
                    };
                    const ext = path.extname(String(fallbackName || '')).slice(1).toLowerCase();
                    return map[m] || ext || (m.split('/')[1] || 'bin').split(';')[0];
                };

                const ext = extFromMime(mime, originalFileName);
                const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
                const filePath = path.join(uploadsDir, filename);
                fs.writeFileSync(filePath, buf);

                const mediaKind = mime.startsWith('audio/')
                    ? 'audio'
                    : mime.startsWith('image/')
                        ? 'image'
                        : mime.startsWith('video/')
                            ? 'video'
                            : 'media';
                const sent = await sendWhatsAppMessage(phone, filePath, {
                    isMedia: true,
                    sessionId,
                    isPtt: mediaKind !== 'audio',
                    sendMode,
                    allowAudioDedupeBypass,
                    country
                });
                const state = await findOrCreateContactState(phone);
                applyManualSendHold(state, { phone, user: req.user });
                await state.save();
                await recordManualOutboundMessage({
                    phone,
                    body: '',
                    type: mediaKind,
                    mediaUrl: `/media/uploads/${filename}`,
                    user: req.user,
                    sessionId,
                    deliveryStatus: sent ? 'sent' : 'unconfirmed',
                    sendError: sent ? '' : 'WhatsApp nao retornou confirmacao da midia; conferir no aparelho.'
                });
                return res.json({
                    success: sent,
                    storedMediaUrl: `/media/uploads/${filename}`,
                    deliveryStatus: sent ? 'sent' : 'unconfirmed'
                });
            }

            if (!message.startsWith('/media/')) {
                return res.status(400).json({ error: 'For media, message must be a /media/... path or a data:... base64 URL' });
            }

            const baseDir = path.join(process.cwd(), 'public', 'media');
            const relative = message.replace(/^\/media\//, '');
            const resolved = path.normalize(path.join(baseDir, relative));
            if (!resolved.startsWith(baseDir)) {
                return res.status(400).json({ error: 'Invalid media path' });
            }
            const ext = path.extname(resolved).slice(1).toLowerCase();
            const mediaKind = ['ogg', 'opus', 'mp3', 'wav', 'm4a', 'aac', 'webm'].includes(ext)
                ? 'audio'
                : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)
                    ? 'image'
                    : ['mp4', 'mov', 'avi', 'mkv'].includes(ext)
                        ? 'video'
                        : 'media';
            const sent = await sendWhatsAppMessage(phone, resolved, { isMedia: true, sessionId, sendMode, allowAudioDedupeBypass, country });
            const state = await findOrCreateContactState(phone);
            applyManualSendHold(state, { phone, user: req.user });
            await state.save();
            await recordManualOutboundMessage({
                phone,
                body: '',
                type: mediaKind,
                mediaUrl: message,
                user: req.user,
                sessionId,
                deliveryStatus: sent ? 'sent' : 'unconfirmed',
                sendError: sent ? '' : 'WhatsApp nao retornou confirmacao da midia; conferir no aparelho.'
            });
            return res.json({ success: sent, deliveryStatus: sent ? 'sent' : 'unconfirmed' });
        }

        const quotedMessage = quotedMessageId
            ? await Message.findById(String(quotedMessageId)).lean().catch(() => null)
            : null;
        const quotedMsg = buildQuotedMessageFromRecord(quotedMessage);
        const sendResult = await sendWhatsAppMessage(phone, message, {
            sessionId,
            quotedMsg,
            sendMode,
            allowAudioDedupeBypass,
            country,
            returnDetails: true
        });
        const sent = typeof sendResult === 'object' ? sendResult.ok !== false : Boolean(sendResult);
        if (sent) {
            const state = await findOrCreateContactState(phone);
            applyManualSendHold(state, { phone, user: req.user });
            await state.save();
            await recordManualOutboundMessage({
                phone,
                body: message,
                type: 'chat',
                user: req.user,
                sessionId,
                quotedMessage,
                deliveryStatus: sendResult?.provider === 'zapi' ? 'pending_confirmation' : 'sent',
                provider: sendResult?.provider || '',
                providerMessageId: sendResult?.providerMessageId || '',
                providerZaapId: sendResult?.providerZaapId || '',
                providerStatus: sendResult?.providerStatus || '',
                providerPayload: sendResult?.providerPayload || null
            });
        } else {
            await recordManualOutboundMessage({
                phone,
                body: message,
                type: 'chat',
                user: req.user,
                sessionId,
                quotedMessage,
                deliveryStatus: 'failed',
                sendError: sendResult?.error || 'WhatsApp nao confirmou o envio. Verifique a conexao do celular.',
                provider: sendResult?.provider || '',
                providerMessageId: sendResult?.providerMessageId || '',
                providerZaapId: sendResult?.providerZaapId || '',
                providerStatus: sendResult?.providerStatus || '',
                providerPayload: sendResult?.providerPayload || null
            });
        }
        res.json({
            success: sent,
            provider: sendResult?.provider || '',
            providerMessageId: sendResult?.providerMessageId || '',
            providerZaapId: sendResult?.providerZaapId || '',
            deliveryStatus: sent && sendResult?.provider === 'zapi' ? 'pending_confirmation' : sent ? 'sent' : 'failed'
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: error.message || 'Failed to send message' });
    }
});

// DEBUG: Test specific chat retrieval
router.get('/debug-chat/:phone', adminOnly, async (req, res) => {
    try {
        if (!debugRoutesEnabled) {
            return res.status(404).json({ error: 'Not found' });
        }

        const { phone } = req.params;
        const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
        res.json({
            result: 'UNSUPPORTED_ON_BAILEYS_RUNTIME',
            chatId,
            message: 'Debug chat inspection from the legacy client was removed during consolidation.'
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// DEBUG: Fix LIDs
router.get('/fix-lids', adminOnly, async (req, res) => {
    try {
        if (!debugRoutesEnabled) {
            return res.status(404).json({ error: 'Not found' });
        }

        const lids = await Message.distinct('chatId', { chatId: { $regex: /@lid$/ } });
        console.log(`Found ${lids.length} LIDs to fix`);
        const results = [];
        for (const lid of lids) {
            let real = null;

            // Manual mapping for the user's known case
            if (lid === '9681342844995@lid') {
                real = '553184539234@c.us';
            }

            if (real) {
                const newChatId = real.includes('@') ? real : `${real}@c.us`;
                const newPeerPhone = newChatId.replace(/\D/g, '');

                // Update everything
                const updateRes = await Message.updateMany(
                    { chatId: lid },
                    { $set: { chatId: newChatId, peerPhone: newPeerPhone } }
                );

                await Message.updateMany({ from: lid }, { $set: { from: newChatId } });
                await Message.updateMany({ to: lid }, { $set: { to: newChatId } });

                results.push({ lid, real: newChatId, updated: updateRes.modifiedCount });
            } else {
                results.push({ lid, error: 'Could not resolve to c.us' });
            }
        }

        res.json({ count: lids.length, results });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
