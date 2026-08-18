import crypto from 'crypto';

export const LOGISTICS_STATE_V29 = Object.freeze({
    ORDER_CONFIRMED: 'ORDER_CONFIRMED',
    SHIPPED: 'SHIPPED',
    IN_TRANSIT: 'IN_TRANSIT',
    READY_FOR_PICKUP: 'READY_FOR_PICKUP',
    PICKED_UP: 'PICKED_UP',
    DELIVERED: 'DELIVERED',
    RETURNED: 'RETURNED',
    UNKNOWN: 'UNKNOWN'
});

const normalizeToken = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

const normalizeSemanticText = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const SHIPPED_RAW = new Set([
    'SHIPPED',
    'GUIA_GENERADA',
    'PREPARADO_PARA_TRANSPORTADORA',
    'ADMITIDO'
]);

const IN_TRANSIT_RAW = new Set([
    'IN_TRANSIT',
    'EN_TRANSITO',
    'EN_RUTA',
    'EN_REPARTO',
    'EN_DESPACHO',
    'EN_BODEGA_TRANSPORTADORA',
    'MERCANCIA_RECOGIDA',
    'EN_DISTRIBUCION_A_CLIENTE',
    'EN_PROCESAMIENTO',
    'INGRESANDO_EN_AGENCIA',
    'INGRESANDO_OPERATIVO_A'
]);

const ORDER_CONFIRMED_RAW = new Set([
    'ORDER_CONFIRMED',
    'CONFIRMED',
    'CONFIRMADO',
    'CREATED',
    'PENDIENTE',
    'PENDING'
]);

const READY_RAW = new Set([
    'READY_FOR_PICKUP',
    'LISTO_PARA_RETIRO',
    'DISPONIBLE_PARA_RETIRO',
    'PARA_RETIRO_EN_AGENCIA'
]);

const PICKED_UP_RAW = new Set(['PICKED_UP', 'RETIRADO', 'RECOGIDO']);
const DELIVERED_RAW = new Set(['DELIVERED', 'ENTREGADO', 'MERCANCIA_ENTREGADA']);
const RETURNED_RAW = new Set(['RETURNED', 'DEVUELTO', 'DEVOLUCION', 'NO_RETIRADO']);

export const canonicalLogisticsState = (shipmentOrStatus = {}) => {
    const shipment = typeof shipmentOrStatus === 'object' && shipmentOrStatus !== null
        ? shipmentOrStatus
        : { logistics: { status: shipmentOrStatus } };
    if (shipment.outcomes?.returned === true) return LOGISTICS_STATE_V29.RETURNED;
    if (shipment.outcomes?.delivered === true) return LOGISTICS_STATE_V29.DELIVERED;
    if (shipment.outcomes?.pickedUp === true) return LOGISTICS_STATE_V29.PICKED_UP;

    const raw = normalizeToken(shipment.logistics?.status || shipment.status || shipmentOrStatus);
    if (RETURNED_RAW.has(raw)) return LOGISTICS_STATE_V29.RETURNED;
    if (DELIVERED_RAW.has(raw)) return LOGISTICS_STATE_V29.DELIVERED;
    if (PICKED_UP_RAW.has(raw)) return LOGISTICS_STATE_V29.PICKED_UP;
    if (READY_RAW.has(raw)) return LOGISTICS_STATE_V29.READY_FOR_PICKUP;
    if (IN_TRANSIT_RAW.has(raw)) return LOGISTICS_STATE_V29.IN_TRANSIT;
    if (SHIPPED_RAW.has(raw)) return LOGISTICS_STATE_V29.SHIPPED;
    if (ORDER_CONFIRMED_RAW.has(raw)) return LOGISTICS_STATE_V29.ORDER_CONFIRMED;
    return LOGISTICS_STATE_V29.UNKNOWN;
};

export const pickupReadyIsVerified = (shipment = {}) => (
    canonicalLogisticsState(shipment) === LOGISTICS_STATE_V29.READY_FOR_PICKUP
    && shipment.logistics?.pickupReadyVerified === true
);

export const logisticsCommunicationPolicy = (shipment = {}) => {
    const state = canonicalLogisticsState(shipment);
    const pickupReadyVerified = pickupReadyIsVerified(shipment);
    const final = [
        LOGISTICS_STATE_V29.PICKED_UP,
        LOGISTICS_STATE_V29.DELIVERED,
        LOGISTICS_STATE_V29.RETURNED
    ].includes(state);
    const hasGuideStage = [
        LOGISTICS_STATE_V29.SHIPPED,
        LOGISTICS_STATE_V29.IN_TRANSIT,
        LOGISTICS_STATE_V29.READY_FOR_PICKUP,
        LOGISTICS_STATE_V29.PICKED_UP,
        LOGISTICS_STATE_V29.DELIVERED,
        LOGISTICS_STATE_V29.RETURNED
    ].includes(state);
    return Object.freeze({
        version: 29,
        state,
        pickupReadyVerified,
        final,
        allowGuideNumber: hasGuideStage,
        allowGuideImage: pickupReadyVerified && !final,
        allowGuidePdf: pickupReadyVerified && !final,
        allowPickupLanguage: pickupReadyVerified && !final,
        allowPickupAudio: pickupReadyVerified && !final,
        allowReminders: pickupReadyVerified && !final,
        blockReason: pickupReadyVerified || final
            ? ''
            : (state === LOGISTICS_STATE_V29.READY_FOR_PICKUP
                ? 'pickup_ready_not_verified'
                : 'shipment_not_ready_for_pickup')
    });
};

const EARLY_PICKUP_LANGUAGE = /\b(?:ya\s+(?:lo\s+)?puede\s+(?:retirar|recoger)|puede\s+(?:acercarse|retirar|recoger)|acerquese\s+(?:a|en)|vaya\s+a\s+la\s+agencia|esta\s+(?:listo|disponible)\s+para\s+(?:retiro|retirar|recoger)|pedido\s+(?:listo|disponible)\s+para\s+(?:retiro|retirar)|(?:su\s+)?pedido\s+(?:ya\s+)?esta\s+disponible|ya\s+esta\s+en\s+agencia|ya\s+puede\s+ir|cliente\s+ya\s+puede\s+ir)\b/i;

export const containsPickupAuthorizationLanguage = (text = '') => (
    EARLY_PICKUP_LANGUAGE.test(normalizeSemanticText(text))
);

export const isGuideMediaCandidate = ({ fileName = '', mediaUrl = '', body = '', outboundContext = '' } = {}) => {
    const value = normalizeSemanticText([fileName, mediaUrl, body, outboundContext].filter(Boolean).join(' '));
    return /\b(?:guia|guia[-_ ]?print|factura|invoice|tracking|rastreo)\b/.test(value)
        || /shipment_(?:invoice|guide)/.test(value);
};

export const evaluateLogisticsOutbound = (shipment = {}, {
    text = '',
    mediaKind = '',
    fileName = '',
    mediaUrl = '',
    outboundContext = '',
    pickupAudio = false
} = {}) => {
    const policy = logisticsCommunicationPolicy(shipment);
    if (containsPickupAuthorizationLanguage(text) && !policy.allowPickupLanguage) {
        return { allowed: false, reason: policy.blockReason || 'pickup_language_blocked', policy };
    }
    if (pickupAudio && !policy.allowPickupAudio) {
        return { allowed: false, reason: policy.blockReason || 'pickup_audio_blocked', policy };
    }
    const guideMedia = isGuideMediaCandidate({ fileName, mediaUrl, body: text, outboundContext });
    if (guideMedia && ['image', 'document', 'pdf'].includes(String(mediaKind || '').toLowerCase())) {
        const allowed = String(mediaKind || '').toLowerCase() === 'image'
            ? policy.allowGuideImage
            : policy.allowGuidePdf;
        if (!allowed) return { allowed: false, reason: policy.blockReason || 'guide_media_blocked', policy };
    }
    return { allowed: true, reason: 'allowed', policy };
};

const safeName = (shipment = {}) => String(shipment.client?.name || 'cliente').trim() || 'cliente';
const safeGuide = (shipment = {}) => String(shipment.logistics?.trackingNumber || '').trim();

export const buildShippedCommunicationV29 = (shipment = {}) => (
    `Hola, ${safeName(shipment)}. Su pedido ya fue enviado por Servientrega 📦. `
    + `Su número de guía para seguimiento es ${safeGuide(shipment)}. `
    + 'Por favor, no vaya todavía a la agencia. Le avisaremos por aquí apenas esté disponible para retiro.'
);

export const buildReadyForPickupCommunicationV29 = (shipment = {}) => (
    `Hola, ${safeName(shipment)}. ¡Su pedido ya está disponible para retiro en Servientrega! ✅ `
    + `Puede acercarse a la agencia desde ahora. Guía: ${safeGuide(shipment)}. `
    + 'Le recomiendo retirarlo lo antes posible para evitar la devolución.'
);

export const buildEarlyPickupCorrectionV29 = (shipment = {}) => (
    `Disculpe la confusión, ${safeName(shipment)}. Su pedido fue enviado, pero todavía no estaba habilitado para retiro en la agencia. `
    + 'No necesita volver todavía. En cuanto Servientrega lo confirme como disponible, le avisaremos por aquí para que pueda ir con seguridad y no pierda tiempo nuevamente.'
);

export const buildPickupReminderV29 = (shipment = {}, reminder = 1) => {
    const guide = safeGuide(shipment);
    if (Number(reminder) === 1) {
        return `Hola, ${safeName(shipment)}. Su pedido continúa disponible en Servientrega. Si puede, le recomiendo retirarlo hoy. Guía: ${guide}.`;
    }
    return `Hola, ${safeName(shipment)}. Su pedido continúa disponible para retiro en Servientrega y se acerca el plazo de devolución. Por favor, retírelo cuanto antes. Guía: ${guide}.`;
};

export const publicLogisticsStateV29 = (shipment = null) => {
    if (!shipment) return null;
    const policy = logisticsCommunicationPolicy(shipment);
    return {
        version: 29,
        orderId: shipment.orderId || '',
        status: policy.state,
        rawStatus: shipment.logistics?.status || '',
        trackingNumber: shipment.logistics?.trackingNumber || '',
        agencyPickup: Boolean(shipment.logistics?.agencyPickup),
        agencyName: shipment.logistics?.agencyName || '',
        pickupReadyVerified: policy.pickupReadyVerified,
        pickupReadyVerifiedAt: shipment.logistics?.pickupReadyVerifiedAt || null,
        pickupReadyVerifiedSource: shipment.logistics?.pickupReadyVerifiedSource || '',
        allowGuideNumber: policy.allowGuideNumber,
        allowGuideImage: policy.allowGuideImage,
        allowPickupLanguage: policy.allowPickupLanguage,
        allowPickupAudio: policy.allowPickupAudio,
        allowReminders: policy.allowReminders,
        final: policy.final,
        blockReason: policy.blockReason
    };
};

export const buildNotificationLedgerEntryV29 = ({
    shipment = {},
    notificationType = '',
    templateVersion = 'v29',
    source = 'shipment_automation',
    mode = 'automatic',
    blockedReason = '',
    providerMessageId = '',
    sentAt = null,
    deliveredAt = null,
    readAt = null,
    now = new Date()
} = {}) => ({
    notification_id: crypto.randomUUID(),
    order_id: shipment.orderId || '',
    notification_type: notificationType,
    logistics_status: canonicalLogisticsState(shipment),
    pickup_ready_verified: pickupReadyIsVerified(shipment),
    template_version: templateVersion,
    created_at: now,
    sent_at: sentAt,
    delivered_at: deliveredAt,
    read_at: readAt,
    source,
    mode: mode === 'manual' ? 'manual' : 'automatic',
    blocked_reason: blockedReason,
    provider_message_id: providerMessageId
});
