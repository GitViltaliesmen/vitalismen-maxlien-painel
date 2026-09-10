import mongoose from 'mongoose';

import Shipment from '../src/models/Shipment.js';
import { canonicalLogisticsProjectionForShipmentV147 } from '../src/services/canonicalLogisticsStatusV147Service.js';
import { shipmentCanonicalPaymentEvidence } from '../src/services/shipmentMessageService.js';

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI ausente; auditoria V147-R3 interrompida.');

const sourcePaths = [
    'raw.paymentConfirmedAt',
    'raw.payment.confirmedAt',
    'raw.payment.status',
    'raw.latestDroppiPayload.paymentStatus'
];

const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const sourceInventory = Object.fromEntries(sourcePaths.map((path) => [path, {
    present: 0,
    paid: 0,
    timestampPresent: 0,
    canonicalConfirmed: 0,
    classifications: {}
}]));

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 12_000 });
try {
    const shipments = await Shipment.find({ country: 'EC' }).lean();
    for (const shipment of shipments) {
        const evidence = shipmentCanonicalPaymentEvidence(shipment);
        for (const path of sourcePaths) {
            const value = get(shipment, path);
            if (value === undefined || value === null || value === '') continue;
            const inventory = sourceInventory[path];
            inventory.present += 1;
            if (String(value).trim().toLowerCase() === 'paid') inventory.paid += 1;
            const timestamp = path.endsWith('At')
                ? value
                : path === 'raw.payment.status'
                    ? shipment?.raw?.payment?.confirmedAt
                    : shipment?.raw?.latestDroppiPayload?.paymentConfirmedAt
                        || shipment?.raw?.latestDroppiPayload?.paymentUpdatedAt
                        || shipment?.raw?.latestDroppiPayload?.statusUpdatedAt
                        || shipment?.raw?.latestDroppiPayload?.updatedAt
                        || shipment?.raw?.latestDroppiPayload?.syncedAt;
            if (timestamp && !Number.isNaN(new Date(timestamp).getTime())) inventory.timestampPresent += 1;
            if (evidence.confirmed && evidence.source.includes(path.replace(/\.status$/, ''))) {
                inventory.canonicalConfirmed += 1;
                inventory.classifications[evidence.classification] = (inventory.classifications[evidence.classification] || 0) + 1;
            }
        }
    }

    const target = await Shipment.findOne({ orderId: 'EC-ADMIN-3484', country: 'EC' }).lean();
    const targetCanonical = target ? canonicalLogisticsProjectionForShipmentV147(target) : null;
    const targetPayment = target ? shipmentCanonicalPaymentEvidence(target) : null;
    const output = {
        audit: 'V147_R3_PAYMENT_BONUS_READONLY',
        readOnly: true,
        messagesSent: 0,
        shipmentsScanned: shipments.length,
        sourceInventory,
        target: target ? {
            orderId: target.orderId,
            canonicalStatus: targetCanonical?.canonicalStatus || 'UNKNOWN',
            canPickup: targetCanonical?.canPickup === true,
            paymentConfirmedCanonical: targetPayment?.confirmed === true,
            paymentSource: targetPayment?.source || '',
            paymentClassification: targetPayment?.classification || 'UNKNOWN',
            a07Send: false,
            p5Send: false,
            p6Send: false,
            p7Send: false
        } : {
            orderId: 'EC-ADMIN-3484',
            found: false,
            a07Send: false,
            p5Send: false,
            p6Send: false,
            p7Send: false
        }
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} finally {
    await mongoose.disconnect();
}
