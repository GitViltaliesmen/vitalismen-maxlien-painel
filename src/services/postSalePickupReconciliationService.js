import Message from '../models/Message.js';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import { syncOrderToOnlineAdminPanel } from './adminPanelStatusService.js';
import {
    handlePickupProofInbound,
    isPickupProofText,
    notifyReadyForPickup
} from './shipmentMessageService.js';
import {
    expandedPickupConfirmationRegex,
    isExpandedCustomerPickupConfirmation,
    isExplicitDropiPickupReleaseStatus,
    normalizeExpandedCustomerPickupConfirmation
} from './postSalePickupReconciliationPolicy.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DISPATCH_LOCK_MS = Math.max(
    60_000,
    Number.parseInt(process.env.SHIPMENT_DISPATCH_LOCK_MS || '300000', 10) || 300_000
);
const EXPLICIT_DROPI_RELEASE_QUERY = /^(PARA RETIRO EN AGENCIA\b|LIST[OA] PARA RETIRO\b|DISPONIBLE.*RETIRO\b|READY_FOR_PICKUP$)/i;
const EXISTING_PICKUP_NOTICE_QUERY = /\b(PEDIDO\s+(?:YA\s+)?PARA\s+RETIRO\s+EN\s+AGENCIA|PEDIDO\s+LISTO\s+PARA\s+RETIRO|AVISO\s+DE\s+RETIRO|SU\s+PEDIDO\s+(?:YA\s+)?ESTA\s+LISTO\s+PARA\s+RETIRAR)\b/i;

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const escapeRegex = (value = '') => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const latestDropiStatus = (shipment = {}) => String(
    shipment.raw?.latestDroppiPayload?.dropiStatus
    || shipment.raw?.latestDroppiPayload?.status
    || ''
).trim();

export const shipmentHasExplicitDropiPickupRelease = (shipment = {}) => (
    isExplicitDropiPickupReleaseStatus(latestDropiStatus(shipment))
);

const phoneClausesForShipment = (shipment = {}) => {
    const digits = digitsOnly(shipment.client?.phone);
    if (digits.length < 8) return [];
    const tails = [...new Set([
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter(Boolean))];
    return tails.flatMap((tail) => ([
        { peerPhone: { $regex: `${escapeRegex(tail)}$` } },
        { chatId: { $regex: escapeRegex(tail) } },
        { to: { $regex: escapeRegex(tail) } },
        { from: { $regex: escapeRegex(tail) } }
    ]));
};

const explicitDropiQuery = ({ orderIds = [] } = {}) => ({
    country: 'EC',
    ...(orderIds.length ? { orderId: { $in: orderIds } } : {}),
    $and: [
        {
            $or: [
                { 'raw.latestDroppiPayload.dropiStatus': EXPLICIT_DROPI_RELEASE_QUERY },
                { 'raw.latestDroppiPayload.status': EXPLICIT_DROPI_RELEASE_QUERY }
            ]
        },
        { 'outcomes.delivered': { $ne: true } },
        { 'outcomes.pickedUp': { $ne: true } },
        { 'outcomes.returned': { $ne: true } },
        { 'outcomes.prepaidOnly': { $ne: true } }
    ]
});

const appendReconciliationEvent = async (shipmentId, kind, payload = {}) => {
    await Shipment.updateOne(
        { _id: shipmentId },
        {
            $push: {
                events: {
                    $each: [{ kind, at: new Date(), payload }],
                    $slice: -80
                }
            }
        }
    );
};

export const reconcileExplicitDropiPickupReleases = async ({
    orderIds = [],
    limit = 500,
    dryRun = false
} = {}) => {
    const uniqueOrderIds = [...new Set(orderIds.map((value) => String(value || '').trim()).filter(Boolean))];
    const shipments = await Shipment.find(explicitDropiQuery({ orderIds: uniqueOrderIds }))
        .sort({ updatedAt: 1, createdAt: 1 })
        .limit(Math.max(1, Math.min(Number(limit) || 500, 1000)));
    const results = [];
    for (const shipment of shipments) {
        if (!shipmentHasExplicitDropiPickupRelease(shipment)) continue;
        const changed = shipment.logistics?.status !== 'READY_FOR_PICKUP'
            || shipment.logistics?.pickupReadyVerified !== true
            || shipment.logistics?.pickupReadyVerifiedSource !== 'dropi_explicit_pickup_release';
        const item = {
            orderId: shipment.orderId,
            trackingNumber: shipment.logistics?.trackingNumber || '',
            beforeStatus: shipment.logistics?.status || '',
            changed,
            dryRun: Boolean(dryRun)
        };
        if (!dryRun && changed) {
            const now = new Date();
            shipment.logistics.status = 'READY_FOR_PICKUP';
            shipment.logistics.pickupReadyVerified = true;
            shipment.logistics.pickupReadyVerifiedAt = shipment.logistics.pickupReadyVerifiedAt || now;
            shipment.logistics.pickupReadyVerifiedSource = 'dropi_explicit_pickup_release';
            shipment.logistics.lastStatusAt = now;
            shipment.events.push({
                kind: 'dropi_explicit_pickup_release_reconciled',
                at: now,
                payload: {
                    previousStatus: item.beforeStatus,
                    status: 'READY_FOR_PICKUP',
                    dropiStatus: latestDropiStatus(shipment),
                    trackingNumber: item.trackingNumber,
                    pickupReadyVerified: true,
                    pickupReadyVerifiedSource: 'dropi_explicit_pickup_release'
                }
            });
            shipment.events = shipment.events.slice(-80);
            await shipment.save();

            const order = await Order.findOne({ country: 'EC', orderId: shipment.orderId }).catch(() => null);
            if (order && !['delivered', 'returned', 'cancelled'].includes(String(order.status || '').toLowerCase())) {
                order.status = 'shipped';
                order.shippingStatus = 'READY_FOR_PICKUP';
                if (item.trackingNumber) order.trackingNumber = item.trackingNumber;
                await order.save();
                await Promise.resolve(syncOrderToOnlineAdminPanel(order, {
                    status: 'shipped',
                    action: 'dropi_explicit_pickup_release_reconciled'
                })).catch(() => null);
            }
        }
        results.push(item);
    }
    return {
        dryRun: Boolean(dryRun),
        candidates: shipments.length,
        changed: results.filter((item) => item.changed).length,
        results
    };
};

const findExistingPickupNotice = async (shipment) => {
    const phoneClauses = phoneClausesForShipment(shipment);
    const trackingNumber = String(shipment.logistics?.trackingNumber || '').trim();
    if (!phoneClauses.length || !trackingNumber) return null;
    const since = new Date(Date.now() - (10 * DAY_MS));
    return Message.findOne({
        $and: [
            { $or: phoneClauses },
            { $or: [{ isFromMe: true }, { isBot: true }, { from: 'bot' }] },
            { body: EXISTING_PICKUP_NOTICE_QUERY },
            { body: { $regex: escapeRegex(trackingNumber) } },
            { createdAt: { $gte: since } }
        ],
        deliveryStatus: { $nin: ['failed', 'undelivered'] }
    }).sort({ createdAt: -1 }).lean().catch(() => null);
};

const recoverExistingPickupNotice = async ({ shipment, message }) => {
    const recoveredAt = message?.createdAt || new Date();
    const notificationId = `pickup-ready-recovered:${shipment.orderId}:${shipment.logistics?.trackingNumber || ''}`;
    const result = await Shipment.updateOne(
        {
            _id: shipment._id,
            'automation.readyForPickupNotifiedAt': null
        },
        {
            $set: {
                'automation.readyForPickupNotifiedAt': recoveredAt,
                'automation.lastReminderAt': recoveredAt,
                'automation.lastReminderKind': 'ready_for_pickup'
            },
            $push: {
                events: {
                    $each: [{
                        kind: 'ready_for_pickup_notified',
                        at: new Date(),
                        payload: {
                            recoveredFromExistingNotice: true,
                            source: 'dropi_explicit_existing_message',
                            sourceMessageId: message?._id || '',
                            trackingNumber: shipment.logistics?.trackingNumber || ''
                        }
                    }],
                    $slice: -80
                },
                notificationLedger: {
                    notification_id: notificationId,
                    order_id: shipment.orderId,
                    notification_type: 'ready_for_pickup',
                    logistics_status: 'READY_FOR_PICKUP',
                    pickup_ready_verified: true,
                    template_version: 'dropi-pickup-reconciliation-v1',
                    created_at: new Date(),
                    sent_at: recoveredAt,
                    delivered_at: ['delivered', 'read'].includes(String(message?.deliveryStatus || '')) ? recoveredAt : null,
                    read_at: String(message?.deliveryStatus || '') === 'read' ? recoveredAt : null,
                    source: 'existing_message_reconciliation',
                    mode: message?.senderRole === 'human' || message?.isBot !== true ? 'manual' : 'automatic',
                    blocked_reason: '',
                    provider_message_id: message?.providerMessageId || message?._id || ''
                }
            }
        }
    );
    return result.modifiedCount === 1;
};

export const processExplicitDropiPickupReleaseQueue = async ({
    orderIds = [],
    limit = 8,
    dryRun = false
} = {}) => {
    const reconciliation = await reconcileExplicitDropiPickupReleases({ orderIds, limit: 500, dryRun });
    const uniqueOrderIds = [...new Set(orderIds.map((value) => String(value || '').trim()).filter(Boolean))];
    const query = {
        ...explicitDropiQuery({ orderIds: uniqueOrderIds }),
        ...(!dryRun ? {
            'logistics.status': 'READY_FOR_PICKUP',
            'logistics.pickupReadyVerified': true
        } : {}),
        'logistics.agencyPickup': true,
        'logistics.trackingNumber': { $exists: true, $ne: '' },
        'automation.readyForPickupNotifiedAt': null,
        'review.manualOnly': { $ne: true }
    };
    const candidates = await Shipment.find(query)
        .sort({ 'logistics.pickupReadyVerifiedAt': 1, updatedAt: 1 })
        .limit(Math.max(1, Math.min(Number(limit) || 8, 20)));
    const results = [];
    let sent = 0;
    let recovered = 0;
    let skipped = 0;
    for (const candidate of candidates) {
        if (dryRun) {
            results.push({ orderId: candidate.orderId, trackingNumber: candidate.logistics?.trackingNumber || '', dryRun: true });
            continue;
        }
        const now = new Date();
        const shipment = await Shipment.findOneAndUpdate(
            {
                _id: candidate._id,
                'automation.readyForPickupNotifiedAt': null,
                $or: [
                    { 'automation.dispatchLockedUntil': { $exists: false } },
                    { 'automation.dispatchLockedUntil': null },
                    { 'automation.dispatchLockedUntil': { $lte: now } }
                ]
            },
            { $set: { 'automation.dispatchLockedUntil': new Date(now.getTime() + DISPATCH_LOCK_MS) } },
            { new: true }
        );
        if (!shipment) {
            skipped += 1;
            results.push({ orderId: candidate.orderId, success: false, reason: 'dispatch_locked_or_already_notified' });
            continue;
        }
        const item = { orderId: shipment.orderId, trackingNumber: shipment.logistics?.trackingNumber || '', success: false };
        try {
            const existing = await findExistingPickupNotice(shipment);
            if (existing && await recoverExistingPickupNotice({ shipment, message: existing })) {
                item.success = true;
                item.recovered = true;
                item.sourceMessageId = existing._id || '';
                recovered += 1;
            } else {
                item.success = Boolean(await notifyReadyForPickup(shipment));
                if (item.success) sent += 1;
                else item.reason = 'pickup_notice_not_sent';
            }
        } catch (error) {
            item.error = error.message || 'pickup_release_dispatch_failed';
        } finally {
            await Shipment.updateOne(
                { _id: shipment._id },
                { $set: { 'automation.dispatchLockedUntil': null } }
            ).catch(() => null);
        }
        if (!item.success) skipped += 1;
        await appendReconciliationEvent(shipment._id, 'dropi_pickup_release_dispatch_attempt', {
            success: item.success,
            recovered: item.recovered === true,
            reason: item.reason || '',
            error: item.error || '',
            trackingNumber: item.trackingNumber
        }).catch(() => null);
        results.push(item);
    }
    return {
        dryRun: Boolean(dryRun),
        reconciliation,
        candidates: candidates.length,
        processed: results.length,
        sent,
        recovered,
        skipped,
        results
    };
};

export const handleExpandedPickupConfirmationInbound = async ({
    chatId,
    messageId = '',
    sessionId = '',
    proofText = '',
    hasMedia = false
} = {}) => {
    const recognized = isPickupProofText(proofText) || isExpandedCustomerPickupConfirmation(proofText);
    if (!recognized) return { handled: false, reason: 'text_without_pickup_confirmation' };
    return handlePickupProofInbound({
        chatId,
        messageId,
        sessionId,
        proofText: normalizeExpandedCustomerPickupConfirmation(proofText),
        hasMedia
    });
};

export const processExpandedPickupConfirmationSweep = async ({
    limit = 50,
    dryRun = false
} = {}) => {
    const shipments = await Shipment.find({
        country: 'EC',
        'logistics.agencyPickup': true,
        'automation.readyForPickupNotifiedAt': { $ne: null },
        'automation.bonusNotifiedAt': null,
        'outcomes.pickedUp': { $ne: true },
        'outcomes.delivered': { $ne: true }
    }).sort({ 'automation.readyForPickupNotifiedAt': 1 }).limit(Math.max(1, Math.min(Number(limit) || 50, 200)));
    const results = [];
    let confirmed = 0;
    for (const shipment of shipments) {
        const phoneClauses = phoneClausesForShipment(shipment);
        if (!phoneClauses.length) continue;
        const proof = await Message.findOne({
            $and: [
                { $or: phoneClauses },
                { body: expandedPickupConfirmationRegex() }
            ],
            isFromMe: false,
            isBot: false,
            createdAt: { $gte: shipment.automation.readyForPickupNotifiedAt }
        }).sort({ createdAt: -1 }).lean().catch(() => null);
        if (!proof) continue;
        const result = dryRun
            ? { handled: true, dryRun: true }
            : await handleExpandedPickupConfirmationInbound({
                chatId: proof.chatId,
                messageId: proof._id,
                sessionId: shipment.automation?.sessionId || 'zapi',
                proofText: proof.body || '',
                hasMedia: false
            });
        if (result.handled) confirmed += 1;
        results.push({
            orderId: shipment.orderId,
            trackingNumber: shipment.logistics?.trackingNumber || '',
            proofMessageId: proof._id,
            proofText: String(proof.body || '').slice(0, 160),
            result
        });
    }
    return { dryRun: Boolean(dryRun), candidates: shipments.length, confirmed, results };
};
