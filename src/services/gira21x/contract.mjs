import {canonicalLogisticsProjectionV147} from '../canonicalLogisticsStatusV147Service.js';
import {bridgeHash,technicalId} from './protocol.mjs';
import {validatePrepaidClaim,prepaidRuntimeApproved,prepaidIntegrationFields,prepaidDropiProjection} from './prepaid-contract.mjs';
export const isGiraOrder=o=>o?.integration?.origin==='GIRA21X'&&/^g21(?:cod|pre)_order_[a-f0-9]{28}$/.test(o.integration.gira21xOrderId??'');
const offers={OFFER_INICIO_X1_HYB:1,OFFER_EVOLUCION_X2_HYB:2,OFFER_DOMINIO_X3_HYB:3,OFFER_COMPLETO_X6_HYB:6};
export const products={SKU_VIT_POWERS:{key:'vit_power_ec',name:'Vit Power'},SKU_TEX_ULTRA:{key:'tex_ultra_ec',name:'Tex Ultra'},SKU_NITRIC_OXIDE:{key:'nitrix_ec',name:'Nitrix Oxide'}};
export function validateClaim(item){
 const o=item?.order;
 if(o?.schemaVersion===2)validatePrepaidClaim(o,{approved:prepaidRuntimeApproved()});
 if(!o||bridgeHash(JSON.stringify(o))!==item.payloadHash||!technicalId(item.leaseToken)||![1,2].includes(o.schemaVersion)||o.sourceSystem!=='GIRA21X'||o.country!=='EC'
  ||!(o.schemaVersion===2?/^g21pre_order_[a-f0-9]{28}$/:/^g21cod_order_[a-f0-9]{28}$/).test(o.gira21xOrderId??'')||!offers[o.offerId]||o.quantity!==offers[o.offerId]||!products[o.sku]
  ||!Number.isSafeInteger(o.amountMinor)||o.amountMinor<=0||o.currency!=='USD'||o.paymentMode!==(o.schemaVersion===2?'PREPAID':'CON_RECAUDO')
  ||!/^\+593\d{9}$/.test(o.customer?.phone??'')||typeof o.customer.name!=='string'||o.customer.name.length<3||o.customer.name.length>160
  ||typeof o.program!=='string'||o.program.length>160||!['agency','home'].includes(o.delivery?.mode)||typeof o.destination?.cantonName!=='string'
  ||typeof o.whatsappConsent!=='boolean'||o.delivery.mode==='home'&&(!o.delivery.address||!o.delivery.reference)
  ||o.delivery.mode==='agency'&&!o.delivery.agencySelection?.agencyRef)throw Error('GIRA_CLAIM_INVALID');
 return o;
}
// Uses only exact provider values; panel labels, AI output and customer text are not inputs.
export function officialShipmentEvidence({order,carrier,dropi,now=Date.now()}){
 const prepaid=prepaidDropiProjection(order,{approved:prepaidRuntimeApproved(),now});
 const collectionMode=prepaid?'SIN_RECAUDO':'CON_RECAUDO',expectedProviderAmountMinor=prepaid?0:order.integration.amountMinor;
 const guide=String(order.trackingNumber??''),id=String(order.dropiOrderId??''),amount=order.integration.amountMinor;
 if(order.package.quantity!==order.integration.quantity||Math.round(order.total*100)!==amount)throw Error('GIRA_ORDER_SNAPSHOT_CHANGED');
 if(!technicalId(guide)||!/^\d{1,30}$/.test(id)||carrier?.ok!==true||carrier.carrier!=='servientrega'
  ||carrier.requestedGuide!==guide||carrier.observedGuide!==guide||carrier.source!=='carrier_tracking'
  ||dropi?.source!=='dropi_orders_api'||String(dropi.dropiOrderId)!==id||dropi.trackingNumber!==guide
  ||dropi.paymentMode!==collectionMode||prepaid&&dropi.amountToCollectMinor!==0||dropi.amountMinor!==expectedProviderAmountMinor||dropi.currency!=='USD'
  ||dropi.internalOrderId!==order.orderId||dropi.productKey!==products[order.integration.sku]?.key||dropi.quantity!==order.package.quantity)
  throw Error('GIRA_OFFICIAL_BINDING_REVIEW');
 const rawStatus=String(carrier.providerStatus??''),rawCode=String(carrier.providerStatusCode??''),rawSubstatus=String(carrier.providerSubstatus??'');
 const status=canonicalLogisticsProjectionV147({provider:'servientrega',providerCode:rawCode,providerStatus:rawStatus,providerSubstatus:rawSubstatus}).canonicalStatus;
 if(status==='UNKNOWN')throw Error('GIRA_CARRIER_STATUS_REVIEW');
 const observedAt=new Date(now).toISOString();
 return {status,evidence:{provider:'servientrega',source:'carrier_tracking',rawStatus,rawCode,rawSubstatus,guide,paymentMode:collectionMode,...(prepaid?{amountToCollectMinor:0,providerAmountMinor:0}:{}),amountMinor:amount,currency:'USD',observedAt,
  reference:'carrier:'+bridgeHash(guide+':'+rawStatus).slice(0,32),hash:bridgeHash(JSON.stringify({guide,id,rawStatus,rawCode,rawSubstatus,dropi,observedAt}))}};
}
export function giraOrderDocument(payload,payloadHash,now=new Date()){
 const prepaid=payload.schemaVersion===2?prepaidIntegrationFields(payload,payloadHash,{approved:prepaidRuntimeApproved(),now:now.getTime()}):{};
 const id='EC-G21-'+bridgeHash(payload.gira21xOrderId).slice(0,24).toUpperCase(),product=products[payload.sku],agency=payload.delivery.agencySelection;
 return {orderId:id,country:'EC',currency:'USD',status:'confirmed',confirmedAt:now,entryAt:now,entryReason:'gira21x_external',source:'manual',previousOrderId:payload.parentOrderId??'',
  customer:{...(payload.schemaVersion===2?{email:payload.customer.email}:{}),name:payload.customer.name,phone:payload.customer.phone,address:payload.delivery.mode==='home'?payload.delivery.address:String(agency.address??agency.agencyName??agency.agencyRef),reference:payload.delivery.reference??'',city:payload.destination.cantonName,province:payload.destination.provinceName},
  delivery:{mode:payload.delivery.mode,agencyId:agency?.agencyRef??'',agencyName:agency?.agencyName??''},package:{id:payload.quantity,label:payload.program+' · '+product.name,quantity:payload.quantity},total:payload.amountMinor/100,
  tracking:{country:'EC',productKey:product.key,productName:product.name,sourceUrl:'https://gira21x.com/'},
  integration:{...prepaid,origin:'GIRA21X',gira21xOrderId:payload.gira21xOrderId,payloadHash,offerId:payload.offerId,offerVersion:payload.offerVersion,program:payload.program,sku:payload.sku,quantity:payload.quantity,component:payload.component,amountMinor:payload.amountMinor,whatsappConsent:payload.whatsappConsent,dispatch:'MANUAL_ONLY',purchaseOwner:'GIRA21X'},createdAt:now,updatedAt:now};
}
