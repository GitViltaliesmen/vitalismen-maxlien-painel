import { createHash, randomUUID } from 'node:crypto';
import { integrationPolicyV254, withIntegrationScopeV254 } from './orderIntegrationScopeV254Service.js';
export const purchaseLedgerIdV254 = orderId => 'mp254:' + createHash('sha256').update('EC|Purchase|' + orderId).digest('hex');
const validStatuses = new Set(['confirmed','processing','shipped','delivered']);
export const purchaseProblemsV254 = order => [
    order.country !== 'EC' && 'country', !/^5939\d{8}$/.test(String(order.customer?.phone || '').replace(/\D/g,'')) && 'phone',
    !order.orderId && 'order_id', !validStatuses.has(order.status) && 'not_confirmed',
    !['tex_ultra_ec','vit_power_ec','nitrix_ec'].includes(order.tracking?.productKey) && 'product', ![1,2,3,6].includes(Number(order.package?.quantity)) && 'quantity',
    !(Number(order.total) > 0) && 'value', order.currency !== 'USD' && 'currency',
    (!order.confirmedAt || !Number.isFinite(+new Date(order.confirmedAt))) && 'confirmation_time'
].filter(Boolean);
export const acceptedPurchaseReceiptV254 = (order,destination=null) => {
    const t=order.tracking||{},scoped=(t.measurementVersion===243&&t.attributionSource==='tex_verified_first_touch_v243'||t.measurementVersion===213&&t.attributionSource==='verified_zapi_reference_v213')&&+new Date(t.metaPurchaseSentAt)>=+new Date(order.confirmedAt);
    const expected=destination?.eventId||(scoped?t.metaPurchaseEventId:order.orderId);
    return Boolean(t.metaPurchaseSentAt&&t.metaPurchaseEventId&&t.metaPurchaseEventId===expected&&Number(t.metaPurchaseResponse?.events_received)>0);
};
export const inheritedPurchaseReceiptV254 = (order,destination={}) => Boolean(order.previousOrderId&&order.tracking?.metaPurchaseSentAt&&order.tracking?.metaPurchaseEventId!==(destination.eventId||order.orderId)&&(order.tracking.metaPurchaseEventId===order.previousOrderId||+new Date(order.tracking.metaPurchaseSentAt)<+new Date(order.confirmedAt)));
export const preparePurchaseIntentV254 = (order, { transition = false, fromPersistedConfirmation = false, now = new Date() } = {}) => {
    const p = integrationPolicyV254();
    if (!p || !transition || (!fromPersistedConfirmation && order.status !== 'confirmed' || fromPersistedConfirmation && !validStatuses.has(order.status)) || order.integration || order.purchaseDeliveryV254?.requestedAt) return false;
    if (!Number.isFinite(Date.parse(p.activatedAt())) || +new Date(order.confirmedAt) < Date.parse(p.activatedAt()) || purchaseProblemsV254(order).length) return false;
    order.purchaseDeliveryV254 = { version: 254, requestedAt: now, occurredAt: order.confirmedAt, ledgerId: purchaseLedgerIdV254(order.orderId), state: acceptedPurchaseReceiptV254(order) ? 'accepted' : 'pending' };
    return true;
};
export const purchaseAttributionV254 = order => {
    const t = order.tracking || {};
    return { status: t.attributionVisitorKey && ['CLAIMED','VERIFIED'].includes(t.attributionCorrelationStatus) && (t.fbc || t.fbclid || t.ad_id || t.ctwa_clid) ? 'verified' : 'not_proven',
        hasFbc: Boolean(t.fbc), hasFbp: Boolean(t.fbp), hasClickId: Boolean(t.fbclid), hasAdId: Boolean(t.ad_id), source: t.attributionSource || '' };
};
export const queuedPurchaseResponseV254 = order => ({ ok: false, queued: true, pending: true, accepted: false, eventId: order.tracking?.metaPurchaseEventId || order.orderId, reason: 'purchase_queued_at_confirmation' });
export const purchaseOutcomeV254 = (result, now = new Date(), attempts = 1) => {
    if (result?.ok === true && !result.dryRun && Number(result.response?.events_received) > 0) return { state: 'accepted', acceptedAt: now, lastError: '' };
    const status = Number(result?.status || 0), error = String(result?.error || result?.reason || 'meta_purchase_not_accepted').slice(0,600);
    if (result?.dispatched === true && (!status || status >= 500 && !result.explicitlyRejected)) return { state: 'ambiguous', lastError: error };
    if (status === 429 || status >= 500 && result?.explicitlyRejected === true || result?.retryablePreflight === true) {
        const delay = [30000,120000,600000][attempts - 1] || 1800000;
        return { state: 'retry_wait', nextAttemptAt: new Date(+now + delay), lastError: error };
    }
    return { state: 'blocked', lastError: error };
};
const scope = order => ({ kind: 'purchase', orderId: order.orderId, orderObjectId: String(order._id), ledgerId: purchaseLedgerIdV254(order.orderId), checkoutEventId: order.tracking?.checkoutEventId || '' });
export async function materializePurchaseV254({ order, Ledger, destination, now = new Date() }) {
    if (purchaseProblemsV254(order).length || !order.purchaseDeliveryV254?.requestedAt) return null;
    return withIntegrationScopeV254(scope(order), async () => {
        const id = purchaseLedgerIdV254(order.orderId);
        let row = await Ledger.findById(id).lean();
        if (row) return row;
        const inherited=inheritedPurchaseReceiptV254(order,destination),accepted=acceptedPurchaseReceiptV254(order,destination),receipt=inherited?{}:(order.tracking||{});
        const document = { _id: id, country: 'EC', orderId: order.orderId, eventName: 'Purchase',
            eventId: receipt.metaPurchaseEventId || destination?.eventId || order.orderId, datasetId: receipt.metaPurchaseDatasetId || destination?.pixelId || '',
            datasetRoute: receipt.metaPurchaseDatasetRoute || destination?.route || '', occurredAt: new Date(order.purchaseDeliveryV254.occurredAt || order.confirmedAt),
            state: accepted ? 'accepted' : receipt.metaPurchaseSentAt ? 'ambiguous' : 'pending', attempts: 0, nextAttemptAt: now, attribution: purchaseAttributionV254(order), history: inherited?[{at:now,state:'previous_purchase_receipt_preserved',previousOrderId:order.previousOrderId,eventId:order.tracking.metaPurchaseEventId,acceptedAt:order.tracking.metaPurchaseSentAt,datasetId:order.tracking.metaPurchaseDatasetId,response:order.tracking.metaPurchaseResponse}]:[],
            ...(accepted ? { acceptedAt: order.tracking.metaPurchaseSentAt, response: order.tracking.metaPurchaseResponse } : {}) };
        try { await Ledger.create(document); } catch (error) { if (error.code !== 11000) throw error; }
        return Ledger.findById(id).lean();
    });
}
export async function deliverPurchaseV254({ order, Ledger, Orders, sender, destination, now = new Date() }) {
    const row = await materializePurchaseV254({ order, Ledger, destination, now });
    if (!row) return { skipped: true };
    if (!['pending','retry_wait'].includes(row.state)) return withIntegrationScopeV254(scope(order), async () => {
        const update = { 'purchaseDeliveryV254.state': row.state, 'purchaseDeliveryV254.lastError': row.lastError || '' };
        if (row.state === 'accepted' && Number(row.response?.events_received) > 0) Object.assign(update, {
            'tracking.metaPurchaseEventId': row.eventId, 'tracking.metaPurchaseDatasetId': row.datasetId, 'tracking.metaPurchaseDatasetRoute': row.datasetRoute,
            'tracking.metaPurchaseSentAt': row.acceptedAt, 'tracking.metaPurchaseResponse': row.response });
        await Orders.updateOne({ _id: order._id }, { $set: update });
        return { skipped: true, state: row.state };
    });
    if (+new Date(row.nextAttemptAt) > +now) return { skipped: true, state: row.state };
    return withIntegrationScopeV254(scope(order), async () => {
        const token = randomUUID();
        const claim = await Ledger.findOneAndUpdate({ _id: row._id, state: { $in: ['pending','retry_wait'] }, nextAttemptAt: { $lte: now }, $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] },
            { $set: { state: 'sending', leaseToken: token, leaseUntil: new Date(+now + 90000), attemptedAt: now, dispatchedAt: null }, $inc: { attempts: 1 } }, { new: true }).lean();
        if (!claim) return { skipped: true, reason: 'already_claimed' };
        if (+now - +new Date(claim.occurredAt) >= 604800000 || +new Date(claim.occurredAt) > +now + 60000) {
            await Ledger.updateOne({ _id: row._id, leaseToken: token }, { $set: { state: 'expired', lastError: 'original_event_time_outside_meta_window', leaseUntil: null } });
            await Orders.updateOne({ _id: order._id }, { $set: { 'purchaseDeliveryV254.state': 'expired' } });
            return { state: 'expired' };
        }
        let result, dispatchReserved=false;
        try { result = await sender(order, { eventTime: claim.occurredAt, deliveryV254: { id: row._id, eventId: claim.eventId, datasetId: claim.datasetId, leaseToken: token,
            beforeDispatch: async ({ payload, eventId, datasetId }) => {
                if (datasetId !== claim.datasetId || eventId !== claim.eventId) throw Error('purchase_pinned_identity_changed');
                const requestSha256 = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
                const saved = await Ledger.updateOne({ _id: row._id, leaseToken: token, state: 'sending' }, { $set: { dispatchedAt: new Date(), requestSha256, payload } });
                if (saved.matchedCount !== 1) throw Error('purchase_lease_lost');
                dispatchReserved=true;
                return requestSha256;
            } } }); }
        catch (error) { result = { ok: false, error: String(error.code || error.message || 'meta_delivery_failed'), dispatched: dispatchReserved || error.dispatched === true, retryablePreflight: !dispatchReserved && error.dispatched !== true }; }
        if (result?.datasetId && claim.datasetId && result.datasetId !== claim.datasetId) result = { ok: false, error: 'purchase_destination_changed', dispatched: true };
        const outcome = purchaseOutcomeV254(result, new Date(), claim.attempts);
        const receipt = { ...outcome, leaseUntil: null, response: result?.response || result?.data || null, lastHttpStatus: Number(result?.status || 0), ...(result?.eventId ? { eventId: result.eventId } : {}) };
        await Ledger.updateOne({ _id: row._id, leaseToken: token }, { $set: receipt, $push: { history: { at: new Date(), state: outcome.state, http: receipt.lastHttpStatus, error: outcome.lastError, requestSha256: result?.requestSha256 || '' } } });
        const update = { 'purchaseDeliveryV254.state': outcome.state, 'purchaseDeliveryV254.lastError': outcome.lastError || '' };
        if (outcome.state === 'accepted') Object.assign(update, { 'tracking.metaPurchaseEventId': result.eventId || claim.eventId, 'tracking.metaPurchaseDatasetId': result.datasetId || claim.datasetId,
            'tracking.metaPurchaseDatasetRoute': result.datasetRoute || claim.datasetRoute, 'tracking.metaPurchaseSentAt': outcome.acceptedAt, 'tracking.metaPurchaseResponse': result.response });
        await Orders.updateOne({ _id: order._id }, { $set: update });
        return { orderId: order.orderId, state: outcome.state };
    });
}
