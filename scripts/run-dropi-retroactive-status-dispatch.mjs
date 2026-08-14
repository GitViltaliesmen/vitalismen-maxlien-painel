import 'dotenv/config';
import connectDB from '../src/config/db.js';
import Shipment from '../src/models/Shipment.js';
import { syncDroppiEcuadorFromPanel } from '../src/services/droppiEcuadorBrowserService.js';
import {
    countShipmentDispatchCandidates,
    processShipmentStatusDispatch
} from '../src/services/shipmentStatusDispatcherService.js';

const args = process.argv.slice(2);

const readArg = (name, fallback = '') => {
    const index = args.indexOf(`--${name}`);
    if (index === -1) return fallback;
    return args[index + 1] || fallback;
};

const hasFlag = (name) => args.includes(`--${name}`);

const parseActions = (value) => String(value || 'guide,ready_for_pickup,returned')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const parseLimit = (name, fallback) => {
    const parsed = Number.parseInt(readArg(name, String(fallback)), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const syncLimit = parseLimit('sync-limit', 10);
const dispatchLimit = parseLimit('dispatch-limit', 3);
const lookbackDays = parseLimit('days', 10);
const actions = parseActions(readArg('actions', process.env.SHIPMENT_STATUS_DISPATCH_ACTIONS));
const dryRun = !hasFlag('send');
const skipSync = hasFlag('skip-sync');

const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

const buildSyncQuery = () => ({
    country: 'EC',
    provider: 'droppi',
    'client.phone': { $exists: true, $ne: '' },
    updatedAt: { $gte: cutoff },
    $or: [
        { 'logistics.status': { $in: ['CREATED', 'created', 'PENDIENTE', 'GUIA_GENERADA', 'READY_FOR_PICKUP', 'EN_RUTA', 'EN_REPARTO', 'EN_DESPACHO', 'EN_BODEGA_TRANSPORTADORA'] } },
        { 'logistics.trackingNumber': { $exists: true, $ne: '' } },
        { 'automation.submittedToDroppiAt': { $exists: true, $ne: null } },
        { 'raw.manualDropiOrderId': { $exists: true, $ne: '' } },
        { 'raw.latestDroppiPayload.dropiOrderId': { $exists: true, $ne: '' } }
    ]
});

await connectDB();

const synced = [];
if (!skipSync) {
    const shipments = await Shipment.find(buildSyncQuery())
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(syncLimit);

    for (const shipment of shipments) {
        const before = {
            orderId: shipment.orderId,
            status: shipment.logistics?.status || '',
            trackingNumber: shipment.logistics?.trackingNumber || '',
            phoneTail: String(shipment.client?.phone || '').replace(/\D/g, '').slice(-4)
        };
        const result = await syncDroppiEcuadorFromPanel({ shipment });
        const refreshed = await Shipment.findById(shipment._id).lean();
        synced.push({
            ...before,
            ok: Boolean(result?.ok),
            reason: result?.reason || '',
            afterStatus: refreshed?.logistics?.status || '',
            afterTrackingNumber: refreshed?.logistics?.trackingNumber || ''
        });
    }
}

const pendingBeforeDispatch = await countShipmentDispatchCandidates({ actions });
const dispatch = await processShipmentStatusDispatch({
    limit: dispatchLimit,
    dryRun,
    force: true,
    actions
});
const pendingAfterDispatch = await countShipmentDispatchCandidates({ actions });

console.log(JSON.stringify({
    ok: true,
    mode: dryRun ? 'dry-run' : 'send',
    lookbackDays,
    syncLimit,
    dispatchLimit,
    actions,
    syncedCount: synced.length,
    synced,
    pendingBeforeDispatch,
    dispatch,
    pendingAfterDispatch
}, null, 2));

process.exit(0);
