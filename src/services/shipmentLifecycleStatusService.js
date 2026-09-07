import ContactState from '../models/ContactState.js';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import { syncOrderToOnlineAdminPanel } from './adminPanelStatusService.js';

const normalizeStatus = (status = '') => String(status || '').trim().toUpperCase();
const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');

const SHIPPED_STATUSES = new Set([
    'PENDIENTE',
    'GUIA_GENERADA',
    'EN_PROCESAMIENTO',
    'MERCANCIA_RECOGIDA',
    'EN_BODEGA_TRANSPORTADORA',
    'EN_DESPACHO',
    'EN_RUTA',
    'EN_REPARTO',
    'EN_DISTRIBUCION_A_CLIENTE',
    'READY_FOR_PICKUP',
    'NOVEDAD'
]);

const LOGISTICS_STATUS_RANK = Object.freeze({
    CREATED: 0,
    PENDIENTE: 1,
    GUIA_GENERADA: 1,
    EN_PROCESAMIENTO: 1,
    MERCANCIA_RECOGIDA: 2,
    EN_BODEGA_TRANSPORTADORA: 2,
    EN_DESPACHO: 2,
    EN_RUTA: 2,
    EN_REPARTO: 2,
    EN_DISTRIBUCION_A_CLIENTE: 2,
    READY_FOR_PICKUP: 3,
    ENTREGADO: 4
});

const TERMINAL_ORDER_STATUSES = new Set(['delivered', 'cancelled', 'returned']);
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
const PANEL_STATUS_BY_ORDER_STATUS = Object.freeze({
    pending: 'novo',
    confirmed: 'confirmado',
    processing: 'pedido_enviado',
    shipped: 'pedido_enviado',
    delivered: 'entregue',
    cancelled: 'cancelado',
    returned: 'devolvido'
});

export const nonRegressingLogisticsStatus = (currentStatus = '', proposedStatus = '') => {
    const current = normalizeStatus(currentStatus);
    const proposed = normalizeStatus(proposedStatus);
    if (!proposed) return current;
    if (!current || current === 'CREATED') return proposed;
    if (['DEVUELTO', 'CANCELADO', 'RECHAZADO', 'NOVEDAD'].includes(proposed)) return proposed;
    if (['DEVUELTO', 'CANCELADO', 'RECHAZADO'].includes(current)) return current;
    const currentRank = LOGISTICS_STATUS_RANK[current];
    const proposedRank = LOGISTICS_STATUS_RANK[proposed];
    if (!Number.isFinite(currentRank) || !Number.isFinite(proposedRank)) return proposed;
    return proposedRank >= currentRank ? proposed : current;
};

export const nonRegressingCanonicalOrderStatus = (currentStatus = '', proposedStatus = '') => {
    const current = String(currentStatus || '').trim().toLowerCase();
    const proposed = String(proposedStatus || '').trim().toLowerCase();
    if (!proposed) return current;
    if (TERMINAL_ORDER_STATUSES.has(current)) return current;
    if (!(current in ORDER_STATUS_RANK)) return proposed;
    if (!(proposed in ORDER_STATUS_RANK)) return current;
    if (TERMINAL_ORDER_STATUSES.has(proposed)) return proposed;
    return ORDER_STATUS_RANK[proposed] >= ORDER_STATUS_RANK[current] ? proposed : current;
};

const dropiOrderIdForShipment = (shipment = {}) => digitsOnly(
    shipment?.raw?.manualDropiOrderId
    || shipment?.raw?.latestDroppiPayload?.dropiOrderId
    || shipment?.raw?.droppiOrder?.id
    || shipment?.raw?.droppiOrder?.order_id
    || ''
);

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

const persistCanonicalContactState = async ({ state, order, shipment, orderStatus }) => {
    if (!state) return { state: null, changed: false };
    const metadata = state.metadata || {};
    const customerDraft = metadata.customerDraft || {};
    const logistics = metadata.logistics || {};
    const panelStatus = PANEL_STATUS_BY_ORDER_STATUS[orderStatus] || customerDraft.status || '';
    const dropiOrderId = dropiOrderIdForShipment(shipment);
    const trackingNumber = digitsOnly(shipment?.logistics?.trackingNumber);
    const logisticsStatus = normalizeStatus(shipment?.logistics?.status);
    const nextCustomerDraft = {
        ...customerDraft,
        status: panelStatus,
        orderId: order?.orderId || customerDraft.orderId || ''
    };
    const nextLogistics = {
        ...logistics,
        ...(logisticsStatus ? { status: logisticsStatus } : {}),
        ...(dropiOrderId ? { dropiOrderId } : {}),
        ...(trackingNumber ? { trackingNumber } : {}),
        ...(shipment?.logistics?.distributionCompany
            ? { carrier: shipment.logistics.distributionCompany }
            : {})
    };
    const changed = JSON.stringify(customerDraft) !== JSON.stringify(nextCustomerDraft)
        || JSON.stringify(logistics) !== JSON.stringify(nextLogistics);
    if (!changed) return { state, changed: false };
    state.metadata = { ...metadata, customerDraft: nextCustomerDraft, logistics: nextLogistics };
    state.markModified?.('metadata');
    await state.save();
    return { state, changed: true };
};

const isCarrierNoveltyReview = (value = '') => /novedad|carrier_|servientrega|tracking/i.test(String(value || ''));

const appendNoteOnce = (notes = '', line = '') => {
    const cleanLine = String(line || '').trim();
    if (!cleanLine) return notes || '';
    const current = String(notes || '').trim();
    if (current.includes(cleanLine)) return current;
    return current ? `${current}\n${cleanLine}` : cleanLine;
};

export const orderStatusForLogisticsStatus = (status = '') => {
    const normalized = normalizeStatus(status);
    if (normalized === 'ENTREGADO') return 'delivered';
    if (normalized === 'DEVUELTO') return 'returned';
    if (['CANCELADO', 'RECHAZADO'].includes(normalized)) return 'cancelled';
    if (SHIPPED_STATUSES.has(normalized)) return 'shipped';
    return '';
};

export const adminStatusForLogisticsStatus = (status = '') => (
    orderStatusForLogisticsStatus(status)
);

const applyShipmentOutcome = (shipment, status, now) => {
    shipment.outcomes = shipment.outcomes || {};
    shipment.automation = shipment.automation || {};
    shipment.review = shipment.review || {};

    if (status === 'ENTREGADO') {
        shipment.outcomes.delivered = true;
        shipment.outcomes.pickedUp = true;
        shipment.outcomes.returned = false;
        shipment.outcomes.prepaidOnly = false;
        shipment.automation.deliveredConfirmedAt = shipment.automation.deliveredConfirmedAt || now;
        shipment.automation.prepaidOnlyNotifiedAt = null;
        shipment.review.manualOnly = false;
        shipment.review.reviewReason = '';
        shipment.review.reviewStatus = 'delivered_confirmed_by_carrier';
        return;
    }

    if (status === 'DEVUELTO') {
        shipment.outcomes.delivered = false;
        shipment.outcomes.pickedUp = false;
        shipment.outcomes.returned = true;
        shipment.outcomes.prepaidOnly = true;
        shipment.automation.prepaidOnlyNotifiedAt = null;
        shipment.review.manualOnly = false;
        shipment.review.reviewReason = 'carrier_returned';
        shipment.review.reviewStatus = 'prepaid_only_required';
        return;
    }

    if (status === 'NOVEDAD') {
        shipment.review.manualOnly = true;
        shipment.review.reviewReason = 'novedad_servientrega';
        shipment.review.reviewStatus = 'carrier_novedad';
        return;
    }

    if (isCarrierNoveltyReview(shipment.review.reviewReason) || isCarrierNoveltyReview(shipment.review.reviewStatus)) {
        shipment.review.manualOnly = false;
        shipment.review.reviewReason = '';
        shipment.review.reviewStatus = '';
    }
};

const applyOrderReviewState = (order, status, shipment, now) => {
    order.reviewQueue = order.reviewQueue || {};
    if (status === 'NOVEDAD') {
        order.reviewQueue.status = 'conferir_pedidos';
        order.reviewQueue.reason = 'novedad_servientrega';
        order.reviewQueue.evidence = [
            shipment.logistics?.distributionCompany || 'SERVIENTREGA',
            shipment.logistics?.trackingNumber || '',
            status
        ].filter(Boolean).join(' ');
        order.reviewQueue.movedAt = order.reviewQueue.movedAt || now;
        order.reviewQueue.movedBy = order.reviewQueue.movedBy || 'carrier_status_sync';
        return;
    }

    if (isCarrierNoveltyReview(order.reviewQueue.reason) || isCarrierNoveltyReview(order.reviewQueue.evidence)) {
        order.reviewQueue.status = '';
        order.reviewQueue.reason = '';
        order.reviewQueue.evidence = '';
    }
};

export const applyShipmentLifecycleStatus = async ({
    shipmentId,
    status,
    source = 'carrier_tracking',
    carrierResult = null,
    shipmentDocument = null,
    shipmentModel = Shipment,
    orderModel = Order,
    contactStateModel = ContactState,
    syncPanel = syncOrderToOnlineAdminPanel
} = {}) => {
    const normalizedStatus = normalizeStatus(status);
    if (!shipmentId || !normalizedStatus) return { ok: false, reason: 'missing_shipment_or_status' };

    const shipment = shipmentDocument || await shipmentModel.findById(shipmentId);
    if (!shipment) return { ok: false, reason: 'shipment_not_found' };

    const now = new Date();
    const shipmentProjectionBefore = JSON.stringify({
        logistics: shipment.logistics || {},
        outcomes: shipment.outcomes || {},
        automation: shipment.automation || {},
        review: shipment.review || {},
        events: shipment.events || []
    });
    const previousStatus = normalizeStatus(shipment.logistics?.status || '');
    const effectiveStatus = nonRegressingLogisticsStatus(previousStatus, normalizedStatus);
    const statusChanged = effectiveStatus !== previousStatus;
    shipment.logistics = shipment.logistics || {};
    shipment.logistics.status = effectiveStatus;
    if (statusChanged) shipment.logistics.lastStatusAt = now;
    if (effectiveStatus === 'READY_FOR_PICKUP' && source === 'carrier_tracking'
        && (statusChanged || shipment.logistics.pickupReadyVerified !== true)) {
        shipment.logistics.pickupReadyVerified = true;
        shipment.logistics.pickupReadyVerifiedAt = now;
        shipment.logistics.pickupReadyVerifiedSource = 'carrier_tracking';
    } else if (effectiveStatus !== 'READY_FOR_PICKUP') {
        shipment.logistics.pickupReadyVerified = false;
        shipment.logistics.pickupReadyVerifiedAt = null;
        shipment.logistics.pickupReadyVerifiedSource = '';
    }
    if (carrierResult?.trackingNumber) shipment.logistics.trackingNumber = carrierResult.trackingNumber;
    if (carrierResult?.carrier) shipment.logistics.distributionCompany = String(carrierResult.carrier || '').toUpperCase();

    applyShipmentOutcome(shipment, effectiveStatus, now);

    shipment.events = Array.isArray(shipment.events) ? shipment.events : [];
    if (statusChanged) shipment.events.push({
        kind: 'shipment_lifecycle_status_applied',
        at: now,
        payload: {
            source,
            previousStatus,
            status: effectiveStatus,
            observedStatus: normalizedStatus,
            orderStatus: orderStatusForLogisticsStatus(effectiveStatus),
            trackingNumber: shipment.logistics?.trackingNumber || '',
            carrier: shipment.logistics?.distributionCompany || '',
            pickupReadyVerified: shipment.logistics?.pickupReadyVerified === true,
            customerEligibility: effectiveStatus === 'ENTREGADO'
                ? 'released_for_new_order'
                : (effectiveStatus === 'DEVUELTO' ? 'prepaid_only_required' : 'unchanged')
        }
    });
    shipment.events = shipment.events.slice(-80);
    const shipmentProjectionAfter = JSON.stringify({
        logistics: shipment.logistics || {},
        outcomes: shipment.outcomes || {},
        automation: shipment.automation || {},
        review: shipment.review || {},
        events: shipment.events || []
    });
    const shipmentChanged = shipmentProjectionAfter !== shipmentProjectionBefore;
    if (shipmentChanged) await shipment.save();

    const proposedOrderStatus = orderStatusForLogisticsStatus(effectiveStatus);
    let orderStatus = proposedOrderStatus;
    let adminSync = null;
    let contactState = null;
    let contactStateChanged = false;
    let orderChanged = false;
    if (proposedOrderStatus && shipment.orderId) {
        const order = await orderModel.findOne({ country: 'EC', orderId: shipment.orderId }).catch(() => null);
        if (order) {
            const orderProjectionBefore = JSON.stringify({
                status: order.status || '',
                shippingStatus: order.shippingStatus || '',
                dropiOrderId: order.dropiOrderId || '',
                trackingNumber: order.trackingNumber || '',
                reviewQueue: order.reviewQueue || {},
                notes: order.notes || ''
            });
            const previousOrderStatus = order.status || '';
            orderStatus = nonRegressingCanonicalOrderStatus(previousOrderStatus, proposedOrderStatus);
            order.status = orderStatus;
            order.shippingStatus = effectiveStatus;
            const dropiOrderId = dropiOrderIdForShipment(shipment);
            if (dropiOrderId) order.dropiOrderId = dropiOrderId;
            if (shipment.logistics?.trackingNumber) order.trackingNumber = shipment.logistics.trackingNumber;
            applyOrderReviewState(order, effectiveStatus, shipment, now);
            if (previousOrderStatus !== orderStatus || ['NOVEDAD', 'ENTREGADO', 'DEVUELTO'].includes(effectiveStatus)) {
                order.notes = appendNoteOnce(
                    order.notes,
                    `Servientrega status ${effectiveStatus}${shipment.logistics?.trackingNumber ? ` guia ${shipment.logistics.trackingNumber}` : ''}`
                );
            }
            const orderProjectionAfter = JSON.stringify({
                status: order.status || '',
                shippingStatus: order.shippingStatus || '',
                dropiOrderId: order.dropiOrderId || '',
                trackingNumber: order.trackingNumber || '',
                reviewQueue: order.reviewQueue || {},
                notes: order.notes || ''
            });
            orderChanged = orderProjectionAfter !== orderProjectionBefore;
            if (orderChanged) await order.save();
            const state = await findContactState({
                phone: order.customer?.phone || shipment.client?.phone,
                contactStateModel
            });
            const contactProjection = await persistCanonicalContactState({
                state,
                order,
                shipment,
                orderStatus
            });
            contactState = contactProjection.state;
            contactStateChanged = contactProjection.changed;
            // NOVEDAD e' uma revisao logistica de um pedido que ja foi enviado.
            // A ocorrencia permanece na reviewQueue, mas nao pode rebaixar o
            // cliente para a fila operacional de pedidos ainda nao enviados.
            const adminStatus = adminStatusForLogisticsStatus(effectiveStatus);
            if (orderChanged) {
                adminSync = syncPanel(order, {
                    status: adminStatus,
                    action: `carrier_status_${effectiveStatus.toLowerCase()}`
                });
            }
        }
    }

    return {
        ok: true,
        shipment: shipment.toObject?.() || shipment,
        previousStatus,
        observedStatus: normalizedStatus,
        effectiveStatus,
        statusChanged,
        shipmentChanged,
        orderStatus,
        orderChanged,
        adminSync,
        contactState,
        contactStateChanged
    };
};
