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
import { sendTexUltraHowToUseAudio } from './texUltraHowToUseAudioService.js';
import {
    assertCustomerOrderDataReady,
    CUSTOMER_DATA_STATUS,
    resolveCustomerDataDraft
} from './customerDataResolutionService.js';

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

const officialVslEntryLine = (value = '') => normalize(value)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const safeVslPersonOrLocation = (value = '', maxLength = 80) => {
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    if (!clean || clean.length > maxLength) return '';
    return /^[\p{L}][\p{L}\s.'’-]*$/u.test(clean) ? clean : '';
};

export const texUltraVslPayloadData = (text = '') => {
    const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (officialVslEntryLine(lines[0]) !== 'hola quiero el tratamiento') return null;

    const fields = {};
    for (const line of lines.slice(1)) {
        const match = line.match(/^([^:：]{2,24})\s*[:：]\s*(.+)$/u);
        if (!match) continue;
        const label = normalize(match[1]).replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
        const value = safeVslPersonOrLocation(match[2]);
        if (!value) continue;
        if (/^(?:nombre|nombre completo)$/.test(label)) fields.name = value;
        else if (label === 'ciudad') fields.city = value;
        else if (label === 'provincia') fields.province = value;
    }
    return Object.keys(fields).length ? fields : null;
};

export const mergeTexUltraVslPayloadDraft = (draft = {}, payload = {}, capturedAt = new Date().toISOString()) => {
    const next = { ...draft };
    const capturedFields = [];
    for (const field of ['name', 'city', 'province']) {
        if (!String(next[field] || '').trim() && String(payload[field] || '').trim()) {
            next[field] = payload[field];
            capturedFields.push(field);
        }
    }
    if (!capturedFields.length) return next;
    return {
        ...next,
        vslPayloadSource: 'official_multiline_cta',
        vslPayloadCapturedAt: draft.vslPayloadCapturedAt || capturedAt,
        vslPayloadFields: [...new Set([...(draft.vslPayloadFields || []), ...capturedFields])]
    };
};

export const texUltraNextDataCollectionStep = (draft = {}) => {
    if (!String(draft.name || '').trim()) return {
        stage: 'awaiting_name',
        context: 'tex_ultra_ask_name',
        text: 'Para registrar correctamente, ¿me indica su nombre completo?'
    };
    if (!String(draft.city || '').trim()) return {
        stage: 'awaiting_city',
        context: 'tex_ultra_ask_city',
        text: '¿En que ciudad de Ecuador desea recibir o retirar el pedido?'
    };
    if (!String(draft.province || '').trim()) return {
        stage: 'awaiting_province',
        context: 'tex_ultra_ask_province',
        text: '¿A que provincia pertenece?'
    };
    if (!String(draft.address || '').trim()) return {
        stage: 'awaiting_address',
        context: 'tex_ultra_ask_address',
        text: 'Ya tengo su nombre, ciudad y provincia. ¿Prefiere entrega a domicilio o retiro en una agencia Servientrega? Envieme la direccion o el nombre de la agencia.'
    };
    if (!String(draft.reference || '').trim()) return {
        stage: 'awaiting_reference',
        context: 'tex_ultra_ask_reference',
        text: 'Indiqueme un punto de referencia para completar la entrega.'
    };
    return { stage: 'awaiting_confirmation', context: 'tex_ultra_confirmation', text: '' };
};

export const texUltraSelectedQuantity = (text = '') => {
    const value = normalize(text).replace(/\s+/g, ' ');
    const match = value.match(/^(1|2|3|6|un|uno|dos|tres|seis)(?:\s+(?:frasco|frascos|botella|botellas|mes|meses))?$/)
        || value.match(/\b(1|2|3|6|un|uno|dos|tres|seis)\s+(?:frasco|frascos|botella|botellas)\b/);
    if (!match) return 0;
    return ({ un: 1, uno: 1, dos: 2, tres: 3, seis: 6 })[match[1]] || Number(match[1]);
};

const asksPrice = (text = '') => /\b(precio|precios|valor|cuanto|costo|promo|promocion|oferta)\b/.test(normalize(text));
const asksUsage = (text = '') => /\b(como se toma|como se usa|como tomar|como usar|modo de uso|dosis|posologia)\b/.test(normalize(text));
export const texUltraStrongPurchaseIntent = (text = '') => {
    const value = normalize(text)
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return [
        /\b(?:quiero|deseo|necesito|busco)\s+(?:(?:el|un|este|ese)\s+)?(?:tratamiento|producto|tex ultra)\b/,
        /\b(?:lo|la)\s+(?:quiero|deseo|necesito)\b/,
        /\b(?:quiero|deseo)\s+(?:comprar|pedir|ordenar|adquirir)(?:lo)?\b/,
        /\bme interesa(?:\s+(?:el|este))?\s+(?:tratamiento|producto|tex ultra)\b/
    ].some((pattern) => pattern.test(value));
};
export const texUltraInboundNeedsHuman = (text = '') => {
    const value = normalize(text)
        .replace(/[^\p{L}\p{N}\s?¿]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return /[?¿]/.test(value)
        || /\b(?:quiero saber|necesito saber|tengo una pregunta|tengo una duda|puedo|puede|podria|funciona|sirve|contiene|es seguro|que pasa|por que|cuando|donde|quien)\b/.test(value);
};
const affirmative = (text = '') => /^(si|correcto|confirmo|esta correcto|todo correcto|ok|listo)\b/.test(normalize(text));
const negative = (text = '') => /^(no|corregir|incorrecto|cambiar)\b/.test(normalize(text));
const acceptedResolvedName = (resolution = {}) => ['VERIFIED', 'HIGH_CONFIDENCE'].includes(resolution?.fields?.name?.validation_status);

export const texUltraDeliveryData = (text = '') => {
    const raw = String(text || '').trim();
    const normalized = normalize(raw);
    if (/\b(agencia|servientrega|oficina|retiro|retirar)\b/.test(normalized)) {
        return { deliveryMode: 'agency', agencyName: raw, address: raw };
    }
    if (/\b(domicilio|casa|residencia|calle|avenida|av\.?|barrio|sector|manzana|mz\.?|edificio|departamento)\b/.test(normalized)) {
        return { deliveryMode: 'home', address: raw };
    }
    return { deliveryMode: '', address: raw };
};

const resolveTexUltraDraft = ({ state, draft, source, sourceMessageId = '', confirmedByCustomerFields = [] }) => {
    const result = resolveCustomerDataDraft({
        draft,
        previousResolution: state.customerDataResolution?.version ? state.customerDataResolution.toObject?.() || state.customerDataResolution : null,
        conversationPhone: state.phoneDigits || state.chatId || draft.phone || '',
        source,
        sourceMessageId,
        confirmedByCustomerFields
    });
    state.customerDataResolution = result.resolution;
    state.markModified('customerDataResolution');
    return result;
};

const dataGatePrompt = (resolution = {}) => {
    const reason = resolution.blockedReasons?.[0] || '';
    if (reason === 'NAME_SEGMENTATION_REQUIRED' || reason === 'NAME_NOT_RESOLVED') {
        return 'Para registrar correctamente su pedido, ¿me confirma por favor su nombre completo, con nombres y apellidos separados?';
    }
    if (reason === 'CITY_NOT_CANONICAL' || reason === 'LOCATION_CONFLICT' || reason === 'PROVINCE_NOT_RESOLVED') {
        return 'Antes de confirmar, necesito corregir la ciudad y la provincia. ¿Me las indica nuevamente, por favor?';
    }
    if (reason === 'DELIVERY_MODE_REQUIRED') return '¿Prefiere entrega a domicilio o retiro en una agencia Servientrega?';
    if (reason === 'HOME_ADDRESS_REQUIRED') return 'Envíeme por favor la dirección completa para la entrega a domicilio.';
    if (reason === 'AUTHORIZED_AGENCY_REQUIRED' || reason === 'AGENCY_LOCATION_CONFLICT') {
        return 'Necesito una agencia Servientrega autorizada de su ciudad. Envíeme el nombre exacto de la agencia, por favor.';
    }
    return 'Antes de confirmar, un asesor revisará los datos que todavía necesitan validación.';
};

const dataGateStage = (resolution = {}) => {
    const reason = resolution.blockedReasons?.[0] || '';
    if (reason === 'NAME_SEGMENTATION_REQUIRED' || reason === 'NAME_NOT_RESOLVED') return 'awaiting_name_resolution';
    if (reason === 'CITY_NOT_CANONICAL' || reason === 'LOCATION_CONFLICT' || reason === 'PROVINCE_NOT_RESOLVED') return 'awaiting_city';
    if (['DELIVERY_MODE_REQUIRED', 'HOME_ADDRESS_REQUIRED', 'AUTHORIZED_AGENCY_REQUIRED', 'AGENCY_LOCATION_CONFLICT'].includes(reason)) return 'awaiting_address';
    return 'data_quality_handoff';
};

const saveState = async (state, { memory = memoryOf(state), draft = draftOf(state), stage = memory.stage || 'presentation' } = {}) => {
    const nextMemory = { ...memory, stage, updatedAt: new Date().toISOString() };
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

export const texUltraInterruptedInboundRoute = (text = '') => {
    if (texUltraSelectedQuantity(text)) return 'quantity';
    if (asksUsage(text)) return 'usage';
    if (asksPrice(text)) return 'price';
    if (texUltraStrongPurchaseIntent(text)) return 'purchase';
    return 'human';
};

const purchaseIntentPrompt = () => (
    '¡Perfecto! Para continuar con su pedido de Tex Ultra, ¿qué opción desea reservar: 1, 2, 3 o 6 frascos?'
);

const holdInterruptedTexUltraQuestionForHuman = async ({ state, inboundText = '', draft = draftOf(state) }) => {
    const now = new Date();
    const pausedMemory = memoryOf(state);
    state.human = {
        ...(state.human || {}),
        mode: 'manual',
        pausedUntil: null,
        assignedName: 'Atendimento Tex Ultra EC',
        lastManualAt: now,
        lastManualBy: 'tex_ultra_customer_question',
        note: 'Cliente interrompeu a cadencia com uma duvida; funil pausado para resposta humana.'
    };
    state.tags = [...new Set([...(state.tags || []), 'AGUARDANDO_ATENDIMENTO', 'TEX_ULTRA_DUVIDA_CLIENTE'])];
    state.metadata = {
        ...(state.metadata || {}),
        automationHandoffSuggestedReason: 'tex_ultra_customer_question',
        automationHandoffSuggestedAt: now,
        automationHandoffSuggestedNote: String(inboundText || '').slice(0, 700)
    };
    await saveState(state, {
        memory: {
            ...pausedMemory,
            customerQuestionAt: now.toISOString(),
            customerQuestionText: String(inboundText || '').slice(0, 700)
        },
        draft,
        stage: 'question_handoff'
    });
    await sendFunnelText({
        state,
        text: 'Gracias por su pregunta. Detuve los demás mensajes para atender primero su duda. Ya la reviso y continúo con usted por aquí.',
        context: 'tex_ultra_customer_question_handoff'
    });
    return true;
};

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
    const resolution = state.customerDataResolution?.toObject?.() || state.customerDataResolution || {};
    assertCustomerOrderDataReady(resolution);
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
        delivery: {
            mode: draft.deliveryMode || '',
            agencyId: draft.agencyId || '',
            agencyName: draft.agencyName || ''
        },
        customerDataResolution: resolution,
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

export const handleTexUltraFunnelInbound = async ({ contactStateId = '', inboundText = '', sessionId = null, sourceMessageId = '' } = {}) => {
    if (!texUltraFunnelEnabled()) return false;
    if (!contactStateId) return false;
    const state = await ContactState.findById(contactStateId);
    if (!state) return false;
    const explicitTex = /tex[\s_-]*ultra/i.test(inboundText);
    if (state.metadata?.productKey !== AGENT_KEY && !explicitTex) return false;
    if (state.human?.mode === 'manual' && !['', 'vsl_ec', 'tex_ultra_funnel'].includes(String(state.human?.lastManualBy || ''))) return false;

    if (sessionId) state.metadata = { ...(state.metadata || {}), lastSessionId: sessionId };
    let memory = memoryOf(state);
    let draft = { ...draftOf(state), phone: draftOf(state).phone || (state.phoneDigits ? `+${digitsOnly(state.phoneDigits)}` : '') };
    const vslPayload = texUltraVslPayloadData(inboundText);

    if (memory.stage === 'awaiting_name_resolution' && !vslPayload) {
        const resolved = resolveTexUltraDraft({
            state,
            draft: { ...draft, name: String(inboundText || '').trim(), name_raw: String(inboundText || '').trim() },
            source: 'customer_confirmation',
            sourceMessageId,
            confirmedByCustomerFields: ['name']
        });
        draft = resolved.draft;
        if (!acceptedResolvedName(resolved.resolution)) {
            state.human = {
                ...(state.human || {}),
                mode: 'manual',
                pausedUntil: null,
                lastManualAt: new Date(),
                lastManualBy: 'customer_data_resolution_v28',
                note: 'Nome continuou ambiguo após a única pergunta automática; revisão humana obrigatória.'
            };
            state.tags = [...new Set([...(state.tags || []), 'CUSTOMER_DATA_REVIEW', 'NAME_REVIEW_REQUIRED'])];
            await saveState(state, { memory, draft, stage: 'name_resolution_handoff' });
            return true;
        }
        memory = await saveState(state, {
            memory: { ...memory, nameConfirmedAt: new Date().toISOString(), nameConfirmationMessageId: sourceMessageId },
            draft,
            stage: 'presentation'
        });
    }

    if (vslPayload) {
        const mergedDraft = mergeTexUltraVslPayloadDraft(draft, vslPayload);
        const resolved = resolveTexUltraDraft({ state, draft: mergedDraft, source: 'explicit_label', sourceMessageId });
        draft = resolved.draft;
        memory = await saveState(state, { memory, draft, stage: memory.stage || 'presentation' });
        if (resolved.resolution.fields?.name?.validation_status === CUSTOMER_DATA_STATUS.SEGMENTATION_REQUIRED) {
            if (!memory.nameSegmentationQuestionSentAt) {
                const sent = await sendFunnelText({
                    state,
                    text: 'Para registrar correctamente su pedido, ¿me confirma por favor su nombre completo, con nombres y apellidos separados?',
                    context: 'tex_ultra_name_segmentation_v28'
                });
                if (sent) memory.nameSegmentationQuestionSentAt = new Date().toISOString();
            }
            await saveState(state, { memory, draft, stage: 'awaiting_name_resolution' });
            return true;
        }
    }
    const quantity = texUltraSelectedQuantity(inboundText);
    const initialLayerInbound = await interruptTexUltraInitialLayerOnInbound({ state, inboundText });
    const interruptedInboundRoute = texUltraInterruptedInboundRoute(inboundText);
    memory = memoryOf(state);
    if (initialLayerInbound.handled) return true;

    if (interruptedInboundRoute === 'usage') {
        const usageAudio = await sendTexUltraHowToUseAudio({ state });
        const usageRequestedAt = new Date().toISOString();
        if (usageAudio.reason === 'already_sent') {
            await sendFunnelText({
                state,
                text: 'El audio oficial con el modo de uso de Tex Ultra ya está disponible arriba en esta conversación.',
                context: 'tex_ultra_usage_audio_already_sent'
            });
        } else if (!usageAudio.sent) {
            await sendFunnelText({
                state,
                text: 'Para no darle una indicacion incorrecta, el modo de uso de Tex Ultra sera confirmado por una asesora con base en la etiqueta oficial.',
                context: 'tex_ultra_usage_audio_unavailable'
            });
        }
        await saveState(state, {
            memory: {
                ...memory,
                howToUseAudio: {
                    ...(memory.howToUseAudio || {}),
                    baseName: usageAudio.baseName,
                    status: usageAudio.sent ? 'sent' : usageAudio.reason,
                    requestedAt: usageRequestedAt,
                    ...((usageAudio.sent || usageAudio.sentAt) ? { sentAt: usageAudio.sentAt || usageRequestedAt } : {})
                }
            },
            draft,
            stage: memory.stage || 'awaiting_interest'
        });
        return true;
    }

    const dataCollectionStages = new Set(['awaiting_name', 'awaiting_name_resolution', 'awaiting_city', 'awaiting_province', 'awaiting_address', 'awaiting_reference']);
    if (interruptedInboundRoute === 'quantity' && quantity && !dataCollectionStages.has(memory.stage)) {
        const selected = texUltraPriceForQuantity(quantity);
        if (!selected) return true;
        draft = { ...draft, quantity, total: selected.amount, status: 'atendendo' };
        const nextStep = texUltraNextDataCollectionStep(draft);
        await sendFunnelText({
            state,
            text: nextStep.stage === 'awaiting_confirmation'
                ? confirmationText(draft)
                : `Perfecto: ${selected.label}. ${nextStep.text}`,
            context: nextStep.stage === 'awaiting_confirmation' ? nextStep.context : `tex_ultra_quantity_${quantity}_${nextStep.stage}`
        });
        await saveState(state, { memory: { ...memory, selectedQuantity: quantity }, draft, stage: nextStep.stage });
        return true;
    }

    if (initialLayerInbound.interrupted) {
        if (interruptedInboundRoute === 'price') {
            await sendFunnelText({ state, text: offerText(), context: 'tex_ultra_offer_requested_after_interrupt' });
            await saveState(state, { memory: memoryOf(state), draft, stage: 'awaiting_quantity' });
            return true;
        }
        if (interruptedInboundRoute === 'purchase') {
            await sendFunnelText({ state, text: purchaseIntentPrompt(), context: 'tex_ultra_purchase_intent_after_interrupt' });
            await saveState(state, { memory: memoryOf(state), draft, stage: 'awaiting_quantity' });
            return true;
        }
        return holdInterruptedTexUltraQuestionForHuman({ state, inboundText, draft });
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

    if (['awaiting_interest', 'awaiting_quantity'].includes(memory.stage) && interruptedInboundRoute === 'purchase') {
        await sendFunnelText({ state, text: purchaseIntentPrompt(), context: 'tex_ultra_purchase_intent_after_offer' });
        await saveState(state, { memory, draft, stage: 'awaiting_quantity' });
        return true;
    }

    if (!dataCollectionStages.has(memory.stage)
        && interruptedInboundRoute === 'human'
        && texUltraInboundNeedsHuman(inboundText)) {
        return holdInterruptedTexUltraQuestionForHuman({ state, inboundText, draft });
    }

    if (memory.stage === 'awaiting_name') {
        const resolved = resolveTexUltraDraft({
            state,
            draft: { ...draft, name: String(inboundText).trim(), name_raw: String(inboundText).trim() },
            source: 'customer_confirmation',
            sourceMessageId,
            confirmedByCustomerFields: ['name']
        });
        draft = resolved.draft;
        if (!acceptedResolvedName(resolved.resolution)) {
            await sendFunnelText({ state, text: dataGatePrompt(resolved.resolution), context: 'tex_ultra_name_retry' });
            await saveState(state, { memory, draft, stage: 'awaiting_name' });
            return true;
        }
        await sendFunnelText({ state, text: 'Gracias. ¿En que ciudad de Ecuador desea recibir o retirar el pedido?', context: 'tex_ultra_ask_city' });
        await saveState(state, { memory, draft, stage: 'awaiting_city' });
        return true;
    }
    if (memory.stage === 'awaiting_city') {
        const resolved = resolveTexUltraDraft({
            state,
            draft: { ...draft, city: String(inboundText).trim(), city_raw: String(inboundText).trim() },
            source: 'customer_confirmation',
            sourceMessageId,
            confirmedByCustomerFields: ['city']
        });
        draft = resolved.draft;
        if (!['VERIFIED', 'CANONICAL'].includes(resolved.resolution.fields?.city?.validation_status)) {
            await sendFunnelText({ state, text: 'No pude validar esa ciudad en Ecuador. ¿Me confirma la ciudad nuevamente?', context: 'tex_ultra_city_retry_v28' });
            await saveState(state, { memory, draft, stage: 'awaiting_city' });
            return true;
        }
        if (resolved.resolution.fields?.province?.validation_status === CUSTOMER_DATA_STATUS.AUTO_FROM_CITY) {
            await sendFunnelText({ state, text: 'Gracias. ¿Prefiere entrega a domicilio o retiro en una agencia Servientrega? Envieme la direccion o el nombre de la agencia.', context: 'tex_ultra_ask_address' });
            await saveState(state, { memory, draft, stage: 'awaiting_address' });
            return true;
        }
        await sendFunnelText({ state, text: '¿A que provincia pertenece?', context: 'tex_ultra_ask_province' });
        await saveState(state, { memory, draft, stage: 'awaiting_province' });
        return true;
    }
    if (memory.stage === 'awaiting_province') {
        const resolved = resolveTexUltraDraft({
            state,
            draft: { ...draft, province: String(inboundText).trim(), province_raw: String(inboundText).trim() },
            source: 'customer_confirmation',
            sourceMessageId,
            confirmedByCustomerFields: ['province']
        });
        draft = resolved.draft;
        if (resolved.resolution.conflicts?.length || !['VERIFIED', 'CANONICAL', 'AUTO_FROM_CITY'].includes(resolved.resolution.fields?.province?.validation_status)) {
            await sendFunnelText({ state, text: 'La ciudad y la provincia no coinciden en el registro de Ecuador. ¿Me confirma ambas nuevamente?', context: 'tex_ultra_location_conflict_v28' });
            await saveState(state, { memory, draft: { ...draft, city: '', city_raw: '', province: '', province_raw: '' }, stage: 'awaiting_city' });
            return true;
        }
        await sendFunnelText({ state, text: '¿Prefiere entrega a domicilio o retiro en una agencia Servientrega? Envieme la direccion o el nombre de la agencia.', context: 'tex_ultra_ask_address' });
        await saveState(state, { memory, draft, stage: 'awaiting_address' });
        return true;
    }
    if (memory.stage === 'awaiting_address') {
        const delivery = texUltraDeliveryData(inboundText);
        const resolved = resolveTexUltraDraft({
            state,
            draft: { ...draft, ...delivery, address_raw: String(inboundText).trim() },
            source: 'customer_confirmation',
            sourceMessageId,
            confirmedByCustomerFields: ['deliveryMode', 'address', ...(delivery.deliveryMode === 'agency' ? ['agency'] : [])]
        });
        draft = resolved.draft;
        if (!draft.deliveryMode) {
            await sendFunnelText({ state, text: '¿Prefiere domicilio o agencia Servientrega? Indique primero una de esas dos opciones.', context: 'tex_ultra_delivery_mode_retry_v28' });
            await saveState(state, { memory, draft, stage: 'awaiting_address' });
            return true;
        }
        if (draft.deliveryMode === 'agency' && resolved.resolution.fields?.agency?.validation_status !== CUSTOMER_DATA_STATUS.VERIFIED) {
            await sendFunnelText({ state, text: 'No pude validar esa agencia en el catálogo autorizado. Envíeme el nombre exacto de la agencia Servientrega de su ciudad.', context: 'tex_ultra_agency_retry_v28' });
            await saveState(state, { memory, draft, stage: 'awaiting_address' });
            return true;
        }
        await sendFunnelText({ state, text: 'Indiqueme un punto de referencia para completar la entrega.', context: 'tex_ultra_ask_reference' });
        await saveState(state, { memory, draft, stage: 'awaiting_reference' });
        return true;
    }
    if (memory.stage === 'awaiting_reference') {
        const resolved = resolveTexUltraDraft({
            state,
            draft: { ...draft, reference: String(inboundText).trim(), reference_raw: String(inboundText).trim() },
            source: 'customer_confirmation',
            sourceMessageId,
            confirmedByCustomerFields: ['reference']
        });
        draft = resolved.draft;
        await sendFunnelText({ state, text: confirmationText(draft), context: 'tex_ultra_confirmation' });
        await saveState(state, { memory, draft, stage: 'awaiting_confirmation' });
        return true;
    }
    if (memory.stage === 'awaiting_confirmation' && affirmative(inboundText)) {
        const resolution = state.customerDataResolution?.toObject?.() || state.customerDataResolution || {};
        if (resolution.orderDataReady !== true) {
            await sendFunnelText({ state, text: dataGatePrompt(resolution), context: 'tex_ultra_order_data_gate_v28' });
            const nextStage = dataGateStage(resolution);
            if (nextStage === 'data_quality_handoff') {
                state.human = { ...(state.human || {}), mode: 'manual', pausedUntil: null, lastManualAt: new Date(), lastManualBy: 'customer_data_resolution_v28', note: 'Pedido bloqueado pelo gate V28; revisão humana necessária.' };
            }
            await saveState(state, { memory, draft, stage: nextStage });
            return true;
        }
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

    await sendFunnelText({ state, text: 'Sigo con usted. Para avanzar, indíqueme cuántos frascos desea: 1, 2, 3 o 6.', context: 'tex_ultra_resume' });
    return true;
};
