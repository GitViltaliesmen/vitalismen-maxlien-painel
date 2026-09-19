import Shipment from '../models/Shipment.js';
import {
    POST_SALE_NOTIFICATION_DECISIONS,
    decidePostSaleNotification
} from './postSaleNotificationDecisionService.js';
import {
    notifyTreatmentRefillReminder,
    repurchaseProductPolicyForShipment,
    repurchaseReminderDelayDaysForUnits
} from './shipmentMessageService.js';
import { servientregaPostSaleCompletionEligibleV147 } from './canonicalLogisticsStatusV147Service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');

const deliveredReferenceDate = (shipment = {}) => {
    const candidates = [
        shipment?.automation?.deliveredConfirmedAt,
        shipment?.proof?.pickupProofReceivedAt,
        shipment?.logistics?.canonicalEvidence?.observedAt,
        shipment?.logistics?.lastStatusAt
    ];
    for (const candidate of candidates) {
        const parsed = candidate ? new Date(candidate) : null;
        if (parsed && Number.isFinite(parsed.getTime())) return parsed;
    }
    return null;
};

export const treatmentRefillDueAtV188 = (shipment = {}) => {
    if (!servientregaPostSaleCompletionEligibleV147(shipment)) return null;
    const explicitDue = shipment?.treatment?.refillReminderDueAt
        ? new Date(shipment.treatment.refillReminderDueAt)
        : null;
    if (explicitDue && Number.isFinite(explicitDue.getTime())) return explicitDue;
    const deliveredAt = deliveredReferenceDate(shipment);
    if (!deliveredAt) return null;
    const days = repurchaseReminderDelayDaysForUnits(shipment?.treatment?.unitsPurchased || 1);
    return new Date(deliveredAt.getTime() + (days * DAY_MS));
};

const baseCandidateReasonV188 = (shipment = {}, now = new Date()) => {
    const phone = digitsOnly(shipment?.client?.phone);
    if (phone.length < 9 || phone.length > 15) return 'invalid_phone';
    if (shipment?.automation?.refillReminderAt) return 'already_sent_marker';
    if (shipment?.review?.manualOnly === true) return 'shipment_manual_only';
    if (shipment?.outcomes?.returned === true) return 'shipment_returned';
    if (shipment?.outcomes?.prepaidOnly === true) return 'shipment_prepaid_only';
    if (!servientregaPostSaleCompletionEligibleV147(shipment)) return 'canonical_servientrega_delivery_required';
    const product = repurchaseProductPolicyForShipment(shipment);
    if (!product.enabled) return 'unknown_product';
    const dueAt = treatmentRefillDueAtV188(shipment);
    if (!dueAt) return 'delivery_reference_missing';
    if (dueAt.getTime() > now.getTime()) return 'not_due';
    return '';
};

export const listTreatmentRefillCandidatesV188 = async ({
    now = new Date(),
    limit = 200,
    shipmentModel = Shipment
} = {}) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 1000));
    const shipments = await shipmentModel.find({
        country: 'EC',
        'client.phone': { $exists: true, $ne: '' },
        'automation.refillReminderAt': null,
        'logistics.canonicalStatus': 'DELIVERED',
        'outcomes.returned': { $ne: true },
        'outcomes.prepaidOnly': { $ne: true }
    }).sort({ 'logistics.canonicalEvidence.observedAt': 1, 'automation.deliveredConfirmedAt': 1 }).limit(safeLimit);

    const results = [];
    for (const shipment of shipments) {
        const baseReason = baseCandidateReasonV188(shipment, now);
        const dueAt = treatmentRefillDueAtV188(shipment);
        let decision = null;
        if (!baseReason) {
            decision = await decidePostSaleNotification({
                shipment,
                kind: 'treatment_refill_reminder',
                acquireLock: false,
                now
            });
        }
        results.push({
            shipment,
            dueAt,
            eligible: !baseReason && decision?.decision === POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND,
            reason: baseReason || decision?.reason || 'not_eligible',
            decision
        });
    }
    return results;
};

export const processTreatmentRefillV188 = async ({
    now = new Date(),
    limit = 1,
    dryRun = true,
    shipmentModel = Shipment,
    notifyFn = notifyTreatmentRefillReminder
} = {}) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 1, 1));
    const candidates = await listTreatmentRefillCandidatesV188({ now, shipmentModel });
    const ready = candidates.filter((item) => item.eligible).slice(0, safeLimit);
    const report = {
        dryRun: Boolean(dryRun),
        candidates: candidates.length,
        ready: ready.length,
        sent: 0,
        blocked: candidates.filter((item) => !item.eligible && item.reason !== 'not_due').length,
        items: ready.map((item) => ({
            shipmentId: String(item.shipment?._id || ''),
            orderId: String(item.shipment?.orderId || ''),
            phoneTail: digitsOnly(item.shipment?.client?.phone).slice(-4),
            product: repurchaseProductPolicyForShipment(item.shipment).productKey,
            dueAt: item.dueAt,
            decision: item.decision?.decision || '',
            reason: item.reason,
            idempotencyKey: item.decision?.idempotencyKey || ''
        }))
    };
    if (dryRun) return report;
    for (const item of ready) {
        const fresh = await shipmentModel.findById(item.shipment._id);
        if (!fresh || baseCandidateReasonV188(fresh, new Date())) continue;
        if (await notifyFn(fresh)) report.sent += 1;
    }
    return report;
};
