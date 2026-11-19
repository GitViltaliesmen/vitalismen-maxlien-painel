import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePurchaseIntentV254, purchaseLedgerIdV254, purchaseOutcomeV254, deliverPurchaseV254 } from '../src/services/metaPurchaseDeliveryV254Service.js';
import { withIntegrationScopeV254, integrationMongoAllowedV254, integrationExternalAllowedV254 } from '../src/services/orderIntegrationScopeV254Service.js';
globalThis.__VITALISMEN_EC_ORDER_INTEGRATION_V254 = Object.freeze({ kind: 'EC_ORDER_INTEGRATION_V254', isCurrent: () => true, activatedAt: () => '2026-11-19T00:00:00Z' });
const now = new Date('2026-11-19T12:00:00Z');
const order = (id = 'EC-TEST-V254') => ({ _id: '0123456789abcdef01234567', orderId: id, country: 'EC', status: 'confirmed', confirmedAt: now,
    customer: { phone: '+593990000254' }, package: { quantity: 1 }, total: 35.99, currency: 'USD', tracking: { productKey: 'tex_ultra_ec' } });
function fixture() {
    const docs = new Map(), changes = [];
    const assign = (target, values) => { for (const [key, value] of Object.entries(values || {})) target[key] = value; };
    const Ledger = {
        findById: id => ({ lean: async () => structuredClone(docs.get(id) || null) }),
        create: async row => { if (docs.has(row._id)) throw Object.assign(Error('duplicate'), { code: 11000 }); docs.set(row._id, structuredClone(row)); },
        findOneAndUpdate: (q, u) => { const d = docs.get(q._id); let result = null;
            if (d && q.state.$in.includes(d.state) && +new Date(d.nextAttemptAt) <= +q.nextAttemptAt.$lte && (!d.leaseUntil || +new Date(d.leaseUntil) <= +now)) {
                assign(d,u.$set);d.attempts += u.$inc.attempts;result=structuredClone(d);
            } return { lean: async () => result }; },
        updateOne: async (q,u) => { const d=docs.get(q._id);if(!d || q.leaseToken && q.leaseToken!==d.leaseToken || q.state && q.state!==d.state)return {matchedCount:0};assign(d,u.$set);if(u.$push?.history)d.history.push(u.$push.history);return {matchedCount:1}; }
    };
    const Orders = { updateOne: async (q,u) => { changes.push({q,u});return {matchedCount:1}; } };
    return { Ledger, Orders, docs, changes };
}
test('confirmation persists Purchase intention without requiring any Dropi receipt', () => {
    const o=order();assert.equal(preparePurchaseIntentV254(o,{transition:true,now}),true);assert.equal(o.purchaseDeliveryV254.state,'pending');assert.equal(o.dropiOrderId,undefined);
    assert.equal(preparePurchaseIntentV254(o,{transition:true,now}),false);
});
test('each repurchase has a separate intention even when the customer is the same', () => {
    const a=order('EC-FIRST-V254'),b=order('EC-RECOMPRA-V254');preparePurchaseIntentV254(a,{transition:true,now});preparePurchaseIntentV254(b,{transition:true,now});assert.notEqual(a.purchaseDeliveryV254.ledgerId,b.purchaseDeliveryV254.ledgerId);
});
test('draft, QA, unknown product and old confirmations cannot create new intentions', () => {
    for(const o of [{...order(),status:'draft'},{...order(),customer:{phone:'5515998038637'}},{...order(),tracking:{}},{...order(),confirmedAt:'2026-11-18T12:00:00Z'}])assert.equal(preparePurchaseIntentV254(o,{transition:true,now}),false);
});
test('HTTP 200 and ok true without provider acceptance do not mark Purchase accepted', () => {
    assert.equal(purchaseOutcomeV254({ok:true,status:200,response:{events_received:0}},now).state,'blocked');
    assert.equal(purchaseOutcomeV254({ok:true,dryRun:true,response:{events_received:1}},now).state,'blocked');
    assert.equal(purchaseOutcomeV254({ok:true,response:{events_received:1}},now).state,'accepted');
});
test('uncertain dispatched outcomes are not automatically retried', () => {
    assert.equal(purchaseOutcomeV254({ok:false,dispatched:true,error:'timeout'},now).state,'ambiguous');
    assert.equal(purchaseOutcomeV254({ok:false,dispatched:true,status:503},now).state,'ambiguous');
    assert.equal(purchaseOutcomeV254({ok:false,retryablePreflight:true},now).state,'retry_wait');
    assert.equal(purchaseOutcomeV254({ok:false,status:429},now).nextAttemptAt.toISOString(),'2026-11-19T12:00:30.000Z');
});
test('two concurrent workers send one Purchase and preserve original occurrence time', async () => {
    const f=fixture(),o=order();preparePurchaseIntentV254(o,{transition:true,now});let calls=0;
    const sender=async(target,options)=>{calls++;assert.equal(+new Date(options.eventTime),+now);await options.deliveryV254.beforeDispatch({payload:{data:[{event_id:o.orderId}]},eventId:o.orderId,datasetId:'920532663934291'});return {ok:true,eventId:o.orderId,datasetId:'920532663934291',response:{events_received:1,fbtrace_id:'fixture'}};};
    const args={order:o,...f,sender,destination:{pixelId:'920532663934291',route:'country_ec_default'},now};await Promise.all([deliverPurchaseV254(args),deliverPurchaseV254(args)]);assert.equal(calls,1);assert.equal(f.docs.get(purchaseLedgerIdV254(o.orderId)).state,'accepted');assert.ok(f.changes.some(x=>x.u.$set['tracking.metaPurchaseSentAt']));
    await deliverPurchaseV254(args);assert.equal(calls,1);
});
test('a persisted acceptance repairs a missing Order projection without another provider call', async () => {
    const f=fixture(),o=order();preparePurchaseIntentV254(o,{transition:true,now});let calls=0;const args={order:o,...f,destination:{pixelId:'920532663934291'},now,sender:async()=>{calls++;return{ok:true,response:{events_received:1},eventId:o.orderId,datasetId:'920532663934291'};}};
    await deliverPurchaseV254(args);f.changes.length=0;await deliverPurchaseV254(args);assert.equal(calls,1);assert.ok(f.changes[0].u.$set['tracking.metaPurchaseSentAt']);
});
test('events outside the API window expire without replacing their date or sending', async () => {
    const f=fixture(),o=order();preparePurchaseIntentV254(o,{transition:true,now});let calls=0;const result=await deliverPurchaseV254({order:o,...f,sender:async()=>{calls++;},destination:{pixelId:'920532663934291'},now:new Date('2026-11-27T12:00:00Z')});assert.equal(result.state,'expired');assert.equal(calls,0);assert.equal(f.changes[0].u.$set['purchaseDeliveryV254.state'],'expired');
});
test('old sent timestamps without an acceptance receipt are kept uncertain rather than replayed', async () => {
    const f=fixture(),o=order();o.tracking.metaPurchaseSentAt=now;preparePurchaseIntentV254(o,{transition:true,now});let calls=0;const result=await deliverPurchaseV254({order:o,...f,sender:async()=>{calls++;},destination:{pixelId:'920532663934291'},now});assert.equal(result.state,'ambiguous');assert.equal(calls,0);
});
test('Purchase capability cannot write human holds, create orders, remove ledgers or send WhatsApp', async () => {
    const o=order();await withIntegrationScopeV254({kind:'purchase',orderId:o.orderId,orderObjectId:o._id,ledgerId:purchaseLedgerIdV254(o.orderId)},async()=>{
        assert.equal(integrationExternalAllowedV254('meta_purchase'),true);for(const effect of ['dropi','zapi_outbound_reply','media'])assert.equal(integrationExternalAllowedV254(effect),false);
        assert.equal(integrationMongoAllowedV254('orders','updateOne',[{_id:o._id},{$set:{'tracking.metaPurchaseSentAt':now}}]),true);
        for(const [c,m,args]of [['orders','insertOne',[o]],['contactstates','updateOne',[{phoneDigits:'593990000254'},{$set:{'human.mode':'auto'}}]],['metapurchasedeliveriesv254','deleteOne',[{_id:purchaseLedgerIdV254(o.orderId)}]],['orders','updateOne',[{_id:'another'},{$set:{'tracking.metaPurchaseSentAt':now}}]]])assert.equal(integrationMongoAllowedV254(c,m,args),false);
    });
});

test('a thrown error after the durable dispatch reservation remains uncertain',async()=>{const f=fixture(),o=order();preparePurchaseIntentV254(o,{transition:true,now});const result=await deliverPurchaseV254({order:o,...f,destination:{pixelId:'920532663934291'},now,sender:async(target,options)=>{await options.deliveryV254.beforeDispatch({payload:{data:[]},eventId:o.orderId,datasetId:'920532663934291'});throw Error('connection_closed');}});assert.equal(result.state,'ambiguous');});
test('recovery scopes cannot broaden updates to multiple records or send Purchase',async()=>{const o=order();await withIntegrationScopeV254({kind:'dropi_recovery',orderId:o.orderId,orderObjectId:o._id,shipmentId:'shipment',phone:'593990000254',proofNoCreate:true},async()=>{assert.equal(integrationExternalAllowedV254('meta_purchase'),false);assert.equal(integrationMongoAllowedV254('orders','updateMany',[{orderId:o.orderId},{$set:{status:'processing'}}]),false);assert.equal(integrationMongoAllowedV254('orders','updateOne',[{orderId:o.orderId},{$set:{'human.mode':'auto'}}]),false);});});


test('only proof before creation enables automatic Dropi retry',async()=>{const {dropiFailureStateV254}=await import('../src/services/dropiRecoveryV254Service.js');assert.equal(dropiFailureStateV254({errorCode:'AUTH_FAILED',lifecycle:{operation:'quote'}}).safeRetry,true);assert.equal(dropiFailureStateV254({errorCode:'AUTH_FAILED',lifecycle:{operation:'list'}}).safeRetry,false);assert.equal(dropiFailureStateV254({errorCode:'AUTH_FAILED',lifecycle:{operation:'create',requestDispatched:true}}).state,'verifying_confirmation');assert.equal(dropiFailureStateV254({errorCode:'AUTH_FAILED',lifecycle:{operation:'create',requestDispatched:false}}).safeRetry,true);});

test('a prior purchase receipt cannot satisfy or pin the new repurchase event',async()=>{const f=fixture(),o=order('EC-RECOMPRA-RECEIPT-V254');o.previousOrderId='EC-PREVIOUS-V254';o.tracking={productKey:'tex_ultra_ec',metaPurchaseSentAt:new Date(+now-60000),metaPurchaseEventId:o.previousOrderId,metaPurchaseDatasetId:'OLD-DATASET',metaPurchaseResponse:{events_received:1}};const before=structuredClone(o.tracking);assert.equal(preparePurchaseIntentV254(o,{transition:true,now}),true);assert.equal(o.purchaseDeliveryV254.state,'pending');let calls=0;await deliverPurchaseV254({order:o,...f,now,destination:{pixelId:'920532663934291',eventId:o.orderId},sender:async(target,options)=>{calls++;assert.equal(options.deliveryV254.eventId,o.orderId);assert.equal(options.deliveryV254.datasetId,'920532663934291');await options.deliveryV254.beforeDispatch({payload:{data:[]},eventId:o.orderId,datasetId:'920532663934291'});return{ok:true,eventId:o.orderId,datasetId:'920532663934291',response:{events_received:1}};}});assert.equal(calls,1);const row=f.docs.get(purchaseLedgerIdV254(o.orderId));assert.equal(row.state,'accepted');assert.equal(row.history[0].eventId,o.previousOrderId);assert.deepEqual(o.tracking,before);});
test('unknown product identifiers are ineligible and all three official products persist intentions',()=>{assert.equal(preparePurchaseIntentV254({...order(),tracking:{productKey:'unknown'}},{transition:true,now}),false);for(const productKey of ['tex_ultra_ec','vit_power_ec','nitrix_ec']){const o=order();o.tracking.productKey=productKey;assert.equal(preparePurchaseIntentV254(o,{transition:true,now}),true);}});

test('manual Purchase never submits the operator IP or user agent as customer browser context',async t=>{let buildPurchaseEventPayloadForOrder;try{({buildPurchaseEventPayloadForOrder}=await import('../src/services/metaConversionsService.js'));}catch(e){if(e.code==='ERR_MODULE_NOT_FOUND'&&process.platform==='win32')return t.skip('Full dependency test executes on isolated Linux release');throw e;}const o=order();o.source='manual';o.customer.name='Carlos Perez';o.tracking={...o.tracking,ip:'203.0.113.254',userAgent:'Operator fixture browser'};const r=buildPurchaseEventPayloadForOrder(o,{eventTime:now});assert.equal(r.ok,true);assert.equal(r.payload.data[0].user_data.client_ip_address,undefined);assert.equal(r.payload.data[0].user_data.client_user_agent,undefined);const verified={...o,tracking:{...o.tracking,clientContextSource:'client_browser_direct'}};const v=buildPurchaseEventPayloadForOrder(verified,{eventTime:now});assert.equal(v.ok,true);assert.equal(v.payload.data[0].user_data.client_ip_address,'203.0.113.254');assert.equal(v.payload.data[0].user_data.client_user_agent,'Operator fixture browser');});

test('one unresolved purchase destination does not starve an independent valid purchase',async t=>{let processPurchaseBatchV254;try{({processPurchaseBatchV254}=await import('../src/services/orderIntegrationWorkerV254Service.js'));}catch(e){if(e.code==='ERR_MODULE_NOT_FOUND'&&process.platform==='win32')return t.skip('Full dependency test executes on isolated Linux release');throw e;}const sent=[],errors=[];await processPurchaseBatchV254({orders:[{orderId:'EC-BAD'},{orderId:'EC-VALID'},{orderId:'EC-NEXT'}],destination:async o=>{if(o.orderId==='EC-BAD')throw Error('owned_destination_not_ready');return{pixelId:'unchanged'};},deliver:async(o,d)=>{sent.push(o.orderId);assert.equal(d.pixelId,'unchanged');return{state:'accepted'};},onError:async(o,e)=>errors.push([o.orderId,e.message])});assert.deepEqual(sent,['EC-VALID']);assert.deepEqual(errors,[['EC-BAD','owned_destination_not_ready']]);});
