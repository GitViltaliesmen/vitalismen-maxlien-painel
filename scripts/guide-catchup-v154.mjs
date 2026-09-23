import mongoose from 'mongoose';
import Shipment from '../src/models/Shipment.js';
import { trackCarrierGuide, saveCarrierTrackingResult } from '../src/services/carrierTrackingService.js';
import { decidePostSaleNotification } from '../src/services/postSaleNotificationDecisionService.js';
import { notifyShipmentGuideGenerated } from '../src/services/shipmentMessageService.js';

const clean = (value = '') => String(value || '').trim();
const [modeRaw = 'plan', orderIdRaw = '', trackingRaw = ''] = process.argv.slice(2);
const mode = clean(modeRaw).toLowerCase();
const orderId = clean(orderIdRaw);
const tracking = clean(trackingRaw).replace(/\s+/g, '');
const authorized = clean(process.env.V154_GUIDE_CATCHUP_AUTHORIZATION) === 'I_UNDERSTAND_V154_SINGLE_GUIDE';
const mongoUri = clean(process.env.MONGODB_URI);

if (!['plan', 'run'].includes(mode) || !orderId || !tracking) {
    console.error('usage: node scripts/guide-catchup-v154.mjs plan|run ORDER_ID TRACKING');
    process.exit(64);
}
if (mode === 'run' && !authorized) {
    console.error('V154_GUIDE_CATCHUP_AUTHORIZATION_REQUIRED');
    process.exit(65);
}
if (!mongoUri) {
    console.error('MONGODB_URI_REQUIRED');
    process.exit(66);
}

const publicResult = ({ shipment, live, decision, result, mutation = '' } = {}) => ({
    mode,
    orderId,
    tracking,
    shipmentId: shipment?._id ? String(shipment._id) : '',
    phoneSuffix: clean(shipment?.client?.phone).slice(-4),
    storedCanonicalStatus: clean(shipment?.logistics?.canonicalStatus),
    liveCanonicalStatus: clean(live?.canonicalStatus),
    liveProviderStatus: clean(live?.statusAtual),
    liveProviderSubstatus: clean(live?.providerSubstatus),
    evidenceProvider: clean(live?.carrier),
    suppressedGuide: Boolean(shipment?.review?.suppressedNotificationKinds?.includes?.('guide')),
    preDecision: clean(decision?.decision),
    preReason: clean(decision?.reason),
    mutation,
    sendSuccess: result?.success === true,
    textSent: result?.textSent === true,
    sendReason: clean(result?.reason)
});

await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
try {
    let shipment = await Shipment.findOne({ orderId, country: 'EC' });
    if (!shipment) throw new Error('canonical_shipment_not_found');
    if (clean(shipment.logistics?.trackingNumber) !== tracking) throw new Error('canonical_tracking_mismatch');
    if (shipment.review?.manualOnly === true) throw new Error('shipment_manual_only');
    if (shipment.automation?.guiaNotifiedAt) {
        console.log(JSON.stringify({ ...publicResult({ shipment }), status: 'ALREADY_NOTIFIED' }, null, 2));
        process.exitCode = 0;
    } else {
        const live = await trackCarrierGuide({ trackingNumber: tracking, carrier: 'servientrega' });
        if (live?.ok !== true || clean(live.trackingNumber) !== tracking || clean(live.carrier).toLowerCase() !== 'servientrega') {
            throw new Error(`carrier_tracking_invalid:${clean(live?.reason) || 'unknown'}`);
        }
        if (clean(live.canonicalStatus) !== 'GUIDE_CREATED') {
            console.log(JSON.stringify({ ...publicResult({ shipment, live }), status: 'BLOCKED_CURRENT_STAGE' }, null, 2));
            process.exitCode = 3;
        } else {
            const decision = await decidePostSaleNotification({ shipment, kind: 'guide', acquireLock: false });
            if (mode === 'plan') {
                console.log(JSON.stringify({ ...publicResult({ shipment, live, decision }), status: 'PLAN_ONLY' }, null, 2));
            } else if (!['HISTORICAL_EVENT_SUPPRESSED', 'SHOULD_SEND'].includes(clean(decision?.decision))) {
                console.log(JSON.stringify({ ...publicResult({ shipment, live, decision }), status: 'BLOCKED_DECISION' }, null, 2));
                process.exitCode = 4;
            } else {
                await saveCarrierTrackingResult({ shipmentId: shipment._id, result: live, updateStatus: true });
                shipment = await Shipment.findById(shipment._id);
                if (clean(shipment.logistics?.canonicalStatus) !== 'GUIDE_CREATED') throw new Error('stage_changed_after_carrier_persist');
                let mutation = 'carrier_refreshed';
                if (decision.decision === 'HISTORICAL_EVENT_SUPPRESSED') {
                    const changed = await Shipment.updateOne({
                        _id: shipment._id,
                        'review.suppressedNotificationKinds': 'guide',
                        'automation.guiaNotifiedAt': null
                    }, {
                        $pull: { 'review.suppressedNotificationKinds': 'guide' },
                        $push: { events: { kind: 'v154_single_guide_catchup_authorized', at: new Date(), payload: {
                            orderId, tracking, previousDecision: decision.decision, previousReason: decision.reason || ''
                        } } }
                    });
                    if (changed.modifiedCount !== 1) throw new Error('guide_unsuppress_atomic_update_failed');
                    mutation = 'guide_unsuppressed_once';
                    shipment = await Shipment.findById(shipment._id);
                }
                const result = await notifyShipmentGuideGenerated(shipment, { force: false });
                const fresh = await Shipment.findById(shipment._id).lean();
                const verified = result?.success === true && result?.textSent === true && Boolean(fresh?.automation?.guiaNotifiedAt);
                console.log(JSON.stringify({
                    ...publicResult({ shipment: fresh, live, decision, result, mutation }),
                    status: verified ? 'SENT_AND_PERSISTED' : 'SEND_NOT_VERIFIED',
                    guiaNotifiedAt: fresh?.automation?.guiaNotifiedAt || null,
                    ledgerState: clean(fresh?.automation?.postSaleSafetyLedger?.GUIDE?.state),
                    providerMessageIdPresent: Boolean(fresh?.automation?.postSaleSafetyLedger?.GUIDE?.providerMessageId)
                }, null, 2));
                if (!verified) process.exitCode = 5;
            }
        }
    }
} catch (error) {
    console.error(JSON.stringify({ mode, orderId, tracking, status: 'ERROR', error: clean(error?.message || error) }, null, 2));
    process.exitCode = 1;
} finally {
    await mongoose.disconnect().catch(() => null);
}
