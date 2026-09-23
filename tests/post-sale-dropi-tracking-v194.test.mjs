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
