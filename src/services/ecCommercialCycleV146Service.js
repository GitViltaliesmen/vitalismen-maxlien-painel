const clean = (value = '') => String(value ?? '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');

export const V146_TERMINAL_ORDER_STATUSES = new Set(['delivered', 'cancelled', 'canceled', 'returned']);
export const V146_FRESH_CYCLE_STATUSES = new Set(['recompra', 'novo', 'atendendo', 'confirmado']);

export const isTerminalOrderV146 = (order = null) => (
    Boolean(order?.orderId) && V146_TERMINAL_ORDER_STATUSES.has(clean(order?.status).toLowerCase())
);

export const isRepurchaseOrderV146 = (order = null, previousOrderId = '') => Boolean(
    order?.orderId
    && clean(order?.previousOrderId)
    && (!previousOrderId || clean(order.previousOrderId) === clean(previousOrderId))
    && clean(order?.entryReason) === 'repeat_purchase_after_delivered'
);

export const freshCycleOrderIdV146 = ({ previousOrderId = '', now = Date.now(), random = Math.random() } = {}) => {
    const stamp = Number(now).toString(36).toUpperCase();
    const suffix = Math.floor(Number(random || 0) * 1679616).toString(36).toUpperCase().padStart(4, '0').slice(-4);
    const lineage = clean(previousOrderId).replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase();
    return `EC-RECOMPRA-${stamp}-${lineage || suffix}-${suffix}`;
};

/**
 * Starts a fresh commercial cycle without copying order-scoped information.
 * Name, phone, city and province identify the customer. Address, reference,
 * delivery, agency, quantity and total belong to the new order and start empty.
 */
export const freshCommercialCycleDraftV146 = ({
    draft = {},
    previousOrder = null,
    newOrderId = '',
    status = 'recompra',
    entryReason = 'repeat_purchase_after_delivered',
    updatedAt = new Date().toISOString()
} = {}) => {
    const previousOrderId = clean(previousOrder?.orderId || draft.previousOrderId || draft.sourceOrderId || draft.historicalOrderId);
    const customer = previousOrder?.customer || {};
    const explicitProductKey = clean(draft.productKey || draft.negotiationProductKey);
    const explicitProductName = clean(draft.productName || draft.product);
    const explicitProductMedia = clean(draft.productMedia);
    const orderId = clean(newOrderId);

    return {
        name: clean(draft.name || customer.name),
        phone: clean(draft.phone || customer.phone),
        city: clean(draft.city || customer.city),
        province: clean(draft.province || customer.province),
        country: clean(draft.country || previousOrder?.country || 'EC').toUpperCase(),
        address: '',
        reference: '',
        deliveryMode: '',
        agencyId: '',
        agencyName: '',
        quantity: '',
        total: '',
        orderId,
        currentNegotiationOrderId: orderId,
        previousOrderId,
        sourceOrderId: previousOrderId,
        historicalOrderId: previousOrderId,
        status: clean(status).toLowerCase() || 'recompra',
        entryReason: clean(entryReason) || 'repeat_purchase_after_delivered',
        newCommercialCycle: true,
        orderScopedFieldsResetAt: updatedAt,
        updatedAt,
        ...(explicitProductKey ? {
            productKey: explicitProductKey,
            negotiationProductKey: explicitProductKey
        } : {}),
        ...(explicitProductName ? {
            product: explicitProductName,
            productName: explicitProductName,
            negotiationProductName: explicitProductName
        } : {}),
        ...(explicitProductMedia ? { productMedia: explicitProductMedia } : {})
    };
};

export const repeatPurchasePendingOrderV146 = ({ shipment = null, peerPhone = '' } = {}) => {
    const client = shipment?.client || {};
    return {
        name: clean(client.name),
        phone: clean(client.phone || peerPhone),
        province: clean(client.province),
        city: clean(client.city),
        address: '',
        reference: '',
        deliveryMode: '',
        agencyId: '',
        agencyName: '',
        agencyAddress: '',
        agencyValidated: false,
        quantity: '',
        total: '',
        previousOrderId: clean(shipment?.orderId),
        previousTrackingNumber: clean(shipment?.logistics?.trackingNumber),
        source: 'repeat_purchase_after_delivered',
        stage: 'awaiting_quantity_data',
        funnelStage: 'awaiting_quantity_data',
        conversationSummary: 'Cliente voltou apos entrega/retirada confirmada. Historico preservado; solicitar novos dados do pedido.'
    };
};

export const botRepurchaseEligibilityV146 = ({ human = {}, explicitNewPurchase = false, delivered = false } = {}) => {
    const pausedUntil = human?.pausedUntil ? new Date(human.pausedUntil).getTime() : 0;
    const humanTakeover = clean(human?.mode).toLowerCase() === 'manual'
        && (!pausedUntil || pausedUntil > Date.now());
    if (humanTakeover) return Object.freeze({ eligible: false, reason: 'human_takeover_active', botSends: 0 });
    if (!delivered) return Object.freeze({ eligible: false, reason: 'no_delivered_history', botSends: 0 });
    if (!explicitNewPurchase) return Object.freeze({ eligible: false, reason: 'no_new_commercial_intent', botSends: 0 });
    return Object.freeze({ eligible: true, reason: 'new_commercial_cycle_allowed', botSends: null });
};

export const sameCustomerPhoneV146 = (left = '', right = '') => {
    const a = digitsOnly(left).slice(-9);
    const b = digitsOnly(right).slice(-9);
    return Boolean(a && b && a === b);
};

export default {
    botRepurchaseEligibilityV146,
    freshCommercialCycleDraftV146,
    freshCycleOrderIdV146,
    isRepurchaseOrderV146,
    isTerminalOrderV146,
    repeatPurchasePendingOrderV146,
    sameCustomerPhoneV146
};
