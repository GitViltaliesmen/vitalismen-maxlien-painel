import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Shipment from '../src/models/Shipment.js';
import {
    canResolveStaleDropiRejectedReview,
    resolveStaleDropiRejectedReviewAtomic,
    suppressedNotificationKindsForStatus
} from '../src/services/dropiRejectedReviewResolutionService.js';
import { decidePostSaleNotification } from '../src/services/postSaleNotificationDecisionService.js';

dotenv.config();

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const approved = process.env.POSTSALE_HISTORICAL_APPLY_APPROVED === 'I_UNDERSTAND_NO_REPLAY';
if (apply && !approved) {
    throw new Error('Apply bloqueado: defina POSTSALE_HISTORICAL_APPLY_APPROVED=I_UNDERSTAND_NO_REPLAY. O modo padrao e DRY RUN.');
}

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';
if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI ausente. Nenhuma alteracao foi executada.');
const limitArg = [...args].find((arg) => arg.startsWith('--limit='));
const limit = Math.max(1, Math.min(Number(limitArg?.split('=')[1]) || 500, 5000));
const kindForStatus = (status = '') => {
    const value = String(status || '').trim().toUpperCase();
    if (value === 'READY_FOR_PICKUP') return 'ready_for_pickup';
    if (value === 'DEVUELTO') return 'returned';
    if (/EN_RUTA|EN_REPARTO|EN_DESPACHO|EN_BODEGA|MERCANCIA_RECOGIDA/.test(value)) return 'in_transit';
    return 'guide';
};

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });
try {
    const candidates = await Shipment.find({
        country: 'EC',
        'review.manualOnly': true,
        'review.reviewReason': 'dropi_rejected',
        'review.reviewStatus': 'manual_send_required'
    }).sort({ updatedAt: 1 }).limit(limit);

    const items = [];
    for (const shipment of candidates) {
        const evidence = {
            source: 'dropi_sync_authoritative',
            orderId: shipment.orderId,
            dropiOrderId: shipment.raw?.manualDropiOrderId
                || shipment.raw?.latestDroppiPayload?.dropiOrderId
                || shipment.raw?.droppiOrder?.id
                || '',
            trackingNumber: shipment.logistics?.trackingNumber || '',
            status: shipment.logistics?.status || '',
            observedAt: shipment.logistics?.lastStatusAt || shipment.updatedAt
        };
        const resolution = canResolveStaleDropiRejectedReview({ shipment, evidence });
        const notificationKind = kindForStatus(shipment.logistics?.status);
        const simulated = shipment.toObject();
        if (resolution.ok) {
            simulated.review = {
                ...simulated.review,
                manualOnly: false,
                reviewReason: '',
                reviewStatus: 'superseded_by_authoritative_logistics',
                suppressedNotificationKinds: [
                    ...new Set([
                        ...(simulated.review?.suppressedNotificationKinds || []),
                        ...suppressedNotificationKindsForStatus(shipment.logistics?.status)
                    ])
                ]
            };
        }
        const notificationDecision = await decidePostSaleNotification({
            shipment: simulated,
            kind: notificationKind,
            acquireLock: false
        });
        let applyResult = null;
        if (apply && resolution.ok) {
            applyResult = await resolveStaleDropiRejectedReviewAtomic({ shipment, evidence });
        }
        items.push({
            orderId: shipment.orderId,
            phoneTail: String(shipment.client?.phone || '').replace(/\D/g, '').slice(-4),
            proposedChange: resolution.ok
                ? 'dropi_rejected/manual_send_required -> superseded_by_authoritative_logistics'
                : 'none',
            evidence: resolution.evidence || evidence,
            risk: resolution.ok ? 'low_closed_positive_evidence' : `blocked:${resolution.reason}`,
            notificationKind,
            equivalentMessageDecision: notificationDecision.decision,
            wouldTriggerAutomaticEvent: notificationDecision.decision === 'SHOULD_SEND',
            suppressedHistoricalKinds: simulated.review?.suppressedNotificationKinds || [],
            applied: Boolean(applyResult?.resolved),
            applyReason: applyResult?.reason || ''
        });
    }

    const report = {
        generatedAt: new Date().toISOString(),
        mode: apply ? 'APPLY_WITHOUT_REPLAY' : 'DRY_RUN',
        deployAuthorized: false,
        realMessagesSent: 0,
        realDropiSubmissions: 0,
        candidateCount: candidates.length,
        items
    };
    const outputArg = [...args].find((arg) => arg.startsWith('--output='));
    if (outputArg) {
        const outputPath = path.resolve(outputArg.slice('--output='.length));
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
    await mongoose.disconnect();
}
