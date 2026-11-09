import test from 'node:test';import assert from 'node:assert/strict';
import {createGiraRuntimePolicy,giraRuntimePolicy} from '../src/services/gira21x/runtime-policy.mjs';
const orderId='EC-G21-'+'A'.repeat(24),giraId='g21cod_order_'+'a'.repeat(28),p='593999999999';
const order=()=>({orderId,country:'EC',currency:'USD',status:'confirmed',customer:{phone:'+'+p},package:{quantity:1},total:49.99,integration:{origin:'GIRA21X',gira21xOrderId:giraId,payloadHash:'a'.repeat(64),dispatch:'MANUAL_ONLY',purchaseOwner:'GIRA21X',amountMinor:4999,quantity:1,whatsappConsent:true}});
const fixture=(overrides={})=>createGiraRuntimePolicy({approval:()=>Object.freeze({loaded:true,kind:'GIRA21X_EC_BRIDGE_RUNTIME_V1',receive:true,notices:true,...overrides}),env:()=>({GIRA21X_BRIDGE_ENABLED:'true',GIRA21X_NATIVE_CONTRACT_APPROVED:'true',GIRA21X_NOTICES_ENABLED:'true'})});
test('default profile and lookalike mutable global never grant service permission',()=>{
 assert.equal(giraRuntimePolicy.approved(),false);
 const key='__VITALISMEN_GIRA21X_BRIDGE_CONTEXT',descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
 if(descriptor&&!descriptor.configurable){assert.equal(descriptor.writable,false);assert.throws(()=>{globalThis[key]=Object.freeze({loaded:true,receive:true});},TypeError);assert.throws(()=>{delete globalThis[key];},TypeError);}
 else{globalThis[key]=Object.freeze({loaded:true,kind:'GIRA21X_EC_BRIDGE_RUNTIME_V1',receive:true});assert.equal(giraRuntimePolicy.approved(),false);delete globalThis[key];}
 assert.equal(giraRuntimePolicy.approved(),false);
 assert.throws(()=>fixture({receive:false}).run(()=>true),/PROFILE_REQUIRED/);
});
test('own import requires immutable EC origin snapshot; native/foreign writes and destructive methods stay blocked',()=>{
 const policy=fixture();assert.equal(policy.mongo('orders','updateOne',[]),false);
 policy.run(()=>{const valid=[{orderId},{$setOnInsert:order()}];assert.equal(policy.mongo('orders','updateOne',valid),true);
  for(const bad of [{...order(),country:'CO'},{...order(),total:35.99},{...order(),integration:{...order().integration,dispatch:'AUTO'}}])assert.equal(policy.mongo('orders','updateOne',[{orderId},{$setOnInsert:bad}]),false);
  for(const collection of ['users','shipments','products','messages','outbounddedupes'])assert.equal(policy.mongo(collection,'insertOne',[order()]),false);
  for(const method of ['drop','deleteMany','replaceOne','bulkWrite','createIndex'])assert.equal(policy.mongo('gira21x_bridge_v1',method,[{_id:'cycle'}]),false);
 });
});
test('receipt/cycle writes remain restricted to their namespace and allowed fields',()=>{
 const policy=fixture();policy.run(()=>{
  assert.equal(policy.mongo('gira21x_bridge_v1','findOneAndUpdate',[{_id:'cycle'},{$set:{until:new Date(),lastMinute:1,token:'a'.repeat(8)+'-aaaa-aaaa-aaaa-'+ 'a'.repeat(12)}}]),true);
  assert.equal(policy.mongo('gira21x_bridge_v1','updateOne',[{_id:'cycle'},{$set:{permissions:['admin']}}]),false);
  assert.equal(policy.mongo('gira21x_bridge_v1','insertOne',[{_id:'event:foreign',raw:'{}'}]),false);
 });
});
test('notice permission is scoped to consented GIRA buyer, existing text transport and reserved dedupe IDs',()=>{
 const policy=fixture();policy.send(order(),()=>{
  assert.equal(policy.external('zapi_outbound_reply'),true);assert.equal(policy.external('dropi_submit'),false);assert.equal(policy.external('meta_purchase'),false);
  assert.equal(policy.mongo('outbounddedupes','insertOne',[{_id:'qa',key:'qa-key',phoneDigits:p}]),true);
  assert.equal(policy.mongo('outbounddedupes','updateOne',[{key:'qa-key'},{$set:{status:'sent'}}]),true);
  assert.equal(policy.mongo('outbounddedupes','updateMany',[{key:{$in:['qa-key']}},{$set:{status:'sent',sentAt:new Date()}}]),true);
  assert.equal(policy.mongo('outbounddedupes','updateMany',[{key:{$in:['foreign']}},{$set:{status:'sent'}}]),false);
  assert.equal(policy.mongo('outbounddedupes','updateOne',[{key:'other'},{$set:{status:'sent'}}]),false);
  assert.equal(policy.mongo('messages','updateOne',[{_id:'mirror'},{$setOnInsert:{peerPhone:p,isFromMe:true,isBot:true,type:'chat'}}]),true);
  assert.equal(policy.mongo('messages','updateOne',[{_id:'other'},{$setOnInsert:{peerPhone:'593111111111',isFromMe:true,isBot:true,type:'chat'}}]),false);
 });assert.equal(policy.external('zapi_outbound_reply'),false);
 assert.throws(()=>policy.send({...order(),integration:{...order().integration,whatsappConsent:false}},()=>true),/PROFILE_REQUIRED/);
});
test('customer opt-out only disables messages for the same EC phone and origin',()=>{
 const policy=fixture();policy.optOut(order(),()=>{
  const filter={country:'EC','customer.phone':'+'+p,'integration.origin':'GIRA21X'},update={$set:{'integration.whatsappConsent':false,'integration.whatsappOptOutAt':new Date(),'integration.whatsappOptOutSource':'CUSTOMER_WHATSAPP'}};
  assert.equal(policy.mongo('orders','updateMany',[filter,update]),true);
  assert.equal(policy.mongo('orders','updateMany',[{...filter,'customer.phone':'+593111111111'},update]),false);
  assert.equal(policy.mongo('orders','updateMany',[filter,{$set:{...update.$set,'integration.whatsappConsent':true}}]),false);
 });
});
test('async request isolation cannot borrow the service or send permission from another task',async()=>{
 const policy=fixture();await Promise.all([policy.run(async()=>{await new Promise(r=>setImmediate(r));assert.equal(policy.mongo('gira21x_bridge_v1','updateOne',[{_id:'cycle'},{$set:{until:new Date()}}]),true);}),Promise.resolve().then(()=>assert.equal(policy.mongo('gira21x_bridge_v1','updateOne',[{_id:'cycle'},{$set:{until:new Date()}}]),false))]);
});
