import {validateClaim} from './contract.mjs';
import {bridgeId,bridgeHash} from './protocol.mjs';
import {prepaidDropiProjection,prepaidRuntimeApproved,validatePrepaidHold} from './prepaid-contract.mjs';
const event=(order,type,key,extra,now)=>({schemaVersion:order.integration.schemaVersion===2?2:1,sourceSystem:'VITALISMEN_EC',eventId:bridgeId('evt',key),gira21xOrderId:order.integration.gira21xOrderId,vitalismenOrderId:order.orderId,eventType:type,occurredAt:new Date(now).toISOString(),...extra});
export async function runGiraCycle({enabled=false,store,client,collect,notify,clock=()=>Date.now()}){
 if(!enabled)return {status:'DISABLED',claimed:0};
 const now=clock();if(!await store.reserveCycle(Math.floor(now/60000)))return {status:'ALREADY_RUNNING'};
 try {
 const deadline=clock()+50000;
 const result={status:'COMPLETED',claimed:0,review:0,updates:0};
 // Reconcile pending events first, including timeout after remote commit.
 for(const pending of await store.pendingEvents(25)){try{await client.event(pending);}catch{result.review++;}}
 const batch=await client.claim();if(!batch||!Array.isArray(batch.items)||batch.items.length>25||batch.holds!==undefined&&(!Array.isArray(batch.holds)||batch.holds.length>25))throw Error('GIRA_BATCH_INVALID');
 for(const candidate of batch.holds??[]){try{const hold=validatePrepaidHold(candidate,{now});
  const order=await store.holdPrepaid(hold);
  await client.event(await store.stableEvent(event(order,'PAYMENT_HOLD_ACCEPTED',hold.holdId,{holdId:hold.holdId,payloadHash:hold.payloadHash,paymentStatus:order.integration.currentPaymentStatus},now)));
 }catch{result.review++;}}
 for(const item of batch.items){try{const payload=validateClaim(item),order=await store.importOrder(payload,item.payloadHash);
   await client.event(event(order,'ORDER_ACCEPTED',payload.gira21xOrderId+':accepted:'+item.leaseToken,{leaseToken:item.leaseToken},now));result.claimed++;
  }catch(error){result.review++;if(error.message==='GIRA_CUSTOMER_COD_BLOCKED'){const payload=validateClaim(item);const rejected={orderId:'EC-G21-'+(payload.schemaVersion===2?bridgeHash(payload.gira21xOrderId).slice(0,24):payload.gira21xOrderId.slice(-24)).toUpperCase(),integration:{gira21xOrderId:payload.gira21xOrderId,...(payload.schemaVersion===2?{schemaVersion:2}:{})}};await client.event(event(rejected,'ORDER_REJECTED',payload.gira21xOrderId+':rejected:'+item.leaseToken,{leaseToken:item.leaseToken},now));}}}
 for(const order of await store.activeOrders(25)){if(clock()>=deadline)break;await store.renewCycle?.();try{await store.markPolled(order.orderId);const observation=await collect(order);if(!observation)continue;
   const prepaid=prepaidDropiProjection(order,{approved:prepaidRuntimeApproved(),now});
   const common={dropiOrderId:order.dropiOrderId,trackingNumber:order.trackingNumber,carrier:'servientrega'};
   const binding=await store.stableEvent(event(order,'SHIPMENT_BOUND',order.orderId+':bind:'+order.dropiOrderId,{...common,paymentMode:prepaid?'SIN_RECAUDO':'CON_RECAUDO',...(prepaid?{amountToCollectMinor:0}:{}),amountMinor:order.integration.amountMinor,currency:'USD'},now));
   const bound=await client.event(binding);if(!bound?.accepted)continue;
   const status=await store.stableEvent(event(order,'STATUS_CHANGED',order.orderId+':'+order.trackingNumber+':'+observation.status,{...common,...observation},now));
   // Evidence timestamp and event timestamp are one immutable provider observation.
   status.occurredAt=status.evidence.observedAt;
   const receipt=await client.event(status);result.updates++;
   if(receipt?.accepted&&!receipt.stale&&receipt.status===observation.status){await store.observeReceipt(order.orderId,observation.status);await notify(order,observation.status,receipt.digitalGranted===true);}
  }catch{result.review++;}}
 for(const release of batch.releases??[]){try{const order=await store.findOrder(release.vitalismenOrderId,release.gira21xOrderId);if(!order||order.integration?.fulfillmentHold===true||order.integration?.currentPaymentStatus!==undefined&&order.integration.currentPaymentStatus!=='PAID')continue;await store.observeReceipt(order.orderId,'DELIVERED');
   const notice=await notify(order,'DIGITAL_AVAILABLE',true);
   if(notice&&['SENT','UNCERTAIN','SUPPRESSED'].includes(notice.status))await client.event(await store.stableEvent(event(order,'ACCESS_NOTICE_RESULT',order.orderId+':digital-notice',{notice},now)));
  }catch{result.review++;}}
 return result;
 }finally{await store.finishCycle?.();}
}
