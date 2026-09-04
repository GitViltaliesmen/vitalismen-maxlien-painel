import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    POST_SALE_LIFECYCLE_RECOVERY_V126_FLAG,
    POST_SALE_LIFECYCLE_RECOVERY_V126_NOT_BEFORE,
    buildPostSaleRefillCandidateQueryV126,
    processPostSaleLifecycleRecoveryV126,
    resolvePostSaleLifecycleRecoveryV126Configuration
} from '../src/services/postSaleLifecycleRecoveryV126Service.js';

const activation = new Date('2026-09-04T18:00:00.000Z');
const now = new Date('2026-09-30T18:00:00.000Z');
const configuration = Object.freeze({
    enabled: true,
    reason: 'new_events_only_cursor_valid',
    notBefore: activation
});

const shipment = ({
    orderId = 'EC-V126-1',
    readyAt = new Date('2026-09-05T18:00:00.000Z'),
    dueAt = new Date('2026-09-06T18:00:00.000Z')
} = {}) => ({
    _id: orderId,
    orderId,
    country: 'EC',
    client: { phone: '593999111222' },
    logistics: {
        status: 'READY_FOR_PICKUP',
        pickupReadyVerified: true,
        agencyPickup: true,
        trackingNumber: '123456789'
    },
    automation: { readyForPickupNotifiedAt: readyAt },
    treatment: { refillReminderDueAt: dueAt },
    outcomes: { delivered: false, pickedUp: false, returned: false, prepaidOnly: false },
    review: { manualOnly: false }
});

test('V126 exige gate e cursor válido, não futuro', () => {
    assert.equal(resolvePostSaleLifecycleRecoveryV126Configuration({}, { now }).enabled, false);
    assert.equal(resolvePostSaleLifecycleRecoveryV126Configuration({
        [POST_SALE_LIFECYCLE_RECOVERY_V126_FLAG]: 'true'
    }, { now }).reason, 'activation_cursor_missing_or_invalid');
    assert.equal(resolvePostSaleLifecycleRecoveryV126Configuration({
        [POST_SALE_LIFECYCLE_RECOVERY_V126_FLAG]: 'true',
        [POST_SALE_LIFECYCLE_RECOVERY_V126_NOT_BEFORE]: '2026-10-01T00:00:00.000Z'
    }, { now }).reason, 'activation_cursor_is_in_the_future');
    assert.equal(resolvePostSaleLifecycleRecoveryV126Configuration({
        [POST_SALE_LIFECYCLE_RECOVERY_V126_FLAG]: 'true',
        [POST_SALE_LIFECYCLE_RECOVERY_V126_NOT_BEFORE]: activation.toISOString()
    }, { now }).enabled, true);
});

test('consulta de recompra exige confirmação e vencimento posteriores ao cursor', () => {
    const query = buildPostSaleRefillCandidateQueryV126({ notBefore: activation, now });
    assert.deepEqual(query['automation.deliveredConfirmedAt'], { $gte: activation, $lte: now });
    assert.deepEqual(query['treatment.refillReminderDueAt'], { $gte: activation, $lte: now });
    assert.equal(query['automation.refillReminderAt'], null);
    assert.equal(query['outcomes.returned'], false);
    assert.equal(query['outcomes.prepaidOnly'], false);
});

test('plano V126 ignora evento histórico e não reserva cota nem envia', async () => {
    const old = shipment({
        orderId: 'EC-OLD',
        readyAt: new Date('2026-09-03T18:00:00.000Z'),
        dueAt: new Date('2026-09-04T18:00:00.000Z')
    });
    const fresh = shipment();
    let quotaCalls = 0;
    let sendCalls = 0;
    const result = await processPostSaleLifecycleRecoveryV126({
        dryRun: true,
        now,
        configuration,
        dependencies: {
            getPendingShipmentReminders: async () => [
                { shipment: old, kind: 'day1', dueAt: old.treatment.refillReminderDueAt },
                { shipment: fresh, kind: 'day1', dueAt: fresh.treatment.refillReminderDueAt }
            ],
            findPostSaleRefillCandidates: async () => [],
            decidePostSaleNotification: async () => ({
                decision: 'SHOULD_SEND',
                reason: 'eligible_dry_run',
                idempotencyKey: 'ps66:test'
            }),
            reservePostSaleDailyQuota: async () => { quotaCalls += 1; },
            notifyShipmentReminder: async () => { sendCalls += 1; }
        }
    });
    assert.equal(result.candidates, 1);
    assert.equal(result.results[0].orderId, 'EC-V126-1');
    assert.equal(result.results[0].dryRun, true);
    assert.equal(quotaCalls, 0);
    assert.equal(sendCalls, 0);
});

test('execução V126 reserva a mesma cota uma vez e tenta só um candidato', async () => {
    const first = shipment({ orderId: 'EC-V126-1' });
    const second = shipment({ orderId: 'EC-V126-2' });
    let quotaCalls = 0;
    let sendCalls = 0;
    const result = await processPostSaleLifecycleRecoveryV126({
        dryRun: false,
        now,
        env: { SHIPMENT_STATUS_DISPATCH_DAILY_LIMIT: '1', SHIPMENT_STATUS_DISPATCH_TIME_ZONE: 'America/Guayaquil' },
        configuration,
        dependencies: {
            getPendingShipmentReminders: async () => [
                { shipment: first, kind: 'day1', dueAt: first.treatment.refillReminderDueAt },
                { shipment: second, kind: 'day1', dueAt: second.treatment.refillReminderDueAt }
            ],
            findPostSaleRefillCandidates: async () => [],
            decidePostSaleNotification: async () => ({
                decision: 'SHOULD_SEND',
                reason: 'eligible_dry_run',
                idempotencyKey: 'ps66:test'
            }),
            reservePostSaleDailyQuota: async () => {
                quotaCalls += 1;
                return { reserved: true, reason: 'quota_reserved_atomically', used: 1, dailyLimit: 1 };
            },
            notifyShipmentReminder: async () => {
                sendCalls += 1;
                return true;
            }
        }
    });
    assert.equal(result.sent, 1);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].eligibleAttempt, true);
    assert.equal(quotaCalls, 1);
    assert.equal(sendCalls, 1);
});

test('cota atômica esgotada não chama provedor', async () => {
    const fresh = shipment();
    let sendCalls = 0;
    const result = await processPostSaleLifecycleRecoveryV126({
        now,
        configuration,
        dependencies: {
            getPendingShipmentReminders: async () => [
                { shipment: fresh, kind: 'day1', dueAt: fresh.treatment.refillReminderDueAt }
            ],
            findPostSaleRefillCandidates: async () => [],
            decidePostSaleNotification: async () => ({ decision: 'SHOULD_SEND', idempotencyKey: 'ps66:test' }),
            reservePostSaleDailyQuota: async () => ({ reserved: false, reason: 'daily_quota_exhausted' }),
            notifyShipmentReminder: async () => { sendCalls += 1; }
        }
    });
    assert.equal(result.sent, 0);
    assert.equal(result.results[0].eligibleAttempt, false);
    assert.equal(result.results[0].atomicQuota.reason, 'daily_quota_exhausted');
    assert.equal(sendCalls, 0);
});

test('V126 permanece no timer V116, sem scheduler paralelo, backfill ou prova automática', () => {
    const executor = fs.readFileSync('ops/post-sale-v116', 'utf8');
    const batch = fs.readFileSync('scripts/post-sale-transactional-batch-v116.mjs', 'utf8');
    const dispatcher = fs.readFileSync('src/services/shipmentStatusDispatcherService.js', 'utf8');
    assert.match(executor, /post-sale-lifecycle-v126-not-before/);
    assert.match(executor, /I_UNDERSTAND_NEW_EVENTS_ONLY_NO_BACKFILL/);
    assert.match(executor, /POST_SALE_LIFECYCLE_RECOVERY_V126_NOT_BEFORE/);
    assert.doesNotMatch(executor, /systemctl enable --now vitalismen-postsale-lifecycle/);
    assert.match(batch, /processPostSaleLifecycleRecoveryV126/);
    assert.match(batch, /pickupProofSweep: false/);
    assert.match(dispatcher, /'treatment\.refillReminderDueAt': refillReminderDueAt/);
});
