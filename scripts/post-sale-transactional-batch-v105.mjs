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
import { assertPostSaleTransactionalV105Configuration } from '../src/services/postSaleTransactionalControlPlaneV105Service.js';

const action = String(process.argv[2] || 'plan').trim().toLowerCase();
if (!['plan', 'run'].includes(action)) throw new Error('usage: post-sale-transactional-batch-v105.mjs plan|run');
assertPostSaleTransactionalV105Configuration(process.env);

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

    const result = await processShipmentStatusDispatch({
        limit: 1,
        dryRun: action === 'plan',
        actions
    });
    const first = result?.results?.[0] || null;
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
    const sentLedger = ledgerEntries.filter((entry) => (
        String(entry?.state || '').toUpperCase() === 'SENT'
    ));
    const terminalLedger = ledgerEntries.filter((entry) => (
        POST_SALE_TERMINAL_LEDGER_STATES.includes(String(entry?.state || '').toUpperCase())
    ));
    const output = {
        status: action === 'run'
            ? (Number(result?.sent || 0) === 1 ? 'PASS' : 'FAILED_NO_RETRY')
            : 'PASS',
        mode: action === 'run' ? 'BATCH_ONE_REAL' : 'BATCH_ONE_PLAN',
        batchMax: 1,
        processed: Number(result?.processed || 0),
        sent: Number(result?.sent || 0),
        skipped: Number(result?.skipped || 0),
        paused: Boolean(result?.paused),
        quotaReason: String(result?.quota?.reason || ''),
        candidate: first ? {
            orderId: String(first.orderId || ''),
            action: String(first.action || ''),
            status: String(first.status || shipment?.logistics?.status || ''),
            success: Boolean(first.success),
            reason: String(first.reason || ''),
            error: String(first.error || '').replace(/\s+/g, ' ').slice(0, 160),
            preDispatchSync: first.preDispatchSync ? {
                ok: Boolean(first.preDispatchSync.ok),
                skipped: Boolean(first.preDispatchSync.skipped),
                reason: String(first.preDispatchSync.reason || ''),
                status: String(first.preDispatchSync.status || '')
            } : null
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
            humanModeManualGuard: true,
            chronologyGuard: true,
            historicalBacklog: false,
            dropiMode: 'REPORT_ONLY',
            dropiApply: false,
            metaRetroactive: false,
            automaticRetry: false
        }
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (action === 'run' && output.status !== 'PASS') process.exitCode = 2;
} finally {
    await mongoose.disconnect();
}
