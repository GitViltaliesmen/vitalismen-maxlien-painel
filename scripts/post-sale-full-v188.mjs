import 'dotenv/config';
import mongoose from 'mongoose';

import OperationalSafetyState from '../src/models/OperationalSafetyState.js';
import {
    buildPostSaleBacklogSnapshotV188,
    processDeliveredSequenceV188,
    processRefillStageV188,
    processShipmentPickupRemindersV188,
    reconcilePickupProofAliasV188
} from '../src/services/postSaleFullExecutorV188Service.js';
import {
    assertPostSaleFullOperationalV188Configuration,
    isPostSaleV188SendWindowOpen
} from '../src/services/postSaleFullOperationalV188Service.js';
import {
    POST_SALE_SAFETY_STATE_ID,
    resolvePostSaleOperationalMutationGate
} from '../src/services/postSaleSafetyV66Service.js';
import {
    processPickupProofSweep
} from '../src/services/shipmentMessageService.js';
import {
    processCarrierStatusSweep,
    processShipmentStatusDispatch
} from '../src/services/shipmentStatusDispatcherService.js';
import { getZapiStatus } from '../src/services/zapiClient.js';

const action = String(process.argv[2] || 'snapshot').trim().toLowerCase();
if (!['snapshot', 'dry-run', 'run'].includes(action)) {
    throw new Error('usage: post-sale-full-v188.mjs snapshot|dry-run|run');
}

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL;
if (!mongoUri) throw new Error('mongo_uri_missing');

const zapiConnected = (status = {}) => Boolean(
    status?.connected
    || status?.smartphoneConnected
    || String(status?.error || '').toLowerCase().includes('already connected')
);

const profile = assertPostSaleFullOperationalV188Configuration(process.env);
await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
try {
    const now = new Date();
    const compatibility = await OperationalSafetyState.findById(POST_SALE_SAFETY_STATE_ID).lean();
    const mutationGate = resolvePostSaleOperationalMutationGate(process.env, { compatibilityState: compatibility });
    if (!mutationGate.allowed) throw new Error(`post_sale_v66_mutation_gate_blocked:${mutationGate.reason}`);

    const providerStatus = await getZapiStatus();
    if (!zapiConnected(providerStatus)) throw new Error('zapi_not_connected');

    const snapshot = await buildPostSaleBacklogSnapshotV188({ now });
    if (action === 'snapshot') {
        const repeated = await buildPostSaleBacklogSnapshotV188({ now });
        const deterministic = snapshot.deterministicKeyHash === repeated.deterministicKeyHash;
        process.stdout.write(`${JSON.stringify({
            status: deterministic ? 'PASS_SNAPSHOT' : 'FAIL_NON_DETERMINISTIC',
            mode: 'V188_READ_ONLY_SNAPSHOT',
            profile,
            zapiConnected: true,
            mutationGate: mutationGate.mode,
            sendWindowOpen: isPostSaleV188SendWindowOpen(now),
            backlogDeterministic: deterministic,
            snapshot
        }, null, 2)}\n`);
        if (!deterministic) process.exitCode = 2;
    } else if (action === 'dry-run') {
        const [reminders, proof, delivered, refill, statusDispatch] = await Promise.all([
            processShipmentPickupRemindersV188({ limit: 1, dryRun: true, now }),
            processPickupProofSweep({ limit: 50, dryRun: true }),
            processDeliveredSequenceV188({ limit: 1, dryRun: true, now }),
            processRefillStageV188({ limit: 1, dryRun: true, now }),
            processShipmentStatusDispatch({
                limit: 1,
                dryRun: true,
                actions: ['guide', 'in_transit', 'ready_for_pickup', 'returned']
            })
        ]);
        process.stdout.write(`${JSON.stringify({
            status: 'PASS_DRY_RUN',
            mode: 'V188_TOTAL_DRY_RUN',
            profile,
            zapiConnected: true,
            sendWindowOpen: isPostSaleV188SendWindowOpen(now),
            sendCount: 0,
            statusDispatch,
            reminders,
            pickupProof: proof,
            delivered,
            refill,
            snapshot
        }, null, 2)}\n`);
    } else {
        const [proof, pickupProofAlias] = await Promise.all([
            processPickupProofSweep({ limit: 20, dryRun: false }),
            reconcilePickupProofAliasV188({ limit: 50, dryRun: false, now })
        ]);
        if (!isPostSaleV188SendWindowOpen(now)) {
            process.stdout.write(`${JSON.stringify({
                status: 'PASS_DEFERRED_OUTSIDE_EC_WINDOW',
                mode: 'V188_OPERATIONAL_BATCH_ONE',
                profile,
                zapiConnected: true,
                sendWindowOpen: false,
                outboundCount: 0,
                pickupProof: proof,
                pickupProofAlias,
                nextAction: 'WAIT_NEXT_AMERICA_GUAYAQUIL_WINDOW'
            }, null, 2)}\n`);
        } else {
            const carrierPolling = await processCarrierStatusSweep({ limit: 6, dryRun: false });
            const statusDispatch = await processShipmentStatusDispatch({
                limit: 1,
                dryRun: false,
                actions: ['guide', 'in_transit', 'ready_for_pickup', 'returned']
            });
            let outboundCount = Number(statusDispatch?.sent || 0);
            let reminders = null;
            let delivered = null;
            let refill = null;
            if (outboundCount === 0) {
                reminders = await processShipmentPickupRemindersV188({ limit: 1, dryRun: false, now: new Date() });
                outboundCount += Number(reminders?.sent || 0);
            }
            if (outboundCount === 0) {
                delivered = await processDeliveredSequenceV188({ limit: 1, dryRun: false, now: new Date() });
                outboundCount += Number(delivered?.sent || 0);
            }
            if (outboundCount === 0) {
                refill = await processRefillStageV188({ limit: 1, dryRun: false, now: new Date() });
                outboundCount += Number(refill?.sent || 0);
            }
            const status = outboundCount <= 1 ? 'PASS_BATCH' : 'FAIL_OUTBOUND_LIMIT';
            process.stdout.write(`${JSON.stringify({
                status,
                mode: 'V188_OPERATIONAL_BATCH_ONE',
                profile,
                zapiConnected: true,
                sendWindowOpen: true,
                outboundCount,
                carrierPolling,
                statusDispatch,
                reminders,
                pickupProof: proof,
                pickupProofAlias,
                delivered,
                refill
            }, null, 2)}\n`);
            if (outboundCount > 1) process.exitCode = 2;
        }
    }
} finally {
    await mongoose.disconnect();
}
