import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGiraClient} from '../src/services/gira21x/client.mjs';
import {validateClaim,giraOrderDocument,officialShipmentEvidence,isGiraOrder} from '../src/services/gira21x/contract.mjs';
import {runGiraCycle} from '../src/services/gira21x/cycle.mjs';
import {createGiraNotifier} from '../src/services/gira21x/notice.mjs';
import {bridgeHash,verifyVitalismenRequest} from '../src/services/gira21x/protocol.mjs';
const now=()=>Date.parse('2026-11-09T15:00:00Z'),secret='synthetic-secret-not-a-production-key-12345',keyId='synthetic-v1';
const payload=()=>({schemaVersion:1,sourceSystem:'GIRA21X',country:'EC',gira21xOrderId:'g21cod_order_'+'a'.repeat(28),offerId:'OFFER_INICIO_X1_HYB',offerVersion:1,program:'Inicio 21X',sku:'SKU_VIT_POWERS',component:'Vit Power',quantity:1,amountMinor:3999,currency:'USD',paymentMode:'CON_RECAUDO',customer:{name:'Cliente Sintético',phone:'+593999999999'},destination:{cantonName:'Guayaquil',provinceName:'Guayas'},delivery:{mode:'home',address:'Calle sintética 123',reference:'Parque sintético'},whatsappConsent:true,parentOrderId:null});
const claim=()=>{const order=payload();return {order,payloadHash:bridgeHash(JSON.stringify(order)),leaseToken:'synthetic-lease'};};
function memory(){const events=new Map(),notices=new Map(),drafts=new Map(),orders=new Map(),cycles=new Set();return {events,notices,orders,
 async reserveEvent(id,raw,hash){if(!events.has(id))events.set(id,{raw,hash});return {...events.get(id)};},async markEventAttempted(id){events.get(id).attempted=true;},async finishEvent(id,result){events.get(id).result=result;},
 async reserveCycle(id){if(cycles.has(id))return false;cycles.add(id);return true;},async pendingEvents(){return [...events.values()].filter(r=>!r.result).map(r=>JSON.parse(r.raw));},
 async stableEvent(e){if(!drafts.has(e.eventId))drafts.set(e.eventId,structuredClone(e));return structuredClone(drafts.get(e.eventId));},
 async importOrder(p,h){const doc=giraOrderDocument(p,h,new Date(now()));if(!orders.has(doc.orderId))orders.set(doc.orderId,doc);return orders.get(doc.orderId);},
 async activeOrders(){return [];},async markPolled(){},async observeReceipt(){},async findOrder(id){return orders.get(id);},
 async notice(id){return notices.get(id);},async reserveNotice(id,row){const won=!notices.has(id);if(won)notices.set(id,{...row,state:'INTENDED'});return {won,row:notices.get(id)};},async finishNotice(id,result){notices.get(id).result=result;}};}
test('claim preserves GIRA snapshot and never native tariff or funnel',()=>{const item=claim(),o=validateClaim(item),doc=giraOrderDocument(o,item.payloadHash);assert.equal(doc.total,39.99);assert.equal(doc.package.quantity,1);assert.equal(doc.integration.purchaseOwner,'GIRA21X');assert.equal(doc.integration.dispatch,'MANUAL_ONLY');assert.equal(isGiraOrder(doc),true);assert.equal(doc.tracking.funnel,undefined);assert.equal(doc.customer.email,undefined);assert.equal(doc.integration.program,o.program);});
test('tampered, foreign, wrong quantity or unsupported component claim rejected',()=>{for(const change of [o=>o.sourceSystem='OTHER',o=>o.quantity=6,o=>o.sku='OTHER',o=>o.amountMinor=-1]){const item=claim();change(item.order);item.payloadHash=bridgeHash(JSON.stringify(item.order));assert.throws(()=>validateClaim(item));}const item=claim();item.order.amountMinor++;assert.throws(()=>validateClaim(item));});
test('official evidence requires exact independent guide, COD amount, identity and currency',()=>{const item=claim(),order={...giraOrderDocument(item.order,item.payloadHash),trackingNumber:'GUIDE-123',dropiOrderId:'123'};
 const carrier={ok:true,carrier:'servientrega',requestedGuide:'GUIDE-123',observedGuide:'GUIDE-123',source:'carrier_tracking',providerStatus:'ENTREGADO'},dropi={source:'dropi_orders_api',dropiOrderId:'123',trackingNumber:'GUIDE-123',paymentMode:'CON_RECAUDO',amountMinor:3999,currency:'USD',internalOrderId:order.orderId,productKey:'vit_power_ec',quantity:1};
 assert.equal(officialShipmentEvidence({order,carrier,dropi,now:now()}).status,'DELIVERED');
 for(const c of [{...carrier,observedGuide:''},{...carrier,observedGuide:'OTHER'},{...carrier,source:'panel'}])assert.throws(()=>officialShipmentEvidence({order,carrier:c,dropi}));
 for(const d of [{...dropi,paymentMode:'PREPAID'},{...dropi,amountMinor:999},{...dropi,currency:null},{...dropi,internalOrderId:'OTHER'}])assert.throws(()=>officialShipmentEvidence({order,carrier,dropi:d}));
 assert.equal(officialShipmentEvidence({order,carrier:{...carrier,providerStatus:'INGRESANDO EN AGENCIA'},dropi}).status,'ENTERING_AGENCY');assert.equal(officialShipmentEvidence({order,carrier:{...carrier,providerStatus:'ENTREGADO AL REMITENTE'},dropi}).status,'RETURNED');});
test('timeout after remote commit queries immutable receipt instead of resending',async()=>{const store=memory(),paths=[],event={eventId:'synthetic-event',eventType:'ORDER_ACCEPTED'},hash=bridgeHash(JSON.stringify(event));let accepted=0;
 const client=createGiraClient({origin:'https://gira21x.invalid',secret,keyId,store,clock:now,transport:async(url,init)=>{paths.push(new URL(url).pathname);await verifyVitalismenRequest(new Request(url,init),{secret,keyId,now:now()});if(init.method==='POST'){accepted++;throw Error('TIMEOUT_AFTER_COMMIT');}return Response.json({payloadHash:hash,result:{accepted:true}});}});
 await assert.rejects(()=>client.event(event));assert.equal((await client.event(event)).accepted,true);assert.equal(accepted,1);assert.equal(paths[1],'/api/integrations/vitalismen/events/synthetic-event');assert.equal((await client.event(event)).accepted,true);assert.equal(paths.length,2);});
test('conflicting remote receipt is held without another POST',async()=>{const store=memory();const event={eventId:'synthetic-conflict'};await store.reserveEvent(event.eventId,JSON.stringify(event),bridgeHash(JSON.stringify(event)));await store.markEventAttempted(event.eventId);
 const client=createGiraClient({origin:'https://gira21x.invalid',secret,keyId,store,clock:now,transport:async()=>Response.json({payloadHash:'different',result:{accepted:true}})});await assert.rejects(()=>client.event(event),/CONFLICT/);});
test('batch duplicate and uncertain acceptance import one order only',async()=>{const store=memory(),item=claim();let acknowledgements=0;const client={claim:async()=>({items:[item]}),event:async()=>{acknowledgements++;return {accepted:true};}};
 for(let i=0;i<2;i++)await runGiraCycle({enabled:true,store,client,collect:async()=>null,notify:async()=>null,clock:()=>now()+i*60000});assert.equal(store.orders.size,1);assert.equal(acknowledgements,2);assert.equal((await runGiraCycle({enabled:true,store,client,clock:()=>now()+60000})).status,'ALREADY_RUNNING');});
test('OFF means no queue, database, carrier or transport invocation',async()=>{assert.deepEqual(await runGiraCycle({}),{status:'DISABLED',claimed:0});});
test('automatic/manual notification race, timeout and restart do not resend',async()=>{const store=memory(),item=claim(),order=giraOrderDocument(item.order,item.payloadHash);let sends=0;
 const make=()=>createGiraNotifier({store,windowOpen:()=>true,history:async()=>false,send:async()=>{sends++;throw Error('PROVIDER_TIMEOUT');}});
 await Promise.all([make()(order,'DELIVERED',true),make()(order,'DIGITAL_AVAILABLE',true)]);assert.equal(sends,1);assert.equal((await make()(order,'DIGITAL_AVAILABLE',true)).status,'UNCERTAIN');assert.equal(sends,1);});
test('opt-out, window and unsupported milestones do not send; success receipt persists',async()=>{const store=memory(),item=claim(),order=giraOrderDocument(item.order,item.payloadHash);let sends=0;
 const make=open=>createGiraNotifier({store,windowOpen:()=>open,history:async()=>false,send:async()=>{sends++;return {ok:true,providerMessageId:'native-synthetic-id'};}});
 assert.equal((await make(true)({...order,integration:{...order.integration,whatsappConsent:false}},'DIGITAL_AVAILABLE',true)).status,'SUPPRESSED');assert.equal(await make(false)(order,'DIGITAL_AVAILABLE',true),null);assert.equal(await make(true)(order,'ENTERING_AGENCY',false),null);
 assert.equal((await make(true)(order,'DIGITAL_AVAILABLE',true)).status,'SENT');assert.equal((await make(false)(order,'DIGITAL_AVAILABLE',true)).status,'SENT');assert.equal(sends,1);});
test('native source hooks retain normal transport guards, manual Dropi and per-origin Purchase suppression',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');for(const kind of ['Text','Audio','Image','Video','Document']){const s=read('src/whatsapp/send'+kind+'.js');assert.match(s,/giraOutboundAllowed/);assert.match(s,/canSendOutbound/);assert.match(s,/operatorNoAutoResend/);}
 assert.match(read('src/services/schedulerService.js'),/GIRA21X_BRIDGE_ENABLED',false/);assert.match(read('src/services/metaConversionsService.js'),/if\(isGiraOrder\(order\)\)return.*GIRA21X_OWNS_PURCHASE/);assert.doesNotMatch(read('src/services/gira21x/runtime.mjs'),/submitDroppi|sendPurchaseEvent/);
});

test('human pause defers before reserving any outbound attempt',async()=>{const store=memory(),item=claim(),order=giraOrderDocument(item.order,item.payloadHash);let sends=0;
 const notify=createGiraNotifier({store,windowOpen:()=>true,canSend:async()=>false,history:async()=>false,send:async()=>{sends++;}});
 assert.equal(await notify(order,'DIGITAL_AVAILABLE',true),null);assert.equal(sends,0);assert.equal(store.notices.size,0);
});
