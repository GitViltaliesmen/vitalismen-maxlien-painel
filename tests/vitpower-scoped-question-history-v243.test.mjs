import test from 'node:test';
import assert from 'node:assert/strict';
import { vitPowerQuestionHistoryQueryV243 as query } from '../src/services/vitPowerScopedQuestionHistoryV243Service.js';
const now=new Date('2026-11-17T12:00:00Z'),phone='593980000071',sessionId='zapi',ownerPhoneDigits='5531971862958';
function fixture(){return {phone,sessionId,ownerPhoneDigits,now,state:{phoneDigits:phone,vitPowerB01:{version:'vit-power-b01-v216',phone,sessionId,startedAt:now,steps:[{kind:'text',status:'accepted',providerMessageId:'PROVIDER_B01_PRICE',text:'¿Cuántos frascos desea?'}]}},saved:{history:[{role:'assistant',content:'¿Cuál es su ciudad?',providerMessageId:'PROVIDER_SDR_CITY',sessionId,ownerPhoneDigits},{role:'assistant',content:'¿Prefiere domicilio o agencia?'}],lastOutboundProviderId:'PROVIDER_LEGACY_MODE'}}}
const selectors=q=>q.$and[0].$or;
test('known B01 and SDR receipts supplement the canonical owner without opening a general ownerless scope',()=>{
 const q=query(fixture());assert.equal(q.peerPhone,phone);assert.equal(q.sessionId,'zapi');assert.equal(q.provider,'zapi');assert.equal(q.isFromMe,true);
 assert.equal(selectors(q).length,4);assert.deepEqual(selectors(q)[0],{ownerPhoneDigits});
 for(const s of selectors(q).slice(1)){assert.equal(typeof s.providerMessageId,'string');assert.equal(typeof s.body,'string');assert.deepEqual(s.$or,[{ownerPhoneDigits:''},{ownerPhoneDigits:null},{ownerPhoneDigits:{$exists:false}}])}
 assert.deepEqual(selectors(q).slice(1).map(x=>x.providerMessageId),['PROVIDER_B01_PRICE','PROVIDER_SDR_CITY','PROVIDER_LEGACY_MODE']);
 assert.equal(+q.$or[0].createdAt.$gte,+now-86400000);
});
for(const [name,change]of Object.entries({phone:x=>x.state.phoneDigits='593980000099',jobPhone:x=>x.state.vitPowerB01.phone='593980000099',session:x=>x.state.vitPowerB01.sessionId='other',version:x=>x.state.vitPowerB01.version='unknown',unaccepted:x=>x.state.vitPowerB01.steps[0].status='pending',noReceipt:x=>x.state.vitPowerB01.steps[0].providerMessageId='',media:x=>x.state.vitPowerB01.steps[0].kind='audio',expired:x=>x.state.vitPowerB01.startedAt=new Date(+now-86400001),future:x=>x.state.vitPowerB01.startedAt=new Date(+now+1)}))test('unproven B01 cannot supply a receipt selector: '+name,()=>{const x=fixture();change(x);assert(!selectors(query(x)).some(s=>s.providerMessageId==='PROVIDER_B01_PRICE'))});
test('rich SDR receipts from a different owner or session cannot become a legacy fallback',()=>{
 for(const key of ['ownerPhoneDigits','sessionId']){const x=fixture();x.saved.history=[x.saved.history[0]];x.saved.history[0][key]='other';x.saved.lastOutboundProviderId='PROVIDER_SDR_CITY';assert(!selectors(query(x)).some(s=>s.providerMessageId==='PROVIDER_SDR_CITY'))}
});
test('legacy fallback requires an exact provider receipt and assistant body',()=>{
 const x=fixture();delete x.saved.lastOutboundProviderId;assert(!selectors(query(x)).some(s=>s.providerMessageId==='PROVIDER_LEGACY_MODE'));
 x.saved.history=[{role:'user',content:'¿Cuál es su ciudad?'}];x.saved.lastOutboundProviderId='PROVIDER_USER';assert(!selectors(query(x)).some(s=>s.providerMessageId==='PROVIDER_USER'));
});
test('rich receipts bind the actual mirrored body when the transport formatted the model text',()=>{
 const x=fixture();x.saved.history[0].sentBody='¿En qué ciudad desea recibirlo?';
 assert.equal(selectors(query(x)).find(s=>s.providerMessageId==='PROVIDER_SDR_CITY').body,'¿En qué ciudad desea recibirlo?');
});
test('unowned inbound preserves the previous same-phone and same-session query contract',()=>{
 const x=fixture();delete x.ownerPhoneDigits;const q=query(x);assert.equal(q.peerPhone,phone);assert.equal(q.sessionId,sessionId);assert(!q.$and);
});
test('receipt history remains bounded to the last 24 stored rows and five B01 steps',()=>{
 const x=fixture();const row=x.saved.history[0];x.saved.history=Array.from({length:200},(_,i)=>({...row,providerMessageId:'P_'+i}));x.state.vitPowerB01.steps=Array.from({length:20},(_,i)=>({...x.state.vitPowerB01.steps[0],providerMessageId:'B_'+i}));assert(selectors(query(x)).length<=30);
});
