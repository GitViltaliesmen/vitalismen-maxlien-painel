import 'dotenv/config';
import mongoose from 'mongoose';
import OperationalSafetyState from '../src/models/OperationalSafetyState.js';
import Shipment from '../src/models/Shipment.js';
import {
    POST_SALE_NOTIFICATION_DECISIONS,
    decidePostSaleNotification
} from '../src/services/postSaleNotificationDecisionService.js';
import {
    POST_SALE_DATA_COMPATIBILITY_VERSION,
    POST_SALE_RUNTIME_VERSION,
    POST_SALE_SAFETY_STATE_ID,
    POST_SALE_STAGES,
    buildPostSaleIdempotencyKey,
    canonicalPostSaleStage,
    legacyMarkerSetForStage,
    postSaleLedgerPath
} from '../src/services/postSaleSafetyV66Service.js';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const approval = String(process.env.POST_SALE_V66_BRIDGE_APPLY_APPROVED || '').trim();
if (apply && approval !== 'I_UNDERSTAND_V66_BRIDGE_NO_REPLAY') {
    throw new Error('APPLY bloqueado: use POST_SALE_V66_BRIDGE_APPLY_APPROVED=I_UNDERSTAND_V66_BRIDGE_NO_REPLAY.');
}

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';
if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI ausente. Nenhum dado foi lido ou alterado.');
const limitArg = [...args].find((arg) => arg.startsWith('--limit='));
const limit = Math.max(1, Math.min(Number(limitArg?.split('=')[1]) || 5000, 50_000));
const terminalDecisions = new Set([
    POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED,
    POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY,
    POST_SALE_NOTIFICATION_DECISIONS.HISTORICAL_EVENT_SUPPRESSED
]);
const stateForDecision = (decision) => ({
    [POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED]: 'RECOVERED_STRUCTURED',
    [POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY]: 'RECOVERED_MANUAL',
    [POST_SALE_NOTIFICATION_DECISIONS.HISTORICAL_EVENT_SUPPRESSED]: 'SUPPRESSED_HISTORICAL'
}[decision] || '');
const stageKinds = [
    [POST_SALE_STAGES.GUIDE, 'guide'],
    [POST_SALE_STAGES.IN_TRANSIT, 'in_transit'],
    [POST_SALE_STAGES.READY_FOR_PICKUP, 'ready_for_pickup'],
    [POST_SALE_STAGES.RETURNED, 'returned']
];

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });
try {
    const query = {
        country: 'EC',
        'logistics.trackingNumber': { $exists: true, $nin: ['', null] }
    };
    const totalCandidates = await Shipment.countDocuments(query);
    const shipments = await Shipment.find(query).sort({ _id: 1 }).limit(limit);
    const completeScan = shipments.length === totalCandidates;
    if (apply && !completeScan) {
        throw new Error(`Bridge parcial bloqueada antes do primeiro write: candidatos=${totalCandidates}; processados=${shipments.length}; aumente --limit.`);
    }
    const items = [];
    let stageWrites = 0;

    for (const shipment of shipments) {
        const stageResults = [];
        for (const [stage, kind] of stageKinds) {
            const decision = await decidePostSaleNotification({
                shipment,
                kind,
                acquireLock: false
            });
            if (!terminalDecisions.has(decision.decision)) continue;
            const at = shipment.review?.resolvedAt || shipment.updatedAt || new Date();
            const ledgerPath = postSaleLedgerPath(stage);
            const idempotencyKey = buildPostSaleIdempotencyKey({ shipment, stage, variant: kind });
            if (apply) {
                await Shipment.updateOne(
                    { _id: shipment._id },
                    {
                        $set: {
                            ...legacyMarkerSetForStage(stage, at),
                            [ledgerPath]: {
                                stage: canonicalPostSaleStage(stage),
                                variant: kind,
                                state: stateForDecision(decision.decision),
                                decision: decision.decision,
                                reason: decision.reason || 'v66_compatibility_bridge',
                                idempotencyKey,
                                decidedAt: at,
                                finalizedAt: at,
                                dataCompatibilityVersion: POST_SALE_DATA_COMPATIBILITY_VERSION
                            }
                        }
                    }
                );
                stageWrites += 1;
            }
            stageResults.push({ stage, decision: decision.decision, reason: decision.reason || '' });
        }
        if (stageResults.length) {
            items.push({
                orderId: shipment.orderId,
                phoneTail: String(shipment.client?.phone || '').replace(/\D/g, '').slice(-4),
                stages: stageResults
            });
        }
    }

    if (apply) {
        await OperationalSafetyState.updateOne(
            { _id: POST_SALE_SAFETY_STATE_ID },
            {
                $set: {
                    dataCompatibilityVersion: POST_SALE_DATA_COMPATIBILITY_VERSION,
                    minRuntimeVersion: POST_SALE_RUNTIME_VERSION,
                    writerRuntimeVersion: POST_SALE_RUNTIME_VERSION,
                    bridgeComplete: true,
                    bridgeCompletedAt: new Date(),
                    bridgeSource: 'scripts/reconcile-post-sale-safety-v66.mjs',
                    notes: 'Marcadores legados dual-write; nenhuma mensagem e nenhum pedido Dropi.'
                }
            },
            { upsert: true }
        );
    }

    process.stdout.write(`${JSON.stringify({
        mode: apply ? 'APPLY_COMPATIBILITY_BRIDGE_NO_REPLAY' : 'REPORT_ONLY',
        deployAuthorized: false,
        totalCandidates,
        scanned: shipments.length,
        completeScan,
        affectedShipments: items.length,
        stageWrites,
        realMessagesSent: 0,
        realDropiSubmissions: 0,
        productionMutationExecuted: apply,
        compatibilityStateWritten: apply,
        items
    }, null, 2)}\n`);
} finally {
    await mongoose.disconnect();
}
