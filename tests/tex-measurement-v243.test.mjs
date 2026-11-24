import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createTexMeasurementV243, texMeasurementReferenceV243 } from '../src/services/texUltraMeasurementV243Service.js';
const hash=x=>createHash('sha256').update(x).digest('hex');
const T=Date.parse('2026-11-17T22:00:00Z'),reference='TX243-'+'a'.repeat(64), code='TX242-'+'b'.repeat(64),phone='593999000001';
async function setup(t,{post,body='Hola, quiero el tratamiento Tex Ultra.\nReferencia: '+reference}={}) {
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tex243-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 let enabled=true,scope={method:'POST',writeContext:true,path:'/api/zapi/webhook'},row={body,timestamp:T/1000},calls=[],writes=[],selector;
 const capability={isCurrent:()=>enabled,directory,key:'c'.repeat(64),ownerPhone:'5531971862958',officialPhone:'553171862958',activatedAt:new Date(T-60000).toISOString(),confirmedCode:async()=>true};
 const state={phoneDigits:phone,metadata:{productKey:'tex_ultra_ec',existing:'preserve'},updateOne:async q=>writes.push(q)};
 const runtime=createTexMeasurementV243({capability:()=>capability,now:()=>T,context:async()=>scope,findInbound:async q=>(selector=q,row),post:async p=>{calls.push(p);return post?post(p):{ok:true,verified:true,datasetId:'1100892582698669',eventId:'fixture'};}});
 const input={state,inboundText:body,sourceMessageId:'isolated-inbound-1',sessionId:'zapi',recovered:false};
 return {runtime,input,capability,calls,writes,get selector(){return selector;},setRow:r=>row=r,setScope:s=>scope=s,disable:()=>enabled=false};
}
test('native reference parser is exact and rejects free-form/oversized input',()=>{
 assert.equal(texMeasurementReferenceV243('Hola, quiero el tratamiento Tex Ultra.\nReferencia: '+reference),reference);
 for(const text of ['Referencia: '+reference,'hola '+reference,'Hola, quiero el tratamiento Tex Ultra.\nReferencia: '+reference+'\nQuiero 6 frascos'])assert.equal(texMeasurementReferenceV243(text),'');
});
test('real persisted official inbound alone qualifies; phone/name never leave backend',async t=>{
 const s=await setup(t);assert.equal((await s.runtime.observe(s.input)).ok,true);assert.equal(s.calls.length,1);
 assert.equal(s.selector.ownerPhoneDigits,'5531971862958');assert.equal(s.selector.provider,'zapi');assert.equal(s.selector.isFromMe,false);
 assert.equal(s.input.state.metadata.existing,'preserve');assert.equal(s.writes.length,1);
 assert.equal(Object.keys(s.writes[0].$set).join(','),'metadata.texMeasurementV243');
 assert.ok(!JSON.stringify(s.calls).includes(phone));assert.ok(!JSON.stringify(s.calls).includes('name'));
});
test('linked device requires exact socket context, owner and persisted inbound before a Tex claim',async t=>{
 const s=await setup(t),owner=s.capability.officialPhone;
 const input={...s.input,sessionId:'default',provider:'baileys',ownerPhoneDigits:owner};
 const scope={method:'SOCKET',path:'/internal/whatsapp/baileys-inbound',writeContext:true,
  baileysInbound:{verified:true,sessionId:'default',messageId:input.sourceMessageId,ownerPhoneDigits:owner}};
 s.setScope(scope);
 assert.equal((await s.runtime.observe(input)).ok,true);
 assert.deepEqual({provider:s.selector.provider,sessionId:s.selector.sessionId,owner:s.selector.ownerPhoneDigits},
  {provider:'baileys',sessionId:'default',owner});
 assert.equal(s.input.state.metadata.texMeasurementV243.provider,'baileys');
 const order={country:'EC',tracking:{productKey:'tex_ultra_ec'},customer:{phone:'+'+phone},entryAt:new Date(T+1000)};
 assert.equal(await s.runtime.bindOrder(order,s.input.state),true);
 assert.equal(order.tracking.attributionConfidence,'official_baileys_exact_message');
 assert.equal(order.tracking.measurementOwnerPhoneDigits,owner);
 const bad=await setup(t);bad.setScope({...scope,baileysInbound:{...scope.baileysInbound,messageId:'wrong'}});
 assert.equal(await bad.runtime.observe(input),null);assert.equal(bad.calls.length,0);
 const badOwner=await setup(t);badOwner.setScope({...scope,baileysInbound:{...scope.baileysInbound,ownerPhoneDigits:'5531999999999'}});
 assert.equal(await badOwner.runtime.observe({...input,ownerPhoneDigits:'5531999999999'}),null);
});
test('recovered, QA, wrong session, missing context and altered persisted body never qualify',async t=>{
 for(const change of [{recovered:true},{sessionId:'other'},{state:{phoneDigits:'5515998038637',metadata:{testOnly:true}}}]){
  const s=await setup(t);assert.equal(await s.runtime.observe({...s.input,...change}),null);assert.equal(s.calls.length,0);
 }
 for(const change of [{method:'GET',writeContext:true,path:'/api/zapi/webhook'},{method:'POST',writeContext:true,path:'/api/whatsapp/send'}]){
  const s=await setup(t);s.setScope(change);assert.equal(await s.runtime.observe(s.input),null);assert.equal(s.calls.length,0);
 }
 const s=await setup(t);s.setRow({body:'changed',timestamp:T/1000});assert.equal(await s.runtime.observe(s.input),null);
 s.setRow({body:s.input.inboundText,timestamp:(T-86400001)/1000});assert.equal(await s.runtime.observe(s.input),null);
});
test('off capability does not alter contacts, send events or bind a reference',async t=>{
 const s=await setup(t);s.disable();assert.equal(await s.runtime.observe(s.input),null);assert.equal(s.calls.length,0);assert.equal(s.writes.length,0);
});
test('duplicate across messages and process recreation stays one Lead',async t=>{
 const s=await setup(t);await s.runtime.observe(s.input);await s.runtime.observe({...s.input,sourceMessageId:'second'});
 const recreated=createTexMeasurementV243({capability:()=>s.capability,now:()=>T,context:async()=>({method:'POST',writeContext:true,path:'/api/zapi/webhook'}),findInbound:async()=>({body:s.input.inboundText,timestamp:T/1000}),post:async()=>{throw Error('replay forbidden');}});
 assert.equal((await recreated.observe(s.input)).ok,true);assert.equal(s.calls.length,1);
});
test('ambiguous transport result is durably attempted and never retried',async t=>{
 const s=await setup(t,{post:async()=>{throw Error('timeout');}});
 assert.equal((await s.runtime.observe(s.input)).ok,false);assert.equal((await s.runtime.observe(s.input)).blocked,true);
 assert.equal(s.calls.length,1);assert.equal(s.writes.length,0);
});
test('web reference requires the existing V242 confirmed phone link',async t=>{
 const body='Hola, quiero el tratamiento Tex Ultra.\nConfirmar chat: '+code,s=await setup(t,{body});
 const issued={verificationUrl:'https://wa.me/553171862958?text='+encodeURIComponent(body),expiresAt:T+600000};
 await s.runtime.bindCode(issued,reference);s.capability.confirmedCode=async()=>false;
 assert.equal(await s.runtime.observe(s.input),null);s.capability.confirmedCode=async()=>true;
 assert.equal((await s.runtime.observe(s.input)).ok,true);assert.equal(s.calls[0].channel,'web');
});
test('concurrent duplicate proof cannot send twice',async t=>{
 const s=await setup(t,{post:async()=>{await new Promise(r=>setTimeout(r,20));return {ok:true};}});
 const results=await Promise.allSettled([s.runtime.observe(s.input),s.runtime.observe(s.input)]);
 assert.equal(s.calls.length,1);assert.ok(results.some(r=>r.status==='fulfilled'));
});
test('only a new explicitly Tex order binds; old orders and V148 remain untouched',async t=>{
 const s=await setup(t);await s.runtime.observe(s.input);
 const order={country:'EC',tracking:{productKey:'tex_ultra_ec'},customer:{phone:'+'+phone},entryAt:new Date(T+1000)};
 assert.equal(await s.runtime.bindOrder(order,s.input.state),true);assert.equal(order.tracking.measurementVersion,243);assert.equal(order.tracking.browserPixelId,'1100892582698669');
 for(const bad of [{...order,entryAt:new Date(T-1000),tracking:{productKey:'tex_ultra_ec'}},{...order,tracking:{productKey:'vit_power_ec'}},{...order,tracking:{productKey:'tex_ultra_ec',measurementVersion:148}}])assert.equal(await s.runtime.bindOrder(bad,s.input.state),false);
});
test('Purchase is exact new confirmed order, dry run is side-effect free and repeated sends dedupe',async t=>{
 const s=await setup(t);await s.runtime.observe(s.input);
 const order={country:'EC',tracking:{productKey:'tex_ultra_ec'},customer:{phone:'+'+phone},entryAt:new Date(T+1000),confirmedAt:new Date(T+1000),orderId:'ISOLATED-NOT-REAL',status:'confirmed',currency:'USD',total:80.99,package:{quantity:3}};
 assert.equal(await s.runtime.bindOrder(order,s.input.state),true);
 assert.equal((await s.runtime.purchase(order,{dryRun:true})).dryRun,true);assert.equal(s.calls.length,1);
 assert.equal((await s.runtime.purchase({...order,status:'draft'})).blocked,true);assert.equal(s.calls.length,1);
 assert.equal((await s.runtime.purchase(order)).ok,true);assert.equal((await s.runtime.purchase(order)).ok,true);assert.equal(s.calls.length,2);
 assert.equal(s.calls[1].kind,'Purchase');assert.equal(s.calls[1].value,80.99);assert.ok(!JSON.stringify(s.calls[1]).includes(phone));
 assert.equal(await s.runtime.purchase({...order,tracking:{productKey:'vit_power_ec'}}),null);
 assert.equal(await s.runtime.purchase({...order,tracking:{...order.tracking,productKey:'vit_power_ec'}}),null);
});
