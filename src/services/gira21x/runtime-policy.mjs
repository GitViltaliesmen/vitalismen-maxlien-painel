import {AsyncLocalStorage} from 'node:async_hooks';
import {isGiraOrder} from './contract.mjs';
import {prepaidDropiProjection,prepaidRuntimeApproved,isPrepaidHoldMutation} from './prepaid-contract.mjs';
const id=/^EC-G21-[A-F0-9]{24}$/;
const phone=/^593\d{9}$/;
const safeKeys=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>keys.includes(k));
const keys=o=>Object.keys(o??{});
const dates=o=>o instanceof Date&&Number.isFinite(o.getTime());
const digits=s=>String(s??'').split('@')[0].replace(/\D/g,'');
const hasPhone=(o,wanted)=>{
 if(!o||typeof o!=='object')return false;
 if(['phoneDigits','peerPhone','chatId','to','phone','recipientDigits'].some(k=>typeof o[k]==='string'&&digits(o[k])===wanted))return true;
 if(o.phoneDigits?.$regex===wanted+'$')return true;
 return Array.isArray(o.$or)&&o.$or.length>0&&o.$or.every(v=>hasPhone(v,wanted));
};
// Each policy owns its ALS. A caller cannot forge the default policy by passing
// a lookalike object or by constructing a different test policy instance.
export function createGiraRuntimePolicy({approval,env=()=>process.env}={}){
 const activity=new AsyncLocalStorage();
 const approved=()=>{const a=approval?.(),e=env();return !!(a&&Object.isFrozen(a)&&a.loaded===true&&a.kind==='GIRA21X_EC_BRIDGE_RUNTIME_V1'
  &&a.receive===true&&e.GIRA21X_BRIDGE_ENABLED==='true'&&e.GIRA21X_NATIVE_CONTRACT_APPROVED==='true');};
 function run(fn){if(!approved())throw Error('GIRA_RUNTIME_PROFILE_REQUIRED');return activity.run(Object.freeze({service:true}),fn);}
 function send(order,fn){if(!approved()||approval().notices!==true||env().GIRA21X_NOTICES_ENABLED!=='true'||!isGiraOrder(order)||!id.test(order.orderId)||!order.integration.whatsappConsent||!phone.test(digits(order.customer?.phone)))throw Error('GIRA_NOTICE_PROFILE_REQUIRED');
  return activity.run(Object.freeze({service:true,send:true,orderId:order.orderId,phone:digits(order.customer.phone),dedupeIds:new Set(),messageIds:new Set()}),fn);}
 function optOut(order,fn){if(!approved()||!isGiraOrder(order)||!id.test(order.orderId)||!phone.test(digits(order.customer?.phone)))throw Error('GIRA_OPT_OUT_ORDER_REQUIRED');
  return activity.run(Object.freeze({service:true,optOut:true,orderId:order.orderId,phone:digits(order.customer.phone)}),fn);}
 function mongo(collection,method,args){
  const c=activity.getStore();if(!c?.service||!approved())return false;
  const [query,update]=args??[],set=update?.$set??{},insert=update?.$setOnInsert;
  if(['drop','rename','deleteOne','deleteMany','bulkWrite','insertMany','replaceOne','findOneAndDelete','findOneAndReplace','createIndex','createIndexes','dropIndex','dropIndexes'].includes(method))return false;
  if(collection==='gira21x_bridge_v1'){
   const recordId=method==='insertOne'?query?._id:query?._id;
   if(typeof recordId!=='string'||!(/^(event|draft):g21bridge_evt_[a-f0-9]{28}$/.test(recordId)||/^notice:[a-f0-9]{64}$/.test(recordId)||/^review:EC-G21-[A-F0-9]{24}$/.test(recordId)||recordId==='cycle'))return false;
   if(method==='insertOne')return safeKeys(query,['_id','kind','raw','hash','attempted','result','orderId','stage','state','at'])&&JSON.stringify(query).length<=40000;
   if(!['updateOne','findOneAndUpdate'].includes(method)||!safeKeys(update,['$set','$setOnInsert']))return false;
   if(recordId==='cycle')return safeKeys(set,['lastMinute','token','until'])&&(!set.until||dates(set.until))&&(!set.token||/^[a-f0-9-]{36}$/.test(set.token))&&(!('lastMinute'in set)||Number.isInteger(set.lastMinute));
   if(recordId.startsWith('event:'))return safeKeys(set,['attempted','result'])&&(!('attempted'in set)||set.attempted===true)&&JSON.stringify(set).length<=40000;
   if(recordId.startsWith('notice:'))return safeKeys(set,['state','result','finalizedAt']);
   return recordId.startsWith('review:')&&safeKeys(set,['reason','at']);
  }
  if(collection==='orders'){
   if(method==='updateMany')return c.optOut===true&&query?.country==='EC'&&query?.['integration.origin']==='GIRA21X'&&digits(query?.['customer.phone'])===c.phone
    &&safeKeys(set,['integration.whatsappConsent','integration.whatsappOptOutAt','integration.whatsappOptOutSource','updatedAt'])&&set['integration.whatsappConsent']===false&&set['integration.whatsappOptOutSource']==='CUSTOMER_WHATSAPP'&&safeKeys(update,['$set','$setOnInsert']);
   if(method!=='updateOne'||!id.test(query?.orderId??'')||!safeKeys(update,['$set','$setOnInsert']))return false;
   if(insert?.integration?.origin==='GIRA21X'){
    const i=insert.integration;
    try{prepaidDropiProjection(insert,{approved:prepaidRuntimeApproved()});}catch{return false;}
    return insert.orderId===query.orderId&&isGiraOrder(insert)&&insert.country==='EC'&&insert.currency==='USD'&&insert.status==='confirmed'
     &&i.dispatch==='MANUAL_ONLY'&&i.purchaseOwner==='GIRA21X'&&[1,2,3,6].includes(insert.package?.quantity)&&i.quantity===insert.package.quantity&&Math.round(insert.total*100)===i.amountMinor
     &&phone.test(digits(insert.customer?.phone))&&/^[a-f0-9]{64}$/.test(i.payloadHash??'')&&safeKeys(set,['updatedAt']);
   }
   if(prepaidRuntimeApproved()&&isPrepaidHoldMutation(query,update))return true;
   return query['integration.origin']==='GIRA21X'&&safeKeys(set,['integration.lastPolledAt','shippingCanonicalStatus','status','updatedAt'])
    &&(!('status'in set)||['delivered','returned'].includes(set.status))&&safeKeys(insert??{},['createdAt']);
  }
  if(collection==='contactstates'){
   if(method!=='updateOne')return false;
   if(insert?.metadata?.gira21x?.origin==='GIRA21X')return /^593\d{9}@s\.whatsapp\.net$/.test(query?.chatId??'')
    &&digits(query.chatId)===insert.phoneDigits&&insert.countryCode==='EC'&&id.test(insert.metadata.gira21x.orderId??'')&&insert.human?.mode==='auto'
    &&safeKeys(set,['updatedAt'])&&safeKeys(update,['$set','$setOnInsert']);
   return c.send===true&&hasPhone(query,c.phone)&&safeKeys(set,['lastOutboundAt','metadata.lastOutboundProvider','metadata.lastOutboundProviderStatus','metadata.lastOutboundProviderMessageId','metadata.lastOutboundMirroredAt','updatedAt']);
  }
  if(c.send===true&&collection==='messages'){
   if(method==='updateOne'&&hasPhone(insert,c.phone)&&insert.isFromMe===true&&insert.isBot===true&&insert.type==='chat'&&safeKeys(set,['updatedAt'])){c.messageIds.add(String(query?._id));return true;}
   return method==='updateOne'&&c.messageIds.has(String(query?._id))&&safeKeys(set,['ack','deliveryStatus','providerStatus','providerPayload','providerStatusAt','updatedAt']);
  }
  if(c.send===true&&collection==='outbounddedupes'){
   if(method==='insertOne'&&query?.phoneDigits===c.phone){c.dedupeIds.add(String(query._id));c.dedupeIds.add(String(query.key));return true;}
   if(method==='updateMany')return Array.isArray(query?.key?.$in)&&query.key.$in.length>0&&query.key.$in.length<=4&&query.key.$in.every(k=>c.dedupeIds.has(String(k)))&&safeKeys(update,['$set'])&&safeKeys(set,['status','sentAt','failedAt','ambiguousAt','retryAllowed','error','updatedAt']);
   return ['updateOne','findOneAndUpdate'].includes(method)&&(c.dedupeIds.has(String(query?._id))||c.dedupeIds.has(String(query?.key)))&&safeKeys(update,['$set','$inc']);
  }
  return false;
 }
 return Object.freeze({approved,run,send,optOut,mongo,external:effect=>approved()&&activity.getStore()?.send===true&&effect==='zapi_outbound_reply'});
}
const approval=()=>{const d=Object.getOwnPropertyDescriptor(globalThis,'__VITALISMEN_GIRA21X_BRIDGE_CONTEXT');return d&&!d.configurable&&!d.writable&&typeof d.value?.isCurrent==='function'&&d.value.isCurrent()?d.value:null;};
export const giraRuntimePolicy=createGiraRuntimePolicy({approval});
