import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { createTexMeasurementV243 as backendFactory } from '../../../src/services/texUltraMeasurementV243Service.js';
const require=createRequire(import.meta.url),express=require('./origin/node_modules/express');
const {createTexMeasurementV243:originFactory}=require('./origin/tex-measurement-v243.js');
assert.notEqual(await fs.readlink('/proc/self/ns/net'),await fs.readlink('/proc/1/ns/net'));
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'tex243-cross-')),key='c'.repeat(64),phone='593999000001',now=Date.now(),meta=[],checks=[];
let server;
try{
 const origin=originFactory({directory:path.join(temp,'origin'),key,now:()=>now,enabled:()=>true,
  config:{pixel_id:'1100892582698669',origins:['https://plusmen.shop']},send:async e=>(meta.push(e),{accepted:true,status:200,events_received:1})});
 const app=express();app.use(express.json());app.post('/issue',origin.publicHandler);app.post('/proof',origin.proofHandler);
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const url='http://127.0.0.1:'+server.address().port;
 const http=async(route,body,headers={})=>{const r=await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return{status:r.status,body:await r.json()};};
 const issue=await http('/issue',{action:'issue',event_source_url:'https://plusmen.shop/tex?utm_source=facebook&campaign_id=ISOLATED_CAMPAIGN&ad_id=ISOLATED_AD',fbc:'fb.1.'+now+'.ISOLATED_CLICK',fbp:'fb.1.'+now+'.123',external_id:'ISOLATED_ANONYMOUS_ID',phone:'SHOULD_NEVER_BE_MATCHED',firstName:'SHOULD_NEVER_BE_MATCHED'},{origin:'https://plusmen.shop','user-agent':'ISOLATED_HTTP_FIXTURE'});
 assert.equal(issue.status,200,JSON.stringify(issue.body));assert.match(issue.body.reference,/^TX243-[a-f0-9]{64}$/);assert.equal(meta.length,0);checks.push('visit_issues_reference_without_conversion');
 const state={phoneDigits:phone,metadata:{productKey:'tex_ultra_ec',existing:'preserve'},updateOne:async({$set})=>{assert.deepEqual(Object.keys($set),['metadata.texMeasurementV243']);}};
 const native='Hola, quiero el tratamiento Tex Ultra.\nReferencia: '+issue.body.reference;
 const cap={isCurrent:()=>true,directory:path.join(temp,'backend'),key,ownerPhone:'5531971862958',officialPhone:'553171862958',activatedAt:new Date(now-60000).toISOString(),confirmedCode:async()=>true};
 const backend=backendFactory({capability:()=>cap,now:()=>now,context:async()=>({method:'POST',writeContext:true,path:'/api/zapi/webhook'}),findInbound:async selector=>{
  assert.equal(selector.provider,'zapi');assert.equal(selector.ownerPhoneDigits,'5531971862958');assert.equal(selector.peerPhone,phone);assert.equal(selector.isFromMe,false);
  return{body:native,timestamp:now/1000};
 },post:async body=>{const text=JSON.stringify(body),timestamp=String(now);const signed={'x-tex-timestamp':timestamp,'x-tex-signature':createHmac('sha256',key).update(timestamp+'.'+text).digest('hex')};return(await http('/proof',body,signed)).body;}});
 assert.equal((await http('/proof',{version:243,kind:'Lead',reference:issue.body.reference})).status,403);assert.equal(meta.length,0);checks.push('public_forged_lead_rejected');
 const input={state,inboundText:native,sourceMessageId:'ISOLATED_ONLY_NOT_REAL_INBOUND',sessionId:'zapi',recovered:false};
 const receipt=await backend.observe(input);assert.equal(receipt.ok,true);assert.equal(meta.length,1);assert.equal(meta[0].event_name,'Lead');assert.equal(meta[0].custom_data.content_name,'Tex Ultra Ecuador');assert.equal(meta[0].custom_data.ad_id,'ISOLATED_AD');
 assert.ok(meta[0].user_data.fbc.includes('ISOLATED_CLICK'));assert.ok(!meta[0].user_data.ph);assert.ok(!meta[0].user_data.fn);checks.push('signed_official_fixture_inbound_correlates_original_ad_to_lead');
 await backend.observe({...input,sourceMessageId:'ISOLATED_DUPLICATE'});assert.equal(meta.length,1);checks.push('cross_channel_persistent_identity_prevents_repeat');
 const status=await http('/issue',{action:'status',reference:issue.body.reference},{origin:'https://plusmen.shop'});assert.equal(status.body.confirmed,true);assert.equal(status.body.eventId,meta[0].event_id);checks.push('browser_receipt_uses_same_capi_id');
 const order={country:'EC',tracking:{productKey:'tex_ultra_ec'},customer:{phone:'+'+phone},entryAt:new Date(now+1000),confirmedAt:new Date(now+1000),orderId:'ISOLATED_NO_REAL_ORDER',status:'confirmed',currency:'USD',total:80.99,package:{quantity:3}};
 assert.equal(await backend.bindOrder(order,state),true);assert.equal(order.tracking.browserPixelId,'1100892582698669');assert.equal((await backend.purchase(order)).ok,true);assert.equal(meta.length,2);assert.equal(meta[1].event_name,'Purchase');assert.equal(meta[1].custom_data.value,80.99);await backend.purchase(order);assert.equal(meta.length,2);checks.push('qualified_new_tex_order_purchase_uses_original_ad_and_dedupes');
 assert.equal(await backend.purchase({...order,tracking:{...order.tracking,productKey:'vit_power_ec'}}),null);assert.equal(meta.length,2);checks.push('manual_product_switch_preserves_other_product_transport');
 const report={project:'VITALISMEN_EC',pass:true,checks,actualLoopbackHttp:true,originMetaTransportMocked:true,officialInboundLookupMocked:true,networkNamespaceIsolated:true,noProductionEvents:true,realWhatsappSends:0,realOrdersCreated:0,realMetaEvents:0,simulatedMetaCalls:meta.length};
 await fs.writeFile(new URL('./CROSS_CHANNEL_HTTP.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{
 if(server)await new Promise(r=>server.close(r));await fs.rm(temp,{recursive:true,force:true});
}
