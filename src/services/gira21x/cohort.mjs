import Order from '../../models/Order.js';
import {isGiraOrder} from './contract.mjs';
import {giraRuntimePolicy} from './runtime-policy.mjs';
const authorized=new WeakSet();
export function giraOutboundOptions(order,extra={}){const options={...extra,gira21xOrderId:order.integration.gira21xOrderId};authorized.add(options);return options;}
export async function currentGiraOrder(phone){
 if(process.env.GIRA21X_BRIDGE_ENABLED!=='true')return null;
 const digits=String(phone??'').split('@')[0].replace(/\D/g,'');if(!/^593\d{9}$/.test(digits))return null;
 if(Order.db.readyState!==1)throw Error('GIRA_COHORT_DATABASE_UNAVAILABLE');
 const latest=await Order.findOne({country:'EC','customer.phone':{$regex:digits.slice(-9)+'$'}}).sort({entryAt:-1,createdAt:-1}).lean();
 return isGiraOrder(latest)?latest:null;
}
export async function giraOutboundAllowed(jid,options,kind='text'){
 if(process.env.GIRA21X_BRIDGE_ENABLED!=='true')return true;
 const order=await currentGiraOrder(options.recipientDigits||jid);if(!order)return !options.gira21xOrderId;
 if(options.sendMode==='manual_panel')return true; // existing authenticated human transport guards still apply
 if(kind!=='text')return false;
 return authorized.has(options)&&options.gira21xOrderId===order.integration.gira21xOrderId&&order.integration.whatsappConsent===true;
}

export async function routeGiraInbound(phone,body){
 const order=await currentGiraOrder(phone);if(!order)return null;
 const text=String(body??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 if(/^(stop|parar|cancelar mensajes|no (quiero|deseo) (mas )?mensajes|dejar de recibir mensajes)[.! ]*$/.test(text))
  await giraRuntimePolicy.optOut(order,()=>Order.updateMany({country:'EC','customer.phone':order.customer.phone,'integration.origin':'GIRA21X'},{$set:{'integration.whatsappConsent':false,'integration.whatsappOptOutAt':new Date(),'integration.whatsappOptOutSource':'CUSTOMER_WHATSAPP'}}));
 return {handled:true,skipped:true,reason:'GIRA21X_POSTSALE_HUMAN_INBOX_NO_LEGACY_FUNNEL'};
}
