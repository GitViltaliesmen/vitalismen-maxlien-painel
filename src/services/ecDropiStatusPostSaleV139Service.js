import ContactState from '../models/ContactState.js';
import Order from '../models/Order.js';
import { syncOrderToOnlineAdminPanel } from './adminPanelStatusService.js';

const clean = (value = '') => String(value || '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');
const statusKey = (value = '') => clean(value).toUpperCase().replace(/[\s-]+/g, '_');

const ORDER_STATUS_RANK = Object.freeze({
    draft: 0,
    pending: 1,
    confirmed: 2,
    processing: 3,
    shipped: 4,
    delivered: 5,
    cancelled: 5,
    returned: 5
});

const PANEL_TO_ORDER_STATUS = Object.freeze({
    draft: 'draft',
    pending: 'pending',
    confirmed: 'confirmed',
    processing: 'processing',
    shipped: 'shipped',
    delivered: 'delivered',
    cancelled: 'cancelled',
    returned: 'returned',
    novo: 'pending',
    atendendo: 'pending',
    comprar_depois: 'pending',
    confirmado: 'confirmed',
    pedido_enviado: 'shipped',
    entregue: 'delivered',
    cancelado: 'cancelled',
    devolvido: 'returned',
    recompra: 'confirmed'
});

const ORDER_TO_PANEL_STATUS = Object.freeze({
    draft: 'novo',
    pending: 'novo',
    confirmed: 'confirmado',
    processing: 'pedido_enviado',
    shipped: 'pedido_enviado',
    delivered: 'entregue',
    cancelled: 'cancelado',
    returned: 'devolvido'
});

const TERMINAL_ORDER_STATUSES = new Set(['delivered', 'cancelled', 'returned']);

export const dropiOrderIdForShipmentV139 = (shipment = {}) => digitsOnly(
    shipment?.raw?.manualDropiOrderId
    || shipment?.raw?.latestDroppiPayload?.dropiOrderId
    || shipment?.raw?.droppiOrder?.id
    || shipment?.raw?.droppiOrder?.order_id
    || ''
);

export const dropiHumanAuthorizationEvidenceV139 = (shipment = {}) => Boolean(
    shipment?.automation?.dropiSubmitAuthorizedAt
    && clean(shipment?.automation?.dropiSubmitAuthorizedBy)
);

export const dropiPostSaleEvidenceV139 = (shipment = {}) => {
    const dropiOrderId = dropiOrderIdForShipmentV139(shipment);
    const trackingNumber = digitsOnly(shipment?.logistics?.trackingNumber);
    const authorized = dropiHumanAuthorizationEvidenceV139(shipment);
    const status = statusKey(shipment?.logistics?.status);
    const providerStatus = status && !['', 'CREATED'].includes(status);
    return Object.freeze({
        eligible: Boolean(dropiOrderId && authorized && providerStatus),
        dropiOrderId,
        trackingNumber,
        authorized,
        providerStatus,
        status,
        reason: !dropiOrderId
            ? 'missing_real_dropi_order_id'
            : (!authorized
                ? 'missing_human_dropi_authorization'
                : (!providerStatus ? 'missing_dropi_provider_status' : 'dropi_event_verified'))
    });
};

export const orderStatusForDropiLogisticsV139 = (value = '') => {
    const status = statusKey(value);
    if (status === 'ENTREGADO') return 'delivered';
    if (status === 'DEVUELTO') return 'returned';
    if (['CANCELADO', 'RECHAZADO'].includes(status)) return 'cancelled';
    if (['PENDIENTE', 'EN_PROCESAMIENTO'].includes(status)) return 'processing';
    if ([
        'GUIA_GENERADA',
        'READY_FOR_PICKUP',
        'MERCANCIA_RECOGIDA',
        'EN_BODEGA_TRANSPORTADORA',
        'EN_DESPACHO',
        'EN_RUTA',
        'EN_REPARTO',
        'EN_DISTRIBUCION_A_CLIENTE',
        'NOVEDAD'
    ].includes(status)) return 'shipped';
    return '';
};

export const nonRegressingOrderStatusV139 = (currentStatus = '', proposedStatus = '') => {
    const current = clean(currentStatus).toLowerCase();
    const proposed = clean(proposedStatus).toLowerCase();
    if (!proposed || !(proposed in ORDER_STATUS_RANK)) return current;
    if (!current || !(current in ORDER_STATUS_RANK)) return proposed;
    if (TERMINAL_ORDER_STATUSES.has(current)) return current;
    if (TERMINAL_ORDER_STATUSES.has(proposed)) return proposed;
    return ORDER_STATUS_RANK[proposed] >= ORDER_STATUS_RANK[current] ? proposed : current;
};

const findContactState = async ({ phone = '', contactStateModel = ContactState } = {}) => {
    const tail = digitsOnly(phone).slice(-9);
    if (!tail) return null;
    const query = contactStateModel.findOne({
        countryCode: 'EC',
        $or: [
            { phoneDigits: { $regex: `${tail}$` } },
            { chatId: { $regex: tail } },
            { 'metadata.customerDraft.phone': { $regex: `${tail}$` } }
        ]
    });
    return typeof query?.sort === 'function' ? query.sort({ updatedAt: -1 }) : query;
};

const persistContactDraftStatus = async ({ state, order, panelStatus, logisticsStatus = '', dropiOrderId = '', trackingNumber = '' }) => {
    if (!state) return null;
    const metadata = state.metadata || {};
    state.metadata = {
        ...metadata,
        customerDraft: {
            ...(metadata.customerDraft || {}),
            status: panelStatus,
            orderId: order?.orderId || metadata.customerDraft?.orderId || ''
        },
        logistics: {
            ...(metadata.logistics || {}),
            ...(logisticsStatus ? { status: logisticsStatus } : {}),
            ...(dropiOrderId ? { dropiOrderId } : {}),
            ...(trackingNumber ? { trackingNumber } : {})
        }
    };
    state.markModified?.('metadata');
    await state.save();
    return state;
};

export const persistDropiStatusProjectionV139 = async ({
    shipment,
    orderModel = Order,
    contactStateModel = ContactState,
    syncPanel = syncOrderToOnlineAdminPanel
} = {}) => {
    if (!shipment?.orderId) return { ok: false, reason: 'shipment_order_id_required' };
    const evidence = dropiPostSaleEvidenceV139(shipment);
    const proposedStatus = orderStatusForDropiLogisticsV139(shipment?.logistics?.status);
    if (!proposedStatus) return { ok: false, reason: 'dropi_status_not_projectable', evidence };
    const order = await orderModel.findOne({ orderId: shipment.orderId });
    if (!order) return { ok: false, reason: 'existing_order_not_found', evidence };

    const nextStatus = nonRegressingOrderStatusV139(order.status, proposedStatus);
    order.status = nextStatus;
    order.shippingStatus = shipment.logistics?.status || order.shippingStatus || '';
    if (evidence.dropiOrderId) order.dropiOrderId = evidence.dropiOrderId;
    if (evidence.trackingNumber) order.trackingNumber = evidence.trackingNumber;
    await order.save();

    const panelStatus = ORDER_TO_PANEL_STATUS[nextStatus] || 'pedido_enviado';
    const state = await findContactState({ phone: order.customer?.phone || shipment.client?.phone, contactStateModel });
    await persistContactDraftStatus({
        state,
        order,
        panelStatus,
        logisticsStatus: shipment.logistics?.status || '',
        dropiOrderId: evidence.dropiOrderId,
        trackingNumber: evidence.trackingNumber
    });
    const panel = await Promise.resolve(syncPanel(order, {
        status: nextStatus,
        action: 'dropi_status_projection_v139'
    }));
    return {
        ok: true,
        reason: 'dropi_status_projected',
        order,
        contactState: state,
        panel,
        evidence,
        proposedStatus,
        persistedStatus: nextStatus,
        panelStatus
    };
};

export const persistManualPanelStatusV139 = async ({
    order,
    lead,
    panelStatus,
    contactStateModel = ContactState,
    syncPanel = syncOrderToOnlineAdminPanel
} = {}) => {
    const normalizedPanelStatus = clean(panelStatus).toLowerCase();
    const orderStatus = PANEL_TO_ORDER_STATUS[normalizedPanelStatus] || '';
    if (!order || !orderStatus) return { ok: false, reason: 'manual_status_not_projectable' };
    const persistedPanelStatus = ORDER_TO_PANEL_STATUS[normalizedPanelStatus] || normalizedPanelStatus;
    order.status = orderStatus;
    await order.save();
    const state = await findContactState({
        phone: order.customer?.phone || lead?.phone,
        contactStateModel
    });
    await persistContactDraftStatus({ state, order, panelStatus: persistedPanelStatus });
    const panel = await Promise.resolve(syncPanel(order, {
        status: orderStatus,
        action: 'manual_panel_status_v139'
    }));
    return {
        ok: true,
        reason: 'manual_status_persisted',
        order,
        contactState: state,
        panel,
        orderStatus,
        panelStatus: persistedPanelStatus
    };
};
