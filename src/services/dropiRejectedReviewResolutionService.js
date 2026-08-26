import crypto from 'crypto';
import Shipment from '../models/Shipment.js';

const clean = (value = '') => String(value || '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');
const normalizedStatus = (value = '') => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');

const AUTHORITATIVE_SOURCES = new Set([
    'dropi_api',
    'dropi_orders_api',
    'dropi_panel',
    'dropi_panel_dom',
    'dropi_sync_authoritative',
    'manual_guide_verified'
]);

const LATER_LOGISTICS_STATUSES = new Set([
    'PENDIENTE',
    'GUIA_GENERADA',
    'MERCANCIA_RECOGIDA',
    'EN_BODEGA_TRANSPORTADORA',
    'EN_DESPACHO',
    'EN_PROCESAMIENTO',
    'EN_RUTA',
    'EN_REPARTO',
    'READY_FOR_PICKUP',
    'ENTREGADO',
    'DEVUELTO'
]);

export const isStaleDropiRejectedReview = (shipment = {}) => (
    shipment?.review?.manualOnly === true
    && clean(shipment?.review?.reviewReason) === 'dropi_rejected'
    && clean(shipment?.review?.reviewStatus) === 'manual_send_required'
);

export const suppressedNotificationKindsForStatus = (status = '') => {
    const value = normalizedStatus(status);
    if (value === 'GUIA_GENERADA') return ['guide'];
    if (['MERCANCIA_RECOGIDA', 'EN_BODEGA_TRANSPORTADORA', 'EN_DESPACHO', 'EN_PROCESAMIENTO', 'EN_RUTA', 'EN_REPARTO'].includes(value)) {
        return ['guide', 'in_transit'];
    }
    if (value === 'READY_FOR_PICKUP') return ['guide', 'in_transit', 'ready_for_pickup'];
    if (value === 'ENTREGADO') return ['guide', 'in_transit', 'ready_for_pickup', 'delivered_bonus'];
    if (value === 'DEVUELTO') return ['guide', 'in_transit', 'ready_for_pickup', 'returned'];
    return [];
};

export const canResolveStaleDropiRejectedReview = ({ shipment = {}, evidence = {} } = {}) => {
    if (!isStaleDropiRejectedReview(shipment)) return { ok: false, reason: 'review_not_exact_stale_dropi_rejected' };
    const source = clean(evidence.source);
    if (!AUTHORITATIVE_SOURCES.has(source)) return { ok: false, reason: 'non_authoritative_source' };
    if (clean(evidence.orderId) && clean(evidence.orderId) !== clean(shipment.orderId)) {
        return { ok: false, reason: 'order_identity_mismatch' };
    }
    const dropiOrderId = digitsOnly(evidence.dropiOrderId);
    const trackingNumber = digitsOnly(evidence.trackingNumber);
    const status = normalizedStatus(evidence.status);
    if (!dropiOrderId && trackingNumber.length < 6) return { ok: false, reason: 'missing_dropi_or_tracking_evidence' };
    if (!LATER_LOGISTICS_STATUSES.has(status)) return { ok: false, reason: 'status_not_authoritative_later_state' };
    if (status === 'PENDIENTE' && !dropiOrderId) return { ok: false, reason: 'pending_requires_exact_dropi_id' };
    return {
        ok: true,
        reason: 'authoritative_logistics_supersedes_dropi_rejection',
        evidence: {
            source,
            orderId: clean(shipment.orderId),
            dropiOrderId,
            trackingNumber,
            status,
            observedAt: evidence.observedAt || new Date()
        },
        suppressedNotificationKinds: suppressedNotificationKindsForStatus(status)
    };
};

export const resolveStaleDropiRejectedReviewAtomic = async ({
    shipment,
    evidence,
    model = Shipment,
    now = new Date(),
    lockMs = 60_000
} = {}) => {
    const decision = canResolveStaleDropiRejectedReview({ shipment, evidence });
    if (!decision.ok || !shipment?._id) return { resolved: false, ...decision };
    const token = crypto.randomUUID();
    const exactStaleReview = {
        _id: shipment._id,
        'review.manualOnly': true,
        'review.reviewReason': 'dropi_rejected',
        'review.reviewStatus': 'manual_send_required'
    };
    const locked = await model.findOneAndUpdate(
        {
            ...exactStaleReview,
            $or: [
                { 'review.resolutionLockUntil': { $exists: false } },
                { 'review.resolutionLockUntil': null },
                { 'review.resolutionLockUntil': { $lte: now } }
            ]
        },
        {
            $set: {
                'review.resolutionLockUntil': new Date(now.getTime() + lockMs),
                'review.resolutionLockToken': token
            }
        },
        { new: true }
    );
    if (!locked) return { resolved: false, reason: 'resolution_locked_or_review_changed' };

    const before = {
        manualOnly: true,
        reviewReason: 'dropi_rejected',
        reviewStatus: 'manual_send_required'
    };
    const after = {
        manualOnly: false,
        reviewReason: '',
        reviewStatus: 'superseded_by_authoritative_logistics'
    };
    const audit = {
        at: now,
        source: decision.evidence.source,
        reason: decision.reason,
        before,
        after,
        evidence: decision.evidence,
        suppressedNotificationKinds: decision.suppressedNotificationKinds
    };
    const updated = await model.findOneAndUpdate(
        {
            ...exactStaleReview,
            'review.resolutionLockToken': token
        },
        {
            $set: {
                'review.manualOnly': false,
                'review.reviewReason': '',
                'review.reviewStatus': after.reviewStatus,
                'review.resolvedAt': now,
                'review.resolvedSource': decision.evidence.source,
                'review.resolvedEvidence': decision.evidence,
                'review.resolutionLockUntil': null,
                'review.resolutionLockToken': ''
            },
            $addToSet: {
                'review.suppressedNotificationKinds': { $each: decision.suppressedNotificationKinds }
            },
            $push: {
                'review.resolutionHistory': { $each: [audit], $slice: -20 },
                events: {
                    $each: [{ kind: 'dropi_rejected_review_resolved', at: now, payload: audit }],
                    $slice: -60
                }
            }
        },
        { new: true }
    );
    return updated
        ? { resolved: true, reason: decision.reason, shipment: updated, audit }
        : { resolved: false, reason: 'review_changed_after_resolution_lock' };
};

export default resolveStaleDropiRejectedReviewAtomic;
