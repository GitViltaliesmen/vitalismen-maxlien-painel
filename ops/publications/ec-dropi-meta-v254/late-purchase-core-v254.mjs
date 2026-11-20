import {commercialFingerprintV254,historicalPurchasePlanV254,ledgerIdV254} from './recovery-core-v254-r2.mjs';
export function latePurchaseGrantV254(order,{startAt,endAt,excludedOrderIds=[],now=new Date()}={}){
 const time=+new Date(order.confirmedAt);if(!Number.isFinite(time)||time<+new Date(startAt)||time>=+new Date(endAt)||excludedOrderIds.includes(order.orderId)||order.source!=='manual')throw Error('late_purchase_outside_cutover_scope');
 if([213,243].includes(order.tracking?.measurementVersion))throw Error('late_purchase_owned_measurement_requires_its_owner');
 const plan=historicalPurchasePlanV254(order,{pixelId:'920532663934291',route:'country_ec_default'},{now});
 if(plan.alreadyAccepted)return null;
 if(order.purchaseDeliveryV254?.requestedAt)return null;
 if(plan.document.state!=='pending'||plan.document.eventId!==order.orderId)throw Error('late_purchase_prior_receipt_requires_review');
 return {orderId:order.orderId,orderObjectId:String(order._id),fingerprint:commercialFingerprintV254(order),originalConfirmedAt:order.confirmedAt,eventId:order.orderId,datasetId:'920532663934291',ledgerId:ledgerIdV254(order.orderId),intent:{...plan.intent,cutoverRecovery:true}};
}
