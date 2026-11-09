import {bridgeHash} from './protocol.mjs';
const texts={GUIDE_CREATED:'Tu pedido GIRA21X tiene guía Servientrega. Aún no está disponible para retirar.',IN_TRANSIT:'Tu pedido GIRA21X está en tránsito.',READY_FOR_PICKUP:'Servientrega informa que tu pedido GIRA21X está disponible para retirar en la agencia seleccionada. Pagas al retirarlo.',RETURNED:'La transportadora registra una devolución de tu pedido GIRA21X. Contacta soporte para revisar el caso.',EXCEPTION:'La transportadora registra una incidencia con tu pedido GIRA21X. Contacta soporte.',DIGITAL_AVAILABLE:'La entrega de tu pedido GIRA21X fue validada y tu acceso digital está habilitado. Ingresa en https://gira21x.com/area con el correo del pedido. La progresión de tu programa se mantiene.'};
export function createGiraNotifier({store,send,history,windowOpen,canSend=async()=>true}){
 let physicalSends=0;
 return async(order,status,digital)=>{
  const stage=digital?'DIGITAL_AVAILABLE':status,key=bridgeHash(order.orderId+':'+stage),text=texts[stage]+' Pedido: '+order.integration.gira21xOrderId;
  if(!order.integration.whatsappConsent)return {status:'SUPPRESSED'};
  if(!texts[stage])return null;
  // Read a previous receipt even outside the send window. Never resend an INTENDED/uncertain attempt.
  const existing=await store.notice(key);if(existing)return existing.result??{status:'UNCERTAIN'};
  if(!windowOpen()||physicalSends>=1||!await canSend(order))return null;
  const reservation=await store.reserveNotice(key,{orderId:order.orderId,stage});
  if(!reservation.won)return reservation.row.result??{status:'UNCERTAIN'};
  let receipt={status:'UNCERTAIN'};
  try{if(!await history(order,text)){physicalSends++;const r=await send(order,text,key,stage);
   if(r?.ok&&typeof r.providerMessageId==='string'&&r.providerMessageId.length>0&&r.providerMessageId.length<=128)receipt={status:'SENT',providerMessageId:r.providerMessageId};}}
  catch{/* Permanent uncertainty, independent of entitlement success. */}
  await store.finishNotice(key,receipt);return receipt;
 };
}
