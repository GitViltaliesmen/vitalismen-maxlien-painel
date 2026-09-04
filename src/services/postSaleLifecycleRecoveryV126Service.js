import crypto from 'node:crypto';

import Shipment from '../models/Shipment.js';
import { buildCanaryV75RecipientQuery } from './canaryIsolationV75Service.js';
import {
    getPendingShipmentReminders,
    notifyShipmentReminder,
    notifyTreatmentRefillReminder
} from './shipmentMessageService.js';
import {
    POST_SALE_NOTIFICATION_DECISIONS,
    decidePostSaleNotification
} from './postSaleNotificationDecisionService.js';
import { reservePostSaleDailyQuotaV116 } from './postSaleTransactionalSafetyV116Service.js';

export const POST_SALE_LIFECYCLE_RECOVERY_V126_VERSION = 126;
export const POST_SALE_LIFECYCLE_RECOVERY_V126_FLAG = 'POST_SALE_LIFECYCLE_RECOVERY_V126_ENABLED';
export const POST_SALE_LIFECYCLE_RECOVERY_V126_NOT_BEFORE = 'POST_SALE_LIFECYCLE_RECOVERY_V126_NOT_BEFORE';

const DAY_MS = 24 * 60 * 60 * 1000;
const clean = (value = '') => String(value ?? '').trim();

const validDate = (value) => {
    const parsed = value instanceof Date ? value : new Date(clean(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const resolvePostSaleLifecycleRecoveryV126Configuration = (
    env = process.env,
    { now = new Date() } = {}
) => {
    const enabled = clean(env[POST_SALE_LIFECYCLE_RECOVERY_V126_FLAG]).toLowerCase() === 'true';
    const notBefore = validDate(env[POST_SALE_LIFECYCLE_RECOVERY_V126_NOT_BEFORE]);
    if (!enabled) return Object.freeze({ enabled: false, reason: 'lifecycle_recovery_disabled', notBefore: null });
    if (!notBefore) return Object.freeze({ enabled: false, reason: 'activation_cursor_missing_or_invalid', notBefore: null });
    if (notBefore.getTime() > now.getTime()) {
        return Object.freeze({ enabled: false, reason: 'activation_cursor_is_in_the_future', notBefore });
    }
    return Object.freeze({ enabled: true, reason: 'new_events_only_cursor_valid', notBefore });
};

const zonedDayKey = (now, timeZone) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(now).reduce((result, part) => {
        if (part.type !== 'literal') result[part.type] = part.value;
        return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
};

export const buildPostSaleRefillCandidateQueryV126 = ({ notBefore, now = new Date() } = {}) => {
    const activationCursor = validDate(notBefore);
    if (!activationCursor) throw new Error('post_sale_v126_activation_cursor_required');
    const canary = buildCanaryV75RecipientQuery('client.phone');
    return {
        country: 'EC',
        ...(Object.keys(canary).length ? canary : { 'client.phone': { $exists: true, $ne: '' } }),
        'review.manualOnly': { $ne: true },
        'automation.deliveredConfirmedAt': { $gte: activationCursor, $lte: now },
        'automation.refillReminderAt': null,
        'treatment.refillReminderDueAt': { $gte: activationCursor, $lte: now },
        'outcomes.returned': false,
        'outcomes.prepaidOnly': false,
        $or: [
            { 'outcomes.delivered': true },
            { 'outcomes.pickedUp': true },
            { 'logistics.status': 'ENTREGADO' }
        ]
    };
};

const findPostSaleRefillCandidatesV126 = async ({ notBefore, now = new Date(), limit = 200 } = {}) => (
    Shipment.find(buildPostSaleRefillCandidateQueryV126({ notBefore, now }))
        .sort({ 'treatment.refillReminderDueAt': 1, updatedAt: 1 })
        .limit(limit)
);

const reminderDecisionKind = (kind = '') => `pickup_reminder_${clean(kind)}`;

const normalizeReminderCandidates = (items = []) => items.map((item) => ({
    shipment: item.shipment,
    action: reminderDecisionKind(item.kind),
    reminderKind: item.kind,
    dueAt: item.dueAt,
    anchorAt: item.shipment?.automation?.readyForPickupNotifiedAt || null,
    lifecycle: 'pickup_reminder'
}));

const normalizeRefillCandidates = (shipments = []) => shipments.map((shipment) => ({
    shipment,
    action: 'treatment_refill_reminder',
    reminderKind: '',
    dueAt: shipment?.treatment?.refillReminderDueAt || null,
    anchorAt: shipment?.automation?.deliveredConfirmedAt || null,
    lifecycle: 'treatment_refill'
}));

export const processPostSaleLifecycleRecoveryV126 = async ({
    dryRun = false,
    now = new Date(),
    env = process.env,
    configuration = resolvePostSaleLifecycleRecoveryV126Configuration(env, { now }),
    dependencies = {}
} = {}) => {
    if (!configuration.enabled || !configuration.notBefore) {
        return {
            processed: 0,
            sent: 0,
            skipped: 0,
            lifecycleEnabled: false,
            lifecycleReason: configuration.reason,
            results: []
        };
    }

    const listPickup = dependencies.getPendingShipmentReminders || getPendingShipmentReminders;
    const listRefill = dependencies.findPostSaleRefillCandidates || findPostSaleRefillCandidatesV126;
    const decide = dependencies.decidePostSaleNotification || decidePostSaleNotification;
    const reserveQuota = dependencies.reservePostSaleDailyQuota || reservePostSaleDailyQuotaV116;
    const sendPickup = dependencies.notifyShipmentReminder || notifyShipmentReminder;
    const sendRefill = dependencies.notifyTreatmentRefillReminder || notifyTreatmentRefillReminder;
    const pickup = normalizeReminderCandidates(await listPickup({ now, notBefore: configuration.notBefore }));
    const refill = normalizeRefillCandidates(await listRefill({ now, notBefore: configuration.notBefore, limit: 200 }));
    const candidates = [...pickup, ...refill]
        .filter((item) => validDate(item.anchorAt)?.getTime() >= configuration.notBefore.getTime())
        .filter((item) => validDate(item.dueAt)?.getTime() <= now.getTime())
        .sort((left, right) => validDate(left.dueAt).getTime() - validDate(right.dueAt).getTime());
    const results = [];

    for (const candidate of candidates) {
        const decision = await decide({
            shipment: candidate.shipment,
            kind: candidate.action,
            variant: candidate.action,
            acquireLock: false,
            now
        });
        const item = {
            source: 'lifecycle_v126',
            lifecycle: candidate.lifecycle,
            orderId: candidate.shipment?.orderId || '',
            action: candidate.action,
            status: candidate.shipment?.logistics?.status || '',
            dueAt: candidate.dueAt,
            anchorAt: candidate.anchorAt,
            preflightDecision: decision?.decision || '',
            reason: decision?.reason || '',
            success: false,
            eligibleAttempt: false
        };
        if (decision?.decision !== POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND) {
            results.push(item);
            continue;
        }
        if (dryRun) {
            item.success = true;
            item.dryRun = true;
            results.push(item);
            break;
        }

        const timeZone = clean(env.SHIPMENT_STATUS_DISPATCH_TIME_ZONE || env.TZ || 'America/Sao_Paulo');
        const dailyLimit = 1;
        const dayKey = zonedDayKey(now, timeZone);
        const atomicQuota = await reserveQuota({
            dayKey,
            timeZone,
            dailyLimit,
            correlationId: decision?.idempotencyKey || crypto.randomUUID(),
            now,
            expiresAt: new Date(now.getTime() + (2 * DAY_MS))
        });
        item.atomicQuota = {
            reserved: Boolean(atomicQuota?.reserved),
            reason: clean(atomicQuota?.reason),
            dayKey: clean(atomicQuota?.dayKey || dayKey),
            used: Number(atomicQuota?.used || 0),
            dailyLimit: Number(atomicQuota?.dailyLimit || dailyLimit)
        };
        if (!atomicQuota?.reserved) {
            item.reason = clean(atomicQuota?.reason || 'daily_quota_not_reserved');
            results.push(item);
            break;
        }

        item.eligibleAttempt = true;
        try {
            item.success = candidate.lifecycle === 'pickup_reminder'
                ? Boolean(await sendPickup(candidate.shipment, candidate.reminderKind))
                : Boolean(await sendRefill(candidate.shipment));
            if (!item.success) item.reason = 'provider_attempt_not_confirmed_no_automatic_retry';
        } catch (error) {
            item.error = clean(error?.message || 'post_sale_lifecycle_v126_failed');
        }
        results.push(item);
        break;
    }

    return {
        processed: results.length,
        sent: results.filter((item) => item.success && !item.dryRun).length,
        skipped: results.filter((item) => !item.success).length,
        lifecycleEnabled: true,
        lifecycleReason: configuration.reason,
        activationNotBefore: configuration.notBefore,
        candidates: candidates.length,
        results
    };
};

export default processPostSaleLifecycleRecoveryV126;
