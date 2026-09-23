import crypto from 'node:crypto';
import mongoose from 'mongoose';

import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';
import { listOnlineAdminLeadsByWindow } from '../src/services/adminPanelStatusService.js';
import { trackServientregaGuide } from '../src/services/carrierTrackingService.js';
import {
    canonicalLogisticsProjectionForShipmentV147,
    canonicalLogisticsProjectionV147
} from '../src/services/canonicalLogisticsStatusV147Service.js';
import { processEcPhoneServientregaReconciliationV140 } from '../src/services/ecPhoneServientregaReconciliationV140Service.js';
import {
    V147_STATUS_DIVERGENCE_CLASSES,
    buildDeliveredCatchupCandidateV147,
    buildReadyCatchupCandidateV147,
    classifyStatusDivergenceV147,
    listHashV147
} from '../src/services/postSaleCatchupV147Service.js';

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';
if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI ausente; auditoria V147 interrompida.');

const TARGET = Object.freeze({
    phone: '+593980548369',
    orderId: 'EC-ADMIN-3484',
    dropiId: '6924784',
    guide: '189629714'
});
const digits = (value = '') => String(value || '').replace(/\D/g, '');
const clean = (value = '') => String(value ?? '').trim();
const objectId = (value = '') => clean(value?._id || value);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
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
const liveProjection = (live = {}) => canonicalLogisticsProjectionV147({
    provider: live.carrier || 'servientrega',
    providerCode: live.providerStatusCode,
    providerStatus: live.statusAtual,
    providerSubstatus: live.providerSubstatus || live.ultimoMovimiento
});
const productFor = (shipment = {}, order = {}) => clean(
    order?.tracking?.productName
    || order?.tracking?.product
    || shipment?.productName
    || shipment?.raw?.productName
    || shipment?.raw?.latestDroppiPayload?.productName
);
const dropiFor = (shipment = {}, order = {}) => digits(
    order?.dropiOrderId
    || shipment?.raw?.manualDropiOrderId
    || shipment?.raw?.latestDroppiPayload?.dropiOrderId
    || shipment?.raw?.droppiOrder?.id
);

await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 12_000 });
try {
    const generatedAt = new Date();
    const [shipments, states, admin] = await Promise.all([
        Shipment.find({ country: 'EC', 'logistics.trackingNumber': { $exists: true, $ne: '' } }).sort({ updatedAt: -1 }).lean(),
        ContactState.find({ countryCode: 'EC' }).sort({ updatedAt: -1 }).lean(),
        Promise.resolve(listOnlineAdminLeadsByWindow({ country: 'EC', limit: 5000 }))
    ]);
    const orderIds = [...new Set(shipments.map((shipment) => clean(shipment.orderId)).filter(Boolean))];
    const orders = await Order.find({ country: 'EC', orderId: { $in: orderIds } }).lean();
    const orderById = new Map(orders.map((order) => [clean(order.orderId), order]));
    const leads = admin?.ok ? admin.leads : [];

    const records = await mapLimit(shipments, 3, async (shipment) => {
        const guide = digits(shipment?.logistics?.trackingNumber);
        const live = await trackServientregaGuide(guide).catch((error) => ({ ok: false, reason: error.message || String(error) }));
        const projection = live.ok ? liveProjection(live) : canonicalLogisticsProjectionForShipmentV147(shipment);
        const stored = canonicalLogisticsProjectionForShipmentV147(shipment);
        const order = orderById.get(clean(shipment.orderId)) || {};
        const phone = digits(order?.customer?.phone || shipment?.client?.phone);
        const tail = phone.slice(-9);
        const state = tail.length >= 8
            ? states.find((item) => digits(item?.phoneDigits || item?.metadata?.customerDraft?.phone).endsWith(tail))
            : null;
        const lead = tail.length >= 8
            ? leads.find((item) => digits(item?.phone || item?.phone_e164).endsWith(tail))
            : null;
        const customerId = objectId(shipment?.raw?.historicalExternalReconciliation?.customerId || shipment?.raw?.customerId || shipment?.client?.customerId);
        const projectionPanelStatus = projection.canonicalStatus === 'DELIVERED'
            ? 'entregue'
            : '';
        const panelStatus = clean(lead?.status || state?.metadata?.customerDraft?.status).toLowerCase();
        const panelDivergent = Boolean(projectionPanelStatus && panelStatus !== projectionPanelStatus);
        const historical = new Date(shipment.updatedAt || 0).getTime() < generatedAt.getTime() - (120 * 24 * 60 * 60 * 1000);
        const statusDivergent = live.ok === true && stored.canonicalStatus !== projection.canonicalStatus;
        const divergenceClass = statusDivergent || panelDivergent
            ? classifyStatusDivergenceV147({
                shipmentExists: true,
                liveOk: live.ok === true,
                liveStatus: projection.canonicalStatus,
                storedStatus: stored.canonicalStatus,
                panelDivergent,
                historical
            })
            : '';
        const liveShipment = {
            ...shipment,
            productName: productFor(shipment, order),
            client: { ...(shipment.client || {}), customerId },
            raw: {
                ...(shipment.raw || {}),
                customerId,
                manualDropiOrderId: dropiFor(shipment, order) || shipment?.raw?.manualDropiOrderId
            },
            logistics: {
                ...(shipment.logistics || {}),
                canonicalStatus: projection.canonicalStatus,
                canonicalEvidence: live.ok ? {
                    provider: live.carrier || 'servientrega',
                    source: 'carrier_tracking',
                    rawCode: live.providerStatusCode || '',
                    rawStatus: live.statusAtual || '',
                    rawSubstatus: live.providerSubstatus || live.ultimoMovimiento || '',
                    observedAt: generatedAt
                } : shipment?.logistics?.canonicalEvidence
            }
        };
        const readyCandidate = buildReadyCatchupCandidateV147({
            shipment: liveShipment,
            live: { ok: live.ok === true, ...projection },
            customerId,
            humanManual: state?.human?.mode === 'manual'
        });
        const deliveredCandidate = buildDeliveredCatchupCandidateV147({
            shipment: liveShipment,
            product: productFor(shipment, order)
        });
        return {
            orderId: clean(shipment.orderId),
            shipmentId: objectId(shipment._id),
            dropiId: dropiFor(shipment, order),
            guide,
            customerId,
            servientregaOk: live.ok === true,
            servientregaRaw: clean(live.statusAtual),
            servientregaSubstatus: clean(live.providerSubstatus || live.ultimoMovimiento),
            storedCanonicalStatus: stored.canonicalStatus,
            liveCanonicalStatus: projection.canonicalStatus,
            canPickup: projection.canPickup,
            terminal: projection.terminal,
            panelStatus,
            panelExpected: projectionPanelStatus,
            statusDivergent,
            panelDivergent,
            divergenceClass,
            readyCandidate,
            deliveredCandidate
        };
    });

    const targetShipments = shipments.filter((shipment) => (
        clean(shipment.orderId) === TARGET.orderId
        || digits(shipment?.logistics?.trackingNumber) === TARGET.guide
        || dropiFor(shipment) === TARGET.dropiId
    ));
    const targetLive = await trackServientregaGuide(TARGET.guide).catch((error) => ({ ok: false, reason: error.message || String(error) }));
    const targetProjection = targetLive.ok ? liveProjection(targetLive) : canonicalLogisticsProjectionV147({});
    const targetReconciliation = await processEcPhoneServientregaReconciliationV140({
        dryRun: true,
        limit: 20,
        onlyPhone: TARGET.phone
    }).catch((error) => ({ ok: false, readOnly: true, writes: 0, messagesSent: 0, reason: error.message || String(error), results: [] }));
    const targetPlan = (targetReconciliation.results || []).find((item) => (
        clean(item.orderId || item.expected?.orderId) === TARGET.orderId
        && digits(item.dropiOrderId || item.expected?.dropiOrderId) === TARGET.dropiId
        && digits(item.guide || item.expected?.guide) === TARGET.guide
    ));
    const targetRecord = records.find((record) => (
        record.orderId === TARGET.orderId
        || record.guide === TARGET.guide
        || record.dropiId === TARGET.dropiId
    ));
    const expectedShipmentCount = targetShipments.length || (targetPlan?.expected ? 1 : 0);
    const duplicateShipments = Math.max(0, targetShipments.length - 1);
    const targetReconciliationPass = Boolean(
        targetReconciliation.ok
        && targetReconciliation.readOnly === true
        && Number(targetReconciliation.writes || 0) === 0
        && Number(targetReconciliation.messagesSent || 0) === 0
        && targetPlan
        && !['AMBIGUOUS', 'ERROR'].includes(clean(targetPlan.classification).toUpperCase())
        && clean(targetPlan.orderId) === TARGET.orderId
        && digits(targetPlan.dropiOrderId) === TARGET.dropiId
        && digits(targetPlan.guide) === TARGET.guide
        && clean(targetPlan.customerId)
        && clean(targetPlan.leadId)
        && expectedShipmentCount === 1
        && duplicateShipments === 0
    );

    const missingTargetDivergence = targetShipments.length === 0 ? [{
        orderId: TARGET.orderId,
        guide: TARGET.guide,
        class: classifyStatusDivergenceV147({ shipmentExists: false }),
        reason: 'canonical_shipment_missing_reconcilable_by_v140_readonly_plan'
    }] : [];
    const divergenceRecords = [
        ...records.filter((record) => record.statusDivergent || record.panelDivergent).map((record) => ({
            orderId: record.orderId,
            shipmentId: record.shipmentId,
            guide: record.guide,
            storedCanonicalStatus: record.storedCanonicalStatus,
            liveCanonicalStatus: record.liveCanonicalStatus,
            panelDivergent: record.panelDivergent,
            class: record.divergenceClass
        })),
        ...missingTargetDivergence
    ];
    const divergenceCounts = Object.fromEntries(V147_STATUS_DIVERGENCE_CLASSES.map((name) => [name, 0]));
    for (const item of divergenceRecords) {
        if (Object.hasOwn(divergenceCounts, item.class)) divergenceCounts[item.class] += 1;
    }
    const unclassified = divergenceRecords.filter((item) => !V147_STATUS_DIVERGENCE_CLASSES.includes(item.class));
    const readyCatchup = records.map((record) => record.readyCandidate)
        .filter((item) => item.catchupEligible)
        .sort((a, b) => a.orderId.localeCompare(b.orderId));
    const deliveredCatchup = records
        .filter((record) => record.liveCanonicalStatus === 'DELIVERED')
        .map((record) => record.deliveredCandidate)
        .filter((item) => item.p5Sent === false || item.p6Sent === false || item.p7Sent === false)
        .sort((a, b) => a.orderId.localeCompare(b.orderId));

    const report = {
        audit: 'V147_R3_DELIVERED_SINGLE_GATE_READONLY',
        generatedAt: generatedAt.toISOString(),
        readOnly: true,
        transport: 'SINK',
        writes: 0,
        messagesSent: 0,
        shipmentsScanned: records.length,
        statusDivergencesTotal: divergenceRecords.length,
        divergenceCounts,
        unclassifiedCurrentOperationalDivergences: unclassified.length,
        unfixedCurrentOperationalDefects: divergenceCounts.REAL_OPERATIONAL_DEFECT,
        readyCatchupCandidatesCount: readyCatchup.length,
        readyCatchupCandidates: readyCatchup,
        readyCatchupListHash: listHashV147(readyCatchup),
        deliveredCatchupCandidatesCount: deliveredCatchup.length,
        deliveredCatchupCandidates: deliveredCatchup,
        deliveredCatchupListHash: listHashV147(deliveredCatchup),
        target: {
            ...TARGET,
            liveOk: targetLive.ok === true,
            liveStatus: [clean(targetLive.statusAtual), clean(targetLive.providerSubstatus || targetLive.ultimoMovimiento)].filter(Boolean).join('|'),
            canonicalStatus: targetProjection.canonicalStatus,
            canPickup: targetProjection.canPickup,
            a07SendNow: targetRecord?.readyCandidate?.catchupEligible === true,
            p5SendNow: targetRecord?.deliveredCandidate?.catchupEligible === true
                && targetRecord.deliveredCandidate.p5Sent === false,
            p6SendNow: targetRecord?.deliveredCandidate?.catchupEligible === true
                && targetRecord.deliveredCandidate.p5Sent === true
                && targetRecord.deliveredCandidate.p6Sent === false,
            p7SendNow: targetRecord?.deliveredCandidate?.catchupEligible === true
                && targetRecord.deliveredCandidate.p6Sent === true
                && targetRecord.deliveredCandidate.p7Sent === false,
            canonicalShipmentReconciliation: targetReconciliationPass ? 'PASS' : 'FAIL',
            shipmentCountCurrent: targetShipments.length,
            shipmentCountExpectedAfterReconciliation: expectedShipmentCount,
            duplicateShipments,
            reconciliationDryRun: targetReconciliation.readOnly === true,
            reconciliationWrites: Number(targetReconciliation.writes || 0),
            reconciliationMessagesSent: Number(targetReconciliation.messagesSent || 0),
            reconciliationPlan: targetPlan || null
        },
        records,
        reportSha256: ''
    };
    report.reportSha256 = sha256(JSON.stringify(report));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
    await mongoose.disconnect();
}
