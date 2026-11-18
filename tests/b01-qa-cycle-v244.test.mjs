import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createB01, b01AttemptKeyV244, b01AntiSpamKeyV244, b01ReservationFingerprintV244, B01_VERSION, b01PriceTextV242 } from '../src/services/vitPowerB01CoreV216Service.js';
import { createEcQaTestPermitV78, applyEcQaTestResetToStateV78, resolveEcQaTestContextV78 } from '../src/services/ecQaTestResetV78Service.js';
const QA='5515998038637', CTA='Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?\nNombre: Gerson';
const legacy=(phone,cursor)=>createHash('sha256').update(`${B01_VERSION}:${phone}:${cursor}`).digest('hex');
function fixture({phone=QA,serverPermit='native',uncertain=false}={}) {
 let clock=+new Date('2026-11-17T22:00:00Z'),job=null,permit,sequence=0;
 const state={phoneDigits:QA,chatId:QA+'@c.us',human:{mode:'manual'},tags:['TESTE_8637_PRIORIDADE','TESTE_FIXO_NAO_MEXER','BOT_TESTE_LIBERADO'],metadata:{testOnly:true,botTestEnabled:true,fullFunnelTestEnabled:true,noDropiEver:true}};
 const ledgers=new Map(Array.from({length:5},(_,cursor)=>['b01-v216:'+legacy(QA,cursor),{status:'sent',providerMessageId:'LEGACY_'+cursor,phoneDigits:QA,kind:cursor===0?'text':cursor<3?'audio':'image',fingerprint:createHash('sha256').update('b01-v216:'+cursor).digest('hex')}])), attempts=[];
 const arm=()=>{permit=createEcQaTestPermitV78({phone:QA,now:new Date(clock),ttlMs:600000});applyEcQaTestResetToStateV78({state,phone:QA,permit,now:new Date(clock)});};arm();
 const repo={
  get:async()=>job&&structuredClone(job),
  eligible:async()=>({allowed:true,qaPermitId:serverPermit==='native'?permit.permitId:serverPermit}),
  start:async(id,value)=>{if(job)return null;job=structuredClone(value);return structuredClone(job);},
  interrupt:async()=>{},expire:async()=>{},history:async()=>false,
  due:async now=>job?.status==='pending'&&+job.nextAt<=+now?['qa']:[],
  claim:async(id,now,token)=>{if(job?.status!=='pending')return null;job.status='sending';job.lockToken=token;return structuredClone(job);},
  check:async()=>{const ready=phone!==QA||resolveEcQaTestContextV78(state,{phone:QA,permitId:job.qaPermitId,now:new Date(clock)}).ready;return{allowed:ready&&job.status==='sending',reason:'qa_window_closed'};},
  reserve:async(id,token,cursor,key)=>{const full='b01-v216:'+key,fp=b01ReservationFingerprintV244({...job,cursor}),kind=job.steps[cursor].kind;if(ledgers.has(full)||[...ledgers.values()].some(x=>x.phoneDigits===phone&&x.kind===kind&&x.fingerprint===fp)){job.status='ambiguous';job.reason='attempt_already_reserved';return false;}ledgers.set(full,{status:'reserved',phoneDigits:phone,kind,fingerprint:fp});job.steps[cursor].status='attempted';return true;},
  accept:async(id,token,cursor,providerMessageId,now,nextAt)=>{const key='b01-v216:'+b01AttemptKeyV244({...job,cursor});ledgers.set(key,{...ledgers.get(key),status:'sent',providerMessageId});job.steps[cursor].status='accepted';job.steps[cursor].providerMessageId=providerMessageId;job.cursor++;job.status=nextAt?'pending':'done';job.nextAt=nextAt;},
  stop:async(id,token,status,reason)=>{job.status=status;job.reason=reason;}
 };
 const make=()=>createB01({repo,policy:()=>({enabled:true}),now:()=>new Date(clock),random:()=>0,send:async(j,step,key)=>{attempts.push({key,kind:step.kind,text:step.text});return uncertain?{ok:false}:{ok:true,provider:'zapi',providerMessageId:'NEW_'+attempts.length};}});
 let core=make();const input=()=>({contactId:'qa',phone,chatId:phone+'@c.us',sessionId:'zapi',productKey:'vit_power_ec',inboundId:'INPUT_'+(++sequence),text:CTA});
 return{ledgers,attempts,state,input,get job(){return job;},get permit(){return permit;},get core(){return core;},advance:async ms=>{clock+=ms;await core.tick();},complete:async()=>{await core.tick();for(let i=0;i<5;i++){clock+=i?18000:5000;await core.tick();}},restart:()=>{core=make();},freshRound:(newPermit=true)=>{assert(job?.status!=='sending');job=null;if(newPermit){state.human.mode='manual';arm();}}};
}
for(const cursor of [0,1,2,3,4])test('real EC keeps exact V216 key bytes for step '+cursor,()=>{
 for(const phone of ['593980000001','593990000002']){const job={phone,cursor,qaPermitId:'ecqa-v78-'+'a'.repeat(32)};assert.equal(b01AttemptKeyV244(job),legacy(phone,cursor));assert.equal(b01ReservationFingerprintV244(job),createHash('sha256').update('b01-v216:'+cursor).digest('hex'));}
});
test('two native QA permits each complete once while all five old B01 ledgers remain unchanged',async()=>{
 const f=fixture(),old=JSON.stringify([...f.ledgers]);await f.core.start(f.input());const first=f.permit.permitId;await f.complete();assert.equal(f.job.status,'done');assert.equal(f.attempts.length,5);assert.equal(f.attempts.filter(x=>x.kind==='audio').length,1);assert.equal(f.attempts.at(-1).text,b01PriceTextV242());
 const firstKeys=f.attempts.map(x=>x.key);f.freshRound();assert.notEqual(f.permit.permitId,first);await f.core.start(f.input());await f.complete();assert.equal(f.job.status,'done');assert.equal(f.attempts.length,10);assert.equal(new Set(f.attempts.map(x=>x.key)).size,10);assert.equal(JSON.stringify([...f.ledgers].slice(0,5)),old);assert.equal(f.ledgers.size,15);assert(firstKeys.every(k=>f.ledgers.get('b01-v216:'+k).status==='sent'));
});
test('same permit cannot resend after test-state cleanup or worker restart',async()=>{
 const f=fixture();await f.core.start(f.input());await f.complete();f.freshRound(false);await f.core.start(f.input());f.restart();await f.advance(5000);assert.equal(f.job.status,'ambiguous');assert.equal(f.job.reason,'attempt_already_reserved');assert.equal(f.attempts.length,5);await f.advance(30000);assert.equal(f.attempts.length,5);
});
test('duplicate inbound retains one presentation in one QA permit',async()=>{
 const f=fixture(),input=f.input();await f.core.start(input);assert.equal((await f.core.start(input)).reason,'same_inbound');await f.complete();assert.equal(f.attempts.length,5);
});
for(const serverPermit of [undefined,null,'','ecqa-v78-bad','ecqa-v78-'+'A'.repeat(32)])test('missing or invalid server-side QA permit fails closed: '+String(serverPermit),async()=>{
 const f=fixture({serverPermit:serverPermit===undefined?null:serverPermit}),input={...f.input(),qaPermitId:'ecqa-v78-'+'b'.repeat(32)};const result=await f.core.start(input);assert.equal(result.handled,true);assert.equal(result.reason,'qa_permit_required');assert.equal(f.job,null);assert.equal(f.attempts.length,0);
});
test('client-provided permit does not override native server eligibility',async()=>{
 const f=fixture();await f.core.start({...f.input(),qaPermitId:'ecqa-v78-'+'b'.repeat(32)});assert.equal(f.job.qaPermitId,f.permit.permitId);
});
test('a permit expires before dispatch and cannot authorize a new send',async()=>{
 const f=fixture();await f.core.start(f.input());await f.advance(600001);assert.equal(f.attempts.length,0);assert.equal(f.job.status,'interrupted');
});
test('uncertain provider response is never retried within the permit',async()=>{
 const f=fixture({uncertain:true});await f.core.start(f.input());await f.advance(5000);assert.equal(f.job.status,'ambiguous');f.restart();await f.advance(30000);assert.equal(f.attempts.length,1);
});
test('EC job never stores a QA permit supplied by eligibility or client',async()=>{
 const f=fixture({phone:'593980000001'});await f.core.start({...f.input(),qaPermitId:f.permit.permitId});assert(!Object.hasOwn(f.job,'qaPermitId'));await f.advance(5000);assert.equal(f.attempts[0].key,legacy('593980000001',0));
});
test('another Brazilian phone stays outside B01 scope',async()=>{
 const f=fixture({phone:'5515998038638'});assert.equal((await f.core.start(f.input())).reason,'outside_scope');assert.equal(f.job,null);
});
test('QA key rejects missing native permit and differs from old phone-only keys',()=>{
 assert.throws(()=>b01AttemptKeyV244({phone:QA,cursor:0}),/native_qa_permit_required/);assert.notEqual(b01AttemptKeyV244({phone:QA,cursor:0,qaPermitId:'ecqa-v78-'+'c'.repeat(32)}),legacy(QA,0));
});

test('semantic anti-spam keeps EC defaults and uses stable native permit namespace only for QA',()=>{
 assert.equal(b01AntiSpamKeyV244({phone:'593991234567',cursor:0}),undefined);
 const first={phone:QA,cursor:0,qaPermitId:'ecqa-v78-'+'a'.repeat(32)},second={...first,qaPermitId:'ecqa-v78-'+'b'.repeat(32)};
 assert.equal(b01AntiSpamKeyV244(first),b01AntiSpamKeyV244({...first}));assert.notEqual(b01AntiSpamKeyV244(first),b01AntiSpamKeyV244(second));
 assert.throws(()=>b01AntiSpamKeyV244({phone:QA,cursor:0}),/native_qa_permit_required/);
});

test('EC price table has a distinct stable semantic key without changing greeting or attempt keys',()=>{
 const phone='593991234567';assert.equal(b01AntiSpamKeyV244({phone,cursor:0}),undefined);
 assert.equal(b01AntiSpamKeyV244({phone,cursor:4}),'vitpower_b01_v216:step:4');
 for(const cursor of [0,1,2,3,4])assert.equal(b01AttemptKeyV244({phone,cursor}),legacy(phone,cursor));
});
