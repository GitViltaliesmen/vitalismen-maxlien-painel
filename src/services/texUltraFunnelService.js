import path from 'path';
import ContactState from '../models/ContactState.js';
import Order from '../models/Order.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendText } from '../whatsapp/sendText.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { resolveCountryAudio } from './audioTemplateService.js';
import { getSalesMedia } from './salesMediaCatalog.js';
import { sendPurchaseEventForOrder } from './metaConversionsService.js';
import { enrichOrderWithMetaAttribution } from './metaAttributionService.js';
import { buildTexUltraEntryGreeting, texUltraCustomerName } from './texUltraEntryGreetingService.js';
import { TEX_ULTRA_EC_PRODUCT_PROFILE, texUltraPriceForQuantity, texUltraPublicOfferText } from './texUltraProductProfile.js';
import { interruptTexUltraInitialLayerOnInbound, startTexUltraInitialLayer } from './texUltraInitialLayerService.js';
import { sendTexUltraConfirmedPostSaleAudios } from './texUltraConfirmedPostSaleLayerService.js';

const AGENT_KEY = TEX_ULTRA_EC_PRODUCT_PROFILE.key;
export const texUltraFunnelEnabled = (env = process.env) => String(env.TEX_ULTRA_FUNNEL_ENABLED || 'false').toLowerCase() === 'true';
const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const normalize = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const stateChatId = (state = {}) => state.chatId || (state.phoneDigits ? `${digitsOnly(state.phoneDigits)}@c.us` : '');
const memoryOf = (state = {}) => state?.metadata?.perAgentMemory?.[AGENT_KEY] || {};
const draftOf = (state = {}) => state?.metadata?.customerDraft || {};

export const texUltraSelectedQuantity = (text = '') => {
    const value = normalize(text).replace(/\s+/g, ' ');
    const match = value.match(/^(1|2|3|6|un|uno|dos|tres|seis)(?:\s+(?:frasco|frascos|botella|botellas|mes|meses))?$/);
    if (!match) return 0;
    return ({ un: 1, uno: 1, dos: 2, tres: 3, seis: 6 })[match[1]] || Number(match[1]);
};

const asksPrice = (text = '') => /\b(precio|precios|valor|cuanto|costo|promo|promocion|oferta)\b/.test(normalize(text));
const asksUsage = (text = '') => /\b(como se toma|como tomar|como usar|dosis|posologia)\b/.test(normalize(text));
const affirmative = (text = '') => /^(si|correcto|confirmo|esta correcto|todo correcto|ok|listo)\b/.test(normalize(text));
const negative = (text = '') => /^(no|corregir|incorrecto|cambiar)\b/.test(normalize(text));
const looksLikeFullName = (text = '') => {
    const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
    return parts.length >= 2 && parts.length <= 6 && parts.every((part) => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'-]{2,}$/.test(part));
};

const saveState = async (state, { memory = memoryOf(state), draft = draftOf(state), stage = memory.stage || 'presentation' } = {}) => {
    const nextMemory = { ...memory, stage, updatedAt: new Date().toISOString() };
    state.assignedAgent = AGENT_KEY;
    state.countryCode = 'EC';
    if (state.human?.mode === 'manual' && String(state.human?.lastManualBy || '') === 'vsl_ec') {
        state.human = { ...state.human, mode: 'auto', lastManualBy: 'tex_ultra_funnel', note: 'Funil Tex Ultra isolado em andamento.' };
    }
    state.tags = [...new Set([...(state.tags || []), 'TEX_ULTRA_EC'])];
    state.metadata = {
        ...(state.metadata || {}),
        productKey: AGENT_KEY,
        productName: TEX_ULTRA_EC_PRODUCT_PROFILE.displayName,
        productMedia: TEX_ULTRA_EC_PRODUCT_PROFILE.bottle.media,
        customerDraft: {
            ...draft,
            country: 'EC',
            product: TEX_ULTRA_EC_PRODUCT_PROFILE.displayName,
            productKey: AGENT_KEY,
            productName: TEX_ULTRA_EC_PRODUCT_PROFILE.displayName,
            productMedia: TEX_ULTRA_EC_PRODUCT_PROFILE.bottle.media,
            updatedAt: new Date().toISOString()
        },
        perAgentMemory: {
            ...((state.metadata || {}).perAgentMemory || {}),
            [AGENT_KEY]: nextMemory
        },
        lastKnownFunnelStage: `tex_ultra_${stage}`
    };
    state.markModified('metadata');
    await state.save();
    return nextMemory;
};

const sendFunnelText = async ({ state, text, context }) => Boolean(await sendText(stateChatId(state), text, null, {
    sessionId: state?.metadata?.lastSessionId || null,
    country: 'EC',
    outboundContext: context,
    humanize: false,
    antiSpamKey: `${AGENT_KEY}:${context}:${state._id}`
}));

const sendUniversalEntryAudio = async (state) => {
    const baseName = TEX_ULTRA_EC_PRODUCT_PROFILE.entry.universalAudioName;
    const audioPath = await resolveCountryAudio({ country: 'EC', baseName });
    if (!audioPath) return false;
    return Boolean(await sendAudio(stateChatId(state), audioPath, true, {
        sessionId: state?.metadata?.lastSessionId || null,
        country: 'EC',
        outboundContext: 'tex_ultra_inicio_universal_fallback',
        dedupeValue: `${AGENT_KEY}:universal_entry:${state._id}`
    }));
};

const sendBottle = async (state) => sendImage(
    stateChatId(state),
    path.join(process.cwd(), 'public', TEX_ULTRA_EC_PRODUCT_PROFILE.bottle.media.replace(/^\/+/, '')),
    TEX_ULTRA_EC_PRODUCT_PROFILE.bottle.caption,
    { country: 'EC', sessionId: state?.metadata?.lastSessionId || null, outboundContext: 'tex_ultra_bottle' }
);

const sendSharedProof = async (state) => {
    const tail = digitsOnly(state.phoneDigits || state.chatId).slice(-1);
    const proofKey = `social_0${(Number(tail || 0) % 4) + 1}`;
    const proof = getSalesMedia(proofKey);
    if (!proof?.path) return false;
    return sendImage(stateChatId(state), proof.path, 'Le comparto una experiencia de clientes de nuestra atencion en Ecuador.', {
        country: 'EC',
        sessionId: state?.metadata?.lastSessionId || null,
        outboundContext: 'tex_ultra_shared_proof'
    });
};

const presentationText = (state = {}) => buildTexUltraEntryGreeting({
    name: texUltraCustomerName(
        draftOf(state).name,
        draftOf(state).customerName,
        state?.metadata?.notifyName,
        state?.metadata?.profileName
    )
});

const offerText = () => (
    `Hoy tenemos estas opciones de Tex Ultra:\n${texUltraPublicOfferText()}\n\n¿Cuantos frascos desea?`
);

const confirmationText = (draft = {}) => [
    '*CONFIRMACION TEX ULTRA*',
    `Nombre: ${draft.name || ''}`,
    `Ciudad: ${draft.city || ''}`,
    `Provincia: ${draft.province || ''}`,
    `Direccion/agencia: ${draft.address || ''}`,
    `Referencia: ${draft.reference || ''}`,
    `Cantidad: ${draft.quantity || ''} frasco${Number(draft.quantity) > 1 ? 's' : ''}`,
    `Total: USD ${draft.total || ''}`,
    '',
    '¿Los datos estan correctos? Responda SI para confirmar.'
].join('\n');

const createOrConfirmOrder = async (state, draft) => {
    const phone = digitsOnly(draft.phone || state.phoneDigits || state.chatId);
    let order = await Order.findOne({
        country: 'EC',
        'customer.phone': { $regex: phone.slice(-9) },
        status: { $in: ['draft', 'pending', 'confirmed'] },
        'tracking.productKey': AGENT_KEY
    }).sort({ updatedAt: -1 }).catch(() => null);
    const payload = {
        country: 'EC',
        customer: {
            name: draft.name,
            phone: phone ? `+${phone}` : '',
            address: draft.address,
            reference: draft.reference,
            city: draft.city,
            province: draft.province
        },
        package: {
            id: Number(draft.quantity),
            quantity: Number(draft.quantity),
            label: `Tex Ultra Ecuador ${draft.quantity} frasco${Number(draft.quantity) > 1 ? 's' : ''}`
        },
        total: Number(draft.total),
        currency: 'USD',
        source: 'whatsapp',
        status: 'confirmed',
        entryReason: 'new_purchase',
        notes: 'tex_ultra_ec | Dropi desabilitado ate auditoria especifica.',
        tracking: {
            ...(state.metadata?.tracking || {}),
            productKey: AGENT_KEY,
            productName: TEX_ULTRA_EC_PRODUCT_PROFILE.displayName,
            contentName: 'Tex Ultra Ecuador WhatsApp',
            contentIds: ['tex_ultra_ec'],
            sourceUrl: state.metadata?.vslSourceUrl || state.metadata?.tracking?.sourceUrl || 'https://ec.maxlien.shop/tex-ultra/'
        },
        conversationMemory: {
            currentIntent: 'purchase_confirmed',
            funnelStage: 'tex_ultra_order_confirmed',
            lastCustomerMessageAt: new Date()
        }
    };
    if (order) Object.assign(order, payload);
    else order = new Order({ ...payload, entryAt: new Date(), draftCreatedAt: new Date() });
    await order.save();

    if (!order.tracking?.metaPurchaseSentAt) {
        await enrichOrderWithMetaAttribution(order).catch(() => null);
        const result = await sendPurchaseEventForOrder(order).catch((error) => ({ ok: false, error: error.message }));
        order.tracking = order.tracking || {};
        order.tracking.metaPurchaseEventId = result.eventId || order.orderId;
        order.tracking.metaPurchaseResponse = result.ok ? result.response : { ok: false, error: result.error || 'meta_purchase_failed' };
        if (result.ok) order.tracking.metaPurchaseSentAt = new Date();
        await order.save();
    }
    return order;
};

export const handleTexUltraFunnelInbound = async ({ contactStateId = '', inboundText = '', sessionId = null } = {}) => {
    if (!texUltraFunnelEnabled()) return false;
    if (!contactStateId) return false;
    const state = await ContactState.findById(contactStateId);
    if (!state) return false;
    const explicitTex = /tex[\s_-]*ultra/i.test(inboundText);
    if (state.assignedAgent !== AGENT_KEY && state.metadata?.productKey !== AGENT_KEY && !explicitTex) return false;
    if (state.human?.mode === 'manual' && !['', 'vsl_ec', 'tex_ultra_funnel'].includes(String(state.human?.lastManualBy || ''))) return false;

    if (sessionId) state.metadata = { ...(state.metadata || {}), lastSessionId: sessionId };
    let memory = memoryOf(state);
    let draft = { ...draftOf(state), phone: draftOf(state).phone || (state.phoneDigits ? `+${digitsOnly(state.phoneDigits)}` : '') };
    const quantity = texUltraSelectedQuantity(inboundText);
    const initialLayerInbound = await interruptTexUltraInitialLayerOnInbound({ state, inboundText });
    if (initialLayerInbound.handled) return true;

    if (asksUsage(inboundText)) {
        await sendFunnelText({ state, text: 'Para no darle una indicacion incorrecta, el modo de uso de Tex Ultra sera confirmado por una asesora con base en la etiqueta oficial. ¿Desea que le muestre primero las opciones disponibles?', context: 'tex_ultra_usage_guard' });
        await saveState(state, { memory, draft, stage: memory.stage || 'awaiting_interest' });
        return true;
    }

    const dataCollectionStages = new Set(['awaiting_name', 'awaiting_city', 'awaiting_province', 'awaiting_address', 'awaiting_reference']);
    if (quantity && !dataCollectionStages.has(memory.stage)) {
        const selected = texUltraPriceForQuantity(quantity);
        if (!selected) return true;
        draft = { ...draft, quantity, total: selected.amount, status: 'atendendo' };
        await sendFunnelText({ state, text: `Perfecto: ${selected.label}. Para registrar correctamente, ¿me indica su nombre completo?`, context: `tex_ultra_quantity_${quantity}` });
        await saveState(state, { memory: { ...memory, selectedQuantity: quantity }, draft, stage: 'awaiting_name' });
        return true;
    }

    if (initialLayerInbound.interrupted) {
        if (asksPrice(inboundText)) {
            await sendFunnelText({ state, text: offerText(), context: 'tex_ultra_offer_requested_after_interrupt' });
            await saveState(state, { memory: memoryOf(state), draft, stage: 'awaiting_quantity' });
        }
        return true;
    }

    if (!memory.presentationSentAt) {
        const layered = await startTexUltraInitialLayer({ state });
        if (layered.started || layered.reason === 'flow_already_exists') return true;
        const presentationLockAt = new Date(memory.presentationSendingAt || '').getTime();
        if (Number.isFinite(presentationLockAt) && Date.now() - presentationLockAt < 120000) return true;
        memory = { ...memory, presentationSendingAt: new Date().toISOString() };
        await saveState(state, { memory, draft, stage: memory.stage || 'presentation' });
        const directOffer = asksPrice(inboundText);
        await sendFunnelText({ state, text: directOffer ? offerText() : presentationText(state), context: directOffer ? 'tex_ultra_offer' : 'tex_ultra_presentation' });
        const universalIntroSent = directOffer ? false : await sendUniversalEntryAudio(state);
        await sendBottle(state);
        await sendSharedProof(state);
        memory = {
            ...memory,
            presentationSendingAt: '',
            presentationSentAt: new Date().toISOString(),
            ...(universalIntroSent ? { universalIntroSentAt: new Date().toISOString() } : {}),
            bottleSentAt: new Date().toISOString(),
            proofSentAt: new Date().toISOString()
        };
        await saveState(state, { memory, draft, stage: directOffer ? 'awaiting_quantity' : 'awaiting_interest' });
        return true;
    }

    if ((['awaiting_interest', 'awaiting_quantity'].includes(memory.stage) && asksPrice(inboundText)) || (memory.stage === 'awaiting_interest' && affirmative(inboundText))) {
        await sendFunnelText({ state, text: offerText(), context: 'tex_ultra_offer' });
        await saveState(state, { memory: { ...memory, offerSentAt: new Date().toISOString() }, draft, stage: 'awaiting_quantity' });
        return true;
    }

    if (memory.stage === 'awaiting_name') {
        if (!looksLikeFullName(inboundText)) {
            await sendFunnelText({ state, text: 'Para evitar errores en el pedido, necesito nombre y apellido. ¿Me los confirma, por favor?', context: 'tex_ultra_name_retry' });
            return true;
        }
        draft = { ...draft, name: String(inboundText).trim() };
        await sendFunnelText({ state, text: 'Gracias. ¿En que ciudad de Ecuador desea recibir o retirar el pedido?', context: 'tex_ultra_ask_city' });
        await saveState(state, { memory, draft, stage: 'awaiting_city' });
        return true;
    }
    if (memory.stage === 'awaiting_city') {
        draft = { ...draft, city: String(inboundText).trim() };
        await sendFunnelText({ state, text: '¿A que provincia pertenece?', context: 'tex_ultra_ask_province' });
        await saveState(state, { memory, draft, stage: 'awaiting_province' });
        return true;
    }
    if (memory.stage === 'awaiting_province') {
        draft = { ...draft, province: String(inboundText).trim() };
        await sendFunnelText({ state, text: '¿Prefiere entrega a domicilio o retiro en una agencia Servientrega? Envieme la direccion o el nombre de la agencia.', context: 'tex_ultra_ask_address' });
        await saveState(state, { memory, draft, stage: 'awaiting_address' });
        return true;
    }
    if (memory.stage === 'awaiting_address') {
        draft = { ...draft, address: String(inboundText).trim() };
        await sendFunnelText({ state, text: 'Indiqueme un punto de referencia para completar la entrega.', context: 'tex_ultra_ask_reference' });
        await saveState(state, { memory, draft, stage: 'awaiting_reference' });
        return true;
    }
    if (memory.stage === 'awaiting_reference') {
        draft = { ...draft, reference: String(inboundText).trim() };
        await sendFunnelText({ state, text: confirmationText(draft), context: 'tex_ultra_confirmation' });
        await saveState(state, { memory, draft, stage: 'awaiting_confirmation' });
        return true;
    }
    if (memory.stage === 'awaiting_confirmation' && affirmative(inboundText)) {
        const order = await createOrConfirmOrder(state, draft);
        draft = { ...draft, status: 'confirmed', orderId: order.orderId };
        state.human = { ...(state.human || {}), mode: 'manual', lastManualBy: 'tex_ultra_funnel', lastManualAt: new Date(), note: 'Venda Tex Ultra confirmada; Dropi permanece bloqueado.' };
        state.tags = [...new Set([...(state.tags || []), 'VENDA_CONFIRMADA', 'DROPI_BLOQUEADO_TEX_ULTRA'])];
        await sendFunnelText({ state, text: `Pedido ${order.orderId} confirmado. Nossa equipe revisara a entrega antes de qualquer envio.`, context: 'tex_ultra_order_confirmed' });
        await saveState(state, { memory: { ...memory, orderId: order.orderId, confirmedAt: new Date().toISOString() }, draft, stage: 'confirmed' });
        await sendTexUltraConfirmedPostSaleAudios({
            contactStateId: state._id,
            orderId: order.orderId,
            sessionId: sessionId || state.metadata?.lastSessionId || null
        });
        return true;
    }
    if (memory.stage === 'awaiting_confirmation' && negative(inboundText)) {
        await sendFunnelText({ state, text: 'Claro. Diga qual dado deseja corrigir e um atendente ajustara antes da confirmacao.', context: 'tex_ultra_correction_handoff' });
        state.human = { ...(state.human || {}), mode: 'manual', lastManualBy: 'tex_ultra_funnel', lastManualAt: new Date(), note: 'Cliente pediu correcao dos dados Tex Ultra.' };
        await saveState(state, { memory, draft, stage: 'correction_handoff' });
        return true;
    }

    await sendFunnelText({ state, text: 'Sigo com usted. Para avanzar, indiqueme cuantos frascos desea: 1, 3 o 6.', context: 'tex_ultra_resume' });
    return true;
};
