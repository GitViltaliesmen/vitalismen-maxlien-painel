import { spawnSync } from 'node:child_process';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import { integrationPolicyV254, withIntegrationScopeV254 } from './orderIntegrationScopeV254Service.js';
import { preparePurchaseIntentV254, purchaseLedgerIdV254 } from './metaPurchaseDeliveryV254Service.js';
let busy=false;
const sqlite = (action,input=null) => {
    const script=new URL('../../scripts/ec-sqlite-integration-v254.py',import.meta.url);
    const r=spawnSync('python3',['-I','-B','-S',script.pathname,action],{input:input?JSON.stringify(input):undefined,encoding:'utf8',timeout:15000,maxBuffer:512*1024,
        env:{PATH:'/usr/bin:/bin',...(process.env.V254_SQLITE_FIXTURE_PATH?{V254_SQLITE_FIXTURE_PATH:process.env.V254_SQLITE_FIXTURE_PATH}:{})}});
    if(r.status!==0)throw Error('confirmation_intake_'+action+'_failed');return JSON.parse(r.stdout);
};
export const readConfirmationClaimV254 = input => sqlite('read_claim', input);
export async function sqliteConfirmationTickV254() {
    if(busy||!integrationPolicyV254()||mongoose.connection.readyState!==1)return;
    busy=true;let job;
    try {
        job=sqlite('claim');if(!job)return;
        if(job.blocked||!/^\+?5939\d{8}$/.test(String(job.payload.phone||'').replace(/\s/g,'')))throw Object.assign(Error('invalid_or_blocked_ec_confirmation'),{permanent:true});
        const intakeKey=`v254:lead:${job.leadId}:${job.id}`;
        let order=await Order.findOne({country:'EC',integrationIntakeKeyV254:intakeKey}).lean();
        const hints=[...String(job.payload.notes||'').matchAll(/Pedido automacao:\s*(EC-[A-Z0-9-]+)/gi)].map(x=>x[1]);
        if(!order&&job.oldStatus!=='recompra'&&hints.length){
            const candidate=await Order.findOne({country:'EC',orderId:hints.at(-1)}).lean();
            if(candidate&&String(candidate.customer?.phone||'').replace(/\D/g,'')===String(job.payload.phone).replace(/\D/g,''))order=candidate;
        }
        if(!order){
            if(job.liveStatus!=='confirmado')throw Object.assign(Error('confirmation_superseded'),{permanent:true});
            const admin=await mongoose.connection.db.collection('users').findOne({role:'admin',isActive:true},{projection:{_id:1,role:1}});
            if(!admin)throw Error('active_admin_missing');
            const token=jwt.sign({id:String(admin._id),role:'admin'},process.env.JWT_SECRET,{expiresIn:'2m'});
            const response=await fetch(`http://127.0.0.1:3001/api/shipments/droppi/ec/admin-leads/${job.leadId}/stage-confirmed`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
                headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Vitalismen-Intake-Key':intakeKey,'X-Vitalismen-Intake-Token':job.token},body:JSON.stringify({forceRepurchase:job.oldStatus==='recompra',note:'Confirmação humana persistida no intake V254 '+job.id})});
            const data=await response.json();
            if(!response.ok||!data.success||!data.orderId)throw Object.assign(Error(data.error||'native_registration_failed'),{permanent:response.status>=400&&response.status<500});
            order=await Order.findOne({country:'EC',orderId:data.orderId}).lean();
        }
        if(!order)throw Error('native_registration_not_persisted');
        // Import only an exact order event receipt. A lead-level receipt never belongs to a repurchase by phone alone.
        const receipt=sqlite('read_receipt',{leadId:job.leadId,eventId:order.tracking?.metaPurchaseEventId||order.orderId});
        let ack;try{ack=JSON.parse(receipt?.response_payload||'null');}catch{}
        if(ack?.response)ack=ack.response;
        if(receipt&&Number(ack?.events_received)>0&&!order.tracking?.metaPurchaseSentAt){
            order.tracking={...(order.tracking||{}),metaPurchaseEventId:receipt.event_id,metaPurchaseSentAt:new Date(receipt.updated_at),metaPurchaseResponse:ack};
            if(Number.isFinite(+order.tracking.metaPurchaseSentAt))await withIntegrationScopeV254({kind:'purchase',orderId:order.orderId,orderObjectId:String(order._id),ledgerId:purchaseLedgerIdV254(order.orderId)},()=>Order.updateOne({_id:order._id},{$set:{'tracking.metaPurchaseEventId':receipt.event_id,'tracking.metaPurchaseSentAt':order.tracking.metaPurchaseSentAt,'tracking.metaPurchaseResponse':ack}}));
        }
        if(preparePurchaseIntentV254(order,{transition:true,fromPersistedConfirmation:true}))await withIntegrationScopeV254({kind:'purchase',orderId:order.orderId,orderObjectId:String(order._id),ledgerId:purchaseLedgerIdV254(order.orderId)},()=>
            Order.updateOne({_id:order._id,'purchaseDeliveryV254.requestedAt':null},{$set:{purchaseDeliveryV254:order.purchaseDeliveryV254}}));
        sqlite('finish',{id:job.id,token:job.token,state:'done',orderId:order.orderId});
    }catch(error){
        if(job)try{sqlite('finish',{id:job.id,token:job.token,state:error.permanent?'blocked':'retry_wait',error:error.code||error.message});}catch{}
        console.error('[V254] confirmation bridge:',error.code||error.message);
    }finally{busy=false;}
}
