import { getSock } from '../whatsapp/connection.js';
import { ecBaileysTextMode } from '../whatsapp/ecTransportMode.js';
import { isPostSaleV188SendWindowOpen } from './postSaleFullOperationalV188Service.js';
import { processDropiTrackingReconciliationV194 } from './postSaleDropiTrackingReconcilerV194Service.js';
import { processForwardLogisticsStageV194 } from './postSaleForwardOnlyV194Service.js';
import { executePostSaleLinkedV270Cycle } from './postSaleLinkedV270Cycle.js';
import { notifyReadyForPickup, notifyShipmentInTransit } from './shipmentMessageService.js';

const ACTIONS = Object.freeze(['guide', 'in_transit', 'ready_for_pickup']);
export const runPostSaleLinkedV270 = async ({
    dryRun = true,
    now = new Date(),
    forwardOnlySince = process.env.POST_SALE_V270_FORWARD_ONLY_SINCE,
    transportReady = () => ecBaileysTextMode() && Boolean(getSock()?.user?.id),
    dropi = processDropiTrackingReconciliationV194,
    logistics = processForwardLogisticsStageV194
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
                logistics({ now: at, forwardOnlySince: cutoff, dryRun: simulate, allowedActions: ACTIONS,
                    notifyFns: { ready_for_pickup: shipment => notifyReadyForPickup(shipment,
                        { maxComponents: 1, allowedComponents: ['TEXT'], returnDetails: true }),
                    in_transit: shipment => notifyShipmentInTransit(shipment, { returnDetails: true }) } }) },
        ]
    });
};
