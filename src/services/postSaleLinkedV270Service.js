import { getSock } from '../whatsapp/connection.js';
import { ecBaileysTextMode } from '../whatsapp/ecTransportMode.js';
import { isPostSaleV188SendWindowOpen } from './postSaleFullOperationalV188Service.js';
import { processDropiTrackingReconciliationV194 } from './postSaleDropiTrackingReconcilerV194Service.js';
import { processForwardLogisticsStageV194 } from './postSaleForwardOnlyV194Service.js';
import { processDeliveredSequenceV188, processShipmentPickupRemindersV188 } from './postSaleFullExecutorV188Service.js';
import { processPickupProofSweep } from './shipmentMessageService.js';
import { isPostSaleV194ForwardOnlyEligible } from './postSaleForwardOnlyV194Service.js';
import { POST_SALE_STAGES } from './postSaleSafetyV66Service.js';
import { executePostSaleLinkedV270Cycle } from './postSaleLinkedV270Cycle.js';

const ACTIONS = Object.freeze(['guide', 'in_transit', 'ready_for_pickup']);
export const runPostSaleLinkedV270 = async ({
    dryRun = true,
    now = new Date(),
    forwardOnlySince = process.env.POST_SALE_V270_FORWARD_ONLY_SINCE,
    transportReady = () => ecBaileysTextMode() && Boolean(getSock()?.user?.id),
    dropi = processDropiTrackingReconciliationV194,
    logistics = processForwardLogisticsStageV194,
    reminders = processShipmentPickupRemindersV188,
    proof = processPickupProofSweep,
    delivered = processDeliveredSequenceV188
} = {}) => {
    // The adapter cannot run live until the sealed successor explicitly enables
    // this exact operation. A green simulation must never authorize a send.
    if (!dryRun && process.env.POST_SALE_V270_RUNTIME_ACTIVE !== 'true') {
        throw new Error('v270_live_runtime_not_authorized');
    }
    return executePostSaleLinkedV270Cycle({
        dryRun: Boolean(dryRun), now, forwardOnlySince, transportReady,
        windowOpen: isPostSaleV188SendWindowOpen,
        reconcile: ({ now: at, forwardOnlySince: cutoff, dryRun: simulate }) =>
            dropi({ now: at, forwardOnlySince: cutoff, limit: 8, dryRun: simulate }),
        stages: [
            { name: 'logistics', run: ({ now: at, forwardOnlySince: cutoff, dryRun: simulate }) =>
                logistics({ now: at, forwardOnlySince: cutoff, dryRun: simulate, allowedActions: ACTIONS }) },
            { name: 'pickup_proof', run: ({ forwardOnlySince: cutoff, dryRun: simulate }) =>
                proof({ limit: 1, dryRun: simulate, maxPhysicalSends: 1,
                    eligibilityFn: ({ shipment, proof: message }) =>
                        isPostSaleV194ForwardOnlyEligible({ shipment,
                            stage: POST_SALE_STAGES.PICKUP_BONUS, forwardOnlySince: cutoff })
                        && new Date(message?.createdAt || 0).getTime() >= cutoff.getTime() }) },
            { name: 'reminders', run: ({ now: at, forwardOnlySince: cutoff, dryRun: simulate }) =>
                reminders({ now: at, forwardOnlySince: cutoff, limit: 1, dryRun: simulate }) },
            { name: 'delivered', run: ({ now: at, forwardOnlySince: cutoff, dryRun: simulate }) =>
                delivered({ now: at, forwardOnlySince: cutoff, limit: 1, dryRun: simulate }) }
        ]
    });
};
