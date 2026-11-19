import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createTexUltraLinkedEntryV242 } from '../src/services/texUltraLinkedEntryV242Service.js';
import { buildTexPostLeadInviteV251, texPostLeadEligibleV251 } from '../src/services/texUltraPostLeadInviteV251Service.js';
import { runCustomerInviteV232, inviteKeyV232 } from '../src/services/customerInvitesV232Service.js';
import { createVitPowerWebChatHandlerV220 } from '../src/services/vitPowerWebChatV220Application.js';
import { createVitPowerWebStoreV220 } from '../src/services/vitPowerWebStoreV220Service.js';
const phone='593990000001', session='a'.repeat(64), other='b'.repeat(64);
const now=Date.parse('2026-11-19T16:00:00Z'), cutoff=now-3600000, policy={enabled:true,required:true,cutoff};
const row=()=>({phoneDigits:phone,countryCode:'EC',officialInboundVerified:true,createdAt:new Date(cutoff+1),lastInboundAt:new Date(now-1200000),lastOutboundAt:new Date(now-1200000),metadata:{productKey:'tex_ultra_ec'},firstInboundText:'Hola, quiero el tratamiento Tex Ultra.',human:{mode:'auto'}});
async function fixture(fn){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tex251-'));let time=now,held=false;
 const links=createTexUltraLinkedEntryV242({directory,officialPhone:'553171862958',minFreeBytes:0,now:()=>time,currentContactHold:async()=>held});
 try{await fn(links,{directory,setTime:t=>time=t,setHold:v=>held=v})}finally{await fs.rm(directory,{recursive:true,force:true})}
}
const issue=links=>links.issueWhatsappInvitation({phone,firstName:'Juan Carlos',inboundId:'fixture_official_inbound',verifiedInbound:true});
test('only verified official EC inbound can issue a private invitation',async()=>fixture(async links=>{
 for(const args of [{phone,verifiedInbound:false,inboundId:'fixture'},{phone:'5515998038637',verifiedInbound:true,inboundId:'fixture'},{phone,verifiedInbound:true,inboundId:''}])await assert.rejects(()=>links.issueWhatsappInvitation(args));
}));
test('one invitation, one browser, same-browser resumption and no repeated presentation',async()=>fixture(async(links,{directory})=>{
 const issued=await issue(links),token=issued.url.split('#chat=')[1];assert.match(issued.url,/^https:\/\/plusmen.shop\/tex#chat=[a-f0-9]{64}$/);
 assert.equal((await issue(links)).url,issued.url);assert.equal(await links.invitationAvailable('f'.repeat(64)),false);
 assert.equal((await links.acceptWhatsappInvitation({token,sessionId:session})).verified,true);
 assert.equal((await links.acceptWhatsappInvitation({token,sessionId:session})).verified,true);
 await assert.rejects(()=>links.acceptWhatsappInvitation({token,sessionId:other}));
 const identity=await links.identity(session);assert.equal(identity.phone,phone);assert.equal(identity.firstName,'Juan');assert.equal(identity.verifiedBy,'official_zapi_inbound');assert.equal(identity.inboundId,'fixture_official_inbound');
 assert.equal((await links.claimWebEntry(session,'entry_251_fixture')).allowed,false);
 assert.equal((await fs.stat(path.join(directory,'links',session+'.json'))).mode&0o777,0o600);
}));
test('manual hold and expiration deny redemption',async()=>fixture(async(links,control)=>{
 const token=(await issue(links)).url.split('=')[1];control.setHold(true);await assert.rejects(()=>links.acceptWhatsappInvitation({token,sessionId:session}));
 control.setHold(false);control.setTime(now+604800001);assert.equal(await links.invitationAvailable(token),false);await assert.rejects(()=>links.acceptWhatsappInvitation({token,sessionId:session}));
}));
test('parallel redemption cannot bind two browsers',async()=>fixture(async links=>{
 const token=(await issue(links)).url.split('=')[1];const outcomes=await Promise.allSettled([links.acceptWhatsappInvitation({token,sessionId:session}),links.acceptWhatsappInvitation({token,sessionId:other})]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
}));
test('future-only Tex eligibility preserves historical and active contacts',()=>{
 assert.equal(texPostLeadEligibleV251(row(),now,policy),true);
 for(const delta of [{createdAt:new Date(cutoff-1)},{officialInboundVerified:false},{lastInboundAt:new Date(now-1)},{metadata:{testOnly:true,productKey:'tex_ultra_ec'}},{countryCode:'BR'},{phoneDigits:'5515998038637'},{metadata:{productKey:'vit_power_ec'},firstInboundText:'Hola, quiero Vit Power.'}])assert.equal(texPostLeadEligibleV251({...row(),...delta},now,policy),false,JSON.stringify(delta));
 assert.equal(texPostLeadEligibleV251(row(),now,{enabled:false}),false);
});
test('copy uses exact Tex host, acknowledges inbound and does not confirm purchase',()=>{
 const text=buildTexPostLeadInviteV251({name:'Juan Carlos',url:'https://plusmen.shop/tex#chat='+'c'.repeat(64)});assert.match(text,/Ya recibimos tu mensaje por WhatsApp/);assert.match(text,/no confirma una compra/);assert.doesNotMatch(text,/Vit Power/);
 for(const url of ['https://evil.example/tex#chat='+'c'.repeat(64),'https://plusmen.shop/tex?phone=1#chat='+'c'.repeat(64),'https://plusmen.shop/tex#chat=invalid'])assert.throws(()=>buildTexPostLeadInviteV251({url}));
});
function repositoryFixture(){
 const entries=new Map(),sent=[],mirrored=[];let fresh=row();
 return{sent,mirrored,entries,setFresh:x=>fresh=x,repository:{candidates:async()=>[row()],stopped:async()=>false,entry:async k=>entries.get(k),historyHas:async()=>false,claimGlobal:async()=>true,reserve:async({key,...v})=>{if(entries.has(key))return false;entries.set(key,{...v,state:'reserved'});return true},refresh:async()=>fresh,markAttempt:async key=>{assert.equal(entries.get(key).state,'reserved');entries.get(key).state='attempted'},finish:async(key,_lock,result)=>Object.assign(entries.get(key),result),privateTexInvite:async()=>({message:buildTexPostLeadInviteV251({name:'Juan',url:'https://plusmen.shop/tex#chat='+'d'.repeat(64)})})},send:async x=>{assert.equal(entries.get(x.key).state,'attempted');sent.push(x);return{messageId:'fixture_provider_receipt'}},mirror:async x=>mirrored.push(x)};
}
const run=fx=>runCustomerInviteV232({...fx,policy:{enabled:true,generalChat:true},now,clock:()=>now,dryRun:false,texPostLeadEligible:(x,t)=>texPostLeadEligibleV251(x,t,policy)});
test('natural runner reserves before send, sends once and redacts token from history',async()=>{
 const fx=repositoryFixture(),result=await run(fx);assert.equal(result.status,'PASS_SENT_ONCE');assert.equal(result.stage,'TEX_CHAT_ACCESS');assert.equal(fx.sent.length,1);assert.match(fx.mirrored[0].body,/#chat=\[acceso-privado\]/);assert.doesNotMatch(fx.mirrored[0].body,/#chat=[a-f0-9]{64}/);await run(fx);assert.equal(fx.sent.length,1);assert.equal(fx.entries.get(inviteKeyV232(phone,'TEX_CHAT_ACCESS')).state,'sent');
});
test('manual takeover before sending suppresses invitation',async()=>{
 const fx=repositoryFixture();fx.setFresh({...row(),human:{mode:'manual'}});assert.equal((await run(fx)).status,'RECIPIENT_CHANGED');assert.equal(fx.sent.length,0);
});
test('ambiguous provider outcome is permanent and cannot retry',async()=>{
 const fx=repositoryFixture();fx.send=async()=>{throw Error('network_unknown')};assert.equal((await run(fx)).status,'AMBIGUOUS_NO_RETRY');await run(fx);assert.equal(fx.entries.get(inviteKeyV232(phone,'TEX_CHAT_ACCESS')).state,'ambiguous');
});
test('handler denies anonymous Tex, accepts persisted invite, preserves Vit Power',async()=>fixture(async links=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tex251-web-')),store=createVitPowerWebStoreV220({directory,minFreeBytes:0,now:()=>now});
 const handler=createVitPowerWebChatHandlerV220({store,linkedStore:()=>links,postLeadPolicy:()=>policy,authority:()=>({requestAllowed:()=>true,productForRequest:req=>req.product||'tex_ultra_ec',entryV242Allowed:()=>true}),now:()=>now});let count=0;
 async function request(body,cookie='',product='tex_ultra_ec'){
  const headers={},req={product,body,headers:{'content-type':'application/json','x-vitalismen-chat-ip':'192.0.2.'+(++count),cookie},is:()=>true};let status=200,result;
  const res={setHeader:(k,v)=>headers[k]=v,status:s=>{status=s;return res},json:x=>{result=x;return res},send:x=>{result=x;return res}};await handler(req,res);return{status,data:result,cookie:headers['Set-Cookie']?.split(';')[0]||cookie};
 }
 try{
  const denied=await request({action:'start'});assert.equal(denied.status,403);assert.equal(denied.cookie,'');assert.equal((await request({action:'message',requestId:'fixture_message_1',message:'Hola'})).status,403);assert.equal((await request({action:'invite_accept',accessToken:'f'.repeat(64)})).status,403);
  const token=(await issue(links)).url.split('=')[1],accepted=await request({action:'invite_accept',accessToken:token});assert.equal(accepted.status,200);assert.equal(accepted.data.verified,true);assert.ok(accepted.cookie.startsWith('__Host-texchat-v240='));
  assert.equal((await request({action:'start'},accepted.cookie)).data.identity.productKey,'tex_ultra_ec');const status=await request({action:'link_status'},accepted.cookie);assert.equal(status.data.verified,true);assert.equal(status.data.firstChannel,'whatsapp');assert.equal(Object.hasOwn(status.data,'phone'),false);assert.equal((await request({action:'invite_accept',accessToken:token})).status,400);
  const legacy=await request({action:'start'},'','vit_power_ec');assert.equal(legacy.status,200);assert.ok(legacy.cookie.startsWith('__Host-vpchat-v220='));
 }finally{await fs.rm(directory,{recursive:true,force:true})}
}));
