import Shipment from '../models/Shipment.js';
import {
    notifyPickupBonus,
    notifyReadyForPickup,
    notifyShipmentGuideGenerated,
    notifyShipmentReturned
} from './shipmentMessageService.js';

const DEFAULT_BATCH_LIMIT = Number.parseInt(process.env.SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT || '5', 10);

let paused = process.env.SHIPMENT_STATUS_DISPATCH_ENABLED !== 'true';
let lastRun = null;

const normalizeLimit = (value) => {
    const parsed = Number.parseInt(value || DEFAULT_BATCH_LIMIT, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BATCH_LIMIT;
    return Math.min(parsed, 30);
};

const normalizeActions = (actions = []) => {
    const list = Array.isArray(actions) ? actions : String(actions || '').split(',');
    const allowed = new Set(['guide', 'ready_for_pickup', 'delivered_bonus', 'returned']);
    const normalized = list.map((item) => String(item || '').trim()).filter((item) => allowed.has(item));
    return [...new Set(normalized)];
};

const appendDispatchEvent = async (shipmentId, kind, payload = {}) => {
    await Shipment.updateOne(
        { _id: shipmentId },
        {
            $push: {
                events: {
                    $each: [{
                        kind,
                        at: new Date(),
                        payload
                    }],
                    $slice: -60
                }
            }
        }
    );
};

export const getShipmentDispatchState = () => ({
    paused,
    enabled: !paused,
    batchLimit: DEFAULT_BATCH_LIMIT,
    lastRun
});

export const setShipmentDispatchPaused = (value, reason = '') => {
    paused = Boolean(value);
    lastRun = {
        ...(lastRun || {}),
        pausedChangedAt: new Date(),
        paused,
        reason
    };
    return getShipmentDispatchState();
};

const candidateQuery = (actions = []) => {
    const actionSet = new Set(actions.length ? actions : ['guide', 'ready_for_pickup', 'delivered_bonus', 'returned']);
    const branches = [];
    if (actionSet.has('guide')) {
        branches.push({
            'logistics.status': 'GUIA_GENERADA',
            'logistics.trackingNumber': { $exists: true, $ne: '' },
            'automation.guiaNotifiedAt': null
        });
    }
    if (actionSet.has('ready_for_pickup')) {
        branches.push({
            'logistics.status': 'READY_FOR_PICKUP',
            'logistics.trackingNumber': { $exists: true, $ne: '' },
            'logistics.agencyPickup': true,
            'automation.readyForPickupNotifiedAt': null,
            'outcomes.delivered': { $ne: true },
            'outcomes.pickedUp': { $ne: true },
            'outcomes.returned': { $ne: true },
            'outcomes.prepaidOnly': { $ne: true }
        });
    }
    if (actionSet.has('delivered_bonus')) {
        branches.push({
            'logistics.status': 'ENTREGADO',
            'automation.bonusNotifiedAt': null,
            'outcomes.returned': { $ne: true }
        });
    }
    if (actionSet.has('returned')) {
        branches.push({
            'logistics.status': 'DEVUELTO',
            'automation.returnedNotifiedAt': null
        });
    }
    return {
        country: 'EC',
        'client.phone': { $exists: true, $ne: '' },
        $or: branches.length ? branches : [{ _id: null }]
    };
};

const actionForShipment = (shipment) => {
    const status = shipment?.logistics?.status || '';
    if (status === 'DEVUELTO') return 'returned';
    if (status === 'ENTREGADO') return 'delivered_bonus';
    if (status === 'READY_FOR_PICKUP') return 'ready_for_pickup';
    if (status === 'GUIA_GENERADA') return 'guide';
    return 'none';
};

const markDeliveredAndNotifyBonus = async (shipment) => {
    const now = new Date();
    await Shipment.updateOne(
        { _id: shipment._id },
        {
            $set: {
                'outcomes.pickedUp': true,
                'outcomes.delivered': true,
                'outcomes.returned': false,
                'outcomes.prepaidOnly': false,
                'automation.deliveredConfirmedAt': shipment.automation?.deliveredConfirmedAt || now,
                'automation.prepaidOnlyNotifiedAt': null,
                'review.manualOnly': false,
                'review.reviewReason': '',
                'review.reviewStatus': 'delivered_confirmed_by_dropi_status'
            }
        }
    );
    await appendDispatchEvent(shipment._id, 'delivered_confirmed_by_dropi_status', {
        status: shipment.logistics?.status || '',
        trackingNumber: shipment.logistics?.trackingNumber || '',
        customerEligibility: 'released_for_new_order'
    });
    const refreshed = await Shipment.findById(shipment._id);
    const bonusSent = refreshed ? await notifyPickupBonus(refreshed) : false;
    return Boolean(bonusSent);
};

export const countShipmentDispatchCandidates = async ({ actions = [] } = {}) => {
    const selectedActions = normalizeActions(actions);
    return Shipment.countDocuments(candidateQuery(selectedActions));
};

export const processShipmentStatusDispatch = async ({ limit = DEFAULT_BATCH_LIMIT, dryRun = false, force = false, actions = [] } = {}) => {
    const startedAt = new Date();
    const effectiveLimit = normalizeLimit(limit);
    const selectedActions = normalizeActions(actions);
    if (paused && !force) {
        lastRun = {
            startedAt,
            finishedAt: new Date(),
            dryRun: Boolean(dryRun),
            actions: selectedActions,
            processed: 0,
            sent: 0,
            skipped: 0,
            paused: true,
            results: []
        };
        return lastRun;
    }

    const shipments = await Shipment.find(candidateQuery(selectedActions))
        .sort({ updatedAt: 1, createdAt: 1 })
        .limit(effectiveLimit);

    const results = [];
    let sent = 0;
    let skipped = 0;

    for (const shipment of shipments) {
        const action = actionForShipment(shipment);
        const item = {
            orderId: shipment.orderId,
            phoneTail: String(shipment.client?.phone || '').replace(/\D/g, '').slice(-4),
            status: shipment.logistics?.status || '',
            action,
            success: false
        };

        if (dryRun) {
            item.success = true;
            item.dryRun = true;
            results.push(item);
            continue;
        }

        try {
            if (action === 'guide') {
                const result = await notifyShipmentGuideGenerated(shipment);
                item.success = Boolean(result?.success);
                item.reason = result?.reason || '';
            } else if (action === 'ready_for_pickup') {
                item.success = await notifyReadyForPickup(shipment);
            } else if (action === 'returned') {
                item.success = await notifyShipmentReturned(shipment);
            } else if (action === 'delivered_bonus') {
                item.success = await markDeliveredAndNotifyBonus(shipment);
            } else {
                item.reason = 'no_action';
            }
        } catch (error) {
            item.success = false;
            item.error = error.message || 'dispatch_failed';
        }

        if (item.success) sent += 1;
        else skipped += 1;
        results.push(item);
    }

    lastRun = {
        startedAt,
        finishedAt: new Date(),
        dryRun: Boolean(dryRun),
        actions: selectedActions,
        processed: shipments.length,
        sent,
        skipped,
        paused: false,
        results
    };
    return lastRun;
};
