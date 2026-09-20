import 'dotenv/config';
import mongoose from 'mongoose';

import OperationalSafetyState from '../src/models/OperationalSafetyState.js';
import {
    buildPostSaleBacklogSnapshotV188,
    processDeliveredSequenceV188,
    processRefillStageV188,
    processShipmentPickupRemindersV188
} from '../src/services/postSaleFullExecutorV188Service.js';
import {
    assertPostSaleFullOperationalV188Configuration,
    isPostSaleV188SendWindowOpen
} from '../src/services/postSaleFullOperationalV188Service.js';
import {
    isPostSaleV194ForwardOnlyEligible,
    processForwardLogisticsStageV194,
    resolvePostSaleV194ForwardOnlySince
} from '../src/services/postSaleForwardOnlyV194Service.js';
import { processDropiTrackingReconciliationV194 } from '../src/services/postSaleDropiTrackingReconcilerV194Service.js';
import {
    POST_SALE_SAFETY_STATE_ID,
    resolvePostSaleOperationalMutationGate
} from '../src/services/postSaleSafetyV66Service.js';
import {
    processPickupProofSweep
} from '../src/services/shipmentMessageService.js';
import {
    processCarrierStatusSweep
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
const forwardOnlySince = resolvePostSaleV194ForwardOnlySince(process.env);
await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
try {
    const now = new Date();
    const compatibility = await OperationalSafetyState.findById(POST_SALE_SAFETY_STATE_ID).lean();
    const mutationGate = resolvePostSaleOperationalMutationGate(process.env, { compatibilityState: compatibility });
    if (!mutationGate.allowed) throw new Error(`post_sale_v66_mutation_gate_blocked:${mutationGate.reason}`);

    const providerStatus = await getZapiStatus();
    if (!zapiConnected(providerStatus)) throw new Error('zapi_not_connected');

    const snapshot = await buildPostSaleBacklogSnapshotV188({ now, forwardOnlySince });
    if (action === 'snapshot') {
        const repeated = await buildPostSaleBacklogSnapshotV188({ now, forwardOnlySince });
        const dropiTracking = await processDropiTrackingReconciliationV194({
            now,
            forwardOnlySince,
            limit: 8,
            dryRun: true
        });
        const deterministic = snapshot.deterministicKeyHash === repeated.deterministicKeyHash;
        process.stdout.write(`${JSON.stringify({
            status: deterministic ? 'PASS_SNAPSHOT' : 'FAIL_NON_DETERMINISTIC',
            mode: 'V188_READ_ONLY_SNAPSHOT',
            profile,
            zapiConnected: true,
            mutationGate: mutationGate.mode,
            sendWindowOpen: isPostSaleV188SendWindowOpen(now),
            forwardOnlySince,
            dropiTracking,
            backlogDeterministic: deterministic,
            snapshot
        }, null, 2)}\n`);
        if (!deterministic) process.exitCode = 2;
    } else if (action === 'dry-run') {
        const [reminders, proof, delivered, refill, statusDispatch, dropiTracking] = await Promise.all([
            processShipmentPickupRemindersV188({ limit: 1, dryRun: true, now, forwardOnlySince }),
            processPickupProofSweep({ limit: 50, dryRun: true }),
            processDeliveredSequenceV188({ limit: 1, dryRun: true, now, forwardOnlySince }),
            processRefillStageV188({ limit: 1, dryRun: true, now, forwardOnlySince }),
            processForwardLogisticsStageV194({ dryRun: true, now, forwardOnlySince }),
            processDropiTrackingReconciliationV194({ dryRun: true, now, forwardOnlySince, limit: 8 })
        ]);
        process.stdout.write(`${JSON.stringify({
            status: 'PASS_DRY_RUN',
            mode: 'V188_TOTAL_DRY_RUN',
            profile,
            zapiConnected: true,
            sendWindowOpen: isPostSaleV188SendWindowOpen(now),
            forwardOnlySince,
            sendCount: 0,
            dropiTracking,
            statusDispatch,
            reminders,
            pickupProof: proof,
            delivered,
            refill,
            snapshot
        }, null, 2)}\n`);
    } else {
        const dropiTracking = await processDropiTrackingReconciliationV194({
            now,
            forwardOnlySince,
            limit: 8,
            dryRun: false
        });
        if (!isPostSaleV188SendWindowOpen(now)) {
            process.stdout.write(`${JSON.stringify({
                status: 'PASS_DEFERRED_OUTSIDE_EC_WINDOW',
                mode: 'V188_OPERATIONAL_BATCH_ONE',
                profile,
                zapiConnected: true,
                sendWindowOpen: false,
                forwardOnlySince,
                outboundCount: 0,
                physicalOutboundCount: 0,
                dropiTracking,
                pickupProof: null,
                nextAction: 'WAIT_NEXT_AMERICA_GUAYAQUIL_WINDOW'
            }, null, 2)}\n`);
        } else {
            const carrierPolling = await processCarrierStatusSweep({ limit: 6, dryRun: false });
            const proof = await processPickupProofSweep({
                limit: 1,
                dryRun: false,
                maxPhysicalSends: 1,
                eligibilityFn: ({ shipment, proof: proofMessage }) => (
                    isPostSaleV194ForwardOnlyEligible({
                        shipment,
                        stage: 'PICKUP_BONUS',
                        forwardOnlySince
                    })
                    && new Date(proofMessage?.createdAt || 0).getTime() >= forwardOnlySince.getTime()
                )
            });
            let outboundCount = Number(proof?.bonusSent || 0);
            let statusDispatch = null;
            let reminders = null;
            let delivered = null;
            let refill = null;
            if (outboundCount === 0) {
                statusDispatch = await processForwardLogisticsStageV194({
                    dryRun: false,
                    now: new Date(),
                    forwardOnlySince
                });
                outboundCount += Number(statusDispatch?.sent || 0);
            }
            if (outboundCount === 0) {
                reminders = await processShipmentPickupRemindersV188({
                    limit: 1,
                    dryRun: false,
                    now: new Date(),
                    forwardOnlySince
                });
                outboundCount += Number(reminders?.sent || 0);
            }
            if (outboundCount === 0) {
                delivered = await processDeliveredSequenceV188({
                    limit: 1,
                    dryRun: false,
                    now: new Date(),
                    forwardOnlySince
                });
                outboundCount += Number(delivered?.sent || 0);
            }
            if (outboundCount === 0) {
                refill = await processRefillStageV188({
                    limit: 1,
                    dryRun: false,
                    now: new Date(),
                    forwardOnlySince
                });
                outboundCount += Number(refill?.sent || 0);
            }
            const status = outboundCount <= 1 ? 'PASS_BATCH' : 'FAIL_OUTBOUND_LIMIT';
            process.stdout.write(`${JSON.stringify({
                status,
                mode: 'V188_OPERATIONAL_BATCH_ONE',
                profile,
                zapiConnected: true,
                sendWindowOpen: true,
                forwardOnlySince,
                outboundCount,
                physicalOutboundCount: outboundCount,
                dropiTracking,
                carrierPolling,
                statusDispatch,
                reminders,
                pickupProof: proof,
                delivered,
                refill
            }, null, 2)}\n`);
            if (outboundCount > 1) process.exitCode = 2;
        }
    }
} finally {
    await mongoose.disconnect();
}
