import { randomUUID } from 'node:crypto';

import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import { sendText } from '../whatsapp/sendText.js';
import { nextBuyLaterReminderState } from './adminBuyLaterFollowupService.js';
import { syncContactDraftToOnlineAdminPanel } from './adminPanelStatusService.js';

export const EC_NEGATIVE_INTENT_V161_DECISIONS = Object.freeze({
    NONE: 'none',
    OPT_OUT: 'opt_out',
    CANCEL: 'cancel',
    BUY_LATER: 'buy_later',
    POSITIVE: 'positive'
});

const ECUADOR_TIMEZONE = 'America/Guayaquil';
const VIT_POWER_AGENT_KEY = 'vit_power_ec';
const PROTECTED_ORDER_STATUSES = Object.freeze(['confirmed', 'processing', 'shipped', 'delivered', 'returned']);
const PRODUCT_NAMES = Object.freeze({
    tex_ultra_ec: 'Tex Ultra Ecuador',
    nitrix_ec: 'Nitrix Oxide Ecuador',
    vit_power_ec: 'Vit Power Ecuador'
});
const COMMERCIAL_AGENT_KEYS = new Set(Object.keys(PRODUCT_NAMES));

const digitsOnly = value => String(value || '').replace(/\D/g, '');
const normalized = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const looksLikeOptOut = body => /\b(no me (?:escriba|escriban|contacte|contacten)|no (?:me )?molest(?:e|en|ar)|deje(?:n)? de escribirme|borre(?:n)? mi numero|elimine(?:n)? mi numero|bloque(?:e|en) mi numero|no quiero mas mensajes)\b/.test(body);
const looksLikeBuyLater = body => /\b(proximo mes|mas tarde|despues|cuando cobre|cuando me paguen|quincena|fin de mes|final de mes|no por ahora|por ahora no|ahora no|no puedo ahora|todavia no|aun no|otro dia|proxima semana|luego)\b/.test(body);
const looksLikeCancellation = body => (
    /\b(no (?:quiero|deseo) (?:el |este |ese )?(?:pedido|producto|tratamiento|comprar|llevar))\b/.test(body)
    || /^(?:no (?:quiero|deseo)|ya no(?: lo)? (?:quiero|deseo))$/.test(body)
    || /\bya no(?: lo)? (?:quiero|deseo)(?: el| este| ese)?(?: pedido| producto| tratamiento)?\b/.test(body)
    || /\b(cancelar|cancele|cancela)(?: el| este| ese)?(?: pedido)?\b/.test(body)
    || /\b(dejelo|dejalo|dejarlo)\b/.test(body)
    || /\bno me interesa\b/.test(body)
);
const looksLikePositivePurchase = body => (
    /\b(?:quiero|deseo|me interesa|comprar|llevar)(?:\s+comprar)?\b/.test(body)
    || /\b(?:1|2|3|6|uno|dos|tres|seis)\s+(?:frasco|frascos|botella|botellas)\b/.test(body)
    || /\b(?:si|confirmo|listo|correcto)\b.*\b(?:envie|envielo|mande|pedido)\b/.test(body)
    || /\b(?:prefiero|quiero)\b.*\b(?:agencia|servientrega|domicilio)\b/.test(body)
);

const desiredTiming = body => {
    if (/\b(?:fin de mes|final de mes)\b/.test(body)) return 'fin de mes';
    if (/\bquincena\b/.test(body)) return 'quincena';
    if (/\bproximo mes\b/.test(body)) return 'proximo mes';
    if (/\b(?:cuando cobre|cuando me paguen)\b/.test(body)) return 'cuando cobre';
    if (/\bmas tarde\b/.test(body)) return 'mas tarde';
    if (/\b(?:despues|luego)\b/.test(body)) return 'despues';
    if (/\b(?:no por ahora|por ahora no|ahora no|no puedo ahora|todavia no|aun no)\b/.test(body)) return 'sin fecha';
    return '';
};

const ecuadorDateParts = (now = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: ECUADOR_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(now);
    const value = Object.fromEntries(parts.map(item => [item.type, item.value]));
    return { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
};

const isoDate = (year, monthIndex, day) => {
    const date = new Date(Date.UTC(year, monthIndex, day));
    return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
};

export const inferBuyLaterDesiredDateV161 = ({ timing = '', now = new Date() } = {}) => {
    const { year, month, day } = ecuadorDateParts(now);
    if (timing === 'proximo mes') return isoDate(year, month, 5);
    if (timing === 'fin de mes') return isoDate(year, month, 0);
    if (timing === 'quincena') {
        const targetDay = day <= 15 ? 15 : new Date(Date.UTC(year, month, 0)).getUTCDate();
        return isoDate(year, month - 1, targetDay);
    }
    return '';
};

export const classifyEcuadorCommercialDecisionV161 = (text = '', { now = new Date() } = {}) => {
    const body = normalized(text);
    if (!body) return { decision: EC_NEGATIVE_INTENT_V161_DECISIONS.NONE, timing: '', desiredOrderDate: '' };
    if (looksLikeOptOut(body)) return { decision: EC_NEGATIVE_INTENT_V161_DECISIONS.OPT_OUT, timing: '', desiredOrderDate: '' };

    const buyLater = looksLikeBuyLater(body);
    const cancellation = looksLikeCancellation(body);
    if (buyLater) {
        const timing = desiredTiming(body);
        return {
            decision: EC_NEGATIVE_INTENT_V161_DECISIONS.BUY_LATER,
            timing,
            desiredOrderDate: inferBuyLaterDesiredDateV161({ timing, now }),
            mixedCancellation: cancellation
        };
    }
    if (cancellation) return { decision: EC_NEGATIVE_INTENT_V161_DECISIONS.CANCEL, timing: '', desiredOrderDate: '' };
    if (looksLikePositivePurchase(body)) return { decision: EC_NEGATIVE_INTENT_V161_DECISIONS.POSITIVE, timing: '', desiredOrderDate: '' };
    return { decision: EC_NEGATIVE_INTENT_V161_DECISIONS.NONE, timing: '', desiredOrderDate: '' };
};

export const isNegativeOrBuyLaterDecisionV161 = text => [
    EC_NEGATIVE_INTENT_V161_DECISIONS.OPT_OUT,
    EC_NEGATIVE_INTENT_V161_DECISIONS.CANCEL,
    EC_NEGATIVE_INTENT_V161_DECISIONS.BUY_LATER
].includes(classifyEcuadorCommercialDecisionV161(text).decision);

const queryOneLean = async (query, sort = { updatedAt: -1, createdAt: -1 }) => {
    if (!query) return null;
    let cursor = query;
    if (typeof cursor.sort === 'function') cursor = cursor.sort(sort);
    if (typeof cursor.lean === 'function') cursor = cursor.lean();
    return Promise.resolve(cursor);
};

export const findProtectedCommercialOperationV161 = async ({
    phone = '',
    orderModel = Order,
    shipmentModel = Shipment
} = {}) => {
    const phoneTail = digitsOnly(phone).slice(-9);
    if (!phoneTail) return { order: null, shipment: null };
    const phoneRegex = new RegExp(`${phoneTail}$`);
    const order = await queryOneLean(orderModel.findOne({
        country: 'EC',
        'customer.phone': { $regex: phoneRegex }
    }));
    const shipment = await queryOneLean(shipmentModel.findOne({
        country: 'EC',
        'client.phone': { $regex: phoneRegex }
    }), { 'logistics.lastStatusAt': -1, updatedAt: -1, createdAt: -1 });
    return { order, shipment };
};

const sendAndRecord = async ({ text, chatId, peerPhone, sessionId, sendTextFn, messageModel, now }) => {
    if (!text) return { attempted: false, sent: false };
    const result = await sendTextFn(chatId, text, null, { sessionId });
    const sent = result === true || result?.ok === true;
    if (!sent) return { attempted: true, sent: false };
    await messageModel.create({
        _id: `out_${randomUUID()}_negative_intent_v161`,
        chatId,
        peerPhone,
        from: 'bot',
        to: chatId,
        body: text,
        isFromMe: true,
        isBot: true,
        timestamp: Math.floor(now.getTime() / 1000)
    }).catch(() => null);
    return { attempted: true, sent: true };
};

const productForState = ({ contactState = {}, agentProfile = {} } = {}) => {
    const candidates = [
        contactState?.metadata?.customerDraft?.productKey,
        contactState?.metadata?.productKey,
        agentProfile?.key
    ].map(value => String(value || '').trim().toLowerCase());
    const key = candidates.find(candidate => COMMERCIAL_AGENT_KEYS.has(candidate)) || 'vit_power_ec';
    return { key, name: PRODUCT_NAMES[key] };
};

const auditFields = ({ decision, text, operation, now, previousPendingCheckout = null }) => ({
    'metadata.negativeIntentV161': {
        decision,
        inboundText: String(text || '').slice(0, 500),
        detectedAt: now,
        existingOrderProtected: Boolean(operation.order),
        existingShipmentProtected: Boolean(operation.shipment),
        automaticExternalCancellation: false,
        previousPendingCheckoutStage: String(previousPendingCheckout?.stage || previousPendingCheckout?.funnelStage || ''),
        previousSelectedQuantity: Number(previousPendingCheckout?.quantity || 0) || 0
    }
});

export const handleEcuadorNegativeOrBuyLaterV161 = async ({
    text = '',
    chatId = '',
    peerPhone = '',
    sessionId = null,
    contactStateId = '',
    contactState = {},
    agentProfile = {},
    now = new Date(),
    contactStateModel = ContactState,
    messageModel = Message,
    orderModel = Order,
    shipmentModel = Shipment,
    sendTextFn = sendText,
    syncAdminFn = syncContactDraftToOnlineAdminPanel
} = {}) => {
    if (String(agentProfile?.key || '') !== VIT_POWER_AGENT_KEY) return { handled: false, decision: 'out_of_scope' };
    const classified = classifyEcuadorCommercialDecisionV161(text, { now });
    if (![EC_NEGATIVE_INTENT_V161_DECISIONS.OPT_OUT, EC_NEGATIVE_INTENT_V161_DECISIONS.CANCEL, EC_NEGATIVE_INTENT_V161_DECISIONS.BUY_LATER].includes(classified.decision)) {
        return { handled: false, decision: classified.decision };
    }
    if (!contactStateId) {
        return { handled: true, decision: classified.decision, persistenceBlocked: true, reason: 'contact_state_required' };
    }

    const operation = await findProtectedCommercialOperationV161({
        phone: peerPhone || chatId,
        orderModel,
        shipmentModel
    });
    const previousPendingCheckout = contactState?.metadata?.perAgentMemory?.[agentProfile.key]?.pendingCheckoutOrder || null;
    const prefix = `metadata.perAgentMemory.${agentProfile.key}`;

    if (operation.order || operation.shipment) {
        await contactStateModel.updateOne(
            { _id: contactStateId },
            {
                $set: {
                    'human.mode': 'manual',
                    'human.pausedUntil': null,
                    'human.lastManualAt': now,
                    'human.lastManualBy': 'negative_intent_v161_existing_order',
                    'human.note': 'Pedido/remessa real preservado. Cancelamento externo bloqueado; revisão humana obrigatória.',
                    'metadata.automationHandoffSuggestedReason': 'existing_order_negative_intent',
                    'metadata.automationHandoffSuggestedAt': now,
                    'metadata.automationPausedReason': 'existing_order_negative_intent',
                    ...auditFields({ decision: classified.decision, text, operation, now, previousPendingCheckout })
                }
            }
        );
        return {
            handled: true,
            decision: classified.decision,
            existingOrderProtected: Boolean(operation.order),
            existingShipmentProtected: Boolean(operation.shipment),
            automaticExternalCancellation: false,
            handoffToHuman: true
        };
    }

    const draft = {
        ...(contactState?.metadata?.customerDraft || {}),
        phone: contactState?.metadata?.customerDraft?.phone || peerPhone || digitsOnly(chatId),
        productKey: productForState({ contactState, agentProfile }).key
    };
    const isBuyLater = classified.decision === EC_NEGATIVE_INTENT_V161_DECISIONS.BUY_LATER;
    const status = isBuyLater ? 'comprar_depois' : 'cancelado';
    const product = productForState({ contactState, agentProfile });
    const reminder = isBuyLater && classified.desiredOrderDate
        ? nextBuyLaterReminderState({
            previous: contactState?.buyLaterReminder,
            status,
            desiredOrderDate: classified.desiredOrderDate,
            productKey: product.key,
            productName: product.name,
            customerName: draft.name || '',
            now
        })
        : {
            ...(contactState?.buyLaterReminder?.toObject?.() || contactState?.buyLaterReminder || {}),
            active: false,
            desiredOrderDate: '',
            productKey: product.key,
            productName: product.name,
            customerName: draft.name || '',
            awaitingReply: false,
            lockUntil: null,
            lockedAt: null,
            ...(isBuyLater ? { cancelledAt: null } : { cancelledAt: now })
        };

    const updatedDraft = {
        ...draft,
        status,
        buyLaterFollowupAt: classified.desiredOrderDate || ''
    };
    await contactStateModel.updateOne(
        { _id: contactStateId },
        {
            $set: {
                'human.mode': 'manual',
                'human.pausedUntil': null,
                'human.lastManualAt': now,
                'human.lastManualBy': isBuyLater ? 'negative_intent_v161_buy_later' : 'negative_intent_v161_cancelled',
                'human.note': isBuyLater
                    ? 'Checkout interrompido; intenção canônica Comprar depois preservada para acompanhamento humano.'
                    : 'Checkout interrompido por desistência pré-pedido. Nenhum cancelamento externo foi executado.',
                'metadata.customerDraft': updatedDraft,
                'metadata.lastKnownFunnelStage': isBuyLater ? 'buy_later_followup' : 'cancelled',
                'metadata.orderStatus': isBuyLater ? 'COMPRAR_DEPOIS' : 'CANCELADO',
                'metadata.automationPausedReason': isBuyLater ? 'customer_buy_later' : 'customer_cancelled_before_order',
                [`${prefix}.lastFunnelStage`]: isBuyLater ? 'buy_later_followup' : 'cancelled',
                [`${prefix}.principalSdrStage`]: isBuyLater ? 'sdr_scheduled_followup' : 'cancelled',
                [`${prefix}.lastNegativeOrBuyLaterDecision`]: classified.decision,
                [`${prefix}.lastNegativeOrBuyLaterAt`]: now,
                buyLaterReminder: reminder,
                'metadata.buyLaterFollowup': {
                    awaitingReply: false,
                    desiredOrderDate: reminder.desiredOrderDate || '',
                    desiredTiming: classified.timing || '',
                    productKey: product.key,
                    productName: product.name,
                    scheduledAt: reminder.scheduledAt || null,
                    cancelledAt: reminder.cancelledAt || null
                },
                ...auditFields({ decision: classified.decision, text, operation, now, previousPendingCheckout })
            },
            $unset: {
                [`${prefix}.pendingCheckoutOrder`]: '',
                [`${prefix}.selectedQuantity`]: ''
            }
        }
    );

    let adminSync = { ok: false, skipped: true, reason: 'not_attempted' };
    try {
        adminSync = await Promise.resolve(syncAdminFn(updatedDraft, {
            country: 'EC',
            adminStatus: status,
            action: isBuyLater ? 'negative_intent_v161_buy_later' : 'negative_intent_v161_cancelled',
            note: isBuyLater
                ? 'Cliente adiou a compra; checkout atual interrompido sem pedido/Shipment.'
                : 'Cliente desistiu antes do pedido; checkout interrompido sem efeito externo.'
        }));
    } catch (error) {
        adminSync = { ok: false, skipped: false, reason: String(error?.message || error) };
    }

    const replyText = isBuyLater
        ? (classified.desiredOrderDate
            ? `Perfecto, señor. Queda anotado para retomar su compra ${classified.timing}.`
            : 'Claro, señor 😊\n¿Qué día desea que le escribamos nuevamente?')
        : (classified.decision === EC_NEGATIVE_INTENT_V161_DECISIONS.OPT_OUT
            ? ''
            : 'Entiendo, señor. No continuaré con este pedido.');
    const outbound = await sendAndRecord({
        text: replyText,
        chatId,
        peerPhone,
        sessionId,
        sendTextFn,
        messageModel,
        now
    });

    return {
        handled: true,
        decision: classified.decision,
        status,
        desiredTiming: classified.timing || '',
        desiredOrderDate: classified.desiredOrderDate || '',
        mixedCancellation: classified.mixedCancellation === true,
        automaticExternalCancellation: false,
        handoffToHuman: false,
        adminSync,
        outbound
    };
};

export const EC_NEGATIVE_INTENT_V161_POLICY = Object.freeze({
    protectedOrderStatuses: [...PROTECTED_ORDER_STATUSES],
    anyPersistedOrderFailsClosed: true,
    automaticExternalCancellation: false,
    createsOrder: false,
    createsShipment: false,
    callsDropi: false,
    callsMeta: false,
    enablesBuyLaterScheduler: false
});
