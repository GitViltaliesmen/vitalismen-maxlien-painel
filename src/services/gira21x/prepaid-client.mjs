// Prepared additive client coordination; the native COD client remains intact.
import {PREPAID_CONTRACT,prepaidRuntimeApproved,prepaidDropiProjection} from './prepaid-contract.mjs';
const prepaidId=id=>/^g21pre_order_[a-f0-9]{28}$/.test(id??'');

export function createGiraCompositeClient({legacy,prepaid,approved=prepaidRuntimeApproved}){
 if(!approved())return legacy;
 return {
  async claim(){
   const original=await legacy.claim();
   if(!approved()||!Array.isArray(original?.items)||original.items.length>=25)return original;
   const remaining=25-original.items.length;
   try{
    const extra=await prepaid.claim(remaining);
    if(!extra||!Array.isArray(extra.items)||extra.items.length>remaining
     ||extra.items.some(item=>item.order?.schemaVersion!==2||!prepaidId(item.order?.gira21xOrderId)))return original;
    if(['releases','holds'].some(key=>extra[key]!==undefined&&(!Array.isArray(extra[key])||extra[key].length>25)))return original;
    return {...original,items:[...original.items,...extra.items],releases:[...(original.releases??[]),...(extra.releases??[])],holds:extra.holds??[]};
   }catch{return original;}
  },
  event(event){
   if(event?.schemaVersion===2||prepaidId(event?.gira21xOrderId)){
    if(event.schemaVersion!==2||!prepaidId(event.gira21xOrderId)||!approved())throw Error('GIRA_PREPAID_EVENT_SCOPE_INVALID');
    return prepaid.event(event);
   }
   return legacy.event(event);
  },
 };
}

// Rechecked immediately before a human-authorized physical submit. A local paid
// snapshot alone cannot override a later refund or dispute at the payment source.
export async function assertPrepaidCurrentPayment(order,{client,approved=prepaidRuntimeApproved()}={}){
 const projection=prepaidDropiProjection(order,{approved});if(!projection)return null;
 if(typeof client?.paymentStatus!=='function')throw Error('GIRA_PREPAID_STATUS_CLIENT_REQUIRED');
 const i=order.integration,result=await client.paymentStatus(i.gira21xOrderId,i.payloadHash);
 if(!result||result.contract!==PREPAID_CONTRACT||result.gira21xOrderId!==i.gira21xOrderId||result.payloadHash!==i.payloadHash
  ||result.paymentStatus!=='PAID'||result.financiallyEligible!==true||result.amountMinor!==i.amountMinor
  ||result.currency!=='USD'||result.amountToCollectMinor!==0||result.paymentIntentId!==i.payment.paymentIntentId
  ||result.checkoutSessionId!==i.payment.checkoutSessionId)throw Error('GIRA_PREPAID_PAYMENT_HELD');
 return Object.freeze({paymentStatus:'PAID',financiallyEligible:true,amountToCollectMinor:0});
}
