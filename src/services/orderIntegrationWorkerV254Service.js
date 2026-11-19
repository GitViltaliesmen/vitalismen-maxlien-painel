import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Ledger from '../models/MetaPurchaseDeliveryV254.js';
import { integrationPolicyV254, withIntegrationScopeV254 } from './orderIntegrationScopeV254Service.js';
import { deliverPurchaseV254, purchaseLedgerIdV254, purchaseAttributionV254, preparePurchaseIntentV254, acceptedPurchaseReceiptV254 } from './metaPurchaseDeliveryV254Service.js';
let busy = false;
export const effectivePurchaseDestinationV254 = (order, resolver) => {
    if (order.tracking?.measurementVersion === 243 && order.tracking?.attributionSource === 'tex_verified_first_touch_v243') return { pixelId: '1100892582698669', route: 'plusmen_tex_v243_private_relay' };
    if (order.tracking?.measurementVersion === 213 && order.tracking?.attributionSource === 'verified_zapi_reference_v213') return { pixelId: '28298613626504767', route: 'vitpower_site_v237' };
    return resolver(order);
};
export async function effectivePurchaseIdentityV254(order, resolver) {
    const target = effectivePurchaseDestinationV254(order, resolver);
    if (target.route === 'plusmen_tex_v243_private_relay') {
        const { sendTexMeasurementPurchaseV243 } = await import('./texUltraMeasurementV243Service.js');
        const built = await sendTexMeasurementPurchaseV243(order, { dryRun: true });
        if(!built?.ok||!built.eventId||built.datasetId!==target.pixelId)throw Error('tex_purchase_identity_not_ready');
        return { ...target, eventId: built.eventId };
    }
    if (target.route === 'vitpower_site_v237') {
        const { scopedPurchaseReceiptV237 } = await import('./vitPowerMeasurementV213Application.js');
        const receipt = await scopedPurchaseReceiptV237(order);
        if(!receipt?.eventId||receipt.datasetId!==target.pixelId)throw Error('vitpower_purchase_identity_not_ready');
        return { ...target, eventId: receipt.eventId };
    }
    if(!target?.pixelId)throw Error('purchase_destination_missing');
    return target;
}
export async function processPurchaseBatchV254({orders,destination,deliver,onError=async()=>{}}) {
    for(const order of orders) {
        try {
            const target=await destination(order);
            const result=await deliver(order,target);
            if(result?.state&&!result.skipped)break;
        } catch(error) {
            // A broken destination for one purchase cannot starve independent purchases.
            try { await onError(order,error); } catch(reportError) { console.error('[V254] Purchase error projection:',reportError.code||'projection_failed'); }
        }
    }
}
export async function purchaseTickV254() {
    if (busy || !integrationPolicyV254() || mongoose.connection.readyState !== 1) return;
    busy = true;
    try {
        // Catch prospective confirmations performed through an older writer during a controlled restart.
        const cutoff=new Date(integrationPolicyV254().activatedAt());
        const missing=await Order.findOne({country:'EC',integration:null,status:{$in:['confirmed','processing','shipped','delivered']},confirmedAt:{$gte:cutoff},currency:'USD',total:{$gt:0},'tracking.productKey':{$in:['tex_ultra_ec','vit_power_ec','nitrix_ec']},'package.quantity':{$in:[1,2,3,6]},'customer.phone':/^\+?5939\d{8}$/,'purchaseDeliveryV254.requestedAt':null}).sort({confirmedAt:1}).lean();
        if(missing&&preparePurchaseIntentV254(missing,{transition:true,fromPersistedConfirmation:true}))await withIntegrationScopeV254({kind:'purchase',orderId:missing.orderId,orderObjectId:String(missing._id),ledgerId:purchaseLedgerIdV254(missing.orderId)},()=>Order.updateOne({_id:missing._id,'purchaseDeliveryV254.requestedAt':null},{$set:{purchaseDeliveryV254:missing.purchaseDeliveryV254}}));
        const stale = await Ledger.findOne({ state: 'sending', leaseUntil: { $lte: new Date() } }).lean();
        if (stale) {
            const order = await Order.findOne({ orderId: stale.orderId, country: 'EC' }).lean();
            if (order) await withIntegrationScopeV254({ kind: 'purchase', orderId: order.orderId, orderObjectId: String(order._id), ledgerId: stale._id }, () =>
                Ledger.updateOne({ _id: stale._id, state: 'sending', leaseToken: stale.leaseToken, leaseUntil: { $lte: new Date() } },
                    { $set: { state: stale.dispatchedAt ? 'ambiguous' : 'retry_wait', nextAttemptAt: new Date(), leaseUntil: null, lastError: stale.dispatchedAt ? 'process_stopped_after_dispatch' : 'process_stopped_before_dispatch' } }));
        }
        const orders = await Order.find({ country: 'EC', status: { $in: ['confirmed','processing','shipped','delivered'] },
            'purchaseDeliveryV254.requestedAt': { $ne: null }, 'purchaseDeliveryV254.state': { $in: ['pending','retry_wait','sending'] } }).sort({ 'purchaseDeliveryV254.requestedAt': 1 }).limit(30).lean();
        const { sendPurchaseEventForOrder, getMetaConfigForOrder } = await import('./metaConversionsService.js');
        await processPurchaseBatchV254({orders,
            destination:order=>effectivePurchaseIdentityV254(order,getMetaConfigForOrder),
            deliver:(order,destination)=>deliverPurchaseV254({order,Ledger,Orders:Order,destination,
                sender:(target,options)=>sendPurchaseEventForOrder(target,{...options,attributionEnricher:async()=>({ok:true,source:'existing_canonical_tracking_v254'})})}),
            onError:(order,error)=>withIntegrationScopeV254({kind:'purchase',orderId:order.orderId,orderObjectId:String(order._id),ledgerId:purchaseLedgerIdV254(order.orderId)},()=>Order.updateOne({_id:order._id},{$set:{'purchaseDeliveryV254.lastError':String(error.code||error.message||'purchase_destination_not_ready').slice(0,300)}}))
        });
    } catch (error) { console.error('[V254] Purchase queue:', error.code || error.message); }
    finally { busy = false; }
}
export async function purchaseStatusV254(order) {
    if (!integrationPolicyV254() || !order) return null;
    const row = await Ledger.findById(purchaseLedgerIdV254(order.orderId)).select('-payload').lean();
    return row ? { state: row.state, eventId: row.eventId, datasetId: row.datasetId, acceptedAt: row.acceptedAt, attempts: row.attempts,
        error: row.lastError || '', nextAttemptAt: row.nextAttemptAt, attribution: row.attribution, occurredAt: row.occurredAt } : {
        state: order.purchaseDeliveryV254?.state || (acceptedPurchaseReceiptV254(order) ? 'accepted' : 'not_registered'),
        eventId: order.tracking?.metaPurchaseEventId || order.orderId, attribution: purchaseAttributionV254(order) };
}

export async function decoratePurchaseOrdersV254(orders) {
    if(!integrationPolicyV254()||!orders.length)return orders;
    const ids=orders.filter(x=>x.country==='EC'&&!x.integration).map(x=>x.orderId);
    const rows=await Ledger.find({country:'EC',orderId:{$in:ids}}).select('-payload').lean(),byId=new Map(rows.map(x=>[x.orderId,x]));
    for(const order of orders){if(order.country!=='EC'||order.integration)continue;const row=byId.get(order.orderId);
        order.purchaseDeliveryV254={...(order.purchaseDeliveryV254||{}),state:row?.state||order.purchaseDeliveryV254?.state||(acceptedPurchaseReceiptV254(order)?'accepted':'not_registered'),
            attempts:row?.attempts||0,lastError:row?.lastError||order.purchaseDeliveryV254?.lastError||'',nextAttemptAt:row?.nextAttemptAt||null,attribution:row?.attribution||purchaseAttributionV254(order)};
        if(row?.state==='accepted'&&Number(row.response?.events_received)>0)order.tracking={...(order.tracking||{}),metaPurchaseEventId:row.eventId,metaPurchaseDatasetId:row.datasetId,metaPurchaseSentAt:row.acceptedAt,metaPurchaseResponse:row.response};
    }return orders;
}
