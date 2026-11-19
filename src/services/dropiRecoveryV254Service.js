import { randomUUID } from 'node:crypto';
import { integrationPolicyV254, withIntegrationScopeV254 } from './orderIntegrationScopeV254Service.js';
export function dropiFailureStateV254(result = {}) {
    const life = result.lifecycle;
    const noCreate = result.preflightNoCreateV254 === true || Boolean(life && ['preflight','catalog','quote'].includes(life.operation)) || Boolean(life?.operation === 'create' && life.requestDispatched === false);
    const code = String(result.errorCode || result.reason || '').toUpperCase();
    if (result.paymentRequired || /PAYMENT|BALANCE|CREDIT/.test(code)) return { state: 'awaiting_balance', safeRetry: false, noCreate, label: 'Aguardando saldo/credito na Dropi' };
    if (/LOCATION|PRODUCT|STOCK|CUSTOMER|ADDRESS|QUOTE/.test(code)) return { state: 'awaiting_data', safeRetry: false, noCreate, label: 'Aguardando correcao de dados/estoque' };
    if (noCreate) return { state: /AUTH|SESSION/.test(code) ? 'awaiting_session' : 'retry_wait', safeRetry: true, noCreate: true, label: 'Recuperacao automatica anterior a criacao' };
    return { state: 'verifying_confirmation', safeRetry: false, noCreate: false, label: 'Verificando confirmacao na Dropi; nao repetir criacao' };
}
export async function markDropiRecoveryV254(shipment, { result = {}, error = '', reason = '' } = {}) {
    const recovery = dropiFailureStateV254(result);
    shipment.review.manualOnly = true; // Excluded from legacy bulk resend; owned by the scoped recovery worker.
    shipment.review.reviewStatus = 'dropi_' + recovery.state + '_v254';
    shipment.review.reviewReason = reason || result.reason || recovery.state;
    shipment.automation.browserCheckpoint = shipment.review.reviewStatus;
    shipment.automation.browserLastError = String(error || result.error || recovery.label).slice(0,600);
    const previous = shipment.raw?.fulfillmentRecoveryV254 || {};
    shipment.raw = { ...(shipment.raw || {}), fulfillmentRecoveryV254: { ...previous, version:254, ...recovery,
        nextAttemptAt: new Date(Date.now()+120000).toISOString(), lastError: shipment.automation.browserLastError,
        lifecycle: result.lifecycle || null, updatedAt: new Date().toISOString() } };
    shipment.markModified?.('raw');
    shipment.events.push({ kind:'dropi_recovery_v254', at:new Date(), payload:{state:recovery.state,noCreate:recovery.noCreate,safeRetry:recovery.safeRetry} });
    await shipment.save();
    return shipment;
}
export async function clearDropiFailureV254(shipment) {
    if(!integrationPolicyV254()||!(shipment.automation?.submittedToDroppiAt||shipment.raw?.latestDroppiPayload?.dropiOrderId||shipment.raw?.droppiOrder?.id))return false;
    shipment.review.manualOnly=false;shipment.review.reviewStatus='submitted';shipment.review.reviewReason='';
    shipment.automation.browserLastError='';shipment.automation.browserCheckpoint='submitted_verified_v254';
    if(shipment.raw?.fulfillmentRecoveryV254){
        shipment.raw.fulfillmentRecoveryV254={...shipment.raw.fulfillmentRecoveryV254,state:'submitted',safeRetry:false,noCreate:false,lastError:'',updatedAt:new Date().toISOString()};shipment.markModified?.('raw');
    }
    await shipment.save();return true;
}
export async function recordExactDropiReceiptV254({order,shipment,row,Orders}) {
    const id=String(row?.id||''),phone=String(row?.phone||'').replace(/\D/g,'');
    if(!/^[1-9]\d{5,11}$/.test(id)||!phone.endsWith(String(order.customer.phone).replace(/\D/g,'').slice(-9)))throw Error('dropi_receipt_identity_invalid');
    const sticker=String(row.sticker||''),guide=sticker.match(/GUIA-([A-Za-z0-9-]+)\.pdf/i)?.[1]||String(row.tracking_number||'');
    const verifiedGuide=/^[A-Za-z0-9-]{6,25}$/.test(guide)&&!String(order.customer.phone).replace(/\D/g,'').endsWith(guide)?guide:'';
    const status=String(row.status||'').slice(0,100);if(!status)throw Error('dropi_receipt_status_missing');
    const carrier=String(row.distribution_company?.name||row.distributionCompany?.name||row.shipping_company||'');
    shipment.raw={...(shipment.raw||{}),droppiOrder:row,latestDroppiPayload:{...(shipment.raw?.latestDroppiPayload||{}),orderId:order.orderId,status:'submitted',dropiOrderId:id,trackingNumber:verifiedGuide||shipment.logistics?.trackingNumber||'',dropiStatus:status,reconciliationSource:'exact_dropi_receipt_v254'}};
    shipment.markModified?.('raw');shipment.automation.submittedToDroppiAt=shipment.automation.submittedToDroppiAt||new Date();
    shipment.logistics.status=status;if(verifiedGuide)shipment.logistics.trackingNumber=verifiedGuide;if(carrier){shipment.logistics.distributionCompany=carrier;shipment.logistics.chosenCarrier=carrier;}
    await clearDropiFailureV254(shipment);
    const update={dropiOrderId:id,shippingStatus:status,...(verifiedGuide?{trackingNumber:verifiedGuide}:{}),...(order.status==='confirmed'?{status:'processing'}:{})};
    await Orders.updateOne({_id:order._id},{$set:update});return{dropiOrderId:id,trackingNumber:verifiedGuide};
}
export async function recoverDropiBeforeCreateV254({ Orders, Shipments, dispatch, readiness, history, now = new Date() }) {
    if (!integrationPolicyV254()) return { skipped:true };
    const shipment = await Shipments.findOne({ country:'EC', 'automation.dropiSubmitAuthorizedAt':{$ne:null}, 'automation.submittedToDroppiAt':null,
        'raw.fulfillmentRecoveryV254.safeRetry':true, 'raw.fulfillmentRecoveryV254.noCreate':true,
        'raw.fulfillmentRecoveryV254.nextAttemptAt':{$lte:now.toISOString()} }).sort({'raw.fulfillmentRecoveryV254.nextAttemptAt':1});
    if(!shipment)return{skipped:true};
    const order=await Orders.findOne({country:'EC',orderId:shipment.orderId,status:'confirmed'});
    if(!order||!readiness(order).ready)return{skipped:true,reason:'order_not_ready'};
    const token=randomUUID();
    return withIntegrationScopeV254({kind:'dropi_recovery',orderId:order.orderId,orderObjectId:String(order._id),shipmentId:String(shipment._id),
        phone:String(order.customer.phone).replace(/\D/g,''),token,proofNoCreate:true},async()=>{
        await history(order);
        const claimed=await Shipments.findOneAndUpdate({_id:shipment._id,'raw.fulfillmentRecoveryV254.safeRetry':true,'raw.fulfillmentRecoveryV254.noCreate':true},{$set:{
            'raw.fulfillmentRecoveryV254.safeRetry':false,'raw.fulfillmentRecoveryV254.noCreate':false,
            'raw.fulfillmentRecoveryV254.state':'dispatch_claimed','raw.fulfillmentRecoveryV254.token':token,
            'review.manualOnly':false,'review.reviewStatus':'dropi_submit_running'
        },$inc:{'raw.fulfillmentRecoveryV254.attempts':1}},{new:true});
        if(!claimed)return{skipped:true,reason:'already_claimed'};
        // From this durable claim onward a crash is uncertain. Only a new proven preflight result can re-enable safeRetry.
        return dispatch(order,claimed);
    });
}
