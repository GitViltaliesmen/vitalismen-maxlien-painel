import test from 'node:test';
import assert from 'node:assert/strict';
import { runCustomerInviteV232, inviteKeyV232, buildChatAccessInviteV236 } from '../src/services/customerInvitesV232Service.js';
import { readChatInviteStatusV236, CHAT_LINK_V236 } from '../src/services/chatInviteStatusV236Service.js';
const NOW=Date.parse('2026-11-16T16:00:00Z');
function fixture(patch={}) {
 const contact={phoneDigits:'593999999991',countryCode:'EC',officialInboundVerified:true,lastInboundAt:new Date(NOW-600001),lastOutboundAt:new Date(NOW-600001),human:{mode:'auto'},name:'Maria QA',...patch};
 const entries=new Map(),sends=[],events=[];
 const repository={candidates:async()=>[contact],stopped:async()=>false,entry:async key=>entries.get(key),historyHas:async()=>false,refresh:async()=>contact,
  claimGlobal:async()=>true,reserve:async row=>{if(entries.has(row.key))return false;entries.set(row.key,{...row,state:'reserved'});events.push('reserve');return true},
  markAttempt:async key=>{entries.get(key).state='attempted';events.push('attempt')},finish:async(key,lockToken,row)=>Object.assign(entries.get(key),row)};
 const args={repository,policy:{enabled:true,generalChat:true},now:NOW,clock:()=>NOW,dryRun:false,send:async row=>{events.push('send');sends.push(row);return{messageId:'QA-236'}},mirror:async()=>{}};
 return {contact,repository,entries,sends,events,args,run:patch=>runCustomerInviteV232({...args,...patch})};
}
test('new contact without an order receives one chat access invitation',async()=>{const f=fixture();assert.equal((await f.run()).stage,'CHAT_ACCESS');assert.match(f.sends[0].message,/#chat/);assert.match(f.sends[0].message,/Maria/);assert.deepEqual(f.events,['reserve','attempt','send']);await f.run();assert.equal(f.sends.length,1)});
test('old contact uses the same permanent per-phone invitation key',async()=>{const f=fixture({lastInboundAt:new Date(NOW-100*86400000)});await f.run();assert(f.entries.has(inviteKeyV232(f.contact.phoneDigits,'CHAT_ACCESS')))});
test('recent conversation is not interrupted by the general invitation',async()=>{const f=fixture({lastInboundAt:new Date(NOW-599999)});await f.run();assert.equal(f.sends.length,0)});
test('existing outbound chat link suppresses automatic access invitation',async()=>{const f=fixture();f.repository.historyHas=async({stage})=>stage==='CHAT_ACCESS';await f.run();assert.equal(f.sends.length,0)});
test('previous sent chat access entry prevents a new invite for the same person',async()=>{const f=fixture();f.entries.set(inviteKeyV232(f.contact.phoneDigits,'CHAT_ACCESS'),{state:'sent'});await f.run();assert.equal(f.sends.length,0)});
test('uncertain access send never retries',async()=>{const f=fixture();await f.run({send:async()=>{f.sends.push({});throw Error('timeout')}});await f.run();assert.equal(f.sends.length,1);assert.equal([...f.entries.values()][0].state,'ambiguous')});
for(const [label,patch]of Object.entries({human:{human:{mode:'manual'}},paused:{human:{pausedUntil:new Date(NOW+60000)}},QA:{phoneDigits:'5515998038637'},STOP:{lastInboundText:'STOP'},unverified:{officialInboundVerified:false},returned:{returned:true},blocked:{blockedAutomatically:true}}))test('general invitation preserves '+label+' exclusion',async()=>{const f=fixture(patch);await f.run();assert.equal(f.sends.length,0)});
test('general invitation dry run makes no reservation or send',async()=>{const f=fixture();f.repository.reserve=()=>assert.fail('must not write');assert.equal((await f.run({dryRun:true})).stage,'CHAT_ACCESS');assert.equal(f.sends.length,0)});
test('existing order-status invitation retains priority',async()=>{const f=fixture({order:{orderId:'EC-QA-236',status:'shipped',productKey:'vit_power_ec',name:'Maria'}});assert.equal((await f.run()).stage,'CHAT_ORDER')});
test('chat invitation contains only public link and opt-out instructions',()=>{const text=buildChatAccessInviteV236({name:'Maria\nnot a second line'});assert.match(text,/Hola, Maria\./);assert.match(text,CHAT_LINK_V236);assert.match(text,/STOP/);assert.doesNotMatch(text,/token=|[a-f0-9]{64}/)});
function reader({exists=true,official=true,sent=false,state=null}={}) {
 let count=0;const deps={contacts:{exists:async()=>exists},messages:{exists:async query=>{count++;return query.isFromMe?sent:official}},ledger:{findById:()=>({select:()=>({lean:async()=>state?{state}:null})})}};
 return {read:phone=>readChatInviteStatusV236(phone,deps),count:()=>count};
}
test('read-only invite status reports prior send without exposing identity or granting order access',async()=>{const result=await reader({sent:true}).read('593999999991');assert.equal(result.invited,true);assert.equal(result.siteIdentityLinked,false);assert.equal(result.readOnly,true);assert.deepEqual(Object.keys(result).sort(),['invited','pending','readOnly','siteIdentityLinked','version'].sort())});
test('uncertain ledger blocks a new invitation in the admin control',async()=>{const result=await reader({state:'ambiguous'}).read('593999999991');assert.equal(result.pending,true);assert.equal(result.invited,false)});
test('unknown or foreign contact has no invitation status',async()=>{for(const phone of ['5515998038637','status@broadcast','593123','593999999991@g.us'])assert.equal(await reader().read(phone),null);assert.equal(await reader({exists:false}).read('593999999991'),null);assert.equal(await reader({official:false}).read('593999999991'),null)});
