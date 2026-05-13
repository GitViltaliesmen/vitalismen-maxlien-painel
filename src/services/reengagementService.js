import crypto from 'crypto';
import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';
import { resolveCountryAudio } from './audioTemplateService.js';
import { getSalesMedia } from './salesMediaCatalog.js';
import { sendText } from '../whatsapp/sendText.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { sendVideo } from '../whatsapp/sendVideo.js';
import { isAutomationRecipientAllowed } from '../whatsapp/automationSafety.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_TEMPLATE = 'Hola, estoy un poco aburrida. ¿Podemos conversar un ratito? 😊';
const DAY1_TEMPLATE = 'Hola 😊 recien pude responderte por aqui. Como estas?';
const DAY2_TEMPLATE = 'Hola 😊 acabo de ver tu mensaje. Cuentame, como va tu dia?';
const PRODUCT_FOLLOWUP_TEXT = process.env.WHATSAPP_PRODUCT_FOLLOWUP_TEXT
    || 'Oi, pasando para te dar un feedback rapido! Acabamos de liberar una remesa de pedidos ahora en la manana (vea abajo).\n\nConsegui liberar para usted un cupon de 10% de descuento para cerrar el suyo ahora, pero tengo una condicion especial: como sobraron pocas unidades de este lote, si garantiza el suyo hoy, separe un Bonus Sorpresa que ya va a estar embalado junto con su pedido para retirar en la agencia.\n\nQuiere que incluya el suyo en este proximo lote con el descuento y el presente?';
const PRODUCT_FOLLOWUP_DELAY_MINUTES = Math.max(
    1,
    Number.parseInt(process.env.WHATSAPP_PRODUCT_FOLLOWUP_DELAY_MINUTES || '1440', 10)
);
const PRODUCT_SOFT_FOLLOWUP_DELAY_MINUTES = Math.max(
    1,
    Number.parseInt(process.env.WHATSAPP_PRODUCT_SOFT_FOLLOWUP_DELAY_MINUTES || '120', 10)
);
const PRODUCT_SOFT_FOLLOWUP_TEXT = process.env.WHATSAPP_PRODUCT_SOFT_FOLLOWUP_TEXT
    || 'Hola 😊 le habia reservado una sorpresa especial para clientes que avanzan hoy con Vit Power. Si confirma su pedido, ademas del pago contra entrega, le guardo ese bonus para cuando retire o reciba su producto. ¿Le separo 1, 3 o 6 frascos?';
const PENDING_CHECKOUT_INFO_REMINDER_DELAY_MINUTES = Math.max(
    1,
    Number.parseInt(process.env.PENDING_CHECKOUT_INFO_REMINDER_DELAY_MINUTES || '20', 10)
);
const PENDING_CHECKOUT_BONUS_RECOVERY_DELAY_MINUTES = Math.max(
    60,
    Number.parseInt(process.env.PENDING_CHECKOUT_BONUS_RECOVERY_DELAY_MINUTES || '1440', 10)
);
const PRODUCT_FOLLOWUP_PROOFS = [
    { type: 'image', key: 'social_01' },
    { type: 'image', key: 'social_02' },
    { type: 'image', key: 'social_03' },
    { type: 'image', key: 'social_04' },
    { type: 'audio', key: 'DEPOIMENTO_AUDIO_PRODUTO' },
    { type: 'video', key: 'prova_social_video_boquet' }
];
let productFollowupRunning = false;
let pendingCheckoutFollowupRunning = false;

const PENDING_CHECKOUT_STAGES = new Set([
    'awaiting_delivery_mode',
    'awaiting_agency_details',
    'awaiting_agency_selection',
    'awaiting_agency_selection_interrupt',
    'awaiting_package_choice_after_agency',
    'awaiting_customer_name',
    'awaiting_customer_data',
    'awaiting_customer_name_data',
    'awaiting_city_province',
    'awaiting_home_address',
    'awaiting_reference',
    'awaiting_quantity_data',
    'awaiting_agency_confirmation'
]);

const hashText = (text) => crypto.createHash('sha1').update(String(text || '')).digest('hex');

const getTemplateForAge = (ageMs) => {
    if (ageMs <= 6 * 60 * 60 * 1000) {
        return { key: 'recent', text: RECENT_TEMPLATE };
    }
    if (ageMs <= DAY_MS) {
        return { key: 'day1', text: DAY1_TEMPLATE };
    }
    return { key: 'day2', text: DAY2_TEMPLATE };
};

const normalizeStateMetadata = (state) => ({
    ...(state.metadata || {}),
    reengagement: {
        ...((state.metadata || {}).reengagement || {}),
        sentHashes: Array.isArray((state.metadata || {}).reengagement?.sentHashes)
            ? (state.metadata || {}).reengagement.sentHashes
            : []
    }
});

const getAgentMemory = (state, agentKey) => (((state?.metadata || {}).perAgentMemory || {})[agentKey] || {});

const getPendingCheckoutStage = (memory = {}) => String(memory.pendingCheckoutOrder?.stage || memory.lastFunnelStage || '');

const getPendingCheckoutInfoLabel = (stage) => {
    if (stage === 'awaiting_delivery_mode') {
        return 'si prefiere retirar en agencia Servientrega o recibir en su domicilio';
    }
    if (['awaiting_agency_details'].includes(stage)) {
        return 'ciudad, provincia y nombre o direccion de la agencia Servientrega';
    }
    if (['awaiting_agency_selection', 'awaiting_agency_selection_interrupt'].includes(stage)) {
        return 'el numero de la agencia que desea para retirar';
    }
    if (['awaiting_package_choice_after_agency', 'awaiting_quantity_data'].includes(stage)) {
        return 'cuantos frascos desea llevar: 1, 3 o 6';
    }
    if (['awaiting_customer_name', 'awaiting_customer_name_data'].includes(stage)) {
        return 'su nombre completo';
    }
    if (stage === 'awaiting_city_province') {
        return 'su ciudad y provincia';
    }
    if (['awaiting_customer_data', 'awaiting_home_address', 'awaiting_reference'].includes(stage)) {
        return 'la direccion completa y un punto de referencia';
    }
    if (stage === 'awaiting_agency_confirmation') {
        return 'si los datos estan correctos para confirmar el envio';
    }
    return 'la informacion que falta';
};

const buildPendingCheckoutInfoReminderText = (stage) => (
    `Hola 😊 para poder avanzar con su pedido, por favor envienos ${getPendingCheckoutInfoLabel(stage)} si aun tiene interes. Si desea, le ayudo por aqui paso a paso.`
);

const buildPendingCheckoutBonusRecoveryText = (stage) => (
    `Hola 😊 todavia le tengo separado Vit Power. Hoy puedo mantenerle un bonus sorpresa si cerramos su pedido.\n\nPara avanzar, me envia ${getPendingCheckoutInfoLabel(stage)}?`
);

const registerBotMessage = async ({ chatId, phoneDigits, body, type = 'chat' }) => {
    try {
        await Message.create({
            _id: `out_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
            chatId,
            peerPhone: phoneDigits || String(chatId).replace(/\D/g, ''),
            from: 'bot',
            to: chatId,
            body,
            type,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (error) {
        if (error.code !== 11000) console.warn('[FOLLOWUP] falha ao registrar mensagem:', error.message);
    }
};

const lastCustomerReplyAfter = async ({ chatId, since }) => {
    const message = await Message.findOne({
        chatId,
        isFromMe: false,
        isBot: false,
        createdAt: { $gt: since }
    }).sort({ createdAt: -1 }).lean();
    return message || null;
};

const isEligibleInbound = (message) => {
    if (!message) return false;
    if (message.isFromMe || message.isBot) return false;
    if (!message.chatId || String(message.chatId).includes('@g.us')) return false;
    return true;
};

export const listReengagementCandidates = async ({ hours = 48, limit = 100 } = {}) => {
    const since = new Date(Date.now() - (hours * 60 * 60 * 1000));
    const inboundMessages = await Message.find({
        createdAt: { $gte: since }
    }).sort({ createdAt: -1 }).limit(limit * 20).lean();

    const latestInboundByChat = new Map();

    for (const message of inboundMessages) {
        if (!isEligibleInbound(message)) continue;
        if (!latestInboundByChat.has(message.chatId)) {
            latestInboundByChat.set(message.chatId, message);
        }
    }

    const candidates = [];
    for (const inbound of latestInboundByChat.values()) {
        const lastBotReply = await Message.findOne({
            chatId: inbound.chatId,
            isBot: true,
            createdAt: { $gte: inbound.createdAt }
        }).sort({ createdAt: -1 }).lean();

        if (lastBotReply) continue;

        const state = await ContactState.findOne({ chatId: inbound.chatId });
        const metadata = state ? normalizeStateMetadata(state) : { reengagement: { sentHashes: [] } };
        const ageMs = Date.now() - new Date(inbound.createdAt).getTime();
        const template = getTemplateForAge(ageMs);
        const textHash = hashText(template.text);

        if (metadata.reengagement.sentHashes.includes(textHash)) continue;

        candidates.push({
            chatId: inbound.chatId,
            phone: inbound.peerPhone || String(inbound.chatId).replace(/\D/g, ''),
            lastInboundAt: inbound.createdAt,
            lastInboundText: inbound.body || '',
            ageHours: Math.round((ageMs / (60 * 60 * 1000)) * 10) / 10,
            templateKey: template.key,
            templateText: template.text,
            sessionId: state?.metadata?.lastSessionId || null
        });
    }

    return candidates
        .sort((a, b) => new Date(b.lastInboundAt).getTime() - new Date(a.lastInboundAt).getTime())
        .slice(0, limit);
};

export const sendReengagementToChat = async ({ chatId, text, sessionId = null }) => {
    const state = await ContactState.findOne({ chatId });
    if (!state) {
        throw new Error('Contact state not found');
    }

    const metadata = normalizeStateMetadata(state);
    const textHash = hashText(text);
    if (metadata.reengagement.sentHashes.includes(textHash)) {
        return { success: false, skipped: 'already_sent' };
    }

    const sent = await sendText(chatId, text, null, {
        sessionId: sessionId || state.metadata?.lastSessionId || null
    });

    if (!sent) {
        return { success: false, skipped: 'send_failed' };
    }

    state.metadata = {
        ...metadata,
        reengagement: {
            ...metadata.reengagement,
            lastSentAt: new Date(),
            lastTemplateText: text,
            lastTemplateHash: textHash,
            sentHashes: [...metadata.reengagement.sentHashes, textHash].slice(-20)
        }
    };
    state.lastOutboundAt = new Date();
    await state.save();

    return { success: true };
};

export const processPendingCheckoutInfoFollowups = async ({ limit = 20 } = {}) => {
    if (pendingCheckoutFollowupRunning) return { processed: 0, sent: 0, skipped: 'already_running' };
    pendingCheckoutFollowupRunning = true;

    try {
        const states = await ContactState.find({
            assignedAgent: 'vit_power_ec',
            'metadata.perAgentMemory.vit_power_ec.pendingCheckoutOrder': { $exists: true }
        }).sort({ updatedAt: -1 }).limit(limit);

        let processed = 0;
        let sent = 0;

        for (const state of states) {
            processed += 1;
            const agentKey = state.assignedAgent || 'vit_power_ec';
            const metadata = normalizeStateMetadata(state);
            const memory = getAgentMemory(state, agentKey);
            const stage = getPendingCheckoutStage(memory);
            if (!PENDING_CHECKOUT_STAGES.has(stage)) continue;

            const lastRequestAt = memory.lastOutboundAt
                ? new Date(memory.lastOutboundAt)
                : (state.lastOutboundAt ? new Date(state.lastOutboundAt) : null);
            if (!lastRequestAt || Number.isNaN(lastRequestAt.getTime())) continue;

            const repliedAfterRequest = await lastCustomerReplyAfter({
                chatId: state.chatId,
                since: lastRequestAt
            });
            if (repliedAfterRequest) continue;

            const safetyTarget = state.metadata?.lastSenderPn || state.phoneDigits || state.chatId;
            const safety = isAutomationRecipientAllowed(safetyTarget);
            if (!safety.allowed) {
                console.log(`[PENDING_CHECKOUT] pulado por seguranca | chat=${state.chatId} | reason=${safety.reason}`);
                continue;
            }

            const now = Date.now();
            const lastRequestAgeMs = now - lastRequestAt.getTime();
            const reminderAt = memory.pendingCheckoutInfoReminderSentAt
                ? new Date(memory.pendingCheckoutInfoReminderSentAt)
                : null;
            const recoveryAt = memory.pendingCheckoutInfoRecoverySentAt
                ? new Date(memory.pendingCheckoutInfoRecoverySentAt)
                : null;
            const reminderStage = String(memory.pendingCheckoutInfoReminderStage || '');
            const recoveryStage = String(memory.pendingCheckoutInfoRecoveryStage || '');

            const reminderDelayMs = PENDING_CHECKOUT_INFO_REMINDER_DELAY_MINUTES * 60 * 1000;
            const recoveryDelayMs = PENDING_CHECKOUT_BONUS_RECOVERY_DELAY_MINUTES * 60 * 1000;

            if (
                (!reminderAt || reminderStage !== stage)
                && lastRequestAgeMs >= reminderDelayMs
            ) {
                const text = buildPendingCheckoutInfoReminderText(stage);
                const ok = await sendText(state.chatId, text, null, {
                    sessionId: state.metadata?.lastSessionId || null
                });
                if (!ok) continue;

                const nextMemory = {
                    ...memory,
                    pendingCheckoutInfoReminderSentAt: new Date(),
                    pendingCheckoutInfoReminderStage: stage,
                    pendingCheckoutInfoReminderText: text,
                    lastOutboundAt: new Date(),
                    lastOutboundText: text,
                    lastFunnelStage: stage
                };
                state.metadata = {
                    ...metadata,
                    lastKnownIntent: 'purchase_intent',
                    lastKnownFunnelStage: stage,
                    perAgentMemory: {
                        ...((metadata || {}).perAgentMemory || {}),
                        [agentKey]: nextMemory
                    }
                };
                state.lastOutboundAt = new Date();
                await state.save();
                await registerBotMessage({
                    chatId: state.chatId,
                    phoneDigits: state.phoneDigits,
                    body: text
                });
                sent += 1;
                continue;
            }

            const reminderAnchor = reminderAt && reminderStage === stage ? reminderAt : lastRequestAt;
            const repliedAfterReminder = await lastCustomerReplyAfter({
                chatId: state.chatId,
                since: reminderAnchor
            });
            if (repliedAfterReminder) continue;

            if (
                (!recoveryAt || recoveryStage !== stage)
                && now - reminderAnchor.getTime() >= recoveryDelayMs
            ) {
                const text = buildPendingCheckoutBonusRecoveryText(stage);
                const ok = await sendText(state.chatId, text, null, {
                    sessionId: state.metadata?.lastSessionId || null
                });
                if (!ok) continue;

                const nextMemory = {
                    ...memory,
                    pendingCheckoutInfoRecoverySentAt: new Date(),
                    pendingCheckoutInfoRecoveryStage: stage,
                    pendingCheckoutInfoRecoveryText: text,
                    lastOutboundAt: new Date(),
                    lastOutboundText: text,
                    lastFunnelStage: stage
                };
                state.metadata = {
                    ...metadata,
                    lastKnownIntent: 'purchase_intent',
                    lastKnownFunnelStage: stage,
                    perAgentMemory: {
                        ...((metadata || {}).perAgentMemory || {}),
                        [agentKey]: nextMemory
                    }
                };
                state.lastOutboundAt = new Date();
                await state.save();
                await registerBotMessage({
                    chatId: state.chatId,
                    phoneDigits: state.phoneDigits,
                    body: text
                });
                sent += 1;
            }
        }

        return { processed, sent };
    } finally {
        pendingCheckoutFollowupRunning = false;
    }
};

const sendProductFollowupProof = async ({ chatId, sessionId, proof }) => {
    if (!proof) return false;

    if (proof.type === 'audio') {
        const audioPath = await resolveCountryAudio({ country: 'EC', baseName: proof.key });
        return audioPath ? sendAudio(chatId, audioPath, true, { sessionId }) : false;
    }

    const media = getSalesMedia(proof.key);
    if (!media) return false;

    if (proof.type === 'video' || media.type === 'video') {
        return sendVideo(chatId, media.path, media.caption || '', {
            sessionId,
            viewOnce: Boolean(media.viewOnce)
        });
    }

    return sendImage(chatId, media.path, media.caption || '', { sessionId });
};

export const processInitialProductFollowups = async ({ limit = 30 } = {}) => {
    if (productFollowupRunning) return { processed: 0, sent: 0, skipped: 'already_running' };
    productFollowupRunning = true;

    try {
        const delayMs = PRODUCT_FOLLOWUP_DELAY_MINUTES * 60 * 1000;
        const cutoff = new Date(Date.now() - delayMs);
        const states = await ContactState.find({
            assignedAgent: 'vit_power_ec',
            'metadata.perAgentMemory.vit_power_ec.initialProductPresentationSentAt': { $lte: cutoff }
        }).sort({ updatedAt: -1 }).limit(limit);

        let sent = 0;
        let processed = 0;

        for (const state of states) {
            processed += 1;
            const agentKey = state.assignedAgent || 'vit_power_ec';
            const memory = getAgentMemory(state, agentKey);
            if (memory.pendingCheckoutOrder && PENDING_CHECKOUT_STAGES.has(getPendingCheckoutStage(memory))) {
                continue;
            }
            const presentationAt = memory.initialProductPresentationSentAt
                ? new Date(memory.initialProductPresentationSentAt)
                : null;

            if (!presentationAt || Number.isNaN(presentationAt.getTime())) continue;

            const replied = await lastCustomerReplyAfter({ chatId: state.chatId, since: presentationAt });
            if (replied) continue;

            const safety = isAutomationRecipientAllowed(state.phoneDigits || state.chatId);
            if (!safety.allowed) {
                console.log(`[FOLLOWUP] pulado por seguranca | chat=${state.chatId} | reason=${safety.reason}`);
                continue;
            }

            const ageMs = Date.now() - presentationAt.getTime();
            const softDelayMs = PRODUCT_SOFT_FOLLOWUP_DELAY_MINUTES * 60 * 1000;
            if (!memory.initialProductSoftFollowupSentAt && ageMs >= softDelayMs) {
                const reengagement = normalizeStateMetadata(state).reengagement;
                const softHash = hashText(PRODUCT_SOFT_FOLLOWUP_TEXT);
                if (reengagement.sentHashes.includes(softHash)) continue;

                const ok = await sendText(state.chatId, PRODUCT_SOFT_FOLLOWUP_TEXT, null, {
                    sessionId: state.metadata?.lastSessionId || null
                });
                if (!ok) continue;

                state.metadata = {
                    ...(state.metadata || {}),
                    reengagement: {
                        ...reengagement,
                        lastSentAt: new Date(),
                        lastTemplateText: PRODUCT_SOFT_FOLLOWUP_TEXT,
                        lastTemplateHash: softHash,
                        sentHashes: [...reengagement.sentHashes, softHash].slice(-20)
                    },
                    perAgentMemory: {
                        ...((state.metadata || {}).perAgentMemory || {}),
                        [agentKey]: {
                            ...memory,
                            initialProductSoftFollowupSentAt: new Date(),
                            initialProductSoftFollowupText: PRODUCT_SOFT_FOLLOWUP_TEXT
                        }
                    }
                };
                state.lastOutboundAt = new Date();
                await state.save();

                try {
                    await Message.create({
                        _id: `out_${Date.now()}`,
                        chatId: state.chatId,
                        peerPhone: state.phoneDigits || String(state.chatId).replace(/\D/g, ''),
                        from: 'bot',
                        to: state.chatId,
                        body: PRODUCT_SOFT_FOLLOWUP_TEXT,
                        type: 'chat',
                        isFromMe: true,
                        isBot: true,
                        timestamp: Math.floor(Date.now() / 1000)
                    });
                } catch (error) {
                    if (error.code !== 11000) console.warn('[FOLLOWUP] falha ao registrar mensagem:', error.message);
                }

                sent += 1;
                continue;
            }

            if (memory.initialProductFollowupSentAt) continue;

            const textHash = hashText(PRODUCT_FOLLOWUP_TEXT);
            const reengagement = normalizeStateMetadata(state).reengagement;
            if (reengagement.sentHashes.includes(textHash)) continue;

            const previousProofIndex = Number.parseInt(String(memory.initialProductFollowupProofIndex ?? ''), 10);
            const seedIndex = hashText(state.chatId)
                .split('')
                .reduce((sum, char) => sum + char.charCodeAt(0), 0);
            const proofIndex = Number.isFinite(previousProofIndex)
                ? previousProofIndex + 1
                : seedIndex;
            const proof = PRODUCT_FOLLOWUP_PROOFS[proofIndex % PRODUCT_FOLLOWUP_PROOFS.length];
            const ok = await sendText(state.chatId, PRODUCT_FOLLOWUP_TEXT, null, {
                sessionId: state.metadata?.lastSessionId || null
            });
            if (!ok) continue;

            const proofSent = await sendProductFollowupProof({
                chatId: state.chatId,
                sessionId: state.metadata?.lastSessionId || null,
                proof
            });

            state.metadata = {
                ...(state.metadata || {}),
                reengagement: {
                    ...reengagement,
                    lastSentAt: new Date(),
                    lastTemplateText: PRODUCT_FOLLOWUP_TEXT,
                    lastTemplateHash: textHash,
                    sentHashes: [...reengagement.sentHashes, textHash].slice(-20)
                },
                perAgentMemory: {
                    ...((state.metadata || {}).perAgentMemory || {}),
                    [agentKey]: {
                        ...memory,
                        initialProductFollowupSentAt: new Date(),
                        initialProductFollowupText: PRODUCT_FOLLOWUP_TEXT,
                        initialProductFollowupProofIndex: proofIndex,
                        initialProductFollowupProof: proof,
                        initialProductFollowupProofSent: proofSent
                    }
                }
            };
            state.lastOutboundAt = new Date();
            await state.save();

            try {
                await Message.create({
                    _id: `out_${Date.now()}`,
                    chatId: state.chatId,
                    peerPhone: state.phoneDigits || String(state.chatId).replace(/\D/g, ''),
                    from: 'bot',
                    to: state.chatId,
                    body: PRODUCT_FOLLOWUP_TEXT,
                    type: 'chat',
                    isFromMe: true,
                    isBot: true,
                    timestamp: Math.floor(Date.now() / 1000)
                });
            } catch (error) {
                if (error.code !== 11000) console.warn('[FOLLOWUP] falha ao registrar mensagem:', error.message);
            }

            sent += 1;
        }

        return { processed, sent };
    } finally {
        productFollowupRunning = false;
    }
};
