import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createTexMeasurementV243 } from '../src/services/texUltraMeasurementV243Service.js';

// Execute the real purchase entrypoint with a blocked legacy transport boundary.
// The scoped service uses its real journal/qualification; only external HTTP is a fixture.
const source=await fs.readFile(new URL('../src/services/metaConversionsService.js',import.meta.url),'utf8');
const declaration='export const sendPurchaseEventForOrder = ';
const entrypoint=source.slice(source.indexOf(declaration)+declaration.length).trim().replace(/;$/,'');
assert.ok(source.includes(declaration));
async function fixture(){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tex243-purchase-routing-'));
 const now=Date.now(),phone='593999000001',reference='TX243-'+'a'.repeat(64),calls=[];
 let approved=true,legacyCalls=0;
 const cap={directory,key:'b'.repeat(64),ownerPhone:'5531971862958',officialPhone:'553171862958',activatedAt:new Date(now-60000).toISOString(),isCurrent:()=>approved};
 const state={phoneDigits:phone,metadata:{},async updateOne(){}};
 const text='Hola, quiero el tratamiento Tex Ultra.\nReferencia: '+reference;
 const scoped=createTexMeasurementV243({capability:()=>cap,now:()=>now,context:async()=>({method:'POST',path:'/api/zapi/webhook',writeContext:true}),findInbound:async()=>({body:text,timestamp:now}),post:async proof=>{calls.push(proof.kind);return {ok:true,verified:true,datasetId:'1100892582698669',eventId:'fixture_'+proof.kind,response:{events_received:1}};}});
 await scoped.observe({state,inboundText:text,sourceMessageId:'fixture-official-inbound',sessionId:'zapi'});
 const order={country:'EC',currency:'USD',orderId:'QA_ISOLATED_ORDER',customer:{phone},package:{quantity:1},total:35.99,status:'confirmed',confirmedAt:new Date(now),entryAt:new Date(now),tracking:{productKey:'tex_ultra_ec'}};
 assert.equal(await scoped.bindOrder(order,state),true);
 const blocked={ok:false,blocked:true,reason:'bot_core_meta_purchase_blocked'};
 const send=vm.runInNewContext('('+entrypoint+')',{
  isGiraOrder:()=>false,
  canaryV75BlockedResult:()=>{legacyCalls++;return blocked;},
  sendTexMeasurementPurchaseV243:(o,options)=>scoped.purchase(o,options),
  process:{env:{VITALISMEN_META_PURCHASE_ENABLED:'false'}}
 });
 return {order,send,calls,blocked,legacyCalls:()=>legacyCalls,disable:()=>{approved=false;},close:()=>fs.rm(directory,{recursive:true,force:true})};
}
test('qualified Tex Purchase reaches only its explicit capability while legacy Meta stays blocked',async()=>{
 const f=await fixture();try{
  const result=await f.send(f.order);
  assert.equal(result.ok,true,'qualified scoped Tex Purchase must not be intercepted by the legacy catch-all block');
  assert.equal(result.datasetId,'1100892582698669');assert.equal(f.legacyCalls(),0);
  assert.deepEqual(f.calls,['Lead','Purchase']);
  await f.send(f.order);assert.deepEqual(f.calls,['Lead','Purchase']);
 }finally{await f.close();}
});
test('manual product switch retains the original legacy Meta block',async()=>{
 const f=await fixture();try{
  f.order.tracking.productKey='nitrix_oxide_ec';const result=await f.send(f.order);
  assert.equal(result,f.blocked);assert.equal(f.legacyCalls(),1);assert.deepEqual(f.calls,['Lead']);
 }finally{await f.close();}
});
test('disabled scoped capability cannot send even when entering the Tex purchase branch',async()=>{
 const f=await fixture();try{
  f.disable();const result=await f.send(f.order);assert.equal(result.ok,false);assert.equal(result.blocked,true);assert.deepEqual(f.calls,['Lead']);
 }finally{await f.close();}
});
