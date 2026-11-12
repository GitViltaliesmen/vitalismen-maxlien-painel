import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import Order from '../../models/Order.js';
import Shipment from '../../models/Shipment.js';
import ContactState from '../../models/ContactState.js';
import {giraOrderDocument,isGiraOrder} from './contract.mjs';
import {prepaidHoldWrite,prepaidRuntimeApproved} from './prepaid-contract.mjs';
export function createGiraMongoStore({connection=mongoose.connection,orderModel=Order,shipmentModel=Shipment,contactModel=ContactState}={}){
 for(const model of [orderModel,shipmentModel,contactModel])if(model.db!==connection)throw Error('GIRA_STORE_CONNECTION_MISMATCH');
 // Existing Mongo database; no model autoIndex/autoCreate, no provisioning on import.
 const records=()=>connection.collection('gira21x_bridge_v1');
 let cycleToken=null;
 const get=id=>records().findOne({_id:id});
 async function once(id,value){try{await records().insertOne({_id:id,...value});return true;}catch(e){if(e.code===11000)return false;throw e;}}
 async function ensureContact(doc){const phone=doc.customer.phone.replace(/\D/g,'');
  if(await contactModel.exists({countryCode:'EC',phoneDigits:phone}))return;
  await contactModel.updateOne({chatId:phone+'@s.whatsapp.net'},{$setOnInsert:{phoneDigits:phone,countryCode:'EC',metadata:{gira21x:{origin:'GIRA21X',orderId:doc.orderId},customerDraft:{...doc.customer,productKey:doc.tracking.productKey}},human:{mode:'auto'}}},{upsert:true,runValidators:true});
 }
 return {
  async reserveCycle(minute){const token=randomUUID(),now=new Date();try{const row=await records().findOneAndUpdate({_id:'cycle',lastMinute:{$ne:minute},$or:[{until:{$lte:now}},{until:{$exists:false}}]},{$set:{lastMinute:minute,token,until:new Date(now.getTime()+600000)}},{upsert:true,returnDocument:'after'});if(row?.token!==token)return false;cycleToken=token;return true;}catch(e){if(e.code===11000)return false;throw e;}},
  renewCycle:()=>records().updateOne({_id:'cycle',token:cycleToken},{$set:{until:new Date(Date.now()+600000)}}),
  finishCycle:()=>records().updateOne({_id:'cycle',token:cycleToken},{$set:{until:new Date(0)}}),
  async reserveEvent(id,raw,hash){await once('event:'+id,{kind:'event',raw,hash,attempted:false,result:null});return get('event:'+id);},
  markEventAttempted:id=>records().updateOne({_id:'event:'+id},{$set:{attempted:true}}),
  finishEvent:(id,result)=>records().updateOne({_id:'event:'+id},{$set:{result}}),
  async pendingEvents(limit){return (await records().find({kind:'event',result:null}).limit(limit).toArray()).map(r=>JSON.parse(r.raw));},
  async stableEvent(event){await once('draft:'+event.eventId,{raw:JSON.stringify(event)});return JSON.parse((await get('draft:'+event.eventId)).raw);},
  async importOrder(payload,payloadHash){
   const doc=giraOrderDocument(payload,payloadHash),existing=await orderModel.findOne({orderId:doc.orderId}).lean();
   if(existing){if(!isGiraOrder(existing)||existing.integration.payloadHash!==payloadHash)throw Error('GIRA_IMPORT_CONFLICT');await ensureContact(existing);return existing;}
   const phone=payload.customer.phone.replace(/\D/g,''),tail=phone.slice(-9),phoneQuery={$regex:tail+'$'};
   // All returned history is blocking, not merely the latest record. No historical import/send.
   const [returned,active,shipmentBlock]=await Promise.all([
    orderModel.exists({country:'EC','customer.phone':phoneQuery,$or:[{status:'returned'},{shippingCanonicalStatus:'RETURNED'}]}),
    orderModel.exists({country:'EC','customer.phone':phoneQuery,status:{$in:['pending','confirmed','processing','shipped']}}),
    shipmentModel.exists({country:'EC','client.phone':phoneQuery,$or:[{'outcomes.returned':true},{'outcomes.prepaidOnly':true},{'logistics.canonicalStatus':{$nin:['DELIVERED','CANCELED','CANCELLED','RETURNED']}}]})]);
   if(returned||active||shipmentBlock)throw Error('GIRA_CUSTOMER_COD_BLOCKED');
   // orderId already has a unique index in the official model. No post-save funnel or Meta hook.
   await orderModel.updateOne({orderId:doc.orderId},{$setOnInsert:doc},{upsert:true,runValidators:true,timestamps:false});
   const stored=await orderModel.findOne({orderId:doc.orderId}).lean();if(stored?.integration?.payloadHash!==payloadHash)throw Error('GIRA_IMPORT_CONFLICT');
   await ensureContact(stored);
   return stored;
  },
  async holdPrepaid(hold){
   if(!prepaidRuntimeApproved())throw Error('GIRA_PREPAID_SUCCESSOR_REQUIRED');
   const {query,update}=prepaidHoldWrite(hold);
   const existing=await orderModel.findOne({orderId:hold.vitalismenOrderId,'integration.origin':'GIRA21X','integration.schemaVersion':2,
    'integration.gira21xOrderId':hold.gira21xOrderId,'integration.payloadHash':hold.payloadHash}).lean();
   if(!existing)throw Error('GIRA_PREPAID_HOLD_ORDER_NOT_FOUND');
   await orderModel.updateOne(query,update,{runValidators:true,timestamps:false});
   const stored=await orderModel.findOne({orderId:hold.vitalismenOrderId}).lean();
   if(stored?.integration?.fulfillmentHold!==true||!['REFUNDED','DISPUTED','PARTIAL_REFUND_REVIEW'].includes(stored.integration.currentPaymentStatus))throw Error('GIRA_PREPAID_HOLD_NOT_APPLIED');
   return stored;
  },
  async activeOrders(limit){const orders=await orderModel.find({'integration.origin':'GIRA21X','integration.fulfillmentHold':{$ne:true},status:{$nin:['cancelled','returned']}}).sort({'integration.lastPolledAt':1,updatedAt:1}).limit(limit).lean();
   for(const order of orders){if(order.trackingNumber&&order.dropiOrderId)continue;
    const ship=await shipmentModel.findOne({orderId:order.orderId,country:'EC'}).lean();
    const dropiId=String(ship?.raw?.manualDropiOrderId||ship?.raw?.latestDroppiPayload?.dropiOrderId||ship?.raw?.droppiOrder?.id||'');
    if(ship?.logistics?.trackingNumber&&/^\d{1,30}$/.test(dropiId)){order.trackingNumber=ship.logistics.trackingNumber;order.dropiOrderId=dropiId;}
   }return orders;
  },
  markPolled:orderId=>orderModel.updateOne({orderId,'integration.origin':'GIRA21X'},{$set:{'integration.lastPolledAt':new Date()}}),
  observeReceipt:(orderId,status)=>orderModel.updateOne({orderId,'integration.origin':'GIRA21X'},{$set:{shippingCanonicalStatus:status,...(status==='DELIVERED'?{status:'delivered'}:status==='RETURNED'?{status:'returned'}:{}),updatedAt:new Date()}}),
  findOrder:(orderId,giraId)=>orderModel.findOne({orderId,'integration.gira21xOrderId':giraId,'integration.origin':'GIRA21X'}).lean(),
  notice:key=>get('notice:'+key),
  async reserveNotice(id,value){const won=await once('notice:'+id,{...value,state:'INTENDED',at:new Date()});return {won,row:await get('notice:'+id)};},
  finishNotice:(id,result)=>records().updateOne({_id:'notice:'+id},{$set:{state:result.status,result,finalizedAt:new Date()}}),
  async review(orderId,reason){await records().updateOne({_id:'review:'+orderId},{$set:{reason,at:new Date()}},{upsert:true});},
 };
}
