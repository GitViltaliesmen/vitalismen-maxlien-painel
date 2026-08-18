import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import { syncOrderToOnlineAdminPanel } from './adminPanelStatusService.js';

const normalizeStatus = (status = '') => String(status || '').trim().toUpperCase();

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
    carrierResult = null
} = {}) => {
    const normalizedStatus = normalizeStatus(status);
    if (!shipmentId || !normalizedStatus) return { ok: false, reason: 'missing_shipment_or_status' };

    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) return { ok: false, reason: 'shipment_not_found' };

    const now = new Date();
    const previousStatus = shipment.logistics?.status || '';
    shipment.logistics = shipment.logistics || {};
    shipment.logistics.status = normalizedStatus;
    shipment.logistics.lastStatusAt = now;
    if (normalizedStatus === 'READY_FOR_PICKUP' && source === 'carrier_tracking') {
        shipment.logistics.pickupReadyVerified = true;
        shipment.logistics.pickupReadyVerifiedAt = now;
        shipment.logistics.pickupReadyVerifiedSource = 'carrier_tracking';
    } else if (normalizedStatus !== 'READY_FOR_PICKUP') {
        shipment.logistics.pickupReadyVerified = false;
        shipment.logistics.pickupReadyVerifiedAt = null;
        shipment.logistics.pickupReadyVerifiedSource = '';
    }
    if (carrierResult?.trackingNumber) shipment.logistics.trackingNumber = carrierResult.trackingNumber;
    if (carrierResult?.carrier) shipment.logistics.distributionCompany = String(carrierResult.carrier || '').toUpperCase();

    applyShipmentOutcome(shipment, normalizedStatus, now);

    shipment.events.push({
        kind: 'shipment_lifecycle_status_applied',
        at: now,
        payload: {
            source,
            previousStatus,
            status: normalizedStatus,
            orderStatus: orderStatusForLogisticsStatus(normalizedStatus),
            trackingNumber: shipment.logistics?.trackingNumber || '',
            carrier: shipment.logistics?.distributionCompany || '',
            pickupReadyVerified: shipment.logistics?.pickupReadyVerified === true,
            customerEligibility: normalizedStatus === 'ENTREGADO'
                ? 'released_for_new_order'
                : (normalizedStatus === 'DEVUELTO' ? 'prepaid_only_required' : 'unchanged')
        }
    });
    shipment.events = shipment.events.slice(-80);
    await shipment.save();

    const orderStatus = orderStatusForLogisticsStatus(normalizedStatus);
    let adminSync = null;
    if (orderStatus && shipment.orderId) {
        const order = await Order.findOne({ country: 'EC', orderId: shipment.orderId }).catch(() => null);
        if (order) {
            const previousOrderStatus = order.status || '';
            order.status = orderStatus;
            order.shippingStatus = normalizedStatus;
            if (shipment.logistics?.trackingNumber) order.trackingNumber = shipment.logistics.trackingNumber;
            applyOrderReviewState(order, normalizedStatus, shipment, now);
            if (previousOrderStatus !== orderStatus || ['NOVEDAD', 'ENTREGADO', 'DEVUELTO'].includes(normalizedStatus)) {
                order.notes = appendNoteOnce(
                    order.notes,
                    `Servientrega status ${normalizedStatus}${shipment.logistics?.trackingNumber ? ` guia ${shipment.logistics.trackingNumber}` : ''}`
                );
            }
            await order.save();
            // NOVEDAD e' uma revisao logistica de um pedido que ja foi enviado.
            // A ocorrencia permanece na reviewQueue, mas nao pode rebaixar o
            // cliente para a fila operacional de pedidos ainda nao enviados.
            const adminStatus = adminStatusForLogisticsStatus(normalizedStatus);
            adminSync = syncOrderToOnlineAdminPanel(order, {
                status: adminStatus,
                action: `carrier_status_${normalizedStatus.toLowerCase()}`
            });
        }
    }

    return {
        ok: true,
        shipment: shipment.toObject(),
        orderStatus,
        adminSync
    };
};
