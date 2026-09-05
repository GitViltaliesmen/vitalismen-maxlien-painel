import crypto from 'crypto';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import Shipment from '../models/Shipment.js';
import {
    LEGACY_MARKERS_BY_STAGE,
    POST_SALE_STAGES,
    POST_SALE_TERMINAL_LEDGER_STATES,
    buildPostSaleIdempotencyKey,
    canonicalPostSaleStage,
    legacyKindForPostSaleStage,
    legacyMarkerSetForStage,
    postSaleLedgerPath,
    terminalPostSaleSafetyEntry
} from './postSaleSafetyV66Service.js';
import { canaryV75SchedulerShipmentAllowed } from './canaryIsolationV75Service.js';

export const POST_SALE_NOTIFICATION_DECISIONS = Object.freeze({
    SHOULD_SEND: 'SHOULD_SEND',
    ALREADY_NOTIFIED_STRUCTURED: 'ALREADY_NOTIFIED_STRUCTURED',
    ALREADY_NOTIFIED_MANUALLY: 'ALREADY_NOTIFIED_MANUALLY',
    HISTORICAL_EVENT_SUPPRESSED: 'HISTORICAL_EVENT_SUPPRESSED',
    MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED',
    NOT_ELIGIBLE: 'NOT_ELIGIBLE'
});

const MARKER_BY_KIND = Object.freeze({
    guide: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.GUIDE],
    in_transit: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.IN_TRANSIT],
    ready_for_pickup: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.READY_FOR_PICKUP],
    returned: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.RETURNED],
    pickup_reminder_day1: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.PICKUP_REMINDER_DAY1],
    pickup_reminder_soft_day2: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2],
    pickup_reminder_day3: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.PICKUP_REMINDER_DAY3],
    pickup_reminder_soft_day4: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY4],
    pickup_reminder_day5: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.PICKUP_REMINDER_DAY5],
    pickup_reminder_soft_day6: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY6],
    pickup_proof_request: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.PICKUP_PROOF_REQUEST],
    pickup_bonus: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.PICKUP_BONUS],
    treatment_refill_reminder: LEGACY_MARKERS_BY_STAGE[POST_SALE_STAGES.TREATMENT_REFILL_REMINDER]
});

const EVENT_BY_KIND = Object.freeze({
    guide: ['guia_notified'],
    in_transit: ['in_transit_notified'],
    ready_for_pickup: ['ready_for_pickup_notified', 'ready_for_pickup_recovered_existing_message'],
    returned: ['returned_notified'],
    pickup_reminder_day1: ['reminder_day1'],
    pickup_reminder_soft_day2: ['reminder_soft_day2'],
    pickup_reminder_day3: ['reminder_day3'],
    pickup_reminder_soft_day4: ['reminder_soft_day4'],
    pickup_reminder_day5: ['reminder_day5'],
    pickup_reminder_soft_day6: ['reminder_soft_day6'],
    pickup_proof_request: ['pickup_proof_requested'],
    pickup_bonus: ['pickup_bonus_notified'],
    treatment_refill_reminder: ['refill_reminder_notified']
});

const clean = (value = '') => String(value || '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');
export const postSaleTransactionalAllowsManualHumanMode = ({ shipment = {}, env = process.env } = {}) => (
    clean(env.VITALISMEN_EC_POSTSALE_TRANSACTIONAL_OPERATIONAL).toLowerCase() === 'true'
    && clean(env.POST_SALE_TRANSACTIONAL_AT_MOST_ONCE_V116_ENABLED).toLowerCase() === 'true'
    && Boolean(shipment?.raw?.postSaleTransactionalApprovedAt)
);
const statusKey = (value = '') => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');

const phoneIdentityVariants = (value = '') => {
    const digits = digitsOnly(value);
    return [...new Set([
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter((item) => item.length >= 8))];
};

const terminalLedgerPresent = (shipment = {}, stages = []) => stages.some((stage) => (
    Boolean(terminalPostSaleSafetyEntry(shipment, stage))
));

export const evaluatePostSaleChronology = ({ shipment = {}, kind = '' } = {}) => {
    const stage = canonicalPostSaleStage(kind);
    const status = statusKey(shipment?.logistics?.status);
    const terminalOutcome = shipment?.outcomes?.delivered === true
        || shipment?.outcomes?.pickedUp === true
        || shipment?.outcomes?.returned === true
        || [
            'ENTREGADO', 'DELIVERED', 'PICKED_UP', 'PICKEDUP', 'RETIRADO', 'RECOGIDO',
            'DEVUELTO', 'RETURNED', 'DEVOLUCION', 'NO_RETIRADO',
            'CANCELADO', 'CANCELADO_SERVIENTREGA'
        ].includes(status);
    const readyOrLater = [
        'READY_FOR_PICKUP', 'LISTO_PARA_RETIRO', 'PARA_RETIRO_EN_AGENCIA', 'DISPONIBLE_PARA_RETIRO'
    ].includes(status) || terminalOutcome;
    const inTransitOrLater = [
        'MERCANCIA_RECOGIDA', 'EN_BODEGA_TRANSPORTADORA', 'EN_DESPACHO',
        'EN_PROCESAMIENTO', 'EN_RUTA', 'EN_REPARTO', 'EN_DISTRIBUCION_A_CLIENTE'
    ].includes(status) || readyOrLater;
    const laterThanGuideLedger = terminalLedgerPresent(shipment, [
        POST_SALE_STAGES.IN_TRANSIT,
        POST_SALE_STAGES.READY_FOR_PICKUP,
        POST_SALE_STAGES.RETURNED,
        POST_SALE_STAGES.PICKUP_REMINDER_DAY1,
        POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2,
        POST_SALE_STAGES.PICKUP_REMINDER_DAY3,
        POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY4,
        POST_SALE_STAGES.PICKUP_REMINDER_DAY5,
        POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY6,
        POST_SALE_STAGES.PICKUP_PROOF_REQUEST,
        POST_SALE_STAGES.PICKUP_BONUS
    ]);
    const laterThanTransitLedger = terminalLedgerPresent(shipment, [
        POST_SALE_STAGES.READY_FOR_PICKUP,
        POST_SALE_STAGES.RETURNED,
        POST_SALE_STAGES.PICKUP_REMINDER_DAY1,
        POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2,
        POST_SALE_STAGES.PICKUP_REMINDER_DAY3,
        POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY4,
        POST_SALE_STAGES.PICKUP_REMINDER_DAY5,
        POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY6,
        POST_SALE_STAGES.PICKUP_PROOF_REQUEST,
        POST_SALE_STAGES.PICKUP_BONUS
    ]);

    if (stage === POST_SALE_STAGES.GUIDE && (inTransitOrLater || laterThanGuideLedger)) {
        return { allowed: false, reason: 'chronology_blocks_guide_after_later_stage', stage, status };
    }
    if (stage === POST_SALE_STAGES.IN_TRANSIT && (readyOrLater || laterThanTransitLedger)) {
        return { allowed: false, reason: 'chronology_blocks_in_transit_after_later_stage', stage, status };
    }
    return { allowed: true, reason: 'chronology_current', stage, status };
};

export const findManualHumanModeForShipment = async ({
    shipment = {},
    contactStateModel = ContactState
} = {}) => {
    const variants = phoneIdentityVariants(shipment?.client?.phone);
    if (!variants.length) return null;
    if (contactStateModel === ContactState && ContactState?.db?.readyState !== 1) return null;
    const state = await contactStateModel.findOne({
        countryCode: 'EC',
        'human.mode': 'manual',
        $or: [
            { phoneDigits: { $in: variants } },
            ...variants.map((tail) => ({ chatId: { $regex: `${tail}(?:@|$)` } }))
        ]
    }).sort({ updatedAt: -1 }).select('_id human.mode').lean().catch(() => null);
    return state || null;
};

const eligibilityForKind = (shipment = {}, kind = '') => {
    const status = statusKey(shipment?.logistics?.status);
    const tracking = digitsOnly(shipment?.logistics?.trackingNumber);
    if (kind === 'guide') {
        return tracking.length >= 6 && !['ENTREGADO', 'DEVUELTO', 'CANCELADO'].includes(status);
    }
    if (kind === 'in_transit') {
        return tracking.length >= 6 && [
            'MERCANCIA_RECOGIDA', 'EN_BODEGA_TRANSPORTADORA', 'EN_DESPACHO',
            'EN_PROCESAMIENTO', 'EN_RUTA', 'EN_REPARTO', 'EN_DISTRIBUCION_A_CLIENTE'
        ].includes(status);
    }
    if (kind === 'ready_for_pickup') {
        return status === 'READY_FOR_PICKUP'
            && shipment?.logistics?.pickupReadyVerified === true
            && shipment?.logistics?.agencyPickup === true
            && tracking.length >= 6;
    }
    if (kind === 'returned') {
        return status === 'DEVUELTO' || shipment?.outcomes?.returned === true;
    }
    if (kind.startsWith('pickup_reminder_') || kind === 'pickup_proof_request') {
        return status === 'READY_FOR_PICKUP'
            && shipment?.logistics?.pickupReadyVerified === true
            && shipment?.logistics?.agencyPickup === true
            && tracking.length >= 6;
    }
    if (kind === 'pickup_bonus' || kind === 'treatment_refill_reminder') {
        return shipment?.outcomes?.pickedUp === true
            || shipment?.outcomes?.delivered === true
            || status === 'ENTREGADO';
    }
    return false;
};

const historyMatchesKind = (message = {}, shipment = {}, kind = '') => {
    const body = clean(message?.body).toLowerCase();
    if (!body) return false;
    const tracking = digitsOnly(shipment?.logistics?.trackingNumber);
    const bodyDigits = digitsOnly(body);
    const trackingMentioned = Boolean(tracking && bodyDigits.includes(tracking));
    if (kind === 'guide') return trackingMentioned && /gu[ií]a|servientrega|pedido/.test(body);
    if (kind === 'in_transit') return trackingMentioned && /en ruta|tr[aá]nsito|avanzando|despach/.test(body);
    if (kind === 'ready_for_pickup') {
        return /retir|recoger|agencia|ya puede ir|listo para/.test(body)
            && (trackingMentioned || /servientrega/.test(body));
    }
    if (kind === 'returned') return /devuelt|devoluci[oó]n|no fue retir|pago anticipado/.test(body);
    return false;
};

const messageIdentityClauses = (shipment = {}) => {
    const digits = digitsOnly(shipment?.client?.phone);
    const tails = [...new Set([
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter((value) => value.length >= 8))];
    return [
        ...(shipment?.orderId ? [{ orderId: shipment.orderId }] : []),
        ...tails.flatMap((tail) => ([
            { peerPhone: { $regex: `${tail}$` } },
            { chatId: { $regex: tail } },
            { to: { $regex: tail } }
        ]))
    ];
};

const structuredShipmentEvidence = (shipment = {}, kind = '') => {
    const stage = canonicalPostSaleStage(kind);
    const safetyEntry = terminalPostSaleSafetyEntry(shipment, stage);
    if (safetyEntry) return { found: true, source: `automation.postSaleSafetyLedger.${stage}`, safetyEntry };
    const marker = (MARKER_BY_KIND[kind] || []).find((field) => shipment?.automation?.[field]);
    if (marker) return { found: true, source: `automation.${marker}` };
    const eventKinds = new Set(EVENT_BY_KIND[kind] || []);
    const event = (shipment?.events || []).find((item) => eventKinds.has(clean(item?.kind)));
    if (event) return { found: true, source: `event.${event.kind}` };
    const ledger = (shipment?.notificationLedger || []).find((entry) => (
        entry?.sent_at
        && [kind, `shipment_${kind}_text`].includes(clean(entry?.notification_type))
    ));
    if (ledger) return { found: true, source: 'notificationLedger' };
    return { found: false, source: '' };
};

const safetyStateForDecision = (decision = '') => ({
    [POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED]: 'RECOVERED_STRUCTURED',
    [POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY]: 'RECOVERED_MANUAL',
    [POST_SALE_NOTIFICATION_DECISIONS.HISTORICAL_EVENT_SUPPRESSED]: 'SUPPRESSED_HISTORICAL'
}[decision] || '');

const persistTerminalSafetyDecision = async ({
    shipment,
    stage,
    variant,
    decision,
    reason,
    evidence = {},
    shipmentModel = Shipment,
    now = new Date()
} = {}) => {
    const safetyState = safetyStateForDecision(decision);
    if (!shipment?._id || !safetyState) return { persisted: false };
    const ledgerPath = postSaleLedgerPath(stage);
    const idempotencyKey = buildPostSaleIdempotencyKey({ shipment, stage, variant });
    const result = await shipmentModel.updateOne(
        { _id: shipment._id },
        {
            $set: {
                ...legacyMarkerSetForStage(stage, now),
                [ledgerPath]: {
                    stage,
                    variant: clean(variant) || legacyKindForPostSaleStage(stage),
                    state: safetyState,
                    decision,
                    reason: clean(reason),
                    idempotencyKey,
                    decidedAt: now,
                    finalizedAt: now,
                    evidence: {
                        source: clean(evidence?.source || reason),
                        messageId: clean(evidence?.messageId),
                        at: evidence?.at || null
                    },
                    dataCompatibilityVersion: 66
                }
            }
        }
    );
    return { persisted: result?.modifiedCount === 1 || result?.matchedCount === 1, idempotencyKey };
};

const outboundHistoryDecision = async ({ shipment, kind, messageModel = Message } = {}) => {
    const clauses = messageIdentityClauses(shipment);
    if (!clauses.length) return null;
    const messages = await messageModel.find({
        isFromMe: true,
        $or: clauses
    }).sort({ timestamp: -1, createdAt: -1 }).limit(120).lean().catch(() => []);
    const match = messages.find((message) => historyMatchesKind(message, shipment, kind));
    if (!match) return null;
    const structured = match.isBot === true || clean(match.senderRole) === 'bot';
    return {
        decision: structured
            ? POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED
            : POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY,
        reason: structured ? 'matching_automation_message_history' : 'matching_human_message_history',
        evidence: {
            messageId: clean(match._id),
            at: match.createdAt || (match.timestamp ? new Date(match.timestamp * 1000) : null),
            trackingMatched: digitsOnly(match.body).includes(digitsOnly(shipment?.logistics?.trackingNumber))
        }
    };
};

export const decidePostSaleNotification = async ({
    shipment,
    kind,
    variant = '',
    acquireLock = true,
    messageModel = Message,
    shipmentModel = Shipment,
    contactStateModel = ContactState,
    now = new Date(),
    lockMs = 10 * 60 * 1000
} = {}) => {
    const stage = canonicalPostSaleStage(kind || variant);
    const legacyKind = legacyKindForPostSaleStage(stage);
    const validKind = Object.prototype.hasOwnProperty.call(MARKER_BY_KIND, legacyKind);
    if (!shipment || !validKind) {
        return { decision: POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE, reason: 'missing_shipment_or_invalid_kind' };
    }
    const canaryDecision = canaryV75SchedulerShipmentAllowed(shipment);
    if (!canaryDecision.allowed) {
        return {
            decision: POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE,
            reason: canaryDecision.reason,
            stage
        };
    }
    const idempotencyKey = buildPostSaleIdempotencyKey({ shipment, stage, variant });
    const structured = structuredShipmentEvidence(shipment, legacyKind);
    if (structured.found) {
        return {
            decision: POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED,
            reason: structured.source,
            stage,
            idempotencyKey
        };
    }
    const history = await outboundHistoryDecision({ shipment, kind: legacyKind, messageModel });
    if (history) {
        if (acquireLock) {
            await persistTerminalSafetyDecision({
                shipment,
                stage,
                variant,
                decision: history.decision,
                reason: history.reason,
                evidence: history.evidence,
                shipmentModel,
                now
            });
        }
        return { ...history, stage, idempotencyKey };
    }
    if ((shipment?.review?.suppressedNotificationKinds || []).includes(legacyKind)) {
        const blocked = {
            decision: POST_SALE_NOTIFICATION_DECISIONS.HISTORICAL_EVENT_SUPPRESSED,
            reason: 'historical_stage_suppressed_after_reconciliation',
            stage,
            idempotencyKey
        };
        if (acquireLock) {
            await persistTerminalSafetyDecision({
                shipment,
                stage,
                variant,
                decision: blocked.decision,
                reason: blocked.reason,
                shipmentModel,
                now
            });
        }
        return blocked;
    }
    if (shipment?.review?.manualOnly === true) {
        return {
            decision: POST_SALE_NOTIFICATION_DECISIONS.MANUAL_REVIEW_REQUIRED,
            reason: shipment?.review?.reviewReason || 'shipment_manual_only',
            stage,
            idempotencyKey
        };
    }
    const chronology = evaluatePostSaleChronology({ shipment, kind: legacyKind });
    const chronologyEnforced = clean(process.env.VITALISMEN_EC_POSTSALE_TRANSACTIONAL_OPERATIONAL).toLowerCase() === 'true';
    if (chronologyEnforced && !chronology.allowed) {
        return {
            decision: POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE,
            reason: chronology.reason,
            stage,
            idempotencyKey
        };
    }
    if (!eligibilityForKind(shipment, legacyKind)) {
        return {
            decision: POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE,
            reason: 'current_logistics_state_not_eligible',
            stage,
            idempotencyKey
        };
    }
    const manualHumanState = await findManualHumanModeForShipment({ shipment, contactStateModel });
    if (manualHumanState && !postSaleTransactionalAllowsManualHumanMode({ shipment })) {
        return {
            decision: POST_SALE_NOTIFICATION_DECISIONS.MANUAL_REVIEW_REQUIRED,
            reason: 'human_mode_manual',
            stage,
            idempotencyKey
        };
    }
    if (!acquireLock || !shipment?._id) {
        return {
            decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND,
            reason: 'eligible_dry_run',
            stage,
            idempotencyKey
        };
    }
    const lockPath = `automation.notificationLocks.${stage}`;
    const ledgerPath = postSaleLedgerPath(stage);
    const lockToken = crypto.randomUUID();
    const markerAbsentClauses = (MARKER_BY_KIND[legacyKind] || []).map((marker) => ({
        $or: [
            { [`automation.${marker}`]: { $exists: false } },
            { [`automation.${marker}`]: null }
        ]
    }));
    const locked = await shipmentModel.findOneAndUpdate(
        {
            _id: shipment._id,
            $and: [
                ...markerAbsentClauses,
                {
                    $or: [
                        { [`${ledgerPath}.state`]: { $exists: false } },
                        { [`${ledgerPath}.state`]: null },
                        { [`${ledgerPath}.state`]: { $nin: POST_SALE_TERMINAL_LEDGER_STATES } }
                    ]
                },
                {
                    $or: [
                        { [lockPath]: { $exists: false } },
                        { [lockPath]: null },
                        { [`${lockPath}.until`]: { $lte: now } }
                    ]
                }
            ]
        },
        {
            $set: {
                [lockPath]: {
                    token: lockToken,
                    until: new Date(now.getTime() + lockMs),
                    acquiredAt: now,
                    idempotencyKey
                },
                [ledgerPath]: {
                    stage,
                    variant: clean(variant) || legacyKind,
                    state: 'LOCKED',
                    decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND,
                    reason: 'eligible_and_persistently_locked',
                    idempotencyKey,
                    decidedAt: now,
                    finalizedAt: null,
                    dataCompatibilityVersion: 66
                }
            }
        },
        { new: true }
    );
    if (!locked) {
        return { decision: POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE, reason: 'persistent_notification_lock_or_marker' };
    }
    return {
        decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND,
        reason: 'eligible_and_persistently_locked',
        stage,
        idempotencyKey,
        lockToken
    };
};

export const completePostSaleNotificationStage = async ({
    shipment,
    stage,
    variant = '',
    lockToken,
    providerMessageId = '',
    shipmentModel = Shipment,
    now = new Date()
} = {}) => {
    const canonicalStage = canonicalPostSaleStage(stage || variant);
    if (!shipment?._id || !canonicalStage || !clean(lockToken)) {
        return { completed: false, reason: 'missing_shipment_stage_or_lock_token' };
    }
    const lockPath = `automation.notificationLocks.${canonicalStage}`;
    const ledgerPath = postSaleLedgerPath(canonicalStage);
    const idempotencyKey = buildPostSaleIdempotencyKey({ shipment, stage: canonicalStage, variant });
    const cleanProviderMessageId = clean(providerMessageId);
    if (!cleanProviderMessageId) {
        const ambiguous = await shipmentModel.updateOne(
            { _id: shipment._id, [`${lockPath}.token`]: lockToken },
            {
                $set: {
                    [lockPath]: null,
                    [ledgerPath]: {
                        stage: canonicalStage,
                        variant: clean(variant) || legacyKindForPostSaleStage(canonicalStage),
                        state: 'AMBIGUOUS',
                        decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND,
                        reason: 'provider_accepted_without_persistable_id',
                        idempotencyKey,
                        decidedAt: now,
                        finalizedAt: now,
                        providerMessageId: '',
                        dataCompatibilityVersion: 116
                    }
                }
            }
        );
        return {
            completed: false,
            terminal: ambiguous?.modifiedCount === 1,
            reason: 'provider_message_id_missing_ambiguous_no_retry',
            stage: canonicalStage,
            idempotencyKey
        };
    }
    const result = await shipmentModel.updateOne(
        {
            _id: shipment._id,
            [`${lockPath}.token`]: lockToken
        },
        {
            $set: {
                ...legacyMarkerSetForStage(canonicalStage, now),
                [lockPath]: null,
                [ledgerPath]: {
                    stage: canonicalStage,
                    variant: clean(variant) || legacyKindForPostSaleStage(canonicalStage),
                    state: 'SENT',
                    decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND,
                    reason: 'provider_accepted_after_central_decision',
                    idempotencyKey,
                    decidedAt: now,
                    finalizedAt: now,
                    providerMessageId: cleanProviderMessageId,
                    dataCompatibilityVersion: 116
                }
            }
        }
    );
    return {
        completed: result?.modifiedCount === 1,
        reason: result?.modifiedCount === 1 ? 'stage_finalized' : 'lock_token_mismatch_or_stage_already_finalized',
        stage: canonicalStage,
        idempotencyKey
    };
};

export const failPostSaleNotificationStage = async ({
    shipment,
    stage,
    variant = '',
    lockToken,
    reason = 'provider_send_failed',
    terminal = false,
    terminalState = 'AMBIGUOUS',
    providerMessageId = '',
    providerStatus = '',
    correlationId = '',
    shipmentModel = Shipment,
    now = new Date()
} = {}) => {
    const canonicalStage = canonicalPostSaleStage(stage || variant);
    if (!shipment?._id || !canonicalStage || !clean(lockToken)) {
        return { released: false, reason: 'missing_shipment_stage_or_lock_token' };
    }
    const lockPath = `automation.notificationLocks.${canonicalStage}`;
    const ledgerPath = postSaleLedgerPath(canonicalStage);
    const idempotencyKey = buildPostSaleIdempotencyKey({ shipment, stage: canonicalStage, variant });
    const finalState = terminal
        ? (clean(terminalState).toUpperCase() === 'FAILED_FINAL' ? 'FAILED_FINAL' : 'AMBIGUOUS')
        : 'FAILED_RETRYABLE';
    const result = await shipmentModel.updateOne(
        { _id: shipment._id, [`${lockPath}.token`]: lockToken },
        {
            $set: {
                [lockPath]: null,
                [ledgerPath]: {
                    stage: canonicalStage,
                    variant: clean(variant) || legacyKindForPostSaleStage(canonicalStage),
                    state: finalState,
                    decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND,
                    reason: clean(reason),
                    idempotencyKey,
                    decidedAt: now,
                    finalizedAt: now,
                    providerMessageId: clean(providerMessageId),
                    providerStatus: clean(providerStatus),
                    correlationId: clean(correlationId) || idempotencyKey,
                    dataCompatibilityVersion: terminal ? 116 : 66
                }
            }
        }
    );
    return {
        released: result?.modifiedCount === 1,
        terminal: Boolean(terminal),
        reason: result?.modifiedCount === 1
            ? (terminal ? 'terminal_failure_recorded_no_retry' : 'retryable_failure_recorded_and_lock_released')
            : 'lock_token_mismatch',
        stage: canonicalStage,
        idempotencyKey
    };
};

export const shouldSendPostSaleNotification = (result = {}) => (
    result?.decision === POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND
);

export default decidePostSaleNotification;
