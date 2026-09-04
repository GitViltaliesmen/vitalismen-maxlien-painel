import 'dotenv/config';
import mongoose from 'mongoose';

import OperationalSafetyState from '../src/models/OperationalSafetyState.js';
import Shipment from '../src/models/Shipment.js';
import { decidePostSaleNotification } from '../src/services/postSaleNotificationDecisionService.js';
import {
    POST_SALE_SAFETY_STATE_ID,
    POST_SALE_TERMINAL_LEDGER_STATES
} from '../src/services/postSaleSafetyV66Service.js';
import { processShipmentStatusDispatch } from '../src/services/shipmentStatusDispatcherService.js';
import {
    processPostSaleLifecycleRecoveryV126,
    resolvePostSaleLifecycleRecoveryV126Configuration
} from '../src/services/postSaleLifecycleRecoveryV126Service.js';
import { assertPostSaleTransactionalV105Configuration } from '../src/services/postSaleTransactionalControlPlaneV105Service.js';
import { postSaleTransactionalSafetyV116Enabled } from '../src/services/postSaleTransactionalSafetyV116Service.js';

const action = String(process.argv[2] || 'plan').trim().toLowerCase();
if (!['plan', 'run'].includes(action)) throw new Error('usage: post-sale-transactional-batch-v116.mjs plan|run');
assertPostSaleTransactionalV105Configuration(process.env);
if (!postSaleTransactionalSafetyV116Enabled()) throw new Error('post_sale_v116_at_most_once_gate_missing');

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL;
if (!mongoUri) throw new Error('mongo_uri_missing');
const actions = String(process.env.SHIPMENT_STATUS_DISPATCH_ACTIONS || '')
    .split(',').map((item) => item.trim()).filter(Boolean);

await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
try {
    const compatibility = await OperationalSafetyState.findById(POST_SALE_SAFETY_STATE_ID).lean();
    if (!compatibility || compatibility.bridgeComplete !== true
        || Number(compatibility.dataCompatibilityVersion) !== 66
        || Number(compatibility.minRuntimeVersion) !== 66) {
        throw new Error('post_sale_v66_compatibility_state_not_ready');
    }

    const statusResult = await processShipmentStatusDispatch({
        limit: 1,
        dryRun: action === 'plan',
        actions
    });
    const statusAttempted = statusResult?.results?.some((item) => item?.eligibleAttempt === true) === true;
    const statusPlanCandidate = action === 'plan' && statusResult?.results?.some((item) => (
        item?.success === true && item?.preflightDecision === 'SHOULD_SEND'
    ));
    const statusQuotaTerminal = statusResult?.quota?.allowed === false
        || statusResult?.results?.some((item) => item?.atomicQuota?.reason === 'daily_quota_exhausted') === true;
    const lifecycleConfiguration = resolvePostSaleLifecycleRecoveryV126Configuration(process.env);
    const lifecycleResult = !statusResult?.paused
        && !statusAttempted
        && !statusPlanCandidate
        && !statusQuotaTerminal
        ? await processPostSaleLifecycleRecoveryV126({
            dryRun: action === 'plan',
            configuration: lifecycleConfiguration
        })
        : {
            processed: 0,
            sent: 0,
            skipped: 0,
            lifecycleEnabled: lifecycleConfiguration.enabled,
            lifecycleReason: statusAttempted || statusPlanCandidate
                ? 'current_status_candidate_has_priority'
                : statusQuotaTerminal ? 'shared_quota_or_window_unavailable' : lifecycleConfiguration.reason,
            results: []
        };
    const result = {
        ...statusResult,
        processed: Number(statusResult?.processed || 0) + Number(lifecycleResult?.processed || 0),
        sent: Number(statusResult?.sent || 0) + Number(lifecycleResult?.sent || 0),
        skipped: Number(statusResult?.skipped || 0) + Number(lifecycleResult?.skipped || 0),
        results: [...(statusResult?.results || []), ...(lifecycleResult?.results || [])],
        lifecycle: lifecycleResult
    };
    const first = result?.results?.find((item) => item?.eligibleAttempt === true || item?.success === true)
        || result?.results?.find((item) => item?.atomicQuota)
        || result?.results?.[0]
        || null;
    const shipment = first?.orderId
        ? await Shipment.findOne({ orderId: first.orderId, country: 'EC' }).lean()
        : null;
    let decision = null;
    if (action === 'plan' && shipment && first?.action) {
        decision = await decidePostSaleNotification({
            shipment,
            kind: first.action === 'delivered_bonus' ? 'pickup_bonus' : first.action,
            acquireLock: false
        });
    }
    const ledgerEntries = Object.values(shipment?.automation?.postSaleSafetyLedger || {});
    const sentLedger = ledgerEntries.filter((entry) => String(entry?.state || '').toUpperCase() === 'SENT');
    const terminalLedger = ledgerEntries.filter((entry) => (
        POST_SALE_TERMINAL_LEDGER_STATES.includes(String(entry?.state || '').toUpperCase())
    ));
    const attempted = Boolean(first?.eligibleAttempt);
    const sent = Number(result?.sent || 0);
    const quotaExhausted = first?.atomicQuota?.reason === 'daily_quota_exhausted';
    const status = action === 'plan'
        ? 'PASS_PLAN'
        : sent === 1
            ? 'PASS_SENT_ONE'
            : (!attempted || quotaExhausted)
                ? 'PASS_NOOP'
                : 'FAILED_NO_RETRY';
    const output = {
        status,
        mode: action === 'run' ? 'V116_TRANSACTIONAL_BATCH_ONE' : 'V116_TRANSACTIONAL_PLAN',
        batchMax: 1,
        dailyLimit: 1,
        processed: Number(result?.processed || 0),
        sent,
        skipped: Number(result?.skipped || 0),
        paused: Boolean(result?.paused),
        quotaReason: String(result?.quota?.reason || ''),
        atomicQuota: first?.atomicQuota || null,
        candidate: first ? {
            orderId: String(first.orderId || ''),
            action: String(first.action || ''),
            status: String(first.status || shipment?.logistics?.status || ''),
            eligibleAttempt: attempted,
            success: Boolean(first.success),
            reason: String(first.reason || ''),
            error: String(first.error || '').replace(/\s+/g, ' ').slice(0, 160)
        } : null,
        decision: decision ? {
            decision: String(decision.decision || ''),
            reason: String(decision.reason || ''),
            stage: String(decision.stage || ''),
            idempotencyKeyPresent: Boolean(decision.idempotencyKey)
        } : null,
        ledger: {
            sentEntries: sentLedger.length,
            terminalEntries: terminalLedger.length,
            latestSentStage: String(sentLedger.at(-1)?.stage || ''),
            providerMessageIdPresent: Boolean(sentLedger.at(-1)?.providerMessageId),
            idempotencyKeyPresent: Boolean(sentLedger.at(-1)?.idempotencyKey)
        },
        safety: {
            persistentAtomicQuota: true,
            providerAmbiguityTerminal: true,
            automaticRetry: false,
            historicalBacklog: false,
            lifecycleActivationCursor: lifecycleConfiguration.notBefore?.toISOString?.() || '',
            lifecycleNewEventsOnly: lifecycleConfiguration.enabled === true,
            lifecycleReason: lifecycleResult.lifecycleReason || lifecycleConfiguration.reason,
            pickupProofSweep: false,
            dropiMode: 'REPORT_ONLY',
            dropiApply: false,
            metaRetroactive: false
        }
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (status === 'FAILED_NO_RETRY') process.exitCode = 2;
} finally {
    await mongoose.disconnect();
}
