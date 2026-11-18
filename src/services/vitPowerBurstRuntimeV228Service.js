import { createHash } from 'node:crypto';
import {isB01GenericEntry} from './vitPowerB01CoreV216Service.js';
import {isVerifiedVitPowerFirstEntryV246} from './vitPowerEntryContextV246Service.js';
import Contact from '../models/ContactState.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import Ledger from '../models/OutboundDedupe.js';
import { routeIncomingMessage } from './agentRouter.js';
import { currentProductRouteForState } from './vslProductAssignmentService.js';
import { principalSdrQaRuntimeReadyV212 } from './principalSdrQaIngressV212Service.js';
import { runPersistedBurstV228, currentEcBotCoreRuntimeContextV78 } from './ecBotCoreRuntimeIntegrationV78Service.js';
import { createVitPowerBurstV228, BURST_VERSION_V228, assertBurstEnvelopeV228 } from './vitPowerBurstCoreV228Service.js';
const ROOT='vitPowerBurstV228',DURABLE={writeConcern:{w:'majority',j:true,wtimeout:5000}},qa='5515998038637';
const policy=()=>globalThis.__VITALISMEN_EC_BURST_V228?.readPolicy?.()||{enabled:false};
const sha=value=>createHash('sha256').update(value).digest('hex');
const incoming=phone=>({peerPhone:phone,provider:'zapi',sessionId:'zapi',isFromMe:false,ownerPhoneDigits:'5531971862958'});
const get=id=>Contact.findById(id).lean();
const write=(method,...args)=>Contact[method](...args).setOptions(DURABLE);
const filter=(id,token)=>({_id:id,[ROOT+'.version']:BURST_VERSION_V228,[ROOT+'.lockToken']:token});
async function checkState(state,p,inboundId){
 if(!p.enabled||p.audience==='QA_ONLY'&&state?.phoneDigits!==qa||!state||!/^593[2-79]\d{8}$/.test(state.phoneDigits)&&state.phoneDigits!==qa)return{allowed:false,reason:'outside_scope'};
 if(state.human?.mode==='manual'||+new Date(state.human?.pausedUntil||0)>Date.now())return{allowed:false,reason:'human_hold',terminal:true};
 if(['review','engagement'].includes(state.conversationBucket?.value))return{allowed:false,reason:'review_or_noncommercial',terminal:true};
 if(currentProductRouteForState(state).productKey!=='vit_power_ec')return{allowed:false,reason:'other_product'};
 if(state.phoneDigits===qa&&!principalSdrQaRuntimeReadyV212({state,phone:qa,messageId:inboundId,now:new Date()}))return{allowed:false,reason:'qa_window_closed',terminal:true};
 if(await Order.exists({country:'EC','customer.phone':state.phoneDigits,status:{$in:['confirmed','processing','shipped','returned']}}))return{allowed:false,reason:'active_order_preserved'};
 return{allowed:true};
}
export function createMongoVitPowerBurstRepositoryV228(){return{
 async eligible(input,p){
  const state=await get(input.contactId),verdict=await checkState(state,p,input.inboundId);if(!verdict.allowed)return verdict;
  if(state[ROOT]?.status==='ambiguous')return{allowed:false,terminal:true,reason:'batch_requires_human_review'};
  const inbound=await Message.findOne({...incoming(input.phone),_id:input.inboundId}).lean();
  if(!inbound||inbound.body!==input.text||+new Date(inbound.createdAt)<+new Date(p.activatedAt))return{allowed:false,reason:'new_verified_inbound_required'};
  return{allowed:true};
 },
 async enqueue(input,now,dueAt){
  for(let retry=0;retry<6;retry++){
   const state=await get(input.contactId),old=state[ROOT];
   if((old?.seenIds||[]).includes(input.inboundId))return{duplicate:true,dueAt:old.dueAt};
   const ids=[...(old?.pendingIds||[]),input.inboundId];if(ids.length>40)throw Error('burst_bounded_capacity_requires_review');
   const next={...(old||{}),version:BURST_VERSION_V228,phone:input.phone,chatId:input.chatId,sessionId:'zapi',status:old?.status==='processing'?'processing':'pending',
    generation:(old?.generation||0)+1,pendingIds:ids,seenIds:[...(old?.seenIds||[]),input.inboundId].slice(-200),dueAt,lastInboundAt:now,createdAt:old?.createdAt||now};
   const query={_id:input.contactId,phoneDigits:input.phone,[ROOT+'.generation']:old?.generation===undefined?{$exists:false}:old.generation};
   const result=await write('updateOne',query,{$set:{[ROOT]:next}});if(result.matchedCount===1)return{dueAt};
  }throw Error('burst_enqueue_contention');
 },
 async due(now){return(await Contact.find({[ROOT+'.version']:BURST_VERSION_V228,[ROOT+'.status']:'pending',[ROOT+'.dueAt']:{$lte:now}}).select('_id').limit(20).lean()).map(s=>s._id)},
 async claim(id,token,now){
  const state=await get(id),job=state?.[ROOT];if(!job||job.status!=='pending'||+new Date(job.dueAt)>+now||!job.pendingIds?.length)return null;
  const ordered=await Message.find({...incoming(job.phone),_id:{$in:job.pendingIds}}).sort({timestamp:1,createdAt:1,_id:1}).select('_id').lean();if(ordered.length!==job.pendingIds.length)return null;
  const lockedIds=ordered.map(m=>String(m._id));
  const result=await runPersistedBurstV228({contactId:id,token,claimOnly:true},()=>write('findOneAndUpdate',{_id:id,[ROOT+'.version']:BURST_VERSION_V228,[ROOT+'.status']:'pending',[ROOT+'.generation']:job.generation,[ROOT+'.dueAt']:{$lte:now}},
   {$set:{[ROOT+'.status']:'processing',[ROOT+'.lockToken']:token,[ROOT+'.lockedUntil']:new Date(+now+180000),[ROOT+'.lockedIds']:lockedIds,[ROOT+'.lockedGeneration']:job.generation,[ROOT+'.claimedAt']:now}},{new:true}).lean());return result?.[ROOT]||null;
 },
 async check(id,job,p){const state=await get(id);if(state?.[ROOT]?.lockToken!==job.lockToken)return{allowed:false,reason:'lock_lost'};return checkState(state,p,job.lockedIds.at(-1))},
 async messages(job){const values=await Message.find({...incoming(job.phone),_id:{$in:job.lockedIds}}).lean(),byId=new Map(values.map(m=>[String(m._id),m]));return job.lockedIds.map(id=>byId.get(id)).filter(Boolean)},
 async history(job){
  const key='principal-sdr-turn:'+sha(job.phone+':'+job.lockedIds.at(-1));
  const record=await Ledger.findOne({key}).lean();
  if(record?.status==='sent'&&record.provider==='zapi'&&record.providerMessageId&&await Message.exists({provider:'zapi',peerPhone:job.phone,isFromMe:true,isBot:true,providerMessageId:record.providerMessageId}))return{providerMessageId:record.providerMessageId,key};
  if(record)return null;
  // Deterministic structured-order handlers retain their original receipt path.
  const outbound=await Message.findOne({provider:'zapi',peerPhone:job.phone,isFromMe:true,isBot:true,createdAt:{$gte:job.claimedAt},providerMessageId:{$exists:true,$ne:''}}).sort({createdAt:1}).lean();
  return outbound?{providerMessageId:outbound.providerMessageId}:null;
 },
 async finish(id,token,receipt,now){
  for(let retry=0;retry<6;retry++){
   const state=await get(id),job=state?.[ROOT];if(!job||job.lockToken!==token||job.status!=='processing')return;
   const completed=new Set(job.lockedIds),remaining=job.pendingIds.filter(id=>!completed.has(id));
   const result=await write('updateOne',{...filter(id,token),[ROOT+'.generation']:job.generation,[ROOT+'.status']:'processing'},{$set:{[ROOT+'.pendingIds']:remaining,[ROOT+'.status']:remaining.length?'pending':'idle',[ROOT+'.sentAt']:now,[ROOT+'.providerMessageId']:receipt.providerMessageId,[ROOT+'.lockedUntil']:null,[ROOT+'.lockToken']:''},$push:{[ROOT+'.history']:{$each:[{ids:job.lockedIds,sentAt:now,providerMessageId:receipt.providerMessageId}],$slice:-20}}});if(result.matchedCount===1)return;
  }throw Error('burst_completion_contention');
 },
 async superseded(id,job){const state=await get(id);return state?.[ROOT]?.generation!==job.lockedGeneration},
 async defer(id,token){await write('updateOne',filter(id,token),{$set:{[ROOT+'.status']:'pending',[ROOT+'.lockedUntil']:null,[ROOT+'.lockToken']:''}})},
 async block(id,token,reason){await write('updateOne',filter(id,token),{$set:{[ROOT+'.status']:'blocked',[ROOT+'.reason']:reason,[ROOT+'.pendingIds']:[],[ROOT+'.lockedIds']:[],[ROOT+'.lockToken']:'',[ROOT+'.lockedUntil']:null}})},
 async uncertain(id,token,reason){await write('updateOne',{...filter(id,token),'human.mode':{$ne:'manual'}},{$set:{'human.mode':'manual','human.pausedUntil':new Date(Date.now()+3650*86400000),'human.note':'Resposta agrupada V228: revisar resultado incerto antes de liberar o bot.'}});await write('updateOne',filter(id,token),{$set:{[ROOT+'.status']:'ambiguous',[ROOT+'.reason']:reason,[ROOT+'.lockedUntil']:null,'metadata.automationHandoffSuggested':true,'metadata.automationHandoffSuggestedReason':'burst_v228_requires_review'}})},
 async safeUncertain(id,token,reason){try{await runPersistedBurstV228({contactId:id,token,finalizeOnly:true},()=>this.uncertain(id,token,reason))}catch{console.warn('[BURST-V228] persisted_attempt_requires_human_review')}},
 async expire(now){const rows=await Contact.find({[ROOT+'.version']:BURST_VERSION_V228,[ROOT+'.status']:'processing',[ROOT+'.lockedUntil']:{$lte:now}}).select('_id '+ROOT+'.lockToken').limit(20).lean();for(const state of rows)await this.safeUncertain(state._id,state[ROOT].lockToken,'worker_interrupted_no_automatic_retry')},
 withScope:(contactId,token,work)=>runPersistedBurstV228({contactId,token},work)
}}
const runtime=createVitPowerBurstV228({repo:createMongoVitPowerBurstRepositoryV228(),dispatch:message=>routeIncomingMessage(message),policy});
export async function handleVitPowerBurstInboundV228(input){
 if(!policy().enabled)return{handled:false,reason:'disabled'};
 if(input.vitPowerBurstV228)return{handled:false,reason:'already_processing_batch'};
 const state=await get(input.contactId);
 let verifiedGenericFirst=false;
 if(input.productKey==='vit_power_ec'&&isB01GenericEntry(input.text)&&!state?.vitPowerB01){
  const nativeQaInitial=input.phone===qa&&principalSdrQaRuntimeReadyV212({state,phone:qa,messageId:input.inboundId,now:new Date()});
  const firstPersistedInbound=input.phone!==qa&&String(state?.firstInboundText||'')===input.text
   &&await Message.countDocuments(incoming(input.phone))===1;
  verifiedGenericFirst=isVerifiedVitPowerFirstEntryV246({input,state,firstPersistedInbound,verifiedQaInitial:nativeQaInitial});
 }
 const initialEntry=state?.metadata?.vslEntryMessage===input.text&&String(state.firstInboundText||'')===input.text||verifiedGenericFirst;
 return runtime.enqueue({...input,initialEntry});
}
let started=false;
export function startVitPowerBurstV228(){if(started||!policy().enabled)return false;started=true;setInterval(()=>{void runtime.tick().catch(()=>console.warn('[BURST-V228] bounded_worker_requires_review'))},1000).unref();return true}

export async function verifyVitPowerBurstInputV228(message) {
 const scope=currentEcBotCoreRuntimeContextV78()?.burstV228;
 if(!scope||scope.token!==message.vitPowerBurstV228?.token||scope.phone!==message.senderPn)throw Error('burst_current_scope_required');
 const state=await get(message.contactStateId),job=state?.[ROOT];
 const rows=await Message.find({...incoming(scope.phone),_id:{$in:job?.lockedIds||[]}}).lean(),byId=new Map(rows.map(m=>[String(m._id),m]));
 assertBurstEnvelopeV228({message,state,messages:(job?.lockedIds||[]).map(id=>byId.get(id)).filter(Boolean)});
 if(job.generation!==job.lockedGeneration){const error=Error('burst_superseded_before_send');error.code='BURST_SUPERSEDED_V228';throw error}
 return true;
}
