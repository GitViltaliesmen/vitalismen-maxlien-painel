import {createHash} from 'node:crypto';
export const digitsV254=value=>String(value||'').replace(/\D/g,'');
export const stableV254=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export const digestV254=value=>createHash('sha256').update(typeof value==='string'?value:stableV254(value)).digest('hex');
export const ledgerIdV254=orderId=>'mp254:'+digestV254('EC|Purchase|'+orderId);
export function verifiedReceiptV254({row,order,expectedId,expectedPhone}){
 const id=String(row?.id||''),phone=digitsV254(expectedPhone||order?.customer?.phone);
 if(!/^[1-9]\d{5,11}$/.test(id)||id!==String(expectedId)||!/^5939\d{8}$/.test(phone)||!digitsV254(row.phone).endsWith(phone.slice(-9)))throw Error('recovery_receipt_identity_mismatch');
 if(!String(row.status||''))throw Error('recovery_receipt_status_missing');
 if(/CANCEL|DEVUEL|ANUL|RECHAZ|ELIMIN|REEMBOLS/i.test(String(row.status)))throw Error('recovery_provider_negative_terminal_status');
 const guide=String(row.sticker||'').match(/GUIA-([A-Za-z0-9-]+)\.pdf/i)?.[1]||'';
 if(!/^[A-Za-z0-9-]{6,25}$/.test(guide)||phone.endsWith(guide))throw Error('recovery_receipt_guide_unproven');
 const carrier=String(row.distribution_company?.name||'');if(!carrier)throw Error('recovery_receipt_carrier_missing');
 const raw=String(row.created_at||'');const createdAt=new Date(/[Zz]|[+-]\d\d:\d\d$/.test(raw)?raw:raw+'-05:00');if(!Number.isFinite(+createdAt))throw Error('recovery_provider_time_invalid');
 return {id,phone,guide,carrier,status:String(row.status),createdAt};
}
export const commercialFingerprintV254=order=>digestV254({orderId:order.orderId,country:order.country,customer:order.customer,package:order.package,total:order.total,currency:order.currency,confirmedAt:order.confirmedAt,previousOrderId:order.previousOrderId||'',product:order.tracking?.productKey});
export function existingShipmentPatchV254(shipment,row,receipt,{now=new Date(),orderId=shipment.orderId}={}){
 if(shipment.country!=='EC'||shipment.orderId!==orderId)throw Error('recovery_shipment_scope_mismatch');
 if(+new Date(shipment.automation?.submitLockedUntil||0)>+now)throw Error('recovery_active_submission');
 const known=String(shipment.raw?.latestDroppiPayload?.dropiOrderId||shipment.raw?.manualDropiOrderId||shipment.raw?.droppiOrder?.id||'');
 if(known&&known!==receipt.id)throw Error('recovery_existing_provider_conflict');
 if(shipment.logistics?.trackingNumber&&String(shipment.logistics.trackingNumber)!==receipt.guide)throw Error('recovery_existing_guide_conflict');
 const already=shipment.raw?.receiptRecoveryV254?.providerId===receipt.id&&!shipment.automation?.browserLastError&&shipment.review?.manualOnly!==true;
 const set={updatedAt:now,'automation.submittedToDroppiAt':shipment.automation?.submittedToDroppiAt||receipt.createdAt,'automation.browserLastError':'','automation.browserCheckpoint':'submitted_verified_existing_v254',
  'review.manualOnly':false,'review.reviewStatus':'submitted','review.reviewReason':'','logistics.status':receipt.status,'logistics.trackingNumber':receipt.guide,'logistics.chosenCarrier':receipt.carrier,
  'raw.droppiOrder':row,'raw.latestDroppiPayload':{...(shipment.raw?.latestDroppiPayload||{}),orderId,status:'submitted',dropiOrderId:receipt.id,trackingNumber:receipt.guide,dropiStatus:receipt.status,reconciliationSource:'verified_existing_dropi_v254'},
  'raw.receiptRecoveryV254':{version:254,providerId:receipt.id,observedAt:now,providerCreatedAt:receipt.createdAt,receiptSha256:digestV254(row),externalCreates:0}};
 if(shipment.raw?.fulfillmentRecoveryV254)set['raw.fulfillmentRecoveryV254']={...shipment.raw.fulfillmentRecoveryV254,state:'submitted',safeRetry:false,noCreate:false,lastError:'',updatedAt:now.toISOString()};
 return {$set:set,...(!already?{$push:{events:{kind:'dropi_verified_existing_v254',at:now,payload:{providerId:receipt.id,receiptSha256:digestV254(row),externalCreates:0}}}}:{})};
}
export function existingOrderPatchV254(order,receipt,{now=new Date()}={}){
 if(order.country!=='EC'||!['confirmed','processing','shipped','delivered'].includes(order.status))throw Error('recovery_order_no_longer_eligible');
 if(order.dropiOrderId&&String(order.dropiOrderId)!==receipt.id)throw Error('recovery_existing_provider_conflict');
 if(order.trackingNumber&&String(order.trackingNumber)!==receipt.guide)throw Error('recovery_existing_guide_conflict');
 const set={updatedAt:now,dropiOrderId:receipt.id,trackingNumber:receipt.guide,shippingStatus:receipt.status,...(order.status==='confirmed'?{status:'processing'}:{})};
 if(order.dropiDispatchV252?.status==='claimed'&&+new Date(order.dropiDispatchV252.startedAt)>+now-15*60000)throw Error('recovery_active_submission');
 if(order.dropiDispatchV252)set.dropiDispatchV252={...order.dropiDispatchV252,status:'submitted',submittedAt:order.dropiDispatchV252.submittedAt||receipt.createdAt,dropiOrderId:receipt.id,reason:'verified_existing_dropi_v254'};
 return {$set:set};
}
export function historicalPurchasePlanV254(order,destination,{now=new Date(),preflightFailureProven=false}={}){
 if(order.country!=='EC'||order.integration||!/^5939\d{8}$/.test(digitsV254(order.customer?.phone))||!['confirmed','processing','shipped','delivered'].includes(order.status)||!['tex_ultra_ec','vit_power_ec','nitrix_ec'].includes(order.tracking?.productKey)||![1,2,3,6].includes(Number(order.package?.quantity))||!(Number(order.total)>0)||order.currency!=='USD'||!Number.isFinite(+new Date(order.confirmedAt)))throw Error('recovery_commercial_confirmation_unproven');
 const tracking=order.tracking||{},eventId=tracking.metaPurchaseEventId||order.orderId,datasetId=tracking.metaPurchaseDatasetId||destination.pixelId;
 if(!datasetId||datasetId!==destination.pixelId||['plusmen_tex_v243_private_relay','vitpower_site_v237'].includes(destination.route))throw Error('recovery_destination_requires_owned_scope');
 let state='pending';const accepted=Boolean(tracking.metaPurchaseSentAt&&eventId===order.orderId&&Number(tracking.metaPurchaseResponse?.events_received)>0);
 if(accepted)state='accepted';else if(tracking.metaPurchaseSentAt)state='ambiguous';else if(tracking.metaPurchaseResponse?.error&&!preflightFailureProven)state='ambiguous';
 else if(+now-+new Date(order.confirmedAt)>=7*86400000||+new Date(order.confirmedAt)>+now+60000)state='expired';
 const id=ledgerIdV254(order.orderId),document={_id:id,country:'EC',orderId:order.orderId,eventName:'Purchase',eventId,datasetId,datasetRoute:tracking.metaPurchaseDatasetRoute||destination.route,
  occurredAt:new Date(order.confirmedAt),state,attempts:0,nextAttemptAt:now,createdAt:now,updatedAt:now,attribution:{status:'not_proven',hasFbc:Boolean(tracking.fbc),hasFbp:Boolean(tracking.fbp),hasClickId:Boolean(tracking.fbclid),hasAdId:Boolean(tracking.ad_id),source:tracking.attributionSource||''},
  history:[{at:now,state,action:'verified_historical_confirmation_recovery_v254',originalEventTime:order.confirmedAt,preflightFailureProven,previousResponse:tracking.metaPurchaseResponse||null}],
  ...(state==='accepted'?{acceptedAt:new Date(tracking.metaPurchaseSentAt),response:tracking.metaPurchaseResponse}:{})};
 return {document,intent:{version:254,requestedAt:now,occurredAt:new Date(order.confirmedAt),ledgerId:id,state,historicalRecovery:true},alreadyAccepted:accepted};
}
export function createVerifiedHistoricalOrderV254({id,lead,row,receipt,confirmedAt,agency,sourceTracking={},now=new Date()}){
 if(Number(lead.id)!==3633||receipt.id!=='8040077'||String(lead.country).toUpperCase()!=='EC'||String(lead.status)!=='pedido_enviado'||Number(lead.product_qty)!==2||Number(lead.product_value)!==70||Number(row.total_order)!==70||!row.orderdetails?.some(x=>Number(x.product_id)===129735))throw Error('recovery_new_native_scope_invalid');
 if(!agency?.id||!/PAQUIZHA/i.test(agency.city||'')||!/MARTHA.*BUCARAM/i.test(agency.name||'')||!/PAQUIZHA/i.test(String(row.city))||!/MARTHA.*BUCARAM/i.test(String(row.dir)))throw Error('recovery_agency_unproven');
 if(!confirmedAt||!Number.isFinite(+new Date(confirmedAt))||+new Date(confirmedAt)<+receipt.createdAt)throw Error('recovery_original_confirmation_unproven');
 const phone='+'+digitsV254(lead.phone_e164||lead.phone);if(digitsV254(phone)!==receipt.phone)throw Error('recovery_phone_mismatch');
 return {_id:id,orderId:'EC-ADMIN-3633',country:'EC',status:'processing',source:'manual',currency:'USD',total:70,confirmedAt:new Date(confirmedAt),createdAt:receipt.createdAt,updatedAt:now,entryAt:new Date(lead.created_at),entryReason:'verified_existing_human_purchase_v254',
  customer:{name:String(lead.name),phone,address:String(row.dir),city:agency.city,province:agency.province},package:{id:2,quantity:2,label:'2 frascos Tex Ultra Ecuador'},
  delivery:{mode:'agency',agencyId:agency.id,agencyName:agency.name},customerDataResolution:{orderDataReady:true,blockedReasons:[],source:'verified_existing_dropi_receipt_v254',verifiedAt:now},
  dropiOrderId:receipt.id,trackingNumber:receipt.guide,shippingStatus:receipt.status,tracking:{...sourceTracking,productKey:'tex_ultra_ec',productName:'Tex Ultra Ecuador',productSelectionSource:'verified_existing_human_purchase_v254'},
  notes:'Compra humana existente verificada na Dropi; lead EC #3633; representacao nativa V254 sem criar outro pedido externo.',
  dropiDispatchV252:{version:254,status:'submitted',attempts:0,dropiOrderId:receipt.id,submittedAt:receipt.createdAt,reason:'verified_existing_dropi_v254'}};
}

export function createVerifiedHistoricalShipmentV254({id,order,row,receipt,now=new Date()}){
 if(order.orderId!=='EC-ADMIN-3633'||receipt.id!=='8040077'||order.dropiOrderId!==receipt.id||order.country!=='EC')throw Error('recovery_new_shipment_scope_invalid');
 return {_id:id,orderId:order.orderId,country:'EC',provider:'droppi',productName:'Tex Ultra Ecuador',client:{...order.customer},
  logistics:{status:receipt.status,canonicalStatus:'UNKNOWN',terminal:false,canPickup:false,pickupReadyVerified:false,reminderEligible:false,trackingNumber:receipt.guide,distributionCompany:receipt.carrier,chosenCarrier:receipt.carrier,agencyPickup:true,agencyName:order.delivery.agencyName},
  automation:{submittedToDroppiAt:receipt.createdAt,browserCheckpoint:'submitted_verified_existing_v254',browserLastError:'',notificationLocks:{},postSaleSafetyLedger:{}},
  outcomes:{delivered:false,pickedUp:false,returned:false,prepaidOnly:false},review:{manualOnly:false,reviewStatus:'submitted',reviewReason:'',suppressedNotificationKinds:['guide','in_transit']},
  treatment:{unitsPurchased:2,daysPerUnit:30,targetUnits:6},raw:{droppiOrder:row,sourceDropi:true,latestDroppiPayload:{orderId:order.orderId,status:'submitted',dropiOrderId:receipt.id,trackingNumber:receipt.guide,total:order.total,quantity:2,reconciliationSource:'verified_existing_dropi_v254'},
   receiptRecoveryV254:{version:254,providerId:receipt.id,observedAt:now,providerCreatedAt:receipt.createdAt,receiptSha256:digestV254(row),externalCreates:0},historicalImportV254:{originalProviderId:receipt.id,recordCreatedAt:now,suppressOldGuideReplay:true}},
  createdAt:now,updatedAt:now,events:[{kind:'verified_existing_dropi_import_v254',at:now,payload:{providerId:receipt.id,externalCreates:0,suppressedNotificationKinds:['guide','in_transit']}}]};
}

export function createVerifiedJesusOrderV254({id,lead,row,receipt,shipment,agency,now=new Date()}){
 if(Number(lead.id)!==2091||receipt.id!=='8007565'||String(lead.country).toUpperCase()!=='EC'||lead.status!=='pedido_enviado'||lead.blocked||Number(lead.product_qty)!==3||Number(lead.product_value)!==95.99||Number(row.total_order)!==96||!row.orderdetails?.some(x=>Number(x.product_id)===103743))throw Error('recovery_jesus_commercial_scope_invalid');
 if(shipment?.orderId!=='8007565'||shipment.country!=='EC'||String(shipment.logistics?.trackingNumber)!==receipt.guide||+new Date(shipment.automation?.submittedToDroppiAt)!==+receipt.createdAt)throw Error('recovery_jesus_existing_shipment_invalid');
 if(!agency?.id||!/SANTO DOMINGO/i.test(agency.city)||!/QUEVEDO/i.test(agency.name)||!/ATABASCOS/i.test(agency.address)||!/SANTO DOMINGO/i.test(String(row.city))||!/QUEVEDO/i.test(String(row.dir)))throw Error('recovery_jesus_agency_unproven');
 const phone='+'+digitsV254(lead.phone_e164||lead.phone);if(digitsV254(phone)!==receipt.phone||!digitsV254(shipment.client?.phone).endsWith(receipt.phone.slice(-9)))throw Error('recovery_jesus_phone_mismatch');
 return {_id:id,orderId:'8007565',country:'EC',status:'shipped',source:'manual',currency:'USD',total:95.99,confirmedAt:receipt.createdAt,createdAt:receipt.createdAt,updatedAt:now,entryAt:receipt.createdAt,entryReason:'verified_existing_human_purchase_v254',
 customer:{name:String(lead.name),phone,address:String(row.dir),city:agency.city,province:agency.province},package:{id:3,quantity:3,label:'3 frascos Vit Power Ecuador'},delivery:{mode:'agency',agencyId:agency.id,agencyName:agency.name},customerDataResolution:{orderDataReady:true,blockedReasons:[],source:'verified_existing_dropi_receipt_v254',verifiedAt:now},
 dropiOrderId:receipt.id,trackingNumber:receipt.guide,shippingStatus:receipt.status,tracking:{productKey:'vit_power_ec',productName:'Vit Power Ecuador',productSelectionSource:'verified_existing_human_purchase_v254'},notes:'Compra humana existente #2091, confirmacao original comprovada por recibo Dropi e Shipment em 17/11; reparo de status em 19/11 nao altera a data comercial.',
 dropiDispatchV252:{version:254,status:'submitted',attempts:0,dropiOrderId:receipt.id,submittedAt:receipt.createdAt,reason:'verified_existing_dropi_v254'}};
}
export async function casV254(collection,id,fn){for(let i=0;i<3;i++){const row=await collection.findOne({_id:id});if(!row)throw Error('recovery_record_disappeared');const patch=fn(row);if(!patch)return row;const q={_id:id,...(row.updatedAt?{updatedAt:row.updatedAt}:{updatedAt:{$exists:false}})};const r=await collection.updateOne(q,patch);if(r.matchedCount===1)return collection.findOne({_id:id})}throw Error('recovery_concurrent_record_changed');}

export function verifiedPendingPurchaseReceiptV254({row,order,shipment}){
 const id=String(row?.id||''),phone=digitsV254(order?.customer?.phone);
 if(id!=='8043790'||order?.orderId!=='EC-MWO6UEZQ-QVQJ'||order.country!=='EC'||String(order.dropiOrderId)!==id||order.tracking?.productKey!=='tex_ultra_ec'||Number(order.package?.quantity)!==3||Number(order.total)!==80.99||order.currency!=='USD'||Number(row.total_order)!==80.99||!row.orderdetails?.some(x=>Number(x.product_id)===110681))throw Error('recovery_additional_commercial_receipt_mismatch');
 if(!/^5939\d{8}$/.test(phone)||!digitsV254(row.phone).endsWith(phone.slice(-9))||shipment?.country!=='EC'||shipment.orderId!==order.orderId||!shipment.automation?.submittedToDroppiAt||String(shipment.raw?.latestDroppiPayload?.dropiOrderId)!==id)throw Error('recovery_additional_existing_shipment_unproven');
 const raw=String(row.created_at||''),createdAt=new Date(/[Zz]|[+-]\d\d:\d\d$/.test(raw)?raw:raw+'-05:00'),confirmedAt=new Date(order.confirmedAt);if(!Number.isFinite(+createdAt)||!Number.isFinite(+confirmedAt)||+createdAt<+confirmedAt-120000||+createdAt>+confirmedAt+1800000)throw Error('recovery_additional_original_time_invalid');
 const guide=String(row.sticker||'').match(/GUIA-([A-Za-z0-9-]+)\.pdf/i)?.[1]||'',status=String(row.status||''),carrier=String(row.distribution_company?.name||'');
 if(!carrier||/CANCEL|DEVUEL|ANUL|RECHAZ|ELIMIN|REEMBOLS/i.test(status)||(!guide&&status!=='PENDIENTE')||(guide&&!/^[A-Za-z0-9-]{6,25}$/.test(guide)))throw Error('recovery_additional_pending_receipt_invalid');
 return {id,phone,guide,status,carrier,createdAt};
}
