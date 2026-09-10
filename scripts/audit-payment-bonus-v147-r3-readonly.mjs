import fs from 'node:fs';
import mongoose from 'mongoose';

import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';
import { trackServientregaGuide } from '../src/services/carrierTrackingService.js';
import { canonicalLogisticsProjectionForShipmentV147 } from '../src/services/canonicalLogisticsStatusV147Service.js';
import { shipmentCanonicalPaymentEvidence } from '../src/services/shipmentMessageService.js';

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI ausente; auditoria V147-R3 interrompida.');

const parentFreeze = JSON.parse(fs.readFileSync(
    new URL('../docs/freeze/ec-postsale-canonical-restoration-v147-20260909.json', import.meta.url),
    'utf8'
));
const targetContract = parentFreeze.target || {};
const rejectedFieldPaths = [
    'raw.paymentConfirmedAt',
    'raw.payment.confirmedAt',
    'raw.payment.status',
    'raw.latestDroppiPayload.paymentStatus'
];
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const rejectedFieldInventory = Object.fromEntries(rejectedFieldPaths.map((path) => [path, {
    present: 0,
    acceptedAsCanonical: 0
}]));

await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 12_000 });
try {
    const shipments = await Shipment.find({ country: 'EC' }).lean();
    const canonicalEvidence = {
        proofExists: false,
        source: 'NONE',
        provider: 'NONE',
        field: 'NONE',
        value: 'NONE',
        timestamp: 'NONE',
        confidence: 'CANONICAL_PROVIDER_SOURCE_UNAVAILABLE',
        classification: 'UNKNOWN',
        confirmedShipments: 0
    };
    const rejectedDerivedEvidence = {
        source: 'events.dropi_payment_claim_skipped_paid',
        reason: 'DERIVED_FROM_ENTREGADO',
        present: 0,
        acceptedAsCanonical: 0
    };

    for (const shipment of shipments) {
        for (const path of rejectedFieldPaths) {
            const value = get(shipment, path);
            if (value !== undefined && value !== null && value !== '') rejectedFieldInventory[path].present += 1;
        }
        const events = (shipment.events || []).filter((event) => event?.kind === 'dropi_payment_claim_skipped_paid');
        rejectedDerivedEvidence.present += events.length;
        const evidence = shipmentCanonicalPaymentEvidence(shipment);
        if (evidence.confirmed) canonicalEvidence.confirmedShipments += 1;
    }

    const [targetShipment, targetOrder, targetCarrier] = await Promise.all([
        Shipment.findOne({
            country: 'EC',
            $or: [
                { orderId: targetContract.orderId },
                { 'logistics.trackingNumber': String(targetContract.guide || '') }
            ]
        }).lean(),
        Order.findOne({ country: 'EC', orderId: targetContract.orderId }).select({
            orderId: 1,
            status: 1,
            trackingNumber: 1,
            dropiOrderId: 1,
            shippingStatus: 1,
            shippingCanonicalStatus: 1,
            shippingCanonicalEvidence: 1
        }).lean(),
        trackServientregaGuide(String(targetContract.guide || '')).catch((error) => ({
            ok: false,
            reason: error.message || String(error)
        }))
    ]);
    const targetProjection = targetCarrier.ok
        ? canonicalLogisticsProjectionForShipmentV147({
            logistics: {
                canonicalStatus: targetCarrier.canonicalStatus,
                canonicalEvidence: {
                    provider: targetCarrier.carrier,
                    rawCode: targetCarrier.providerStatusCode,
                    rawStatus: targetCarrier.statusAtual,
                    rawSubstatus: targetCarrier.providerSubstatus || targetCarrier.ultimoMovimiento
                }
            }
        })
        : (targetShipment ? canonicalLogisticsProjectionForShipmentV147(targetShipment) : null);
    const targetPayment = targetShipment ? shipmentCanonicalPaymentEvidence(targetShipment) : null;
    const targetBlocked = !targetProjection?.canPickup
        && targetProjection?.canonicalStatus !== 'DELIVERED';

    const output = {
        audit: 'V147_R3_PAYMENT_BONUS_READONLY',
        readOnly: true,
        messagesSent: 0,
        shipmentsScanned: shipments.length,
        canonicalEvidence,
        rejectedDerivedEvidence,
        rejectedFieldInventory,
        target: {
            orderId: targetContract.orderId,
            orderFound: Boolean(targetOrder),
            shipmentFound: Boolean(targetShipment),
            guide: String(targetContract.guide || ''),
            carrierReadOnlyOk: Boolean(targetCarrier.ok),
            providerStatus: String(targetCarrier.statusAtual || ''),
            providerSubstatus: String(targetCarrier.providerSubstatus || targetCarrier.ultimoMovimiento || ''),
            canonicalStatus: targetProjection?.canonicalStatus || 'UNKNOWN',
            canPickup: targetProjection?.canPickup === true,
            paymentConfirmedCanonical: targetPayment?.confirmed === true,
            paymentSource: targetPayment?.source || '',
            paymentClassification: targetPayment?.classification || 'UNKNOWN',
            a07Send: false,
            p5Send: false,
            p6Send: false,
            p7Send: false,
            blockVerified: targetBlocked
        }
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} finally {
    await mongoose.disconnect();
}
