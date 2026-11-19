import test from 'node:test';
import assert from 'node:assert/strict';

import {
    POST_SALE_DROPI_TRACKING_V194_STATES,
    classifyDropiTrackingResultV194,
    processDropiTrackingReconciliationV194
} from '../src/services/postSaleDropiTrackingReconcilerV194Service.js';
import {
    isPostSaleV194ForwardOnlyEligible,
    processForwardLogisticsStageV194
} from '../src/services/postSaleForwardOnlyV194Service.js';
import { POST_SALE_STAGES } from '../src/services/postSaleSafetyV66Service.js';

const cutoff = new Date('2026-09-20T16:00:00.000Z');
const baseShipment = (overrides = {}) => ({
    _id: 'shipment-v194-1',
    orderId: 'EC-V194-1',
    country: 'EC',
    provider: 'droppi',
    productName: 'Tex Ultra Ecuador',
    createdAt: new Date('2026-09-20T16:05:00.000Z'),
    updatedAt: new Date('2026-09-20T16:06:00.000Z'),
    client: { phone: '+593999111222', name: 'Cliente QA' },
    logistics: { status: 'PENDIENTE', canonicalStatus: 'UNKNOWN', trackingNumber: '', distributionCompany: '' },
    automation: { submittedToDroppiAt: new Date('2026-09-20T16:05:00.000Z'), guiaNotifiedAt: null },
    review: { manualOnly: false },
    outcomes: {},
    raw: { latestDroppiPayload: { dropiOrderId: '7000123' } },
    ...overrides
});

const row = (overrides = {}) => ({
    dropiOrderId: '7000123',
    phone: '0999111222',
    productKey: 'tex_ultra_ec',
    productName: 'Tex Ultra Ecuador',
    status: 'GUIA_GENERADA',
    trackingNumber: '1897000123',
    distributionCompany: 'SERVIENTREGA',
    ...overrides
});

test('V194 vincula somente Dropi order ID exato e encontra a guia', () => {
    const result = classifyDropiTrackingResultV194({ shipment: baseShipment(), rows: [row()] });
    assert.equal(result.state, POST_SALE_DROPI_TRACKING_V194_STATES.TRACKING_FOUND);
    assert.equal(result.trackingNumber, '1897000123');
    assert.ok(result.changedFields.includes('logistics.trackingNumber'));
});

test('V194 classifica os cinco resultados autorizados sem fallback por aproximação', () => {
    assert.equal(classifyDropiTrackingResultV194({ shipment: baseShipment(), rows: [row({ trackingNumber: '' })] }).state,
        POST_SALE_DROPI_TRACKING_V194_STATES.DROPI_STILL_WITHOUT_TRACKING);
    assert.equal(classifyDropiTrackingResultV194({ shipment: baseShipment(), rows: [] }).state,
        POST_SALE_DROPI_TRACKING_V194_STATES.ORDER_NOT_FOUND);
    assert.equal(classifyDropiTrackingResultV194({ shipment: baseShipment(), rows: [row(), row()] }).state,
        POST_SALE_DROPI_TRACKING_V194_STATES.AMBIGUOUS_LINK);
    assert.equal(classifyDropiTrackingResultV194({ shipment: baseShipment({ productName: 'Produto EC nao configurado' }), rows: [row()] }).state,
        POST_SALE_DROPI_TRACKING_V194_STATES.MANUAL_REVIEW);
    assert.equal(classifyDropiTrackingResultV194({ shipment: baseShipment(), rows: [row({ phone: '0999000000' })] }).state,
        POST_SALE_DROPI_TRACKING_V194_STATES.AMBIGUOUS_LINK);
});

test('V194 dry-run classifica sem escrever Shipment', async () => {
    let writes = 0;
    const model = {
        find: () => ({
            sort: () => ({
                limit: async () => [baseShipment()]
            })
        }),
        findOneAndUpdate: async () => { writes += 1; },
        updateOne: async () => { writes += 1; }
    };
    const report = await processDropiTrackingReconciliationV194({
        forwardOnlySince: cutoff,
        dryRun: true,
        shipmentModel: model,
        fetchRowsFn: async ({ search }) => ({ rows: search === '7000123' ? [row()] : [] })
    });
    assert.equal(report.processed, 1);
    assert.equal(report.classifications.TRACKING_FOUND, 1);
    assert.equal(report.applied, 0);
    assert.equal(writes, 0);
});

test('V194 apply limita a mutação a Shipment local e marca no-replay histórico', async () => {
    const historical = baseShipment({ createdAt: new Date('2026-09-18T10:00:00.000Z') });
    const updates = [];
    const model = {
        find: () => ({ sort: () => ({ limit: async () => [historical] }) }),
        findOneAndUpdate: async (query, update) => ({
            ...historical,
            raw: {
                ...historical.raw,
                postSaleV194DropiSync: {
                    lockToken: update.$set['raw.postSaleV194DropiSync.lockToken'],
                    lockedUntil: update.$set['raw.postSaleV194DropiSync.lockedUntil']
                }
            }
        }),
        updateOne: async (query, update) => {
            updates.push({ query, update });
            return { modifiedCount: 1 };
        }
    };
    const report = await processDropiTrackingReconciliationV194({
        forwardOnlySince: cutoff,
        dryRun: false,
        shipmentModel: model,
        fetchRowsFn: async () => ({ rows: [row()] })
    });
    assert.equal(report.applied, 1);
    assert.equal(updates.length, 1);
    const set = updates[0].update.$set;
    assert.equal(set['logistics.trackingNumber'], '1897000123');
    assert.equal(set['raw.postSaleV194DropiSync.historicalNoReplay'], true);
    assert.equal(Object.keys(set).some((key) => /address|price|productName|recipient|meta/i.test(key)), false);
});

test('forward-only bloqueia guia histórica e entrega histórica', () => {
    const historical = baseShipment({
        createdAt: new Date('2026-09-18T10:00:00.000Z'),
        logistics: { canonicalEvidence: { observedAt: new Date('2026-09-18T11:00:00.000Z') } }
    });
    assert.equal(isPostSaleV194ForwardOnlyEligible({
        shipment: historical,
        stage: POST_SALE_STAGES.GUIDE,
        forwardOnlySince: cutoff
    }), false);
    assert.equal(isPostSaleV194ForwardOnlyEligible({
        shipment: historical,
        stage: POST_SALE_STAGES.DELIVERED_THANK_YOU,
        forwardOnlySince: cutoff
    }), false);
});

test('forward-only permite evento logístico novo e seleciona no máximo um envio físico', async () => {
    const current = baseShipment({
        logistics: {
            status: 'EN_RUTA',
            canonicalStatus: 'IN_TRANSIT',
            canonicalEvidence: { observedAt: new Date('2026-09-20T16:10:00.000Z') },
            trackingNumber: '1897000123'
        },
        automation: { submittedToDroppiAt: cutoff, inTransitNotifiedAt: null }
    });
    const model = {
        find: (query) => ({
            sort: () => ({
                limit: async () => query['logistics.status']?.$in?.includes('EN_RUTA') ? [current] : []
            })
        })
    };
    let physicalSends = 0;
    const report = await processForwardLogisticsStageV194({
        forwardOnlySince: cutoff,
        dryRun: false,
        shipmentModel: model,
        notifyFns: {
            in_transit: async () => { physicalSends += 1; return true; }
        }
    });
    assert.equal(report.sent, 1);
    assert.equal(report.physicalSendLimit, 1);
    assert.equal(physicalSends, 1);
});


test('V252 Dropi terminal statuses retain carrier polling and never invent delivered evidence', async () => {
 for (const status of ['ENTREGADO','DEVUELTO','CANCELADO']) {
  const shipment=baseShipment({logistics:{status:'EN_TRANSITO',canonicalStatus:'IN_TRANSIT',trackingNumber:'1897000123',distributionCompany:'SERVIENTREGA'}}),updates=[];
  const model={find:()=>({sort:()=>({limit:async()=>[shipment]})}),findOneAndUpdate:async(query,update)=>({...shipment,raw:{...shipment.raw,postSaleV194DropiSync:{lockToken:update.$set['raw.postSaleV194DropiSync.lockToken']}}}),updateOne:async(query,update)=>{updates.push(update.$set);return{modifiedCount:1}}};
  const report=await processDropiTrackingReconciliationV194({forwardOnlySince:cutoff,dryRun:false,shipmentModel:model,fetchRowsFn:async()=>({rows:[row({status})]})});
  assert.equal(report.applied,1,status);const set=updates[0];assert.equal(set['logistics.status'],'EN_TRANSITO');assert.equal(set['raw.latestDroppiPayload.dropiStatus'],status);assert.equal(set['raw.postSaleV194DropiSync.terminalDeferredToCarrier'],true);assert.equal(set['logistics.canonicalStatus'],undefined);assert.equal(set['logistics.terminal'],undefined);assert.equal(set['outcomes.delivered'],undefined);assert.equal(set['automation.deliveredConfirmedAt'],undefined);
 }
});


test('V252 pickup executor selects both already-authorized proof sources without sending in dry-run', async () => {
 const queries=[];const model={find:query=>{queries.push(query);return{sort:()=>({limit:async()=>[]})}}};const report=await processForwardLogisticsStageV194({forwardOnlySince:cutoff,dryRun:true,shipmentModel:model});assert.equal(report.sent,0);const pickup=queries.find(q=>q['logistics.status']==='READY_FOR_PICKUP');assert.deepEqual(pickup['logistics.pickupReadyVerifiedSource'],{$in:['carrier_tracking','dropi_orders_api']});assert.equal(pickup['logistics.pickupReadyVerified'],true);assert.equal(pickup['logistics.canonicalStatus'],'READY_FOR_PICKUP');assert.equal(pickup['logistics.agencyPickup'],true);
});


test('V252 terminal Dropi observation blocks stale messages until later carrier completion proof', () => {
 const shipment=baseShipment({raw:{postSaleV194DropiSync:{terminalDeferredToCarrier:true,lastSyncAt:new Date('2026-09-20T17:00:00Z'),trackingRecoveredAt:new Date('2026-09-20T17:00:00Z')}},logistics:{canonicalStatus:'IN_TRANSIT',lastStatusAt:new Date('2026-09-20T17:00:00Z'),canonicalEvidence:{provider:'dropi',source:'dropi_orders_api',observedAt:new Date('2026-09-20T17:00:00Z')}}});
 for(const stage of [POST_SALE_STAGES.GUIDE,POST_SALE_STAGES.IN_TRANSIT,POST_SALE_STAGES.READY_FOR_PICKUP,POST_SALE_STAGES.DELIVERED_THANK_YOU])assert.equal(isPostSaleV194ForwardOnlyEligible({shipment,stage,forwardOnlySince:cutoff}),false,stage);
 shipment.logistics.canonicalStatus='DELIVERED';shipment.logistics.canonicalEvidence={provider:'servientrega',source:'carrier_tracking',observedAt:new Date('2026-09-20T17:05:00Z')};assert.equal(isPostSaleV194ForwardOnlyEligible({shipment,stage:POST_SALE_STAGES.DELIVERED_THANK_YOU,forwardOnlySince:cutoff}),true);assert.equal(isPostSaleV194ForwardOnlyEligible({shipment,stage:POST_SALE_STAGES.GUIDE,forwardOnlySince:cutoff}),false);shipment.logistics.canonicalEvidence.observedAt=new Date('2026-09-20T16:59:00Z');assert.equal(isPostSaleV194ForwardOnlyEligible({shipment,stage:POST_SALE_STAGES.DELIVERED_THANK_YOU,forwardOnlySince:cutoff}),false);
});
