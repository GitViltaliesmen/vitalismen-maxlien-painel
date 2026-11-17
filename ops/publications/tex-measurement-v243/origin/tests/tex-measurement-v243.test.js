'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createHmac}=require('node:crypto');
const {createTexMeasurementV243}=require('../tex-measurement-v243');
const T=Date.parse('2026-11-17T22:00:00Z'),key='c'.repeat(64),subject='d'.repeat(64),inboundId='e'.repeat(64);
async function setup(t,{send,enabled=()=>true}={}){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tex243-origin-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));let clock=T,calls=[];
 const make=()=>createTexMeasurementV243({directory,key,now:()=>clock,enabled,config:{pixel_id:'1100892582698669',origins:['https://plusmen.shop','https://www.plusmen.shop']},send:async e=>{calls.push(e);return send?send(e):{accepted:true,status:200,events_received:1};}});
 const runtime=make();const req={headers:{origin:'https://plusmen.shop','user-agent':'ISOLATED_NO_NETWORK'},socket:{remoteAddress:'127.0.0.1'},body:{action:'issue',event_source_url:'https://plusmen.shop/tex?utm_source=facebook&utm_campaign=ISOLATED&fbclid=fixture',fbp:'fb.1.1794952800000.123',fbc:'fb.1.1794952800000.fixture',external_id:'offline-anonymous-12345'}};
 const signed=b=>({headers:{'x-tex-timestamp':String(clock),'x-tex-signature':createHmac('sha256',key).update(String(clock)+'.'+JSON.stringify(b)).digest('hex')},body:b});
 const issue=await runtime.issue(req),proof={version:243,kind:'Lead',reference:issue.reference,subject,inboundId,occurredAt:T,channel:'whatsapp'};
 return {runtime,make,req,issue,proof,signed,calls,setClock:n=>clock=n};
}
test('issuing reference and polling never create a Lead',async t=>{
 const s=await setup(t);assert.match(s.issue.reference,/^TX243-[a-f0-9]{64}$/);assert.equal(s.calls.length,0);
 assert.equal((await s.runtime.status({...s.req,body:{reference:s.issue.reference}})).confirmed,false);assert.equal(s.calls.length,0);
});
test('untrusted origins/route and public Lead are rejected',async t=>{
 const s=await setup(t);await assert.rejects(s.runtime.issue({...s.req,headers:{...s.req.headers,origin:'https://evil.example'}}),/invalid_origin/);
 await assert.rejects(s.runtime.issue({...s.req,body:{...s.req.body,event_source_url:'https://plusmen.shop/bienestar'}}),/invalid_source_url/);
 await assert.rejects(s.runtime.proof({body:s.proof,headers:{}}),/invalid_proof/);assert.equal(s.calls.length,0);
});
test('signed confirmed Lead uses correct product/pixel context and source anonymous matching',async t=>{
 const s=await setup(t);assert.equal((await s.runtime.proof(s.signed(s.proof))).ok,true);assert.equal(s.calls.length,1);
 const e=s.calls[0];assert.equal(e.event_name,'Lead');assert.equal(e.custom_data.content_name,'Tex Ultra Ecuador');assert.deepEqual(e.custom_data.content_ids,['tex_ultra_ec']);
 assert.match(e.event_source_url,/utm_source=facebook/);assert.equal(e.user_data.fbc,'fb.1.1794952800000.fixture');assert.ok(!e.user_data.ph);assert.ok(!e.user_data.fn);
 const status=await s.runtime.status({...s.req,body:{reference:s.issue.reference}});assert.equal(status.eventId,e.event_id);assert.equal(status.confirmed,true);assert.ok(!JSON.stringify(status).includes('client_ip_address'));
});
test('HMAC tampering, wrong subject reuse and expired references fail closed',async t=>{
 const s=await setup(t);const altered=s.signed(s.proof);altered.body={...s.proof,channel:'web'};await assert.rejects(s.runtime.proof(altered),/invalid_proof/);
 await s.runtime.proof(s.signed(s.proof));await assert.rejects(s.runtime.proof(s.signed({...s.proof,subject:'f'.repeat(64)})),/reference_already_bound/);
 s.setClock(T+604800001);await assert.rejects(s.runtime.proof(s.signed({...s.proof,occurredAt:T+604800001})),/reference_expired/);assert.equal(s.calls.length,1);
});
test('same customer across channels and server recreation creates a single event',async t=>{
 const s=await setup(t);await s.runtime.proof(s.signed(s.proof));assert.equal((await s.make().proof(s.signed({...s.proof,channel:'web'}))).duplicate,true);assert.equal(s.calls.length,1);
});
test('uncertain Meta result is recorded before transport and never automatically retried',async t=>{
 const s=await setup(t,{send:async()=>{throw Error('unknown');}});assert.equal((await s.runtime.proof(s.signed(s.proof))).ok,false);
 assert.equal((await s.make().proof(s.signed(s.proof))).duplicate,true);assert.equal(s.calls.length,1);
});
test('Purchase requires existing confirmed origin and exact order proof; new orders dedupe independently',async t=>{
 const s=await setup(t),p={version:243,kind:'Purchase',reference:s.issue.reference,subject,orderKey:'f'.repeat(64),occurredAt:T+1000,quantity:3,value:80.99,currency:'USD'};
 await assert.rejects(s.runtime.proof(s.signed(p)),/lead_origin_required/);await s.runtime.proof(s.signed(s.proof));
 assert.equal((await s.runtime.proof(s.signed(p))).ok,true);assert.equal((await s.runtime.proof(s.signed(p))).duplicate,true);assert.equal(s.calls.length,2);
 assert.equal(s.calls[1].event_name,'Purchase');assert.equal(s.calls[1].custom_data.value,80.99);assert.equal(s.calls[1].custom_data.num_items,3);
 await assert.rejects(s.runtime.proof(s.signed({...p,quantity:12})),/invalid_purchase/);assert.equal(s.calls.length,2);
});
test('real HTTP path rejects forged conversion, keeps receipt no-store, never leaks key',async t=>{
 const s=await setup(t),express=require('express'),app=express();app.use(express.json());app.post('/public',s.runtime.publicHandler);app.post('/proof',s.runtime.proofHandler);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 const issued=await fetch(base+'/public',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://plusmen.shop','user-agent':'ISOLATED_HTTP_FIXTURE'},body:JSON.stringify(s.req.body)});assert.equal(issued.status,200);assert.match((await issued.json()).reference,/^TX243-[a-f0-9]{64}$/);assert.equal(s.calls.length,0);
 const forged=await fetch(base+'/proof',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s.proof)});assert.equal(forged.status,403);
 const signed=s.signed(s.proof),real=await fetch(base+'/proof',{method:'POST',headers:{'Content-Type':'application/json',...signed.headers},body:JSON.stringify(signed.body)});
 assert.equal(real.status,200);assert.equal(real.headers.get('cache-control'),'no-store');assert.ok(!(await real.text()).includes(key));assert.equal(s.calls.length,1);
});
