import {bridgeHash,signVitalismenRequest,technicalId} from './protocol.mjs';
export function assertGiraClientConfiguration({origin,secret,keyId}){
 if(!['https://gira21x.com','https://www.gira21x.com','https://gira21x.invalid'].includes(origin))throw Error('GIRA_ORIGIN_INVALID');
 if(typeof secret!=='string'||secret.length<32||!technicalId(keyId))throw Error('GIRA_CREDENTIALS_INVALID');
}
// Store must durably reserve immutable event bytes before a network attempt.
export function createGiraClient({origin,secret,keyId,store,transport=fetch,clock=()=>Date.now()}){
 assertGiraClientConfiguration({origin,secret,keyId});
 async function request(path,input){const method=input?'POST':'GET',body=input?JSON.stringify(input):'';
  const r=await transport(origin+path,{method,headers:signVitalismenRequest({secret,keyId,path,method,body,now:clock()}),...(body?{body}:{}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if(r.status===404)return null;if(!r.ok)throw Error('GIRA_HTTP_'+r.status);return r.json();}
 return {claim:()=>request('/api/integrations/vitalismen/orders/claim',{limit:25}),async event(event){
  const raw=JSON.stringify(event),hash=bridgeHash(raw),state=await store.reserveEvent(event.eventId,raw,hash);
  if(state.hash!==hash)throw Error('GIRA_EVENT_ID_CONFLICT');if(state.result)return state.result;
  if(state.attempted){const receipt=await request('/api/integrations/vitalismen/events/'+event.eventId);
   if(receipt){if(receipt.payloadHash!==hash)throw Error('GIRA_REMOTE_EVENT_CONFLICT');if(receipt.result){await store.finishEvent(event.eventId,receipt.result);return receipt.result;}
    return {accepted:false,pendingReview:true};}}
  await store.markEventAttempted(event.eventId);
  // Any uncertain result is reconciled through GET on the next cycle, never a new event ID.
  const result=await request('/api/integrations/vitalismen/events',event);await store.finishEvent(event.eventId,result);return result;
 }};
}
