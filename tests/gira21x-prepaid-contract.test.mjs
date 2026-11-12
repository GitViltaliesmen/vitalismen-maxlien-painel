import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PREPAID_CONTRACT,validatePrepaidClaim,prepaidIntegrationFields,prepaidDropiProjection,
 prepaidPickupText,prepaidRuntimeApproved,dropiCollectionMode,dropiWireFinancials} from '../src/services/gira21x/prepaid-contract.mjs';
const now=Date.parse('2026-11-12T20:00:00Z'),options={approved:true,now};
const hash=value=>createHash('sha256').update(value).digest('hex');
const offers={OFFER_INICIO_X1_HYB:[1,4999],OFFER_EVOLUCION_X2_HYB:[2,7999],OFFER_DOMINIO_X3_HYB:[3,10999],OFFER_COMPLETO_X6_HYB:[6,18999]};
const skus=['SKU_VIT_POWERS','SKU_TEX_ULTRA','SKU_NITRIC_OXIDE'];
function payload(offerId='OFFER_INICIO_X1_HYB',sku=skus[0]){
 const [quantity,amountMinor]=offers[offerId];
 return {schemaVersion:2,sourceSystem:'GIRA21X',country:'EC',gira21xOrderId:'g21pre_order_'+'a'.repeat(28),
  offerId,offerVersion:1,program:'QA LOCAL NO DESPACHAR',sku,component:sku,quantity,amountMinor,currency:'USD',
  paymentContract:PREPAID_CONTRACT,paymentMode:'PREPAID',amountToCollectMinor:0,
  payment:{provider:'STRIPE',status:'PAID',amountMinor,currency:'USD',buyerEmail:'qa@example.invalid',checkoutSessionId:'cs_live_LOCALONLY123',
   paymentIntentId:'pi_LOCALONLY123',providerEventId:'evt_LOCALONLY123',snapshotHash:'b'.repeat(64),paidAt:new Date(now).toISOString()},
  customer:{name:'QA LOCAL NO DESPACHAR',phone:'+593000000000',email:'qa@example.invalid'},
  destination:{provinceName:'Guayas',cantonName:'Guayaquil'},delivery:{mode:'home',address:'LOCAL ONLY',reference:'NO DISPATCH'},whatsappConsent:false};
}
function order(p=payload()){
 const payloadHash=hash(JSON.stringify(p));
 return {orderId:'EC-G21-'+hash(p.gira21xOrderId).slice(0,24).toUpperCase(),country:'EC',currency:'USD',
  entryReason:'gira21x_external',source:'manual',package:{id:p.quantity,quantity:p.quantity},total:p.amountMinor/100,
  integration:{origin:'GIRA21X',gira21xOrderId:p.gira21xOrderId,payloadHash,offerId:p.offerId,offerVersion:p.offerVersion,
   sku:p.sku,quantity:p.quantity,amountMinor:p.amountMinor,dispatch:'MANUAL_ONLY',purchaseOwner:'GIRA21X',
   ...prepaidIntegrationFields(p,payloadHash,options)}};
}

test('twelve prepaid combinations preserve contractual total and collect zero',()=>{
 let count=0;
 for(const offerId of Object.keys(offers))for(const sku of skus){
  const p=payload(offerId,sku),o=order(p),value=prepaidDropiProjection(o,options);count++;
  assert.equal(value.quantity,p.quantity);assert.equal(value.amountMinor,p.amountMinor);assert.equal(value.total,o.total);
  assert.equal(value.paymentMode,'SIN_RECAUDO');assert.equal(value.amountToCollectMinor,0);assert.equal(value.sku,sku);
 }
 assert.equal(count,12);
});

test('current V207 context and environment flags do not authorize the new contract',()=>{
 assert.equal(prepaidRuntimeApproved(),false);
 assert.throws(()=>validatePrepaidClaim(payload()),/SUCCESSOR_REQUIRED/);
 assert.throws(()=>prepaidDropiProjection(order()),/SUCCESSOR_REQUIRED/);
});

test('foreign, unpaid, test-mode and mismatched receipts are rejected',()=>{
 const changes=[p=>p.country='CO',p=>p.currency='BRL',p=>p.sku='SKU_OTHER',p=>p.quantity=6,
  p=>p.amountMinor=1,p=>p.amountToCollectMinor=4999,p=>p.paymentMode='CON_RECAUDO',p=>p.payment.status='UNPAID',
  p=>p.payment.provider='HOTMART',p=>p.payment.amountMinor=1,p=>p.payment.currency='BRL',
  p=>p.payment.checkoutSessionId='cs_test_LOCALONLY123',p=>p.payment.paymentIntentId='',p=>p.payment.providerEventId='',
  p=>p.payment.snapshotHash='changed',p=>p.payment.paidAt=new Date(now+301000).toISOString(),
  p=>p.gira21xOrderId='g21cod_order_'+'a'.repeat(28),p=>p.offerId='__proto__',p=>p.offerVersion=0,
  p=>p.customer.email='different@example.invalid',p=>p.payment.buyerEmail='NOT_VALID'];
 for(const change of changes){const p=payload();change(p);assert.throws(()=>validatePrepaidClaim(p,options));}
});

test('mutating any paid projection or its immutable source prevents dispatch projection',()=>{
 const changes=[o=>o.total=0,o=>o.total=49,o=>o.package.quantity=2,o=>o.integration.amountToCollectMinor=4999,
  o=>o.integration.paymentStatus='UNPAID',o=>o.integration.paymentMode='CON_RECAUDO',o=>o.integration.sourceSnapshot.amountMinor=1,
  o=>o.integration.payment.paymentIntentId='pi_DIFFERENT',o=>o.integration.payloadHash='c'.repeat(64),
  o=>o.integration.offerVersion=2,o=>o.integration.sku='SKU_TEX_ULTRA',o=>o.orderId='EC-G21-'+'F'.repeat(24)];
 for(const change of changes){const o=order();change(o);assert.throws(()=>prepaidDropiProjection(o,options));}
});

test('the native and legacy COD paths receive no prepaid override or price changes',()=>{
 assert.equal(prepaidDropiProjection({total:35.99,package:{quantity:1}},options),null);
 const legacy={integration:{origin:'GIRA21X',gira21xOrderId:'g21cod_order_'+'a'.repeat(28)},total:39.99};
 const before=structuredClone(legacy);assert.equal(prepaidDropiProjection(legacy,options),null);assert.deepEqual(legacy,before);
 const forged=structuredClone(legacy);forged.integration.paymentMode='PREPAID';assert.throws(()=>prepaidDropiProjection(forged,options));
});

test('source and receipt are retained by value and the pickup text cannot ask a prepaid buyer to pay again',()=>{
 const p=payload(),o=order(p);p.payment.status='REFUNDED';assert.equal(o.integration.payment.status,'PAID');
 const text=prepaidPickupText(o,options);assert.match(text,/ya está pagado/);assert.match(text,/no debes pagar/);
 assert.equal(prepaidPickupText({integration:{origin:'NATIVE'}},options),null);
});

test('provider collection mode requires the original branded projection and current approval',()=>{
 const proof=prepaidDropiProjection(order(),options),p={paymentMode:'SIN_RECAUDO',quantity:1,price:49.99,giraPrepaidProof:proof};
 assert.equal(dropiCollectionMode(p,{approved:true}),'SIN_RECAUDO');
 assert.throws(()=>dropiCollectionMode(p,{approved:false}));
 assert.throws(()=>dropiCollectionMode({...p,giraPrepaidProof:{...proof}},{approved:true}));
 assert.throws(()=>dropiCollectionMode({...p,quantity:6},{approved:true}));
 assert.throws(()=>dropiCollectionMode({...p,price:0},{approved:true}));
 assert.throws(()=>dropiCollectionMode({...p,paymentMode:'CON_RECAUDO'},{approved:true}));
 assert.throws(()=>dropiCollectionMode({paymentMode:'SIN_RECAUDO',quantity:1,price:49.99},{approved:true}));
 assert.equal(dropiCollectionMode({paymentMode:'CON_RECAUDO',price:35.99}),'CON_RECAUDO');
});

test('official SIN RECAUDO wire total is zero while all twelve internal kit totals remain intact',()=>{
 for(const offerId of Object.keys(offers))for(const sku of skus){
  const o=order(payload(offerId,sku)),proof=prepaidDropiProjection(o,options),p={paymentMode:'SIN_RECAUDO',giraPrepaidProof:proof,
   price:o.total,quantity:o.package.quantity};
  const wire=dropiWireFinancials(p,{totalOrder:o.total,supplierProductsCost:10,shippingAmount:5},{approved:true});
  assert.deepEqual(wire,{total_order:0,rate_type:'SIN RECAUDO'});assert.equal(o.total,offers[offerId][1]/100);
  assert.equal(wire.dropshipper_amount_to_win,undefined);
 }
});

test('native wire economics stay unchanged, and a paid payload with changed product totals is rejected',()=>{
 assert.deepEqual(dropiWireFinancials({paymentMode:'CON_RECAUDO'},{totalOrder:35.99,supplierProductsCost:10,shippingAmount:5}),
  {total_order:35.99,rate_type:'CON RECAUDO',dropshipper_amount_to_win:20.99});
 const proof=prepaidDropiProjection(order(),options);
 assert.throws(()=>dropiWireFinancials({paymentMode:'SIN_RECAUDO',giraPrepaidProof:proof,price:49.99,quantity:1},
  {totalOrder:0,supplierProductsCost:10,shippingAmount:5},{approved:true}));
});
