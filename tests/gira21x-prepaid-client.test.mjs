import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGiraCompositeClient,assertPrepaidCurrentPayment} from '../src/services/gira21x/prepaid-client.mjs';
import {PREPAID_CONTRACT,prepaidIntegrationFields} from '../src/services/gira21x/prepaid-contract.mjs';
const id='g21pre_order_'+'a'.repeat(28);

test('without the sealed prepaid approval the exact legacy client is returned',()=>{
 const legacy={claim:async()=>({items:[]})};assert.equal(createGiraCompositeClient({legacy,prepaid:{},approved:()=>false}),legacy);
});

test('new claims use only the remaining native batch capacity and keep COD ahead',async()=>{
 const oldItem={order:{schemaVersion:1}},newItem={order:{schemaVersion:2,gira21xOrderId:id}},limits=[];
 const client=createGiraCompositeClient({legacy:{claim:async()=>({items:[oldItem],releases:[{old:true}]})},approved:()=>true,
  prepaid:{claim:async limit=>{limits.push(limit);return {items:[newItem],releases:[{prepaid:true}],holds:[]};}}});
 const value=await client.claim();assert.deepEqual(limits,[24]);assert.deepEqual(value.items,[oldItem,newItem]);assert.equal(value.releases.length,2);
});

test('a prepaid outage, malformed batch or full legacy batch cannot block the existing COD cohort',async()=>{
 const old={items:[{order:{schemaVersion:1}}]},legacy={claim:async()=>old};
 for(const prepaid of [{claim:async()=>{throw Error('OFFLINE');}},{claim:async()=>null},{claim:async()=>({items:Array(25).fill({})})}])
  assert.equal(await createGiraCompositeClient({legacy,prepaid,approved:()=>true}).claim(),old);
 const full={items:Array(25).fill({})};let calls=0;
 assert.equal(await createGiraCompositeClient({legacy:{claim:async()=>full},prepaid:{claim:async()=>{calls++;}},approved:()=>true}).claim(),full);
 assert.equal(calls,0);
});

test('schema2 events can only go to the prepaid channel; legacy events keep their original route',async()=>{
 const calls=[],client=createGiraCompositeClient({approved:()=>true,legacy:{event:async e=>{calls.push(['COD',e]);}},
  prepaid:{event:async e=>{calls.push(['PREPAID',e]);}}});
 await client.event({schemaVersion:1,gira21xOrderId:'g21cod_order_'+'b'.repeat(28)});
 await client.event({schemaVersion:2,gira21xOrderId:id});assert.deepEqual(calls.map(x=>x[0]),['COD','PREPAID']);
 assert.throws(()=>client.event({schemaVersion:1,gira21xOrderId:id}),/SCOPE_INVALID/);
 assert.throws(()=>client.event({schemaVersion:2,gira21xOrderId:'g21cod_order_'+'b'.repeat(28)}),/SCOPE_INVALID/);
});

function paidOrder(){
 const p={schemaVersion:2,sourceSystem:'GIRA21X',country:'EC',gira21xOrderId:id,offerId:'OFFER_INICIO_X1_HYB',offerVersion:1,
  sku:'SKU_VIT_POWERS',quantity:1,amountMinor:4999,currency:'USD',paymentContract:PREPAID_CONTRACT,paymentMode:'PREPAID',amountToCollectMinor:0,
  customer:{email:'qa@example.invalid'},payment:{provider:'STRIPE',status:'PAID',amountMinor:4999,currency:'USD',buyerEmail:'qa@example.invalid',
   checkoutSessionId:'cs_live_LOCALONLY123',paymentIntentId:'pi_LOCALONLY123',providerEventId:'evt_LOCALONLY123',snapshotHash:'b'.repeat(64),paidAt:'2026-11-12T20:00:00.000Z'}};
 const hash=createHash('sha256').update(JSON.stringify(p)).digest('hex');
 return {orderId:'EC-G21-'+createHash('sha256').update(id).digest('hex').slice(0,24).toUpperCase(),country:'EC',currency:'USD',source:'manual',entryReason:'gira21x_external',
  package:{id:1,quantity:1},total:49.99,integration:{origin:'GIRA21X',gira21xOrderId:id,payloadHash:hash,offerId:p.offerId,offerVersion:1,
   sku:p.sku,quantity:1,amountMinor:4999,dispatch:'MANUAL_ONLY',purchaseOwner:'GIRA21X',...prepaidIntegrationFields(p,hash,{approved:true})}};
}

test('fresh source confirmation is required even when the local immutable receipt says paid',async()=>{
 const order=paidOrder(),i=order.integration,valid={contract:PREPAID_CONTRACT,gira21xOrderId:id,payloadHash:i.payloadHash,
  paymentStatus:'PAID',financiallyEligible:true,amountMinor:4999,currency:'USD',amountToCollectMinor:0,
  paymentIntentId:i.payment.paymentIntentId,checkoutSessionId:i.payment.checkoutSessionId};
 let calls=0;
 const verify=result=>assertPrepaidCurrentPayment(order,{approved:true,client:{paymentStatus:async(giraId,hash)=>{
  assert.equal(giraId,id);assert.equal(hash,i.payloadHash);calls++;return result;}}});
 assert.equal((await verify(valid)).financiallyEligible,true);
 for(const patch of [{paymentStatus:'REFUNDED'},{paymentStatus:'DISPUTED'},{financiallyEligible:false},{amountToCollectMinor:4999},
  {payloadHash:'f'.repeat(64)},{paymentIntentId:'pi_DIFFERENT'},{checkoutSessionId:'cs_live_OTHER'}])await assert.rejects(verify({...valid,...patch}),/PAYMENT_HELD/);
 assert.equal(calls,8);
 await assert.rejects(assertPrepaidCurrentPayment(order,{approved:true,client:{paymentStatus:async()=>{throw Error('OFFLINE');}}}),/OFFLINE/);
 assert.equal(await assertPrepaidCurrentPayment({country:'EC',integration:{origin:'NATIVE'}},{client:{}}),null);
});
