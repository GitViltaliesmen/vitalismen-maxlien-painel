import ContactState from '../models/ContactState.js';
import Order from '../models/Order.js';
import { syncOrderToOnlineAdminPanel } from './adminPanelStatusService.js';
import {
    applyShipmentLifecycleStatus,
    nonRegressingCanonicalOrderStatus,
    orderStatusForLogisticsStatus
} from './shipmentLifecycleStatusService.js';

const clean = (value = '') => String(value || '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');
const statusKey = (value = '') => clean(value).toUpperCase().replace(/[\s-]+/g, '_');

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

export const historicalExternalPostSaleEvidenceV140 = (shipment = {}) => {
    const evidence = shipment?.raw?.historicalExternalReconciliation || {};
    const phone = digitsOnly(evidence.phone);
    const shipmentPhone = digitsOnly(shipment?.client?.phone);
    const dropiOrderId = digitsOnly(evidence.dropiOrderId);
    const shipmentDropiOrderId = dropiOrderIdForShipmentV139(shipment);
    const trackingNumber = digitsOnly(evidence.trackingNumber);
    const shipmentTrackingNumber = digitsOnly(shipment?.logistics?.trackingNumber);
    return Boolean(
        evidence.source === 'HISTORICAL_EXTERNAL_RECONCILIATION'
        && evidence.sourceDropi === true
        && evidence.sourceServientrega === true
        && /^5939\d{8}$/.test(phone)
        && phone === shipmentPhone
        && /^\d{6,}$/.test(dropiOrderId)
        && dropiOrderId === shipmentDropiOrderId
        && /^\d{8,15}$/.test(trackingNumber)
        && trackingNumber === shipmentTrackingNumber
        && Boolean(clean(evidence.customerId))
        && Boolean(clean(evidence.leadId))
    );
};

export const dropiPostSaleEvidenceV139 = (shipment = {}) => {
    const dropiOrderId = dropiOrderIdForShipmentV139(shipment);
    const trackingNumber = digitsOnly(shipment?.logistics?.trackingNumber);
    const authorized = dropiHumanAuthorizationEvidenceV139(shipment);
    const historicalExternal = historicalExternalPostSaleEvidenceV140(shipment);
    const postSaleIdentityVerified = authorized || historicalExternal;
    const status = statusKey(shipment?.logistics?.status);
    const providerStatus = status && !['', 'CREATED'].includes(status);
    return Object.freeze({
        eligible: Boolean(dropiOrderId && postSaleIdentityVerified && providerStatus),
        dropiOrderId,
        trackingNumber,
        authorized,
        historicalExternal,
        postSaleIdentityVerified,
        providerStatus,
        status,
        reason: !dropiOrderId
            ? 'missing_real_dropi_order_id'
            : (!postSaleIdentityVerified
                ? 'missing_human_dropi_authorization'
                : (!providerStatus
                    ? 'missing_dropi_provider_status'
                    : (historicalExternal ? 'historical_external_event_verified' : 'dropi_event_verified')))
    });
};

export const orderStatusForDropiLogisticsV139 = orderStatusForLogisticsStatus;
export const nonRegressingOrderStatusV139 = nonRegressingCanonicalOrderStatus;

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
    shipmentModel,
    orderModel = Order,
    contactStateModel = ContactState,
    syncPanel = syncOrderToOnlineAdminPanel
} = {}) => {
    if (!shipment?.orderId) return { ok: false, reason: 'shipment_order_id_required' };
    const evidence = dropiPostSaleEvidenceV139(shipment);
    const proposedStatus = orderStatusForDropiLogisticsV139(shipment?.logistics?.status);
    if (!proposedStatus) return { ok: false, reason: 'dropi_status_not_projectable', evidence };
    const lifecycle = await applyShipmentLifecycleStatus({
        shipmentId: shipment._id,
        shipmentDocument: shipment,
        status: shipment.logistics?.status,
        source: 'dropi_status_sync',
        carrierResult: {
            carrier: shipment.logistics?.distributionCompany || shipment.logistics?.chosenCarrier || '',
            trackingNumber: shipment.logistics?.trackingNumber || ''
        },
        ...(shipmentModel ? { shipmentModel } : {}),
        orderModel,
        contactStateModel,
        syncPanel
    });
    return {
        ...lifecycle,
        ok: lifecycle.ok === true,
        reason: lifecycle.ok ? 'dropi_status_projected' : (lifecycle.reason || 'dropi_status_projection_failed'),
        evidence,
        proposedStatus,
        persistedStatus: lifecycle.orderStatus,
        panelStatus: ORDER_TO_PANEL_STATUS[lifecycle.orderStatus] || 'pedido_enviado',
        panel: lifecycle.adminSync
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
