// Prepared receiver extension. Not imported by the active runtime or published.
// The existing authenticated GIRA bridge remains the source of the paid receipt.
import {createHash} from 'node:crypto';

export const PREPAID_CONTRACT='GIRA21X_EC_STRIPE_PREPAID_V1';
const offers=Object.freeze({OFFER_INICIO_X1_HYB:[1,4999],OFFER_EVOLUCION_X2_HYB:[2,7999],
 OFFER_DOMINIO_X3_HYB:[3,10999],OFFER_COMPLETO_X6_HYB:[6,18999]});
const skus=new Set(['SKU_VIT_POWERS','SKU_TEX_ULTRA','SKU_NITRIC_OXIDE']);
const hash=value=>createHash('sha256').update(value).digest('hex');
const invalid=()=>{throw Object.assign(Error('GIRA_PREPAID_CONTRACT_INVALID'),{status:409});};
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const projections=new WeakSet();
const holds=new Set(['REFUNDED','DISPUTED','PARTIAL_REFUND_REVIEW']);

// Financial holds are separate from the immutable receipt of the original
// purchase. Applying one can only stop fulfillment; it cannot certify payment.
export function validatePrepaidHold(hold,{now=Date.now()}={}){
 if(!record(hold)||Object.keys(hold).some(k=>!['contract','holdId','gira21xOrderId','vitalismenOrderId','payloadHash','paymentStatus','occurredAt'].includes(k))
  ||hold.contract!==PREPAID_CONTRACT||!/^g21bridge_hold_[a-f0-9]{28}$/.test(hold.holdId??'')
  ||!/^g21pre_order_[a-f0-9]{28}$/.test(hold.gira21xOrderId??'')
  ||hold.vitalismenOrderId!=='EC-G21-'+hash(hold.gira21xOrderId).slice(0,24).toUpperCase()
  ||!/^[a-f0-9]{64}$/.test(hold.payloadHash??'')||!holds.has(hold.paymentStatus)
  ||typeof hold.occurredAt!=='string'||!Number.isFinite(Date.parse(hold.occurredAt))
  ||new Date(hold.occurredAt).toISOString()!==hold.occurredAt||Date.parse(hold.occurredAt)>now+300000)invalid();
 return hold;
}

export function prepaidHoldWrite(hold,options){
 validatePrepaidHold(hold,options);
 const stronger=hold.paymentStatus==='REFUNDED'?[]:hold.paymentStatus==='DISPUTED'?['REFUNDED']:['REFUNDED','DISPUTED'];
 return {query:{orderId:hold.vitalismenOrderId,'integration.origin':'GIRA21X','integration.schemaVersion':2,
  'integration.gira21xOrderId':hold.gira21xOrderId,'integration.payloadHash':hold.payloadHash,
  'integration.currentPaymentStatus':{$nin:stronger}},update:{$set:{
   'integration.currentPaymentStatus':hold.paymentStatus,'integration.fulfillmentHold':true,
   'integration.financialHoldId':hold.holdId,'integration.financialHoldAt':new Date(hold.occurredAt)}}};
}

// The sealed Mongo policy admits exactly this negative financial transition.
// No sourceSnapshot, receipt, customer, price, logistics or status is writable.
export function isPrepaidHoldMutation(query,update){
 try{
  const set=update?.$set,at=set?.['integration.financialHoldAt'];
  if(!(at instanceof Date))return false;
  const expected=prepaidHoldWrite({contract:PREPAID_CONTRACT,holdId:set['integration.financialHoldId'],
   gira21xOrderId:query?.['integration.gira21xOrderId'],vitalismenOrderId:query?.orderId,
   payloadHash:query?.['integration.payloadHash'],paymentStatus:set['integration.currentPaymentStatus'],occurredAt:at.toISOString()});
  const sameRecord=(a,b)=>record(a)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(key=>equal(a[key],b[key]));
  return sameRecord(query,expected.query)&&sameRecord(update,expected.update)&&sameRecord(set,expected.update.$set);
 }catch{return false;}
}

// No environment flag can certify payment. This control must come from a newly
// registered, immutable successor context; V207 does not provide it.
export function prepaidRuntimeApproved(){
 const d=Object.getOwnPropertyDescriptor(globalThis,'__VITALISMEN_GIRA21X_BRIDGE_CONTEXT'),a=d?.value;
 return !!(d&&!d.configurable&&!d.writable&&Object.isFrozen(a)&&a.loaded===true
  &&a.kind==='GIRA21X_EC_BRIDGE_RUNTIME_V1'&&a.receive===true&&a.prepaidContract===PREPAID_CONTRACT
  &&typeof a.isCurrent==='function'&&a.isCurrent());
}

export function validatePrepaidClaim(order,{approved=false,now=Date.now()}={}){
 if(approved!==true)throw Error('GIRA_PREPAID_SUCCESSOR_REQUIRED');
 const o=order,p=o?.payment,offer=record(o)&&Object.hasOwn(offers,o.offerId)?offers[o.offerId]:null;
 if(!record(o)||o.schemaVersion!==2||o.sourceSystem!=='GIRA21X'||o.country!=='EC'
  ||o.paymentContract!==PREPAID_CONTRACT||o.paymentMode!=='PREPAID'||o.amountToCollectMinor!==0
  ||!/^g21pre_order_[a-f0-9]{28}$/.test(o.gira21xOrderId??'')||!offer||!skus.has(o.sku)
  ||o.quantity!==offer[0]||o.amountMinor!==offer[1]||o.currency!=='USD'
  ||!Number.isInteger(o.offerVersion)||o.offerVersion<1||!record(p)||p.provider!=='STRIPE'||p.status!=='PAID'
  ||p.amountMinor!==o.amountMinor||p.currency!=='USD'||!/^cs_live_[A-Za-z0-9]+$/.test(p.checkoutSessionId??'')
  ||typeof p.buyerEmail!=='string'||p.buyerEmail.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(p.buyerEmail)
  ||p.buyerEmail!==p.buyerEmail.trim().toLowerCase()||o.customer?.email!==p.buyerEmail
  ||!/^pi_[A-Za-z0-9]+$/.test(p.paymentIntentId??'')||!/^evt_[A-Za-z0-9]+$/.test(p.providerEventId??'')
  ||!/^[a-f0-9]{64}$/.test(p.snapshotHash??'')||typeof p.paidAt!=='string'||!Number.isFinite(Date.parse(p.paidAt))
  ||new Date(p.paidAt).toISOString()!==p.paidAt||Date.parse(p.paidAt)>now+300000)invalid();
 return o;
}

// Only financial fields are projected; the full original claim is retained so
// dispatch can recheck its hash instead of trusting editable panel labels.
export function prepaidIntegrationFields(payload,payloadHash,options){
 validatePrepaidClaim(payload,options);
 if(hash(JSON.stringify(payload))!==payloadHash)invalid();
 return {schemaVersion:2,paymentContract:PREPAID_CONTRACT,paymentMode:'PREPAID',paymentStatus:'PAID',
  amountToCollectMinor:0,payment:structuredClone(payload.payment),sourceSnapshot:structuredClone(payload)};
}

export function prepaidDropiProjection(order,{approved=false,now=Date.now()}={}){
 const i=order?.integration;
 if(i?.origin!=='GIRA21X')return null;
 const prepaidId=/^g21pre_order_[a-f0-9]{28}$/.test(i.gira21xOrderId??'');
 const marked=i.paymentContract===PREPAID_CONTRACT||i.paymentMode==='PREPAID'||i.schemaVersion===2;
 if(!prepaidId&&!marked)return null;
 if(i.fulfillmentHold===true||i.currentPaymentStatus!==undefined&&i.currentPaymentStatus!=='PAID')
  throw Error('GIRA_PREPAID_PAYMENT_HELD');
 const source=validatePrepaidClaim(i.sourceSnapshot,{approved,now});
 const projection=prepaidIntegrationFields(source,i.payloadHash,{approved,now});
 const expectedId='EC-G21-'+hash(source.gira21xOrderId).slice(0,24).toUpperCase();
 if(!prepaidId||order.orderId!==expectedId||order.country!=='EC'||order.currency!=='USD'
  ||order.entryReason!=='gira21x_external'||order.source!=='manual'
  ||i.gira21xOrderId!==source.gira21xOrderId||i.dispatch!=='MANUAL_ONLY'||i.purchaseOwner!=='GIRA21X'
  ||i.offerId!==source.offerId||i.offerVersion!==source.offerVersion||i.sku!==source.sku
  ||i.quantity!==source.quantity||i.amountMinor!==source.amountMinor
  ||Number(order.package?.quantity)!==source.quantity||Number(order.package?.id)!==source.quantity
  ||!Number.isFinite(order.total)||Math.round(order.total*100)!==source.amountMinor
  ||Object.keys(projection).some(key=>!equal(i[key],projection[key])))invalid();
 const result=Object.freeze({paymentMode:'SIN_RECAUDO',customerPaymentMode:'PREPAID',paymentStatus:'PAID',
  amountToCollectMinor:0,amountMinor:source.amountMinor,total:source.amountMinor/100,
  quantity:source.quantity,sku:source.sku,paymentContract:PREPAID_CONTRACT});
 projections.add(result);return result;
}

// A JSON flag or copied object is insufficient to select no-collection in the
// provider adapter. Only the in-process projection of the stored order can do it.
export function dropiCollectionMode(payload,{approved=prepaidRuntimeApproved()}={}){
 if(payload?.paymentMode==='SIN_RECAUDO'||payload?.giraPrepaidProof){
  const proof=payload.giraPrepaidProof;
  if(!approved||!projections.has(proof)||payload.paymentMode!=='SIN_RECAUDO'
   ||payload.quantity!==proof.quantity||payload.price!==proof.total||proof.amountToCollectMinor!==0)invalid();
  return 'SIN_RECAUDO';
 }
 if(payload?.paymentMode!==undefined&&payload.paymentMode!=='CON_RECAUDO')invalid();
 return 'CON_RECAUDO';
}

// Matches the current official Ecuador client: SIN RECAUDO sends total_order=0.
// The merchant's immutable kit total and per-product prices remain separate.
export function dropiWireFinancials(payload,{totalOrder,supplierProductsCost,shippingAmount},options){
 const mode=dropiCollectionMode(payload,options);
 if(mode==='SIN_RECAUDO'){
  if(!Number.isFinite(totalOrder)||Math.round(totalOrder*100)!==payload.giraPrepaidProof.amountMinor)invalid();
  return {total_order:0,rate_type:'SIN RECAUDO'};
 }
 return {total_order:totalOrder,rate_type:'CON RECAUDO',
  dropshipper_amount_to_win:Number((totalOrder-supplierProductsCost-shippingAmount).toFixed(6))};
}

export function approvedPrepaidWirePayload(data,proof){
 if(!prepaidRuntimeApproved()||!projections.has(proof)||data?.rate_type!=='SIN RECAUDO'||data.total_order!==0
  ||data.payment_method_id!==1||!Array.isArray(data.products)||data.products.length!==1) return false;
 const product=data.products[0];
 return Number(product.quantity)===proof.quantity&&Number.isFinite(Number(product.price))
  &&Math.round(Number(product.price)*Number(product.quantity)*100)===proof.amountMinor;
}

export function prepaidPickupText(order,options){
 return prepaidDropiProjection(order,options)
  ?'Servientrega informa que tu pedido GIRA21X está disponible para retirar en la agencia seleccionada. Tu pedido ya está pagado; no debes pagar al retirarlo.'
  :null;
}
