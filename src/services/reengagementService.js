import crypto from 'crypto';
import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';
import Shipment from '../models/Shipment.js';
import { resolveCountryAudio } from './audioTemplateService.js';
import { getSalesMedia } from './salesMediaCatalog.js';
import { sendText } from '../whatsapp/sendText.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { sendVideo } from '../whatsapp/sendVideo.js';
import { isAutomationRecipientAllowed } from '../whatsapp/automationSafety.js';
import { getNextItemByPurpose, markPurposeItemSent } from './funnelPurposeMemoryService.js';
import { toWhatsAppChatId } from '../utils/phone.js';
import { buildRefillReminderText, repurchaseReminderDelayDaysForUnits } from './shipmentMessageService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_TEMPLATE = 'Hola, estoy un poco aburrida. ¿Podemos conversar un ratito? 😊';
const DAY1_TEMPLATE = 'Hola 😊 recien pude responderte por aqui. Como estas?';
const DAY2_TEMPLATE = 'Hola 😊 acabo de ver tu mensaje. Cuentame, como va tu dia?';
const PRODUCT_FOLLOWUP_DELAY_MINUTES = Math.max(
    1,
    Number.parseInt(process.env.WHATSAPP_PRODUCT_FOLLOWUP_DELAY_MINUTES || '120', 10)
);
const PENDING_CHECKOUT_INFO_REMINDER_DELAY_MINUTES = Math.max(
    1,
    Number.parseInt(process.env.PENDING_CHECKOUT_INFO_REMINDER_DELAY_MINUTES || '20', 10)
);
const PENDING_CHECKOUT_BONUS_RECOVERY_DELAY_MINUTES = Math.max(
    60,
    Number.parseInt(process.env.PENDING_CHECKOUT_BONUS_RECOVERY_DELAY_MINUTES || '1440', 10)
);
const POST_SALE_REPURCHASE_MIN_DELAY_DAYS = () => Math.min(
    repurchaseReminderDelayDaysForUnits(1),
    repurchaseReminderDelayDaysForUnits(2),
    repurchaseReminderDelayDaysForUnits(3)
);
const PRODUCT_FOLLOWUP_PROOFS = [
    'image:social_01',
    'image:social_02',
    'audio:DEPOIMENTO_AUDIO_PRODUTO',
    'audio:FUNCIONA_VIT_POWER',
    'image:vit_power_bottle',
    'video:prova_social_video_boquet'
];
let productFollowupRunning = false;
let pendingCheckoutFollowupRunning = false;
let postSaleRepurchaseFollowupRunning = false;

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
const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

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

export const sendReengagementToChat = async ({ chatId, phone = '', text, sessionId = null }) => {
    const digits = String(phone || chatId || '').replace(/\D/g, '');
    const tail = digits.length >= 8 ? digits.slice(-10) : '';
    const state = await ContactState.findOne({
        $or: [
            { chatId },
            ...(digits ? [{ phoneDigits: digits }] : []),
            ...(tail ? [{ phoneDigits: { $regex: `${tail}$` } }] : [])
        ]
    }).sort({ updatedAt: -1 });
    if (!state) {
        throw new Error('Contact state not found');
    }

    const metadata = normalizeStateMetadata(state);
    const textHash = hashText(text);
    if (metadata.reengagement.sentHashes.includes(textHash)) {
        return { success: false, skipped: 'already_sent' };
    }

    const targetChatId = String(state.chatId || chatId || '').endsWith('@zapi') && (state.phoneDigits || digits)
        ? `${state.phoneDigits || digits}@c.us`
        : state.chatId || chatId;

    const sent = await sendText(targetChatId, text, null, {
        sessionId: sessionId || null,
        recipientDigits: state.phoneDigits || digits || ''
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

const sendProductFollowupProof = async ({ chatId, sessionId, proof, outboundOptions = {}, country = 'EC' }) => {
    if (!proof) return false;
    const [type, key] = String(proof || '').split(':');

    if (type === 'audio') {
        const audioPath = await resolveCountryAudio({ country: 'EC', baseName: key });
        return audioPath ? sendAudio(chatId, audioPath, true, { sessionId, country, ...outboundOptions }) : false;
    }

    const media = getSalesMedia(key);
    if (!media) return false;

    if (type === 'video' || media.type === 'video') {
        return sendVideo(chatId, media.path, media.caption || '', {
            sessionId,
            country,
            ...outboundOptions,
            viewOnce: Boolean(media.viewOnce)
        });
    }

    return sendImage(chatId, media.path, media.caption || '', { sessionId, country, ...outboundOptions });
};

const uniquePhoneTails = (value = '') => {
    const digits = digitsOnly(value);
    return [...new Set([
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter(Boolean))];
};

const contactStateQueryForShipment = (shipment = {}) => {
    const tails = uniquePhoneTails(shipment?.client?.phone);
    if (!tails.length) return null;
    return {
        assignedAgent: 'vit_power_ec',
        $or: tails.flatMap((tail) => ([
            { phoneDigits: { $regex: `${tail}$` } },
            { chatId: { $regex: tail } },
            { 'metadata.customerPhoneDigits': { $regex: `${tail}$` } },
            { 'metadata.lastSenderPn': { $regex: `${tail}$` } }
        ]))
    };
};

const findContactStateForShipment = async (shipment = {}) => {
    const query = contactStateQueryForShipment(shipment);
    if (!query) return null;
    return ContactState.findOne(query).sort({ updatedAt: -1, lastInboundAt: -1 }).catch(() => null);
};

const deliveredAnchorForShipment = (shipment = {}) => {
    const candidates = [
        shipment?.automation?.deliveredConfirmedAt,
        shipment?.proof?.pickupProofReceivedAt,
        shipment?.logistics?.lastStatusAt,
        shipment?.updatedAt,
        shipment?.createdAt
    ];

    for (const value of candidates) {
        const date = value ? new Date(value) : null;
        if (date && !Number.isNaN(date.getTime())) return date;
    }
    return null;
};

const repurchaseDueAtForShipment = (shipment = {}) => {
    const anchor = deliveredAnchorForShipment(shipment);
    const units = Number(shipment?.treatment?.unitsPurchased || 1) || 1;
    if (anchor) return new Date(anchor.getTime() + (repurchaseReminderDelayDaysForUnits(units) * DAY_MS));

    const storedDueAt = shipment?.treatment?.refillReminderDueAt
        ? new Date(shipment.treatment.refillReminderDueAt)
        : null;
    return storedDueAt && !Number.isNaN(storedDueAt.getTime()) ? storedDueAt : null;
};

const chatIdForShipmentRepurchase = ({ shipment, state }) => (
    state?.metadata?.lastActiveChatId
    || state?.chatId
    || toWhatsAppChatId(shipment?.client?.phone || '', shipment?.country || 'EC')
);

const updateRepurchaseMemory = async ({
    state,
    agentKey,
    text,
    proof,
    shipment,
    audioSent,
    proofSent
}) => {
    if (!state?._id) return;
    const metadata = normalizeStateMetadata(state);
    const memory = getAgentMemory(state, agentKey);
    state.metadata = {
        ...metadata,
        reengagement: {
            ...metadata.reengagement,
            lastSentAt: new Date()
        },
        perAgentMemory: {
            ...((metadata || {}).perAgentMemory || {}),
            [agentKey]: {
                ...memory,
                postSaleRepurchase30dSentAt: new Date(),
                postSaleRepurchase30dText: text,
                postSaleRepurchase30dProof: proof || '',
                postSaleRepurchase30dProofSent: Boolean(proofSent),
                postSaleRepurchase30dAudioSent: Boolean(audioSent),
                postSaleRepurchase30dShipmentId: shipment?._id || null,
                postSaleRepurchase30dOrderId: shipment?.orderId || '',
                lastOutboundAt: new Date(),
                lastOutboundText: text,
                lastFunnelStage: 'refill_reminder'
            }
        },
        lastKnownIntent: 'repurchase_continuity',
        lastKnownFunnelStage: 'refill_reminder'
    };
    state.lastOutboundAt = new Date();
    await state.save();
};

export const processPostSaleRepurchase30dFollowups = async ({
    limit = Number.parseInt(process.env.POST_SALE_REPURCHASE_BATCH_LIMIT || '3', 10)
} = {}) => {
    if (postSaleRepurchaseFollowupRunning) return { processed: 0, sent: 0, skipped: 'already_running' };
    postSaleRepurchaseFollowupRunning = true;

    try {
        const now = new Date();
        const cutoff = new Date(now.getTime() - (POST_SALE_REPURCHASE_MIN_DELAY_DAYS() * DAY_MS));
        const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit || 3), 10) || 3, 10));
        const shipments = await Shipment.find({
            country: 'EC',
            'client.phone': { $exists: true, $ne: '' },
            'automation.refillReminderAt': null,
            'outcomes.returned': { $ne: true },
            'outcomes.prepaidOnly': { $ne: true },
            'review.manualOnly': { $ne: true },
            $and: [
                {
                    $or: [
                        { 'outcomes.pickedUp': true },
                        { 'outcomes.delivered': true },
                        { 'automation.deliveredConfirmedAt': { $ne: null } }
                    ]
                },
                {
                    $or: [
                        { 'automation.deliveredConfirmedAt': { $lte: cutoff } },
                        { 'proof.pickupProofReceivedAt': { $lte: cutoff } },
                        { 'treatment.refillReminderDueAt': { $lte: now } },
                        { 'logistics.lastStatusAt': { $lte: cutoff } },
                        { updatedAt: { $lte: cutoff } }
                    ]
                }
            ]
        }).sort({ 'automation.deliveredConfirmedAt': 1, 'proof.pickupProofReceivedAt': 1, updatedAt: 1 }).limit(Math.max(safeLimit * 8, 40));

        let processed = 0;
        let sent = 0;

        for (const shipment of shipments) {
            if (sent >= safeLimit) break;
            processed += 1;

            const dueAt = repurchaseDueAtForShipment(shipment);
            if (!dueAt || dueAt.getTime() > now.getTime()) continue;

            const state = await findContactStateForShipment(shipment);
            const chatId = chatIdForShipmentRepurchase({ shipment, state });
            if (!chatId) continue;

            const safetyTarget = state?.metadata?.lastSenderPn || state?.phoneDigits || shipment.client?.phone || chatId;
            const safety = isAutomationRecipientAllowed(safetyTarget);
            if (!safety.allowed) {
                console.log(`[RECOMPRA_30D] pulado por seguranca | order=${shipment.orderId} | reason=${safety.reason}`);
                continue;
            }

            const text = buildRefillReminderText(shipment);
            const sessionId = state?.metadata?.lastSessionId || shipment?.automation?.sessionId || null;
            const textSent = await sendText(chatId, text, null, {
                sessionId,
                country: state?.countryCode || shipment?.country || 'EC',
                allowExistingDropiOrder: true,
                outboundContext: 'post_sale_repurchase_30d',
                dedupeValue: `post_sale_repurchase_30d|${shipment.orderId || digitsOnly(shipment.client?.phone)}`
            });
            if (!textSent) continue;

            await registerBotMessage({
                chatId,
                phoneDigits: digitsOnly(shipment.client?.phone) || state?.phoneDigits,
                body: text
            });

            const tempoAudioPath = await resolveCountryAudio({ country: 'EC', baseName: 'TEMPO_RESULTADO_VIT_POWER' });
            const audioSent = tempoAudioPath
                ? await sendAudio(chatId, tempoAudioPath, true, {
                    sessionId,
                    country: state?.countryCode || shipment?.country || 'EC',
                    allowExistingDropiOrder: true,
                    outboundContext: 'post_sale_repurchase_30d_audio',
                    dedupeValue: `post_sale_repurchase_30d_audio|TEMPO_RESULTADO_VIT_POWER|${shipment.orderId || digitsOnly(shipment.client?.phone)}`
                })
                : false;
            if (audioSent) {
                await registerBotMessage({
                    chatId,
                    phoneDigits: digitsOnly(shipment.client?.phone) || state?.phoneDigits,
                    body: '[AUDIO_RECOMPRA_30D] TEMPO_RESULTADO_VIT_POWER',
                    type: 'audio'
                });
            }

            const agentKey = state?.assignedAgent || 'vit_power_ec';
            const proof = state
                ? await getNextItemByPurpose(state.phoneDigits || shipment.client?.phone || chatId, 'prova', {
                    candidates: PRODUCT_FOLLOWUP_PROOFS,
                    state,
                    agentKey
                })
                : null;
            const proofSent = proof
                ? await sendProductFollowupProof({
                    chatId,
                    sessionId,
                    proof,
                    country: state?.countryCode || shipment?.country || 'EC',
                    outboundOptions: {
                        allowExistingDropiOrder: true,
                        outboundContext: 'post_sale_repurchase_30d_proof'
                    }
                })
                : false;
            if (proofSent && state?._id) {
                await registerBotMessage({
                    chatId,
                    phoneDigits: digitsOnly(shipment.client?.phone) || state?.phoneDigits,
                    body: `[PROVA_RECOMPRA_30D] ${proof}`,
                    type: proof.startsWith('audio:') ? 'audio' : (proof.startsWith('video:') ? 'video' : 'image')
                });
            }

            await updateRepurchaseMemory({
                state,
                agentKey,
                text,
                proof,
                shipment,
                audioSent,
                proofSent
            });
            if (proofSent && state?._id) {
                await markPurposeItemSent({
                    contactStateId: state._id,
                    agentKey,
                    purpose: 'prova',
                    item: proof
                });
            }

            shipment.automation.refillReminderAt = now;
            shipment.automation.lastReminderAt = now;
            shipment.automation.lastAudioAt = audioSent ? now : shipment.automation.lastAudioAt;
            shipment.automation.lastReminderKind = 'post_sale_repurchase_30d';
            shipment.treatment.refillReminderDueAt = dueAt;
            shipment.events.push({
                kind: 'post_sale_repurchase_30d_notified',
                at: now,
                payload: {
                    chatId,
                    delayDays: repurchaseReminderDelayDaysForUnits(shipment?.treatment?.unitsPurchased || 1),
                    dueAt,
                    audioSent,
                    proof: proof || '',
                    proofSent: Boolean(proofSent)
                }
            });
            shipment.events = shipment.events.slice(-60);
            await shipment.save();

            sent += 1;
        }

        return { processed, sent, candidates: shipments.length };
    } finally {
        postSaleRepurchaseFollowupRunning = false;
    }
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

            if (memory.initialProductFollowupSentAt) continue;
            const reengagement = normalizeStateMetadata(state).reengagement;
            const proof = await getNextItemByPurpose(state.phoneDigits || state.chatId, 'prova', {
                candidates: PRODUCT_FOLLOWUP_PROOFS,
                state,
                agentKey
            });
            if (!proof) continue;

            const proofSent = await sendProductFollowupProof({
                chatId: state.chatId,
                sessionId: state.metadata?.lastSessionId || null,
                proof
            });
            if (!proofSent) continue;

            const previousProofMemory = memory.audioPurposeMemory?.prova || {};
            const previousProofSent = Array.isArray(previousProofMemory.sent) ? previousProofMemory.sent : [];

            state.metadata = {
                ...(state.metadata || {}),
                reengagement: {
                    ...reengagement,
                    lastSentAt: new Date()
                },
                perAgentMemory: {
                    ...((state.metadata || {}).perAgentMemory || {}),
                    [agentKey]: {
                        ...memory,
                        audioPurposeMemory: {
                            ...(memory.audioPurposeMemory || {}),
                            prova: {
                                ...previousProofMemory,
                                sent: [...new Set([...previousProofSent, proof])],
                                lastSent: proof,
                                lastSentAt: new Date(),
                                sentCount: Number(previousProofMemory.sentCount || 0) + 1
                            }
                        },
                        initialProductFollowupSentAt: new Date(),
                        initialProductFollowupProof: proof,
                        initialProductFollowupProofSent: proofSent,
                        initialProductFollowupMode: 'single_proof_no_text'
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
                        body: `[PROVA_FOLLOWUP] ${proof}`,
                        type: proof.startsWith('audio:') ? 'audio' : (proof.startsWith('video:') ? 'video' : 'image'),
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
