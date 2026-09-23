import crypto from 'node:crypto';

import {
    canonicalPostSaleIdentityV147,
    servientregaPostSaleCompletionEligibleV147
} from './canonicalLogisticsStatusV147Service.js';
import { POST_SALE_STAGES } from './postSaleSafetyV66Service.js';

export const V147_STATUS_DIVERGENCE_CLASSES = Object.freeze([
    'EXPECTED_HISTORICAL',
    'PROVIDER_NEWER_THAN_LOCAL',
    'MISSING_SHIPMENT',
    'STALE_PROJECTION',
    'AMBIGUOUS',
    'REAL_OPERATIONAL_DEFECT',
    'OTHER'
]);

const clean = (value = '') => String(value ?? '').trim();
const terminalLedgerState = (entry = {}) => ['SENT', 'RECOVERED_STRUCTURED', 'RECOVERED_MANUAL']
    .includes(clean(entry?.state).toUpperCase());
const stageSent = (shipment = {}, stage = '', marker = '') => Boolean(
    shipment?.automation?.[marker]
    || terminalLedgerState(shipment?.automation?.postSaleSafetyLedger?.[stage])
);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const productToken = (value = '') => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
const CANONICAL_PRODUCTS = new Set([
    'TEX_ULTRA', 'TEX_ULTRA_EC', 'TEX_ULTRA_ECUADOR',
    'VIT_POWER', 'VIT_POWER_EC', 'VIT_POWER_ECUADOR',
    'NITRIX', 'NITRIX_EC', 'NITRIX_OXIDE', 'NITRIX_OXIDE_EC', 'NITRIX_OXIDE_ECUADOR'
]);
const stableRows = (rows = []) => [...rows].sort((left, right) => [left.orderId, left.shipmentId]
    .join('|').localeCompare([right.orderId, right.shipmentId].join('|')));

export const listHashV147 = (rows = []) => sha256(JSON.stringify(stableRows(rows)));

export const classifyStatusDivergenceV147 = ({
    shipmentExists = true,
    liveOk = true,
    liveStatus = '',
    storedStatus = '',
    panelDivergent = false,
    duplicateMatches = 0,
    historical = false
} = {}) => {
    if (!shipmentExists) return 'MISSING_SHIPMENT';
    if (duplicateMatches > 1) return 'AMBIGUOUS';
    if (!liveOk) return 'AMBIGUOUS';
    if (clean(liveStatus) === clean(storedStatus) && !panelDivergent) return '';
    if (historical) return 'EXPECTED_HISTORICAL';
    if (liveStatus === 'DELIVERED' && storedStatus !== 'DELIVERED') return 'PROVIDER_NEWER_THAN_LOCAL';
    if (liveStatus && storedStatus && liveStatus !== storedStatus) return 'STALE_PROJECTION';
    if (panelDivergent) return 'STALE_PROJECTION';
    return 'OTHER';
};

export const buildReadyCatchupCandidateV147 = ({ shipment = {}, live = {}, customerId = '', humanManual = false } = {}) => {
    const identity = canonicalPostSaleIdentityV147({
        ...shipment,
        raw: { ...(shipment.raw || {}), customerId: customerId || shipment?.raw?.customerId }
    });
    const a07Sent = stageSent(shipment, POST_SALE_STAGES.READY_FOR_PICKUP, 'readyForPickupNotifiedAt');
    const eligible = live.ok === true
        && live.canonicalStatus === 'READY_FOR_PICKUP'
        && live.canPickup === true
        && live.terminal !== true
        && !a07Sent
        && !humanManual
        && identity.valid;
    const exclusionReason = eligible ? '' : [
        live.ok !== true ? 'servientrega_live_failed' : '',
        live.ok === true && live.canonicalStatus !== 'READY_FOR_PICKUP' ? `canonical_status:${live.canonicalStatus || 'UNKNOWN'}` : '',
        live.ok === true && live.canPickup !== true ? 'can_pickup_no' : '',
        live.terminal === true ? 'terminal' : '',
        a07Sent ? 'a07_already_sent_or_recovered' : '',
        humanManual ? 'human_takeover_manual' : '',
        !identity.valid ? 'canonical_identity_incomplete' : ''
    ].filter(Boolean).join(',');
    return Object.freeze({
        customerId: identity.customerId,
        orderId: identity.orderId,
        shipmentId: identity.shipmentId,
        dropiId: clean(shipment?.raw?.manualDropiOrderId || shipment?.raw?.latestDroppiPayload?.dropiOrderId || shipment?.raw?.droppiOrder?.id),
        guide: clean(shipment?.logistics?.trackingNumber),
        liveStatus: clean(live.canonicalStatus || 'UNKNOWN'),
        canPickup: live.canPickup === true,
        a07Sent,
        catchupEligible: eligible,
        exclusionReason
    });
};

export const buildDeliveredCatchupCandidateV147 = ({ shipment = {}, product = '' } = {}) => {
    const identity = canonicalPostSaleIdentityV147(shipment);
    const p5Sent = stageSent(shipment, POST_SALE_STAGES.DELIVERED_THANK_YOU, 'deliveredThankYouNotifiedAt');
    const p6Sent = stageSent(shipment, POST_SALE_STAGES.PICKUP_BONUS, 'bonusNotifiedAt');
    const p7Sent = stageSent(shipment, POST_SALE_STAGES.PRODUCT_USAGE, 'usageNotifiedAt');
    const delivered = servientregaPostSaleCompletionEligibleV147(shipment);
    const missingStage = !p5Sent || !p6Sent || !p7Sent;
    const productName = clean(product || shipment?.productName || shipment?.raw?.productName || shipment?.raw?.latestDroppiPayload?.productName);
    const productCanonical = CANONICAL_PRODUCTS.has(productToken(productName));
    const eligible = delivered && identity.valid && missingStage && productCanonical;
    const exclusionReason = eligible ? '' : [
        !delivered ? 'servientrega_canonical_delivered_not_proven' : '',
        !identity.valid ? 'canonical_identity_incomplete' : '',
        !missingStage ? 'closure_already_complete' : '',
        !productCanonical ? 'canonical_product_missing' : ''
    ].filter(Boolean).join(',');
    return Object.freeze({
        customerId: identity.customerId,
        orderId: identity.orderId,
        dropiId: clean(shipment?.raw?.manualDropiOrderId || shipment?.raw?.latestDroppiPayload?.dropiOrderId || shipment?.raw?.droppiOrder?.id),
        shipmentId: identity.shipmentId,
        guide: clean(shipment?.logistics?.trackingNumber),
        deliveredAt: shipment?.automation?.deliveredConfirmedAt || shipment?.logistics?.canonicalEvidence?.observedAt || null,
        p5Sent,
        p6Sent,
        p7Sent,
        product: productName,
        productCanonical,
        canonicalIdentityValid: identity.valid,
        catchupEligible: eligible,
        exclusionReason
    });
};

export const buildCatchupListsV147 = ({ records = [] } = {}) => {
    const ready = stableRows(records.map((record) => buildReadyCatchupCandidateV147(record)).filter((item) => item.catchupEligible));
    const delivered = stableRows(records.map((record) => buildDeliveredCatchupCandidateV147(record)).filter((item) => item.catchupEligible));
    return Object.freeze({
        ready,
        readyHash: listHashV147(ready),
        delivered,
        deliveredHash: listHashV147(delivered)
    });
};
