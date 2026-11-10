import { createHash } from 'node:crypto';

const quantities = Object.freeze({ OFFER_COMPLETO_X6_HYB:6, OFFER_DOMINIO_X3_HYB:3, OFFER_EVOLUCION_X2_HYB:2, OFFER_INICIO_X1_HYB:1 });
const products = Object.freeze({ SKU_VIT_POWERS:'vit_power_ec', SKU_TEX_ULTRA:'tex_ultra_ec', SKU_NITRIC_OXIDE:'nitrix_ec' });
const clean = v => String(v ?? '').trim();
function invalid() { const error=new Error('Snapshot financeiro do kit GIRA divergente. Confira o pedido original antes do envio.');error.code='gira_dropi_snapshot_invalid';error.status=409;return error; }

// Returns null ONLY for a native order. An invalid external snapshot never falls
// through to a native price preset. It does not authorize or dispatch an order.
export function giraDropiOffer(order) {
    if(order?.integration?.origin!=='GIRA21X') return null;
    const i=order.integration, qty=quantities[i.offerId], productKey=products[i.sku];
    const id=clean(i.gira21xOrderId);
    if(!/^g21cod_order_[a-f0-9]{28}$/.test(id) || !/^[a-f0-9]{64}$/.test(clean(i.payloadHash))
      || order.orderId!=='EC-G21-'+createHash('sha256').update(id).digest('hex').slice(0,24).toUpperCase()
      || order.country!=='EC' || order.currency!=='USD' || order.entryReason!=='gira21x_external'
      || order.source!=='manual' || i.dispatch!=='MANUAL_ONLY' || i.purchaseOwner!=='GIRA21X'
      || !Number.isInteger(i.offerVersion) || i.offerVersion<1 || !qty || !productKey
      || i.quantity!==qty || Number(order.package?.quantity)!==qty || Number(order.package?.id)!==qty
      || !Number.isSafeInteger(i.amountMinor) || i.amountMinor<=0
      || !Number.isFinite(Number(order.total)) || Math.round(Number(order.total)*100)!==i.amountMinor
      || clean(order.tracking?.productKey)!==productKey) throw invalid();
    return Object.freeze({productKey,quantity:qty,total:i.amountMinor/100,amountMinor:i.amountMinor,
      unitPrice:(i.amountMinor/100)/qty,offerId:i.offerId,gira21xOrderId:id,payloadHash:i.payloadHash,
      label:clean(i.program),source:'GIRA21X_IMMUTABLE_CONTRACT',authorizationRequired:true});
}
