import {bridgeHash,signVitalismenRequest,technicalId} from './protocol.mjs';
import {PREPAID_CONTRACT,prepaidRuntimeApproved} from './prepaid-contract.mjs';
export function assertGiraClientConfiguration({origin,secret,keyId}){
 if(!['https://gira21x.com','https://www.gira21x.com','https://gira21x.invalid'].includes(origin))throw Error('GIRA_ORIGIN_INVALID');
 if(typeof secret!=='string'||secret.length<32||!technicalId(keyId))throw Error('GIRA_CREDENTIALS_INVALID');
}
// Store must durably reserve immutable event bytes before a network attempt.
export function createGiraClient({origin,secret,keyId,store,transport=fetch,clock=()=>Date.now(),channel='COD'}){
 assertGiraClientConfiguration({origin,secret,keyId});
 if(!['COD','STRIPE_PREPAID'].includes(channel))throw Error('GIRA_CHANNEL_INVALID');
 const prepaid=channel==='STRIPE_PREPAID',prefix='/api/integrations/vitalismen'+(prepaid?'/stripe':'');
 if(prepaid&&!prepaidRuntimeApproved())throw Error('GIRA_PREPAID_SUCCESSOR_REQUIRED');
 async function request(path,input){const method=input?'POST':'GET',body=input?JSON.stringify(input):'';
  const r=await transport(origin+path,{method,headers:signVitalismenRequest({secret,keyId,path,method,body,now:clock()}),...(body?{body}:{}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if(r.status===404)return null;if(!r.ok)throw Error('GIRA_HTTP_'+r.status);
  if(!prepaid)return r.json();
  const reader=r.body?.getReader();if(!reader)throw Error('GIRA_RESPONSE_REQUIRED');
  const chunks=[];let length=0;try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>65536){await reader.cancel();throw Error('GIRA_RESPONSE_TOO_LARGE');}chunks.push(part.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 return {claim:(limit=25)=>{
  if(!Number.isInteger(limit)||limit<1||limit>25)throw Error('GIRA_CLAIM_LIMIT_INVALID');
  if(!prepaid)return request(prefix+'/orders/claim',{limit});
  if(!prepaidRuntimeApproved())throw Error('GIRA_PREPAID_SUCCESSOR_REQUIRED');
  const context=globalThis.__VITALISMEN_GIRA21X_BRIDGE_CONTEXT;
  if(!/^[a-f0-9]{40}$/.test(context.commit??''))throw Error('GIRA_PREPAID_SOURCE_COMMIT_REQUIRED');
  return request(prefix+'/orders/claim',{limit,receiver:{contract:PREPAID_CONTRACT,sourceCommit:context.commit,manualDispatch:true,noCollection:true}});
 },...(prepaid?{paymentStatus:(giraId,payloadHash)=>{
  if(!prepaidRuntimeApproved()||!/^g21pre_order_[a-f0-9]{28}$/.test(giraId??'')||!/^[a-f0-9]{64}$/.test(payloadHash??''))throw Error('GIRA_PREPAID_STATUS_SCOPE_INVALID');
  return request(prefix+'/orders/'+giraId+'/payment-status',{payloadHash});
 }}:{}),async event(event){
  if(prepaid&&(!prepaidRuntimeApproved()||event.schemaVersion!==2||!/^g21pre_order_[a-f0-9]{28}$/.test(event.gira21xOrderId??'')))throw Error('GIRA_PREPAID_EVENT_SCOPE_INVALID');
  const raw=JSON.stringify(event),hash=bridgeHash(raw),state=await store.reserveEvent(event.eventId,raw,hash);
  if(state.hash!==hash)throw Error('GIRA_EVENT_ID_CONFLICT');if(state.result)return state.result;
  if(state.attempted){const receipt=await request(prefix+'/events/'+event.eventId);
   if(receipt){if(receipt.payloadHash!==hash)throw Error('GIRA_REMOTE_EVENT_CONFLICT');if(receipt.result){await store.finishEvent(event.eventId,receipt.result);return receipt.result;}
    return {accepted:false,pendingReview:true};}}
  await store.markEventAttempted(event.eventId);
  // Any uncertain result is reconciled through GET on the next cycle, never a new event ID.
  const result=await request(prefix+'/events',event);await store.finishEvent(event.eventId,result);return result;
 }};
}
