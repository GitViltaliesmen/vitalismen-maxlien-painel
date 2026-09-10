import crypto from 'node:crypto';
import mongoose from 'mongoose';

import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';
import { listOnlineAdminLeadsByWindow } from '../src/services/adminPanelStatusService.js';
import { trackServientregaGuide } from '../src/services/carrierTrackingService.js';
import { canonicalLogisticsProjectionForShipmentV147 } from '../src/services/canonicalLogisticsStatusV147Service.js';

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';
if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI ausente; auditoria V147 interrompida.');

const digits = (value = '') => String(value || '').replace(/\D/g, '');
const clean = (value = '') => String(value ?? '').trim();
const objectId = (value = '') => clean(value?._id || value);
const terminalLocal = (shipment = {}) => (
    shipment?.outcomes?.delivered === true
    || shipment?.outcomes?.returned === true
    || ['ENTREGADO', 'DEVUELTO', 'CANCELADO', 'CANCELADO_SERVIENTREGA', 'DELIVERED', 'RETURNED']
        .includes(clean(shipment?.logistics?.canonicalStatus || shipment?.logistics?.status).toUpperCase())
);
const apparentPickup = (shipment = {}) => /READY_FOR_PICKUP|AGENCIA|RETIRO|RETIRADA|INGRESANDO/i.test([
    shipment?.logistics?.canonicalStatus,
    shipment?.logistics?.status,
    shipment?.raw?.latestDroppiPayload?.status,
    shipment?.raw?.latestDroppiPayload?.dropiStatus,
    shipment?.raw?.carrierTracking?.lastResult?.statusAtual,
    shipment?.raw?.carrierTracking?.lastResult?.ultimoMovimiento
].filter(Boolean).join(' '));
const canonicalJson = (value) => JSON.stringify(value, Object.keys(value).sort());
const mapLimit = async (items, limit, worker) => {
    const output = new Array(items.length);
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            output[index] = await worker(items[index], index);
        }
    });
    await Promise.all(runners);
    return output;
};

await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
try {
    const allWithGuide = await Shipment.find({
        country: 'EC',
        'logistics.trackingNumber': { $exists: true, $ne: '' }
    }).sort({ updatedAt: -1 }).lean();
    const selected = allWithGuide.filter((shipment) => !terminalLocal(shipment) || apparentPickup(shipment));
    const orderIds = [...new Set(selected.map((shipment) => clean(shipment.orderId)).filter(Boolean))];
    const phoneTails = [...new Set(selected.map((shipment) => digits(shipment?.client?.phone).slice(-9)).filter(Boolean))];
    const [orders, states] = await Promise.all([
        Order.find({ country: 'EC', orderId: { $in: orderIds } }).lean(),
        ContactState.find({ countryCode: 'EC', $or: phoneTails.flatMap((tail) => ([
            { phoneDigits: { $regex: `${tail}$` } },
            { chatId: { $regex: tail } }
        ])) }).lean()
    ]);
    const orderById = new Map(orders.map((order) => [clean(order.orderId), order]));
    const admin = listOnlineAdminLeadsByWindow({ country: 'EC', limit: 5000 });
    const leads = admin?.ok ? admin.leads : [];

    const records = await mapLimit(selected, 3, async (shipment) => {
        const guide = digits(shipment?.logistics?.trackingNumber);
        const live = await trackServientregaGuide(guide).catch((error) => ({ ok: false, reason: error.message }));
        const projection = canonicalLogisticsProjectionForShipmentV147({
            ...shipment,
            logistics: {
                ...shipment.logistics,
                canonicalStatus: live.ok ? live.canonicalStatus : 'UNKNOWN',
                canonicalEvidence: live.ok ? {
                    provider: live.carrier,
                    rawCode: live.providerStatusCode,
                    rawStatus: live.statusAtual,
                    rawSubstatus: live.providerSubstatus || live.ultimoMovimiento
                } : {}
            }
        });
        const order = orderById.get(clean(shipment.orderId));
        const phone = digits(order?.customer?.phone || shipment?.client?.phone);
        const tail = phone.slice(-9);
        const state = states.find((item) => digits(item?.phoneDigits || item?.metadata?.customerDraft?.phone).endsWith(tail));
        const lead = leads.find((item) => digits(item?.phone || item?.phone_e164).endsWith(tail));
        const safety = shipment?.automation?.postSaleSafetyLedger || {};
        const sentStages = Object.entries(safety).filter(([, entry]) => ['SENT', 'RECOVERED_MANUAL', 'RECOVERED_STRUCTURED'].includes(clean(entry?.state).toUpperCase()));
        const latestLedger = [...(shipment.notificationLedger || [])].filter((entry) => entry.sent_at).sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];
        const lastStage = sentStages.sort((a, b) => new Date(b[1]?.acceptedAt || b[1]?.sentAt || 0) - new Date(a[1]?.acceptedAt || a[1]?.sentAt || 0))[0];
        const a07AlreadySent = Boolean(
            shipment?.automation?.readyForPickupNotifiedAt
            || safety?.READY_FOR_PICKUP?.state === 'SENT'
            || (shipment.events || []).some((event) => ['ready_for_pickup_notified', 'ready_for_pickup_recovered_existing_message'].includes(event?.kind))
            || (shipment.notificationLedger || []).some((entry) => entry?.notification_type === 'ready_for_pickup' && (entry.sent_at || entry.provider_message_id))
        );
        const canonicalCustomerId = objectId(shipment?.raw?.historicalExternalReconciliation?.customerId || state?._id);
        const dropiId = digits(order?.dropiOrderId || shipment?.raw?.manualDropiOrderId || shipment?.raw?.latestDroppiPayload?.dropiOrderId || shipment?.raw?.droppiOrder?.id);
        const humanManual = state?.human?.mode === 'manual';
        const identityComplete = Boolean(canonicalCustomerId && order?.orderId && shipment?._id && guide);
        const eligible = live.ok && projection.canPickup && !projection.terminal && !a07AlreadySent && !humanManual && identityComplete;
        const exclusionReason = eligible ? '' : [
            !live.ok ? 'servientrega_live_failed' : '',
            live.ok && !projection.canPickup ? `can_pickup_no:${projection.canonicalStatus}` : '',
            projection.terminal ? `terminal:${projection.canonicalStatus}` : '',
            a07AlreadySent ? 'a07_already_sent_or_recovered' : '',
            humanManual ? 'human_takeover_manual' : '',
            !identityComplete ? 'canonical_identity_incomplete' : ''
        ].filter(Boolean).join(',');
        const storedCanonical = canonicalLogisticsProjectionForShipmentV147(shipment).canonicalStatus;
        const panelCanPickup = projection.canPickup;
        return {
            orderId: clean(order?.orderId || shipment.orderId),
            dropiId,
            shipmentId: objectId(shipment._id),
            guide,
            customerId: canonicalCustomerId,
            servientregaHttp: live.ok ? 200 : 0,
            servientregaRaw: clean(live.statusAtual),
            servientregaCode: clean(live.providerStatusCode),
            servientregaSubstatus: clean(live.providerSubstatus || live.ultimoMovimiento),
            canonicalStatus: projection.canonicalStatus,
            canPickup: projection.canPickup,
            terminal: projection.terminal,
            panelStatus: clean(lead?.status || state?.metadata?.customerDraft?.status),
            panelLabel: projection.panelLabel,
            panelCanPickup,
            lastPostSaleEvent: clean(lastStage?.[0] || latestLedger?.notification_type),
            lastTemplate: clean(lastStage?.[1]?.variant || latestLedger?.template_version),
            lastProviderMessageId: clean(lastStage?.[1]?.providerMessageId || latestLedger?.provider_message_id),
            a07AlreadySent,
            catchupEligible: eligible,
            exclusionReason,
            statusDivergent: live.ok && storedCanonical !== projection.canonicalStatus,
            panelDivergent: projection.canPickup !== Boolean(shipment?.logistics?.pickupReadyVerified === true && shipment?.logistics?.pickupReadyVerifiedSource === 'carrier_tracking'),
            nextAction: eligible ? 'CATCHUP_A07_AFTER_APPROVAL_AND_LIVE_REVALIDATION' : (projection.reviewRequired ? 'MANUAL_REVIEW' : 'WAIT_NEXT_LIVE_CHANGE')
        };
    });
    const catchup = records.filter((record) => record.catchupEligible).map((record) => ({
        orderId: record.orderId,
        dropiId: record.dropiId,
        shipmentId: record.shipmentId,
        guide: record.guide,
        customerId: record.customerId,
        liveStatus: record.canonicalStatus,
        liveCode: record.servientregaCode,
        canPickup: record.canPickup,
        lastTemplate: record.lastTemplate,
        a07AlreadySent: record.a07AlreadySent,
        catchupEligible: true,
        exclusionReason: ''
    })).sort((a, b) => a.orderId.localeCompare(b.orderId));
    const catchupListHash = crypto.createHash('sha256').update(JSON.stringify(catchup)).digest('hex');
    const report = {
        generatedAt: new Date().toISOString(),
        readOnly: true,
        messagesSent: 0,
        shipmentsScanned: records.length,
        nonTerminalShipments: records.filter((record) => !record.terminal).length,
        readyForPickupCount: records.filter((record) => record.canPickup && !record.terminal).length,
        statusDivergences: records.filter((record) => record.statusDivergent).length,
        panelDivergences: records.filter((record) => record.panelDivergent).length,
        catchupCandidatesCount: catchup.length,
        catchupListHash,
        catchup,
        records
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
    await mongoose.disconnect();
}
