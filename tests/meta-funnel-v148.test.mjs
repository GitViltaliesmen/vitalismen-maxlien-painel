import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { validateVilaliemenProtocoloGContract, protocoloGStructuredTracking } from '../src/services/metaProtocoloGAttributionService.js';
import { selectUniqueVslAttributionCandidate } from '../src/services/metaAttributionBridgeService.js';
import { metaAttributionTrackingFromVisit, enrichOrderWithMetaAttribution } from '../src/services/metaAttributionService.js';
import { recordTexUltraCheckoutV148, checkoutEventIdV148, checkoutCycleV148 } from '../src/services/metaCheckoutV148Service.js';
import { bindPurchaseAttributionV148 } from '../src/services/metaPurchaseV148BindingService.js';
import { metaV148ActivationAt, validateMetaV148Activation, withMetaCheckoutV148 } from '../src/services/metaFunnelV148ContractService.js';
import { buildEcBotCoreV78OverlayEnvironment, EC_BOT_CORE_V78_DATASET_ID } from '../src/services/ecBotCoreOperationalV78Service.js';
import { buildBrowserServerEventPayload, buildPurchaseEventPayloadForOrder, getMetaConfigForOrder, sendBrowserServerEvent } from '../src/services/metaConversionsService.js';
import Order from '../src/models/Order.js';
import MetaBusinessEvent from '../src/models/MetaBusinessEvent.js';
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/meta-funnel-v148-contract.json', import.meta.url)));
const activated = new Date(fixture.attribution_captured_at - 60000);
const clicked = new Date(fixture.attribution_captured_at);
const occurred = new Date(+clicked + 2000);
const now = new Date(+occurred + 2000);
const query = value => ({ lean: async () => structuredClone(value) });
const seven = ['campaign_id','adset_id','ad_id','fbclid','placement','fbc','fbp'];
function harness({ suffix = 'A', organic = false, result = { ok: true, status: 200, response: { events_received: 1 }, datasetId: '1468946114265008' } } = {}) {
    const phone = suffix === 'A' ? '593999999901' : '593999999902';
    const visit = { _id: '68c10000000000000000000'+(suffix === 'A' ? '1' : '2'), country: 'EC', productKey: 'tex_ultra_ec', funnel: 'PROTOCOLO_G',
        tracking: protocoloGStructuredTracking(fixture), externalId: fixture.external_id, visitorId: fixture.visitorId,
        sourceUrl: fixture.event_source_url, userAgent: 'Fixture browser', customerPhone: phone, attributionClaimedAt: clicked,
        lastClickAt: clicked, lastWhatsappMessage: fixture.message, clickCount: 1 };
    if (suffix === 'B') { visit.tracking.ad_id = 'B_TEST'; visit.externalId = visit.visitorId = visit.tracking.external_id = 'VISITOR_TEST_B'; }
    if (organic) for (const key of seven) delete visit.tracking[key];
    const state = { _id: 'CONTACT_'+suffix, countryCode: 'EC', phoneDigits: phone, metadata: {
        vslVisitId: visit._id, vslSourceUrl: fixture.event_source_url, tracking: metaAttributionTrackingFromVisit(visit),
        customerDraft: { productKey: 'tex_ultra_ec', productName: 'Tex Ultra Ecuador', quantity: 3, total: 80.99, name: 'Cliente Fixture' }
    } };
    const message = { _id: 'MESSAGE_'+suffix, isFromMe: false, peerPhone: phone, createdAt: occurred, timestamp: Math.floor(+occurred/1000), body: '3 frascos' };
    const events = new Map(), calls = [], updates = [];
    const models = {
        ContactState: { findById: () => query(state), updateOne: async (filter, update) => {
            for (const [key,value] of Object.entries(update.$set)) { const parts=key.split('.'); let dst=state; for (const part of parts.slice(0,-1)) dst=dst[part] ||= {}; dst[parts.at(-1)]=structuredClone(value); }
            return { modifiedCount: 1 };
        } },
        Message: { findOne: () => query(message) },
        Order: { findOne: () => query({ orderId: 'NEW', createdAt: clicked }) },
        VslVisit: { findById: () => query(visit), updateOne: async (filter, update) => { updates.push(update); Object.assign(visit,update.$set); } },
        MetaBusinessEvent: { create: async item => { if(events.has(item._id)) throw Object.assign(new Error('duplicate'),{code:11000}); events.set(item._id,structuredClone(item)); },
            updateOne: async (filter, update) => Object.assign(events.get(filter._id),update.$set),
            findOneAndUpdate: (filter, update) => {
                const item = events.get(filter._id);
                const match = item && item.customerPhoneSha256 === filter.customerPhoneSha256 && item.attributionSha256 === filter.attributionSha256
                    && item.occurredAt >= filter.occurredAt.$gte && (!item.boundOrderId || item.boundOrderId === update.$set.boundOrderId);
                if (match) Object.assign(item, update.$set);
                return query(match ? item : null);
            }
        }
    };
    const run = extra => recordTexUltraCheckoutV148({ contactStateId: state._id, sourceMessageId: message._id, quantity:3, activationAt:activated, now, models,
        sendEvent: async event => { calls.push(event); if (result instanceof Error) throw result; return result; }, ...extra });
    return { state, visit, message, events, calls, models, run, updates };
}
test('V148 full boundary fixture: seven fields survive claim, checkout, canonical Order and Purchase payload', async () => {
    assert.equal(validateVilaliemenProtocoloGContract(fixture).ok,true);
    const h=harness();
    const selection=selectUniqueVslAttributionCandidate({visits:[h.visit],message:fixture.message,inboundAt:occurred});
    assert.equal(selection.ok,true);
    assert.equal((await h.run()).accepted,true);
    for (const key of seven) assert.equal(h.calls[0][key],fixture[key],key);
    const order=new Order({orderId:'ORDER_A',country:'EC',source:'whatsapp',customer:{phone:h.state.phoneDigits},package:{id:3,quantity:3},total:80.99,currency:'USD',tracking:h.state.metadata.tracking});
    for(const key of seven) assert.equal(order.tracking[key],fixture[key],key);
    assert.equal((await bindPurchaseAttributionV148(order,{EventModel:h.models.MetaBusinessEvent,activationAt:activated})).ok,true);
    const payload=buildPurchaseEventPayloadForOrder(order).payload.data[0];
    assert.equal(payload.event_name,'Purchase'); assert.equal(payload.user_data.fbc,fixture.fbc); assert.equal(payload.user_data.fbp,fixture.fbp);
    assert.equal(payload.event_id,'ORDER_A');
});
test('V148 two customers, two contexts, no cross customer or cross order binding', async () => {
    const a=harness(),b=harness({suffix:'B'}); await Promise.all([a.run(),b.run()]);
    assert.equal(a.calls[0].ad_id,'A_TEST'); assert.equal(b.calls[0].ad_id,'B_TEST');
    const order={orderId:'ORDER_A',customer:{phone:a.state.phoneDigits},tracking:a.state.metadata.tracking};
    const opts={EventModel:a.models.MetaBusinessEvent,activationAt:activated};
    assert.equal((await bindPurchaseAttributionV148({...order,customer:{phone:b.state.phoneDigits}},opts)).ok,false);
    assert.equal((await bindPurchaseAttributionV148({...order,tracking:{...order.tracking,ad_id:'B_TEST'}},opts)).ok,false);
    assert.equal((await bindPurchaseAttributionV148(order,opts)).ok,true);
    assert.equal((await bindPurchaseAttributionV148(order,opts)).ok,true);
    assert.equal((await bindPurchaseAttributionV148({...order,orderId:'ORDER_B'},opts)).ok,false);
});
test('V148 repeat, retry, second worker and restarted invocation reserve one persistent logical event', async () => {
    const h=harness(); const results=await Promise.all(Array.from({length:12},()=>h.run()));
    assert.equal(h.calls.length,1); assert.equal(h.events.size,1); assert.equal(results.filter(r=>r.accepted).length,1);
    await h.run(); assert.equal(h.calls.length,1);
    assert.equal(MetaBusinessEvent.schema.path('_id').instance,'String');
});
test('V148 no acceptance for HTTP 200 with zero events, timeout or crash; no blind retry', async () => {
    for (const result of [{ok:true,status:200,response:{events_received:0}},new Error('timeout')]) {
        const h=harness({result}); assert.equal((await h.run()).accepted,false); await h.run(); assert.equal(h.calls.length,1);
        assert.equal(h.state.metadata.metaInitiateCheckoutV146.sent,false);
    }
    const h=harness(); const id=checkoutEventIdV148(h.state._id,checkoutCycleV148(h.state));
    h.events.set(id,{_id:id,state:'INTENDED'}); await h.run(); assert.equal(h.calls.length,0);
});
test('V148 historical action, selected quantity, wrong customer and missing activation produce no Meta call', async () => {
    const h=harness(); await h.run({activationAt:null}); await h.run({previousQuantity:3});
    h.message.createdAt=new Date(+activated-1); await h.run();
    h.message.createdAt=occurred; h.message.timestamp=Math.floor((+activated-1000)/1000); await h.run();
    h.message.timestamp=Math.floor(+occurred/1000); h.message.peerPhone='593999999902'; await h.run();
    assert.equal(h.calls.length,0); assert.equal(h.events.size,0); assert.equal(metaV148ActivationAt(),null);
});
test('V148 informational branch cannot pass contract or checkout; page load/click alone have no business trigger', async () => {
    assert.equal(validateVilaliemenProtocoloGContract({...fixture,rendered_branch:'INFORMATIONAL'}).ok,false);
    const h=harness(); h.visit.tracking.renderedBranch='INFORMATIONAL'; await h.run(); assert.equal(h.calls.length,0);
    const fresh=harness(); await fresh.run({sourceMessageId:''}); await fresh.run({quantity:0}); assert.equal(fresh.calls.length,0);
});
test('V148 organic sales context produces checkout with no invented advertising and no phone lookback enrichment', async () => {
    const h=harness({organic:true}); assert.equal(selectUniqueVslAttributionCandidate({visits:[h.visit],message:fixture.message,inboundAt:occurred}).ok,true);
    assert.equal((await h.run()).accepted,true);
    for(const key of seven) assert.equal(h.calls[0][key],undefined);
    const out=await enrichOrderWithMetaAttribution({country:'EC',tracking:h.state.metadata.tracking},{VisitModel:{findOne(){throw new Error('forbidden phone lookback');}}});
    assert.equal(out.reason,'v148_canonical_cycle_context_preserved');
});
test('V148 canonical repurchase id is separate; previous order cannot identify new checkout', () => {
    assert.equal(checkoutCycleV148({_id:'A',metadata:{customerDraft:{previousOrderId:'OLD'}}}), '');
    assert.equal(checkoutCycleV148({_id:'A',metadata:{customerDraft:{previousOrderId:'OLD',currentNegotiationOrderId:'NEW'}}}), 'NEW');
    assert.notEqual(checkoutEventIdV148('A','NEW'),checkoutEventIdV148('A','OLD'));
});
test('V148 actual sender remains blocked without reserved scope; accepted only on provider receipt and existing dataset', async t => {
    const env={...buildEcBotCoreV78OverlayEnvironment({baseEnv:{META_PIXEL_ID_EC:EC_BOT_CORE_V78_DATASET_ID}}),META_PIXEL_ID_EC:EC_BOT_CORE_V78_DATASET_ID,META_ACCESS_TOKEN_EC:'fixture-token'};
    const event={eventName:'InitiateCheckout',event_id:'InitiateCheckout:fixture',country:'EC',measurementVersion:148,phone:'593999999901',content_ids:['tex_ultra_ec'],action_source:'chat'};
    assert.equal((await sendBrowserServerEvent(event,null,{env,dryRun:true})).ok,false);
    let sent=0;
    t.mock.method(axios,'post',async (url,payload) => {sent++; assert.match(url,/1468946114265008\/events$/); assert.equal(payload.data[0].event_name,'InitiateCheckout'); return {status:200,data:{events_received:1}};});
    const run=()=>withMetaCheckoutV148({reserved:true,businessTrigger:'tex_ultra_explicit_quantity',eventId:event.event_id},()=>sendBrowserServerEvent(event,null,{env}));
    assert.equal((await run()).status,200); assert.equal(sent,1);
    t.mock.method(axios,'post',async()=>({status:200,data:{events_received:0}})); assert.equal((await run()).ok,false);
    const built=buildBrowserServerEventPayload({...event,content_ids:undefined});
    assert.equal(built.payload.data[0].action_source,'chat');
    assert.equal(built.payload.data[0].custom_data?.content_ids,undefined);
    const config=getMetaConfigForOrder({country:'EC',tracking:protocoloGStructuredTracking(fixture)},env); assert.equal(config.pixelId,'1468946114265008');
});
test('V148 activation identity mismatch, historical baseline and future timestamp fail closed', () => {
    const source={commit:'a'.repeat(40),functionalCommit:'a'.repeat(40)};
    const activation={commit:source.commit,activatedAt:activated,status:'active_safe_observation_only',healthValidated:true};
    assert.ok(validateMetaV148Activation(activation,source,now));
    assert.equal(validateMetaV148Activation({...activation,commit:'b'.repeat(40)},source,now),null);
    assert.equal(validateMetaV148Activation({...activation,activatedAt:new Date(+now+1)},source,now),null);
});
import { withMetaLedgerV148 } from '../src/services/metaFunnelV148ContractService.js';
import { ecBotCoreMutationRouteGuardV78, installEcBotCoreMongooseGuardV78 } from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';
test('V148 real Mongo guard allows only scoped ledger writes under inbound and retains blanket blocks elsewhere', async () => {
    class FakeCollection { constructor(name){this.collectionName=name;} insertOne(){return 'inserted';} updateOne(){return 'updated';} deleteMany(){return 'deleted';} }
    installEcBotCoreMongooseGuardV78({Collection:FakeCollection,mongo:{Collection:FakeCollection}});
    const env={...buildEcBotCoreV78OverlayEnvironment({baseEnv:{META_PIXEL_ID_EC:EC_BOT_CORE_V78_DATASET_ID}}),META_PIXEL_ID_EC:EC_BOT_CORE_V78_DATASET_ID};
    const previous=new Map(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env);
    const req={method:'POST',originalUrl:'/api/zapi/webhook/received',body:{}};
    const res={status(){return this;},json(v){throw new Error(JSON.stringify(v));}};
    const collection=new FakeCollection('metabusinessevents'), context={phase:'checkout',eventId:'IC_A'};
    try {
        assert.throws(()=>collection.insertOne({_id:'IC_A'}),/mongo_write_blocked/);
        await assert.rejects(()=>ecBotCoreMutationRouteGuardV78(req,res,()=>collection.insertOne({_id:'IC_A'})),/mongo_write_blocked/);
        const run=callback=>ecBotCoreMutationRouteGuardV78(req,res,()=>withMetaLedgerV148(context,callback));
        assert.equal(await run(()=>collection.insertOne({_id:'IC_A'})),'inserted');
        assert.equal(await run(()=>collection.updateOne({_id:'IC_A'})),'updated');
        assert.equal(await run(()=>({ then(resolve,reject){ queueMicrotask(()=>{try{resolve(collection.updateOne({_id:'IC_A'}));}catch(e){reject(e);}}); } })), 'updated');
        await assert.rejects(()=>run(()=>collection.insertOne({_id:'IC_B'})),/mongo_write_blocked/);
        await assert.rejects(()=>run(()=>collection.deleteMany({_id:'IC_A'})),/mongo_write_blocked/);
        await assert.rejects(()=>run(()=>new FakeCollection('orders').insertOne({_id:'IC_A'})),/mongo_write_blocked/);
    } finally {for(const [k,v] of previous)if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test('V148 organic repurchase uses its new business cycle and never copies the previous order attribution', async () => {
 const h=harness();h.state.metadata.customerDraft.previousOrderId='OLD';h.state.metadata.customerDraft.currentNegotiationOrderId='NEW';
 h.visit.metaInitiateCheckoutEventId='InitiateCheckout:OLD';
 assert.equal((await h.run({previousQuantity:3})).accepted,true);
 for(const key of seven)assert.equal(h.calls[0][key],undefined);
 assert.equal(h.calls[0].action_source,'chat');assert.equal(h.calls[0].event_source_url,undefined);
 assert.equal(h.state.metadata.tracking.ad_id,undefined);
});

test('V148 preactivation repurchase cannot be relabeled as a forward checkout',async()=>{
 const h=harness();h.state.metadata.customerDraft.previousOrderId='OLD';h.state.metadata.customerDraft.currentNegotiationOrderId='NEW';
 h.models.Order.findOne=()=>query({orderId:'NEW',createdAt:new Date(+activated-1)});
 assert.equal((await h.run()).reason,'repurchase_cycle_not_forward');assert.equal(h.calls.length,0);
});
