const TERMINAL_ORDER_STATUSES = new Set(['delivered', 'cancelled', 'returned']);

const normalizedToken = (value = '') => String(value || '').trim().toLowerCase();
const normalizedShipmentStatus = (shipment = {}) => String(shipment?.logistics?.status || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

const firstValidDate = (...values) => values
    .filter(Boolean)
    .map((value) => new Date(value))
    .find((value) => !Number.isNaN(value.getTime())) || null;

export const terminalStatusFromShipment = (shipment = null) => {
    if (!shipment) return '';
    const status = normalizedShipmentStatus(shipment);
    if (
        shipment?.outcomes?.returned
        || shipment?.automation?.returnedNotifiedAt
        || ['DEVUELTO', 'RETURNED'].includes(status)
    ) return 'returned';
    if (
        shipment?.outcomes?.cancelled
        || ['CANCELADO', 'CANCELLED', 'CANCELED', 'CANCELADO_SERVIENTREGA'].includes(status)
    ) return 'cancelled';
    if (
        shipment?.outcomes?.delivered
        || shipment?.outcomes?.pickedUp
        || shipment?.automation?.deliveredConfirmedAt
        || ['ENTREGADO', 'DELIVERED', 'PICKED_UP', 'PICKEDUP'].includes(status)
    ) return 'delivered';
    return '';
};

export const deliveredAtFromShipment = (shipment = null) => {
    if (terminalStatusFromShipment(shipment) !== 'delivered') return null;
    return firstValidDate(
        shipment?.automation?.deliveredConfirmedAt,
        shipment?.logistics?.lastStatusAt,
        shipment?.updatedAt,
        shipment?.createdAt
    );
};

export const panelOrderLifecycle = ({ order = null, shipment = null } = {}) => {
    const orderStatus = normalizedToken(order?.status);
    const shipmentStatus = terminalStatusFromShipment(shipment);
    const effectiveStatus = shipmentStatus || orderStatus;
    const historical = Boolean(order?.orderId && TERMINAL_ORDER_STATUSES.has(effectiveStatus));
    return Object.freeze({
        effectiveStatus,
        historical,
        historicalOrderId: historical ? String(order.orderId || '').trim() : '',
        hasOperationalOrder: Boolean(order?.orderId) && !historical,
        delivered: effectiveStatus === 'delivered',
        previousDeliveredAt: effectiveStatus === 'delivered'
            ? (deliveredAtFromShipment(shipment) || firstValidDate(order?.previousDeliveredAt, order?.updatedAt))
            : null
    });
};

export const buildDeliveredRepurchaseOrderId = (now = Date.now, random = Math.random) => {
    const stamp = Number(now()).toString(36).toUpperCase();
    const suffix = Number(random()).toString(36).slice(2, 6).padEnd(4, '0').toUpperCase();
    return `EC-RECOMPRA-${stamp}-${suffix}`;
};

export const repurchaseOrderCreationPolicy = ({
    authenticated = false,
    previousOrder = null,
    previousShipment = null,
    newCustomerPhone = ''
} = {}) => {
    if (!authenticated) {
        return Object.freeze({ allowed: false, statusCode: 403, reason: 'repurchase_requires_panel_auth' });
    }
    if (!previousOrder?.orderId) {
        return Object.freeze({ allowed: false, statusCode: 404, reason: 'previous_order_not_found' });
    }
    const previousPhone = String(previousOrder?.customer?.phone || '').replace(/\D/g, '');
    const nextPhone = String(newCustomerPhone || '').replace(/\D/g, '');
    const previousTail = previousPhone.slice(-9);
    const nextTail = nextPhone.slice(-9);
    if (!previousTail || !nextTail || previousTail !== nextTail) {
        return Object.freeze({ allowed: false, statusCode: 409, reason: 'repurchase_customer_mismatch' });
    }
    const lifecycle = panelOrderLifecycle({ order: previousOrder, shipment: previousShipment });
    if (!lifecycle.delivered) {
        return Object.freeze({
            allowed: false,
            statusCode: 409,
            reason: 'previous_order_not_delivered',
            previousStatus: lifecycle.effectiveStatus
        });
    }
    return Object.freeze({
        allowed: true,
        previousOrderId: String(previousOrder.orderId),
        previousDeliveredAt: lifecycle.previousDeliveredAt,
        entryReason: 'repeat_purchase_after_delivered'
    });
};

export const operationalOrderLineage = ({
    existingOrder = null,
    sourceOrderId = '',
    sourceIsAdminOrder = false
} = {}) => {
    const existingPreviousOrderId = String(existingOrder?.previousOrderId || '').trim();
    const existingEntryReason = String(existingOrder?.entryReason || '').trim();
    const deliveredRepurchase = Boolean(
        existingPreviousOrderId
        && existingEntryReason === 'repeat_purchase_after_delivered'
    );

    if (deliveredRepurchase) {
        return Object.freeze({
            deliveredRepurchase: true,
            previousOrderId: existingPreviousOrderId,
            entryReason: existingEntryReason,
            preserveExistingNotes: true
        });
    }

    return Object.freeze({
        deliveredRepurchase: false,
        previousOrderId: sourceIsAdminOrder ? String(sourceOrderId || '').trim() : '',
        entryReason: sourceIsAdminOrder
            ? 'admin_panel_confirmed_whatsapp_mirror'
            : 'whatsapp_panel_confirmed',
        preserveExistingNotes: false
    });
};

export const deliveredRepurchaseRegistrationDecision = ({
    authenticated = false,
    currentOrder = null,
    currentShipment = null,
    activeRepurchase = null,
    newCustomerPhone = '',
    now = Date.now,
    random = Math.random
} = {}) => {
    const lifecycle = panelOrderLifecycle({ order: currentOrder, shipment: currentShipment });
    if (!lifecycle.delivered) {
        return Object.freeze({
            allowed: true,
            repurchase: false,
            reused: false,
            reason: 'current_order_not_delivered'
        });
    }

    const policy = repurchaseOrderCreationPolicy({
        authenticated,
        previousOrder: currentOrder,
        previousShipment: currentShipment,
        newCustomerPhone
    });
    if (!policy.allowed) return policy;

    const reusableOrderId = String(activeRepurchase?.orderId || '').trim();
    const reusablePreviousOrderId = String(activeRepurchase?.previousOrderId || '').trim();
    const reusableEntryReason = String(activeRepurchase?.entryReason || '').trim();
    const sameRepurchaseCycle = Boolean(
        reusableOrderId
        && reusablePreviousOrderId === policy.previousOrderId
        && reusableEntryReason === policy.entryReason
    );

    return Object.freeze({
        allowed: true,
        repurchase: true,
        reused: sameRepurchaseCycle,
        orderId: sameRepurchaseCycle
            ? reusableOrderId
            : buildDeliveredRepurchaseOrderId(now, random),
        previousOrderId: policy.previousOrderId,
        previousDeliveredAt: policy.previousDeliveredAt,
        entryReason: policy.entryReason
    });
};
