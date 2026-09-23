import { isExplicitDropiPickupReleaseStatus } from './postSalePickupReconciliationPolicy.js';

export const DROPI_PICKUP_RELEASE_SOURCE_V168B = 'dropi_orders_api';

const clean = (value = '') => String(value ?? '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');

export const pickupReadyVerifiedSourceAllowedV168B = (source = '') => (
    ['carrier_tracking', DROPI_PICKUP_RELEASE_SOURCE_V168B].includes(clean(source).toLowerCase())
);

export const authoritativeDropiPickupReleaseV168B = ({
    status = '',
    source = '',
    dropiOrderId = '',
    trackingNumber = '',
    agencyPickup = false,
    distributionCompany = ''
} = {}) => Boolean(
    clean(source).toLowerCase() === DROPI_PICKUP_RELEASE_SOURCE_V168B
    && isExplicitDropiPickupReleaseStatus(status)
    && digitsOnly(dropiOrderId).length >= 6
    && /^\d{8,15}$/.test(digitsOnly(trackingNumber))
    && agencyPickup === true
    && /^servi\s*entrega$/i.test(clean(distributionCompany))
);

export const shipmentHasAuthoritativeDropiPickupReleaseV168B = (shipment = {}) => {
    const payload = shipment?.raw?.latestDroppiPayload || {};
    return authoritativeDropiPickupReleaseV168B({
        status: payload.dropiStatus || payload.status || '',
        source: payload.reconciliationSource || payload.syncSource || '',
        dropiOrderId: payload.dropiOrderId
            || shipment?.raw?.manualDropiOrderId
            || shipment?.raw?.droppiOrder?.id
            || '',
        trackingNumber: payload.trackingNumber || shipment?.logistics?.trackingNumber || '',
        agencyPickup: shipment?.logistics?.agencyPickup === true,
        distributionCompany: payload.distributionCompany
            || shipment?.logistics?.distributionCompany
            || shipment?.logistics?.chosenCarrier
            || ''
    });
};

export const preserveDropiPickupReleaseAgainstCarrierV168B = ({
    shipment = {},
    carrierCanonicalStatus = ''
} = {}) => (
    shipmentHasAuthoritativeDropiPickupReleaseV168B(shipment)
    && [
        'GUIDE_CREATED',
        'PICKED_UP_BY_CARRIER',
        'IN_TRANSIT',
        'LOGISTICS_CENTER',
        'ENTERING_AGENCY'
    ].includes(clean(carrierCanonicalStatus).toUpperCase())
);

