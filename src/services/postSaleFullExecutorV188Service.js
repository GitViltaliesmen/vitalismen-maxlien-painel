import Shipment from '../models/Shipment.js';
import { canaryV75SchedulerShipmentAllowed } from './canaryIsolationV75Service.js';
import {
    POST_SALE_NOTIFICATION_DECISIONS,
    decidePostSaleNotification
} from './postSaleNotificationDecisionService.js';
import {
    LEGACY_MARKERS_BY_STAGE,
    POST_SALE_STAGES,
    POST_SALE_VARIANTS,
    POST_SALE_TERMINAL_LEDGER_STATES,
    buildPostSaleIdempotencyKey,
    legacyKindForPostSaleStage
} from './postSaleSafetyV66Service.js';
import {
    notifyDeliveredThankYou,
    notifyPickupBonus,
    notifyProductUsage,
    notifyShipmentReminder,
    repurchaseProductPolicyForShipment
} from './shipmentMessageService.js';
import { shipmentStatusDispatchActionForShipment } from './shipmentStatusDispatcherService.js';
import {
    processTreatmentRefillV188,
    treatmentRefillDueAtV188
} from './postSaleRefillV188Service.js';
import {
    POST_SALE_V188_STAGES
} from './postSaleFullOperationalV188Service.js';
import { isPostSaleV194ForwardOnlyEligible } from './postSaleForwardOnlyV194Service.js';

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const clean = (value = '') => String(value ?? '').trim();

const ACTION_STAGE = Object.freeze({
    guide: POST_SALE_STAGES.GUIDE,
    in_transit: POST_SALE_STAGES.IN_TRANSIT,
    ready_for_pickup: POST_SALE_STAGES.READY_FOR_PICKUP,
    returned: POST_SALE_STAGES.RETURNED
});

const REMINDER_STAGE = Object.freeze({
    day1: POST_SALE_STAGES.PICKUP_REMINDER_DAY1,
    soft_day2: POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2,
    day3: POST_SALE_STAGES.PICKUP_REMINDER_DAY3,
    soft_day4: POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY4,
    day5: POST_SALE_STAGES.PICKUP_REMINDER_DAY5,
    soft_day6: POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY6
});

const AUDIO_STAGE = new Set([
    POST_SALE_STAGES.READY_FOR_PICKUP,
    POST_SALE_STAGES.PICKUP_REMINDER_DAY3,
    POST_SALE_STAGES.PICKUP_REMINDER_DAY5,
    POST_SALE_STAGES.DELIVERED_THANK_YOU,
    POST_SALE_STAGES.PRODUCT_USAGE,
    POST_SALE_STAGES.TREATMENT_REFILL_REMINDER
]);

const DAY_MS = 24 * 60 * 60 * 1000;

export const PICKUP_REMINDER_SCHEDULE_V188 = Object.freeze([
    Object.freeze({ kind: 'day1', field: 'reminderDay1At', days: 1 }),
    Object.freeze({ kind: 'soft_day2', field: 'reminderSoftDay2At', days: 2 }),
    Object.freeze({ kind: 'day3', field: 'reminderDay3At', days: 3 }),
    Object.freeze({ kind: 'soft_day4', field: 'reminderSoftDay4At', days: 4 }),
    Object.freeze({ kind: 'day5', field: 'reminderDay5At', days: 5 }),
    Object.freeze({ kind: 'soft_day6', field: 'reminderSoftDay6At', days: 6 })
]);

const stageMarkerPresent = (shipment = {}, stage = '') => (
    (LEGACY_MARKERS_BY_STAGE[stage] || []).some((field) => Boolean(shipment?.automation?.[field]))
);

const terminalLedger = (shipment = {}, stage = '') => {
    const entry = shipment?.automation?.postSaleSafetyLedger?.[stage];
    return entry && POST_SALE_TERMINAL_LEDGER_STATES.includes(clean(entry.state).toUpperCase())
        ? entry
        : null;
};

export const getDuePickupReminderStepV188 = (shipment = {}, now = new Date()) => {
    if (shipment?.review?.manualOnly === true
        || clean(shipment?.logistics?.status) !== 'READY_FOR_PICKUP'
        || clean(shipment?.logistics?.canonicalStatus) !== 'READY_FOR_PICKUP'
        || shipment?.logistics?.pickupReadyVerified !== true
        || clean(shipment?.logistics?.pickupReadyVerifiedSource) !== 'carrier_tracking'
        || shipment?.outcomes?.delivered === true
        || shipment?.outcomes?.pickedUp === true
        || shipment?.outcomes?.returned === true
        || shipment?.outcomes?.prepaidOnly === true) return null;
    const anchor = shipment?.automation?.readyForPickupNotifiedAt;
    const anchorMs = anchor ? new Date(anchor).getTime() : NaN;
    if (!Number.isFinite(anchorMs)) return null;

    // Não retrocede a cadência histórica. Se DAY3/DAY5 já saiu no runtime
    // anterior, a V188 continua somente da etapa posterior ainda não enviada.
    let lastCompletedIndex = -1;
    for (let index = 0; index < PICKUP_REMINDER_SCHEDULE_V188.length; index += 1) {
        if (shipment?.automation?.[PICKUP_REMINDER_SCHEDULE_V188[index].field]) {
            lastCompletedIndex = index;
        }
    }
    const next = PICKUP_REMINDER_SCHEDULE_V188[lastCompletedIndex + 1];
    if (!next) return null;
    const dueAt = new Date(anchorMs + (next.days * DAY_MS));
    return now.getTime() >= dueAt.getTime() ? { ...next, dueAt } : null;
};

const pickupProofAliasLedgerV188 = (shipment = {}, now = new Date()) => {
    const softLedger = shipment?.automation?.postSaleSafetyLedger?.[POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2];
    const providerMessageId = clean(softLedger?.providerMessageId);
    if (!providerMessageId || clean(softLedger?.state).toUpperCase() !== 'SENT') return null;
    return {
        stage: POST_SALE_STAGES.PICKUP_PROOF_REQUEST,
        variant: POST_SALE_VARIANTS.PICKUP_PROOF_REQUEST,
        state: 'SENT',
        decision: 'SHOULD_SEND',
        reason: 'satisfied_by_soft_day2_single_message',
        idempotencyKey: buildPostSaleIdempotencyKey({
            shipment,
            stage: POST_SALE_STAGES.PICKUP_PROOF_REQUEST,
            variant: POST_SALE_VARIANTS.PICKUP_PROOF_REQUEST
        }),
        providerMessageId,
        decidedAt: softLedger.decidedAt || now,
        finalizedAt: softLedger.finalizedAt || now,
        dataCompatibilityVersion: 66
    };
};

export const reconcilePickupProofAliasV188 = async ({
    shipmentId = null,
    limit = 50,
    dryRun = false,
    now = new Date(),
    shipmentModel = Shipment
} = {}) => {
    const proofStatePath = `automation.postSaleSafetyLedger.${POST_SALE_STAGES.PICKUP_PROOF_REQUEST}.state`;
    const query = {
        country: 'EC',
        ...(shipmentId ? { _id: shipmentId } : {}),
        'automation.reminderSoftDay2At': { $ne: null },
        'automation.pickupProofRequestedAt': { $ne: null },
        [`automation.postSaleSafetyLedger.${POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2}.state`]: 'SENT',
        $or: [
            { [proofStatePath]: { $exists: false } },
            { [proofStatePath]: null }
        ]
    };
    const shipments = await shipmentModel.find(query)
        .sort({ 'automation.reminderSoftDay2At': 1 })
        .limit(Math.max(1, Math.min(Number(limit) || 50, 200)));
    const report = { dryRun: Boolean(dryRun), candidates: shipments.length, reconciled: 0, blocked: 0 };
    for (const shipment of shipments) {
        const ledger = pickupProofAliasLedgerV188(shipment, now);
        if (!ledger) {
            report.blocked += 1;
            continue;
        }
        if (dryRun) continue;
        const update = await shipmentModel.updateOne({
            _id: shipment._id,
            $or: [
                { [proofStatePath]: { $exists: false } },
                { [proofStatePath]: null }
            ]
        }, { $set: {
            [`automation.postSaleSafetyLedger.${POST_SALE_STAGES.PICKUP_PROOF_REQUEST}`]: ledger
        } });
        if (Number(update?.modifiedCount || update?.nModified || 0) === 1) report.reconciled += 1;
    }
    return report;
};

export const processShipmentPickupRemindersV188 = async ({
    limit = 1,
    dryRun = true,
    now = new Date(),
    forwardOnlySince = null,
    shipmentModel = Shipment,
    notifyFn = notifyShipmentReminder
} = {}) => {
    const oldest = new Date(now.getTime() - (30 * DAY_MS));
    const shipments = await shipmentModel.find({
        country: 'EC',
        'client.phone': { $exists: true, $ne: '' },
        'review.manualOnly': { $ne: true },
        'logistics.status': 'READY_FOR_PICKUP',
        'logistics.canonicalStatus': 'READY_FOR_PICKUP',
        'logistics.pickupReadyVerified': true,
        'logistics.pickupReadyVerifiedSource': 'carrier_tracking',
        'logistics.agencyPickup': true,
        'logistics.trackingNumber': { $exists: true, $ne: '' },
        'automation.readyForPickupNotifiedAt': { $ne: null, $gte: oldest },
        'outcomes.delivered': false,
        'outcomes.pickedUp': false,
        'outcomes.returned': false,
        'outcomes.prepaidOnly': false
    }).sort({ 'automation.readyForPickupNotifiedAt': 1 }).limit(200);
    const due = shipments
        .map((shipment) => ({ shipment, step: getDuePickupReminderStepV188(shipment, now) }))
        .filter((item) => item.step
            && (!forwardOnlySince || isPostSaleV194ForwardOnlyEligible({
                shipment: item.shipment,
                stage: REMINDER_STAGE[item.step.kind],
                forwardOnlySince
            }))
            && canaryV75SchedulerShipmentAllowed(item.shipment).allowed);
    const safeLimit = Math.max(1, Math.min(Number(limit) || 1, 1));
    const report = { dryRun: Boolean(dryRun), candidates: due.length, selected: 0, processed: 0, sent: 0, items: [] };
    for (const item of due) {
        if (report.sent >= safeLimit || (dryRun && report.selected >= safeLimit)) break;
        report.selected += 1;
        report.items.push({
            shipmentId: String(item.shipment?._id || ''),
            orderId: clean(item.shipment?.orderId),
            phoneTail: digitsOnly(item.shipment?.client?.phone).slice(-4),
            trackingNumber: clean(item.shipment?.logistics?.trackingNumber),
            kind: item.step.kind,
            dueAt: item.step.dueAt
        });
        if (dryRun) continue;
        report.processed += 1;
        const sent = await notifyFn(item.shipment, item.step.kind);
        if (!sent) continue;
        report.sent += 1;
        if (item.step.kind === 'soft_day2') {
            report.pickupProofAlias = await reconcilePickupProofAliasV188({
                shipmentId: item.shipment._id,
                limit: 1,
                dryRun: false,
                now: new Date(),
                shipmentModel
            });
        }
    }
    return report;
};

const deliveredNextStage = (shipment = {}) => {
    if (!stageMarkerPresent(shipment, POST_SALE_STAGES.DELIVERED_THANK_YOU)) {
        return POST_SALE_STAGES.DELIVERED_THANK_YOU;
    }
    if (!stageMarkerPresent(shipment, POST_SALE_STAGES.PICKUP_BONUS)) {
        return POST_SALE_STAGES.PICKUP_BONUS;
    }
    if (!stageMarkerPresent(shipment, POST_SALE_STAGES.PRODUCT_USAGE)) {
        return POST_SALE_STAGES.PRODUCT_USAGE;
    }
    return '';
};

const classificationForDecision = (decision = {}) => {
    if (decision.decision === POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND) return 'READY_TO_SEND';
    if ([
        POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED,
        POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY,
        POST_SALE_NOTIFICATION_DECISIONS.HISTORICAL_EVENT_SUPPRESSED
    ].includes(decision.decision)) return 'ALREADY_SATISFIED';
    if (decision.decision === POST_SALE_NOTIFICATION_DECISIONS.MANUAL_REVIEW_REQUIRED) {
        return 'MANUAL_REVIEW_REQUIRED';
    }
    if (/missing|invalid|unknown_product|identity/i.test(clean(decision.reason))) return 'MISSING_DATA';
    return 'NOT_ELIGIBLE';
};

const dueStagesForShipment = (shipment = {}, now = new Date(), forwardOnlySince = null) => {
    const output = [];
    const action = shipmentStatusDispatchActionForShipment(shipment);
    if (ACTION_STAGE[action] && !stageMarkerPresent(shipment, ACTION_STAGE[action])) {
        output.push({ stage: ACTION_STAGE[action], scheduledAt: shipment.updatedAt || shipment.createdAt || now });
    }

    const reminder = getDuePickupReminderStepV188(shipment, now);
    if (reminder?.kind && REMINDER_STAGE[reminder.kind]) {
        output.push({ stage: REMINDER_STAGE[reminder.kind], scheduledAt: reminder.dueAt });
    }

    if (action === 'delivered_bonus') {
        const stage = deliveredNextStage(shipment);
        if (stage) {
            output.push({
                stage,
                scheduledAt: shipment?.logistics?.canonicalEvidence?.observedAt
                    || shipment?.automation?.deliveredConfirmedAt
                    || shipment.updatedAt
                    || now
            });
        }
    }

    if (!stageMarkerPresent(shipment, POST_SALE_STAGES.TREATMENT_REFILL_REMINDER)) {
        const refillDueAt = treatmentRefillDueAtV188(shipment);
        if (refillDueAt && refillDueAt.getTime() <= now.getTime()) {
            output.push({ stage: POST_SALE_STAGES.TREATMENT_REFILL_REMINDER, scheduledAt: refillDueAt });
        }
    }
    return forwardOnlySince
        ? output.filter((item) => isPostSaleV194ForwardOnlyEligible({
            shipment,
            stage: item.stage,
            forwardOnlySince
        }))
        : output;
};

export const buildPostSaleBacklogSnapshotV188 = async ({
    now = new Date(),
    limit = 1000,
    forwardOnlySince = null,
    shipmentModel = Shipment
} = {}) => {
    const shipments = await shipmentModel.find({
        country: 'EC',
        'client.phone': { $exists: true, $ne: '' }
    }).sort({ updatedAt: 1, createdAt: 1 }).limit(Math.max(1, Math.min(Number(limit) || 1000, 5000)));

    const backlog = [];
    for (const shipment of shipments) {
        for (const due of dueStagesForShipment(shipment, now, forwardOnlySince)) {
            const ledger = terminalLedger(shipment, due.stage);
            if (clean(ledger?.state).toUpperCase() === 'AMBIGUOUS') {
                backlog.push({ shipment, due, decision: {
                    decision: POST_SALE_NOTIFICATION_DECISIONS.MANUAL_REVIEW_REQUIRED,
                    reason: 'terminal_ambiguous_ledger',
                    stage: due.stage,
                    idempotencyKey: ledger.idempotencyKey || ''
                }, classification: 'AMBIGUOUS' });
                continue;
            }
            const kind = legacyKindForPostSaleStage(due.stage);
            const decision = await decidePostSaleNotification({
                shipment,
                kind,
                acquireLock: false,
                now
            });
            backlog.push({ shipment, due, decision, classification: classificationForDecision(decision) });
        }
    }

    const items = backlog.map(({ shipment, due, decision, classification }) => ({
        shipment_id: String(shipment?._id || ''),
        order_id: clean(shipment?.orderId),
        phone_masked: `***${digitsOnly(shipment?.client?.phone).slice(-4)}`,
        product: repurchaseProductPolicyForShipment(shipment).productKey || clean(shipment?.productName || shipment?.raw?.productName),
        canonical_status: clean(shipment?.logistics?.canonicalStatus),
        stage_due: due.stage,
        scheduled_at: due.scheduledAt ? new Date(due.scheduledAt).toISOString() : '',
        last_event: clean((shipment?.events || []).at(-1)?.kind),
        dedupe_key: decision?.idempotencyKey || buildPostSaleIdempotencyKey({ shipment, stage: due.stage }),
        ledger_state: clean(shipment?.automation?.postSaleSafetyLedger?.[due.stage]?.state),
        eligible: classification === 'READY_TO_SEND',
        blocked_reason: classification === 'READY_TO_SEND' ? '' : clean(decision?.reason),
        classification
    }));

    const inventory = [];
    for (const stage of POST_SALE_V188_STAGES) {
        const markers = LEGACY_MARKERS_BY_STAGE[stage] || [];
        const alreadySentQuery = markers.length === 1
            ? { [`automation.${markers[0]}`]: { $ne: null } }
            : { $or: markers.map((marker) => ({ [`automation.${marker}`]: { $ne: null } })) };
        const [alreadySent, ambiguous] = await Promise.all([
            markers.length ? shipmentModel.countDocuments({ country: 'EC', ...alreadySentQuery }) : 0,
            shipmentModel.countDocuments({
                country: 'EC',
                [`automation.postSaleSafetyLedger.${stage}.state`]: 'AMBIGUOUS'
            })
        ]);
        const stageItems = items.filter((item) => item.stage_due === (
            stage === POST_SALE_STAGES.PICKUP_PROOF_REQUEST
                ? POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2
                : stage
        ));
        inventory.push({
            stage,
            defined: true,
            implemented: true,
            reachable: true,
            schedulerWired: stage === POST_SALE_STAGES.PICKUP_PROOF_REQUEST
                ? 'SOFT_DAY2_SINGLE_MESSAGE'
                : true,
            flagEnabled: true,
            templateAvailable: true,
            audioAvailable: AUDIO_STAGE.has(stage) ? true : 'NOT_REQUIRED',
            eligibilityRule: legacyKindForPostSaleStage(stage),
            dedupeRule: 'canonical_dedupe_key+history+legacy_marker',
            terminalLedger: true,
            providerConfirmation: true,
            dueNowCount: stageItems.length,
            alreadySentCount: alreadySent,
            blockedCount: stageItems.filter((item) => !item.eligible && item.classification !== 'AMBIGUOUS').length,
            ambiguousCount: ambiguous
        });
    }

    const count = (classification) => items.filter((item) => item.classification === classification).length;
    return {
        generatedAt: now.toISOString(),
        readOnly: true,
        outboundCount: 0,
        shipmentsScanned: shipments.length,
        total: items.length,
        ready: count('READY_TO_SEND'),
        alreadySatisfied: count('ALREADY_SATISFIED'),
        notEligible: count('NOT_ELIGIBLE'),
        ambiguous: count('AMBIGUOUS'),
        missingData: count('MISSING_DATA'),
        manualReviewRequired: count('MANUAL_REVIEW_REQUIRED'),
        deterministicKeyHash: buildDeterministicBacklogHashV188(items),
        inventory,
        items
    };
};

export const buildDeterministicBacklogHashV188 = (items = []) => {
    const normalized = items.map((item) => [
        item.shipment_id,
        item.order_id,
        item.stage_due,
        item.scheduled_at,
        item.dedupe_key,
        item.classification
    ].join('|')).sort().join('\n');
    return buildPostSaleIdempotencyKey({
        shipment: {
            country: 'EC',
            orderId: 'V188-BACKLOG',
            _id: 'V188-BACKLOG',
            client: { customerId: normalized || 'EMPTY' }
        },
        stage: POST_SALE_STAGES.GUIDE
    });
};

export const planDeliveredSequenceV188 = async ({
    now = new Date(),
    limit = 200,
    forwardOnlySince = null,
    shipmentModel = Shipment
} = {}) => {
    const shipments = await shipmentModel.find({
        country: 'EC',
        'client.phone': { $exists: true, $ne: '' },
        'logistics.canonicalStatus': 'DELIVERED',
        'logistics.canonicalEvidence.provider': /^servientrega$/i,
        'logistics.canonicalEvidence.source': /^carrier_tracking$/i,
        'outcomes.returned': { $ne: true }
    }).sort({ 'logistics.canonicalEvidence.observedAt': 1, updatedAt: 1 }).limit(Math.max(1, Math.min(Number(limit) || 200, 1000)));
    const items = [];
    for (const shipment of shipments) {
        const stage = deliveredNextStage(shipment);
        if (!stage) continue;
        if (forwardOnlySince && !isPostSaleV194ForwardOnlyEligible({ shipment, stage, forwardOnlySince })) continue;
        const decision = await decidePostSaleNotification({
            shipment,
            kind: legacyKindForPostSaleStage(stage),
            acquireLock: false,
            now
        });
        items.push({ shipment, stage, decision, eligible: decision.decision === POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND });
    }
    return items;
};

export const processDeliveredSequenceV188 = async ({
    now = new Date(),
    limit = 1,
    dryRun = true,
    forwardOnlySince = null,
    shipmentModel = Shipment
} = {}) => {
    const plan = await planDeliveredSequenceV188({ now, forwardOnlySince, shipmentModel });
    const ready = plan.filter((item) => item.eligible).slice(0, Math.max(1, Math.min(Number(limit) || 1, 1)));
    const report = {
        dryRun: Boolean(dryRun),
        candidates: plan.length,
        ready: ready.length,
        sent: 0,
        items: ready.map((item) => ({
            shipmentId: String(item.shipment?._id || ''),
            orderId: clean(item.shipment?.orderId),
            phoneTail: digitsOnly(item.shipment?.client?.phone).slice(-4),
            stage: item.stage,
            idempotencyKey: item.decision?.idempotencyKey || ''
        }))
    };
    if (dryRun) return report;
    const notifierByStage = {
        [POST_SALE_STAGES.DELIVERED_THANK_YOU]: notifyDeliveredThankYou,
        [POST_SALE_STAGES.PICKUP_BONUS]: notifyPickupBonus,
        [POST_SALE_STAGES.PRODUCT_USAGE]: notifyProductUsage
    };
    for (const item of ready) {
        const fresh = await shipmentModel.findById(item.shipment._id);
        const notify = notifierByStage[item.stage];
        if (fresh && notify && await notify(fresh)) report.sent += 1;
    }
    return report;
};

export const processRefillStageV188 = processTreatmentRefillV188;
