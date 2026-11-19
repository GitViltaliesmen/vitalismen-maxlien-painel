import { AsyncLocalStorage } from 'node:async_hooks';
const storage = new AsyncLocalStorage();
export const integrationPolicyV254 = () => {
    const p = globalThis.__VITALISMEN_EC_ORDER_INTEGRATION_V254;
    return p && Object.isFrozen(p) && p.kind === 'EC_ORDER_INTEGRATION_V254' && p.isCurrent() ? p : null;
};
export const integrationScopeV254 = () => {
    const s = storage.getStore();
    return s && integrationPolicyV254() && s.expiresAt > Date.now() ? s : null;
};
export const withIntegrationScopeV254 = (scope, fn) => {
    if (!integrationPolicyV254() || !/^(EC-[A-Z0-9-]+|[1-9]\d{5,11})$/.test(scope.orderId || '')) throw Error('integration_scope_invalid');
    return storage.run(Object.freeze({ ...scope, expiresAt: Date.now() + (scope.kind === 'dropi_recovery' ? 15 * 60000 : 120000) }), fn);
};
export const integrationExternalAllowedV254 = effect => {
    const s=integrationScopeV254();
    return Boolean(s && (s.kind==='purchase' && effect==='meta_purchase' || (s.kind==='dropi_recovery' && s.proofNoCreate || s.kind==='dropi_reconcile') && effect==='dropi'));
};
export const integrationDropiOrderAllowedV254 = (order,shipment) => {
    const s=integrationScopeV254();
    return Boolean(s?.kind==='dropi_recovery' && s.proofNoCreate && String(order?._id)===s.orderObjectId && order?.orderId===s.orderId && order?.status==='confirmed'
        && String(order.customer?.phone||'').replace(/\D/g,'')===s.phone && shipment?.orderId===s.orderId && String(shipment?._id)===s.shipmentId
        && shipment?.automation?.dropiSubmitAuthorizedAt && shipment?.automation?.dropiSubmitAuthorizedBy);
};
export const integrationMongoAllowedV254 = (collection, method, args) => {
    const s = integrationScopeV254();
    if (!s || !['insertOne', 'updateOne', 'findOneAndUpdate','updateMany'].includes(method)) return false;
    if(method==='updateMany')return false;
    const q = args[0] || {}, update = args[1] || {};
    if(['dropi_recovery','dropi_reconcile'].includes(s.kind)) {
        if(method==='insertOne'||args[2]?.upsert)return false;
        let roots=[];
        if(collection==='shipments'&&(String(q._id||'')===s.shipmentId||q.orderId===s.orderId))roots=['automation','logistics','review','raw','events','updatedAt','__v'];
        if(collection==='orders'&&(String(q._id||'')===s.orderObjectId||q.orderId===s.orderId)){
            if(update.$set?.status && update.$set.status!=='processing')return false;
            roots=['status','shippingStatus','shippingCanonicalStatus','shippingCanonicalEvidence','dropiOrderId','trackingNumber','dropiDispatchV252','updatedAt','__v'];
        }
        if(collection==='contactstates'&&q.countryCode==='EC'&&q.phoneDigits===s.phone)roots=['metadata.dropi','metadata.customerDraft.status','metadata.customerDraft.flowDataOk.venda_finalizada','metadata.customerDraft.updatedAt','updatedAt','tags'];
        return roots.length>0 && Object.entries(update).every(([op,values])=>op==='$setOnInsert'?Object.keys(values).every(k=>k==='createdAt')
            :['$set','$unset','$push','$inc','$addToSet'].includes(op)&&Object.keys(values).every(k=>roots.some(r=>k===r||k.startsWith(r+'.')))
                &&(op!=='$addToSet'||Object.entries(values).every(([k,v])=>k==='tags'&&['FEITO_DROPI','ERRO_DROPI'].includes(v))));
    }
    if(s.kind!=='purchase')return false;
    if (collection === 'metapurchasedeliveriesv254') {
        if (method === 'insertOne') return q._id === s.ledgerId && q.orderId === s.orderId && q.country === 'EC';
        if (q._id !== s.ledgerId || args[2]?.upsert) return false;
        const fields = ['state','eventId','datasetId','datasetRoute','attempts','nextAttemptAt','leaseToken','leaseUntil','attemptedAt','dispatchedAt','acceptedAt','response','lastError','lastHttpStatus','requestSha256','payload','attribution','updatedAt','history'];
        return Object.entries(update).every(([op, values]) => op==='$setOnInsert'?Object.keys(values).every(k=>k==='createdAt'):['$set','$unset','$inc','$push'].includes(op) && Object.keys(values).every(k => fields.some(f => k === f || k.startsWith(f + '.'))));
    }
    if (collection === 'orders') {
        if (method === 'insertOne' || args[2]?.upsert || !(String(q._id || '') === s.orderObjectId || q.orderId === s.orderId)) return false;
        return Object.entries(update).every(([op, values]) => op==='$setOnInsert'?Object.keys(values).every(k=>k==='createdAt'):op === '$set' && Object.keys(values).every(k => k === 'updatedAt' || (k==='purchaseDeliveryV254'||k.startsWith('purchaseDeliveryV254.')) || /^tracking\.metaPurchase(?:EventId|DatasetId|DatasetRoute|SentAt|Response)$/.test(k)));
    }
    if (collection === 'metabusinessevents' && s.checkoutEventId && method === 'findOneAndUpdate') {
        return q._id === s.checkoutEventId && update.$set?.boundOrderId === s.orderId && Object.keys(update).length === 1 && Object.keys(update.$set).length === 1;
    }
    return false;
};
