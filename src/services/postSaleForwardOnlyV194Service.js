import Shipment from '../models/Shipment.js';
import { canaryV75SchedulerShipmentAllowed } from './canaryIsolationV75Service.js';
import { shipmentHasAuthoritativeDropiPickupReleaseV168B } from './dropiPickupReleaseV168BService.js';
import { POST_SALE_STAGES } from './postSaleSafetyV66Service.js';
import {
    notifyReadyForPickup,
    notifyShipmentGuideGenerated,
    notifyShipmentInTransit,
    notifyShipmentReturned
} from './shipmentMessageService.js';

const clean = (value = '') => String(value ?? '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');
const asDate = (value) => {
    const parsed = value ? new Date(value) : null;
    return parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
};

export const resolvePostSaleV194ForwardOnlySince = (env = process.env) => {
    const value = asDate(env.POST_SALE_V194_FORWARD_ONLY_SINCE);
    if (!value) throw new Error('post_sale_v194_forward_only_since_invalid');
    return value;
};

const afterOrEqual = (value, cutoff) => {
    const parsed = asDate(value);
    return Boolean(parsed && parsed.getTime() >= cutoff.getTime());
};

const deliveryAnchor = (shipment = {}) => shipment?.logistics?.canonicalEvidence?.observedAt
    || shipment?.automation?.deliveredConfirmedAt
    || shipment?.logistics?.lastStatusAt;

const verifiedCarrierCheckAt = (shipment = {}, statuses = []) => {
    const check = shipment?.raw?.carrierTracking || {};
    const result = check.lastResult || {};
    const currentStatus = clean(shipment?.logistics?.canonicalStatus);
    const valid = statuses.includes(currentStatus)
        && result.ok === true
        && /^servientrega$/i.test(clean(result.carrier))
        && clean(result.trackingNumber) === clean(shipment?.logistics?.trackingNumber)
        && clean(result.observedGuide) === clean(shipment?.logistics?.trackingNumber)
        && Boolean(clean(result.providerStatus))
        && result.canonicalStatus === currentStatus;
    const checkedAt = valid ? asDate(check.lastCheckedAt) : null;
    // Historical catch-up is valid only while the carrier observation is fresh.
    // A stale or future-dated result cannot reopen an old guide notification.
    const ageMs = checkedAt ? Date.now() - checkedAt.getTime() : -1;
    return ageMs >= 0 && ageMs <= (10 * 60 * 1000) ? checkedAt : null;
};

const verifiedDropiCheckAt = (shipment = {}, statuses = []) => {
    const sync = shipment?.raw?.postSaleV194DropiSync || {};
    const payload = shipment?.raw?.latestDroppiPayload || {};
    const evidence = shipment?.logistics?.canonicalEvidence || {};
    const guide = digitsOnly(shipment?.logistics?.trackingNumber);
    const orderId = digitsOnly(sync.dropiOrderId);
    const status = clean(shipment?.logistics?.canonicalStatus);
    const current = statuses.includes(status)
        && sync.lastState === 'TRACKING_FOUND'
        && sync.lastReason === 'exact_dropi_order_id_tracking_found'
        && sync.historicalNoReplay !== true
        && clean(sync.lastDropiStatus)
        && clean(sync.lastDropiStatus) === clean(payload.dropiStatus)
        && clean(sync.lastDropiStatus) === clean(evidence.rawStatus)
        && evidence.provider === 'dropi'
        && evidence.source === 'dropi_orders_api'
        && digitsOnly(evidence.dropiOrderId) === orderId
        && digitsOnly(payload.dropiOrderId) === orderId
        && digitsOnly(evidence.trackingNumber) === guide
        && digitsOnly(payload.trackingNumber) === guide
        && orderId.length >= 6 && /^\d{8,15}$/.test(guide);
    if (!current) return null;
    if (status === 'READY_FOR_PICKUP' && (
        shipment?.logistics?.pickupReadyVerified !== true
        || shipment?.logistics?.pickupReadyVerifiedSource !== 'dropi_orders_api'
        || !shipmentHasAuthoritativeDropiPickupReleaseV168B(shipment)
    )) return null;
    const syncedAt = asDate(sync.lastSyncAt);
    const observedAt = asDate(evidence.observedAt);
    if (!syncedAt || !observedAt || Math.abs(syncedAt.getTime() - observedAt.getTime()) > 5_000) return null;
    const ageMs = Date.now() - syncedAt.getTime();
    return ageMs >= 0 && ageMs <= (10 * 60 * 1000) ? syncedAt : null;
};

const verifiedGuideCheckAt = (shipment = {}) => (
    !shipment?.automation?.guiaNotifiedAt
        ? verifiedCarrierCheckAt(shipment, ['GUIDE_CREATED']) || verifiedDropiCheckAt(shipment, ['GUIDE_CREATED'])
        : null
);

const carrierStatusesForStage = (stage = '') => {
    if (stage === POST_SALE_STAGES.GUIDE) return ['GUIDE_CREATED'];
    if (stage === POST_SALE_STAGES.IN_TRANSIT) return [
        'PICKED_UP_BY_CARRIER', 'IN_TRANSIT', 'LOGISTICS_CENTER', 'ENTERING_AGENCY'
    ];
    if (stage === POST_SALE_STAGES.RETURNED) return ['NOT_PICKED_UP', 'RETURNING', 'RETURNED'];
    if (stage === POST_SALE_STAGES.READY_FOR_PICKUP || stage.startsWith('PICKUP_REMINDER_')
        || stage === POST_SALE_STAGES.PICKUP_PROOF_REQUEST) return ['READY_FOR_PICKUP'];
    return null;
};

export const postSaleV194StageAnchor = (shipment = {}, stage = '') => {
    if (stage === POST_SALE_STAGES.GUIDE) {
        const verifiedAt = verifiedGuideCheckAt(shipment);
        if (verifiedAt) return verifiedAt;
        return shipment?.raw?.postSaleV194DropiSync?.trackingRecoveredAt
            || shipment?.logistics?.canonicalEvidence?.observedAt
            || shipment?.logistics?.lastStatusAt
            || shipment?.updatedAt;
    }
    if (stage === POST_SALE_STAGES.READY_FOR_PICKUP) return shipment?.logistics?.pickupReadyVerifiedAt;
    if ([
        POST_SALE_STAGES.PICKUP_REMINDER_DAY1,
        POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2,
        POST_SALE_STAGES.PICKUP_REMINDER_DAY3,
        POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY4,
        POST_SALE_STAGES.PICKUP_REMINDER_DAY5,
        POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY6,
        POST_SALE_STAGES.PICKUP_PROOF_REQUEST
    ].includes(stage)) return shipment?.automation?.readyForPickupNotifiedAt;
    if ([
        POST_SALE_STAGES.DELIVERED_THANK_YOU,
        POST_SALE_STAGES.PICKUP_BONUS,
        POST_SALE_STAGES.PRODUCT_USAGE,
        POST_SALE_STAGES.TREATMENT_REFILL_REMINDER
    ].includes(stage)) return deliveryAnchor(shipment);
    return shipment?.logistics?.canonicalEvidence?.observedAt || shipment?.logistics?.lastStatusAt;
};

export const isPostSaleV194ForwardOnlyEligible = ({ shipment = {}, stage = '', forwardOnlySince } = {}) => {
    const cutoff = asDate(forwardOnlySince);
    if (!cutoff) return false;
    if (shipment?.raw?.postSaleV194DropiSync?.terminalDeferredToCarrier === true) {
        // Keep carrier polling alive while suppressing stale guide/transit/retirement
        // messages after a final Dropi observation. Completion still needs real carrier proof.
        const evidence = shipment?.logistics?.canonicalEvidence || {};
        const carrierFinal = evidence.source === 'carrier_tracking' && /^servientrega$/i.test(clean(evidence.provider))
            && afterOrEqual(evidence.observedAt, asDate(shipment.raw.postSaleV194DropiSync.lastSyncAt) || cutoff);
        const delivered = shipment?.logistics?.canonicalStatus === 'DELIVERED' && [POST_SALE_STAGES.DELIVERED_THANK_YOU,
            POST_SALE_STAGES.PICKUP_BONUS, POST_SALE_STAGES.PRODUCT_USAGE, POST_SALE_STAGES.TREATMENT_REFILL_REMINDER].includes(stage);
        const returned = shipment?.logistics?.canonicalStatus === 'RETURNED' && stage === POST_SALE_STAGES.RETURNED;
        if (!carrierFinal || (!delivered && !returned)) return false;
    }
    if (shipment?.review?.manualOnly === true) return false;
    if (stage === POST_SALE_STAGES.GUIDE && shipment?.automation?.guiaNotifiedAt) return false;
    if (!stage || !postSaleV194StageAnchor(shipment, stage)) return false;
    if (!afterOrEqual(shipment?.createdAt, cutoff)) return false;
    const carrierStatuses = carrierStatusesForStage(stage);
    const dropiStageAllowed = stage !== POST_SALE_STAGES.RETURNED;
    if (carrierStatuses && !verifiedCarrierCheckAt(shipment, carrierStatuses)
        && !(dropiStageAllowed && verifiedDropiCheckAt(shipment, carrierStatuses))) return false;
    return afterOrEqual(postSaleV194StageAnchor(shipment, stage), cutoff);
};

const LOGISTICS_ACTIONS = Object.freeze([
    Object.freeze({
        action: 'guide',
        stage: POST_SALE_STAGES.GUIDE,
        query: {
            'logistics.trackingNumber': { $exists: true, $ne: '' },
            'automation.guiaNotifiedAt': null,
            'logistics.status': { $nin: ['READY_FOR_PICKUP', 'ENTREGADO', 'DEVUELTO', 'CANCELADO', 'CANCELADO_SERVIENTREGA', 'CANCELADO SERVIENTREGA'] }
        }
    }),
    Object.freeze({
        action: 'in_transit',
        stage: POST_SALE_STAGES.IN_TRANSIT,
        query: {
            'logistics.status': { $in: ['EN_RUTA', 'EN_REPARTO', 'EN_DESPACHO', 'EN_BODEGA_TRANSPORTADORA', 'MERCANCIA_RECOGIDA'] },
            'automation.inTransitNotifiedAt': null,
            'outcomes.delivered': { $ne: true },
            'outcomes.pickedUp': { $ne: true },
            'outcomes.returned': { $ne: true },
            'outcomes.prepaidOnly': { $ne: true }
        }
    }),
    Object.freeze({
        action: 'ready_for_pickup',
        stage: POST_SALE_STAGES.READY_FOR_PICKUP,
        query: {
            'logistics.status': 'READY_FOR_PICKUP',
            'logistics.canonicalStatus': 'READY_FOR_PICKUP',
            'logistics.pickupReadyVerified': true,
            'logistics.pickupReadyVerifiedSource': { $in: ['carrier_tracking', 'dropi_orders_api'] },
            'logistics.trackingNumber': { $exists: true, $ne: '' },
            'logistics.agencyPickup': true,
            $or: [
                { 'automation.readyForPickupNotifiedAt': null },
                { 'automation.postSaleSafetyLedger.READY_FOR_PICKUP.state': 'PARTIAL' }
            ],
            'outcomes.delivered': { $ne: true },
            'outcomes.pickedUp': { $ne: true },
            'outcomes.returned': { $ne: true },
            'outcomes.prepaidOnly': { $ne: true }
        }
    }),
    Object.freeze({
        action: 'returned',
        stage: POST_SALE_STAGES.RETURNED,
        query: {
            $or: [
                { 'logistics.status': 'DEVUELTO' },
                { 'logistics.canonicalStatus': { $in: ['RETURNED', 'RETURNING', 'NOT_PICKED_UP'] } }
            ],
            'automation.returnedNotifiedAt': null
        }
    })
]);

const sentByResult = (action, result) => {
    if (action === 'guide') return result?.success === true;
    return result === true || result?.success === true || Number(result?.sent || 0) > 0;
};

export const processForwardLogisticsStageV194 = async ({
    forwardOnlySince,
    now = new Date(),
    dryRun = true,
    shipmentModel = Shipment,
    notifyFns = {},
    allowedActions = null
} = {}) => {
    const cutoff = asDate(forwardOnlySince);
    if (!cutoff) throw new Error('post_sale_v194_forward_only_since_invalid');
    const candidates = [];
    for (const definition of LOGISTICS_ACTIONS) {
        if (allowedActions && !allowedActions.includes(definition.action)) continue;
        const shipments = await shipmentModel.find({
            country: 'EC',
            createdAt: { $gte: cutoff },
            'client.phone': { $exists: true, $ne: '' },
            'review.manualOnly': { $ne: true },
            ...definition.query
        }).sort({ updatedAt: 1, createdAt: 1 }).limit(200);
        for (const shipment of shipments) {
            if (!isPostSaleV194ForwardOnlyEligible({ shipment, stage: definition.stage, forwardOnlySince: cutoff })) continue;
            if (!canaryV75SchedulerShipmentAllowed(shipment).allowed) continue;
            candidates.push({
                ...definition,
                shipment,
                anchor: asDate(postSaleV194StageAnchor(shipment, definition.stage)) || now
            });
        }
    }
    candidates.sort((left, right) => left.anchor.getTime() - right.anchor.getTime());
    const selected = candidates.slice(0, 1);
    const report = {
        dryRun: Boolean(dryRun),
        candidates: candidates.length,
        selected: selected.length,
        sent: 0,
        physicalSendLimit: 1,
        items: selected.map((item) => ({
            shipmentId: String(item.shipment?._id || ''),
            orderId: clean(item.shipment?.orderId),
            phoneTail: digitsOnly(item.shipment?.client?.phone).slice(-4),
            trackingNumber: clean(item.shipment?.logistics?.trackingNumber),
            action: item.action,
            stage: item.stage,
            anchor: item.anchor
        }))
    };
    if (dryRun || !selected.length) return report;
    const item = selected[0];
    const senders = {
        guide: notifyShipmentGuideGenerated,
        in_transit: notifyShipmentInTransit,
        ready_for_pickup: (shipment) => notifyReadyForPickup(shipment, { maxComponents: 1 }),
        returned: notifyShipmentReturned,
        ...notifyFns
    };
    const result = await senders[item.action](item.shipment);
    if (sentByResult(item.action, result)) report.sent = 1;
    return report;
};

export default processForwardLogisticsStageV194;
