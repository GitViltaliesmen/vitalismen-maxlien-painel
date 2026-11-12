import mongoose from 'mongoose';
import Message from '../../models/Message.js';
import ContactState from '../../models/ContactState.js';
import {giraRuntimePolicy} from './runtime-policy.mjs';
import {isPostSaleV188SendWindowOpen} from '../postSaleFullOperationalV188Service.js';
import {trackServientregaGuide} from '../carrierTrackingService.js';
import {readGiraDropiCodProof,readGiraDropiPrepaidProof} from '../droppiEcuadorBrowserService.js';
import {createGiraCompositeClient} from './prepaid-client.mjs';
import {prepaidRuntimeApproved} from './prepaid-contract.mjs';
import {sendText} from '../../whatsapp/sendText.js';
import {createGiraNotifier} from './notice.mjs';
import {officialShipmentEvidence} from './contract.mjs';
import {createGiraClient,assertGiraClientConfiguration} from './client.mjs';
import {createGiraMongoStore} from './mongo-store.mjs';
import {giraOutboundOptions} from './cohort.mjs';
import {runGiraCycle} from './cycle.mjs';
let running=false;
export async function runGira21xBridge(){
 const env=process.env;if(env.GIRA21X_BRIDGE_ENABLED!=='true')return {status:'DISABLED'};
 if(running)return {status:'ALREADY_RUNNING'};
 if(mongoose.connection.readyState!==1||env.GIRA21X_NATIVE_CONTRACT_APPROVED!=='true')return {status:'BLOCKED_NATIVE_HOMOLOGATION'};
 try{assertGiraClientConfiguration({origin:'https://gira21x.com',secret:env.GIRA21X_HMAC_SECRET,keyId:env.GIRA21X_HMAC_KEY_ID});}
 catch{return {status:'BLOCKED_BRIDGE_CREDENTIALS'};}
 if(!giraRuntimePolicy.approved())return {status:'BLOCKED_GIRA_OPERATIONAL_PROFILE'};
 running=true;
 try {
  const store=createGiraMongoStore(),configuration={origin:'https://gira21x.com',secret:env.GIRA21X_HMAC_SECRET,keyId:env.GIRA21X_HMAC_KEY_ID,store};
  const legacy=createGiraClient(configuration),client=createGiraCompositeClient({legacy,
   prepaid:prepaidRuntimeApproved()?createGiraClient({...configuration,channel:'STRIPE_PREPAID'}):null});
  const notify=createGiraNotifier({store,windowOpen:()=>isPostSaleV188SendWindowOpen(new Date()),
   canSend:async order=>!await ContactState.exists({countryCode:'EC',phoneDigits:order.customer.phone.replace(/\D/g,''),'human.mode':'manual'}),
   history:(order,text)=>Message.exists({peerPhone:order.customer.phone.replace(/\D/g,''),body:text,isBot:true}),
   send:async(order,text,key,stage)=>{const paused=await ContactState.exists({countryCode:'EC',phoneDigits:order.customer.phone.replace(/\D/g,''),'human.mode':'manual'});if(paused)return {ok:false,reason:'HUMAN_PAUSED'};return giraRuntimePolicy.send(order,()=>sendText(order.customer.phone.replace(/\D/g,'')+'@s.whatsapp.net',text,null,
    giraOutboundOptions(order,{country:'EC',outboundContext:'shipment_gira21x_'+stage.toLowerCase(),antiSpamKey:'gira21x:'+key,returnDetails:true,humanize:false})));}});
  return await giraRuntimePolicy.run(()=>runGiraCycle({enabled:true,store,client,notify,collect:async order=>{
   const guide=String(order.trackingNumber??'');if(!guide||!order.dropiOrderId)return null;
   try{const [carrier,dropi]=await Promise.all([trackServientregaGuide(guide),order.integration?.schemaVersion===2?readGiraDropiPrepaidProof({order}):readGiraDropiCodProof({orderId:order.orderId,dropiOrderId:order.dropiOrderId})]);
    return officialShipmentEvidence({order,carrier,dropi});}catch{await store.review(order.orderId,'OFFICIAL_CARRIER_OR_COD_BINDING_REQUIRED');return null;}
  }}));
 }finally{running=false;}
}
