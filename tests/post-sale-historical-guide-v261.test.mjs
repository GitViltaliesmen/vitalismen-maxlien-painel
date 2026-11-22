import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { shipmentHasAuthoritativeDropiPickupReleaseV168B } from '../src/services/dropiPickupReleaseV168BService.js';

const source = fs.readFileSync(new URL('../src/services/postSaleForwardOnlyV194Service.js', import.meta.url), 'utf8');
const pure = source.slice(source.indexOf('const clean ='), source.indexOf('const LOGISTICS_ACTIONS'))
    .replaceAll('export const ', 'const ')
    + '\nglobalThis.policy = { isPostSaleV194ForwardOnlyEligible, postSaleV194StageAnchor };';
const sandbox = { POST_SALE_STAGES: { GUIDE: 'GUIDE', IN_TRANSIT: 'IN_TRANSIT', READY_FOR_PICKUP: 'READY_FOR_PICKUP',
    DELIVERED_THANK_YOU: 'DELIVERED_THANK_YOU', PICKUP_BONUS: 'PICKUP_BONUS', PRODUCT_USAGE: 'PRODUCT_USAGE',
    TREATMENT_REFILL_REMINDER: 'TREATMENT_REFILL_REMINDER', RETURNED: 'RETURNED' },
    shipmentHasAuthoritativeDropiPickupReleaseV168B };
vm.runInNewContext(pure, sandbox);
const { isPostSaleV194ForwardOnlyEligible: eligible } = sandbox.policy;
const cutoff = new Date(Date.now() - (30 * 60 * 1000));
const oldGuide = () => ({
    createdAt: new Date(cutoff.getTime() + 60_000),
    logistics: { canonicalStatus: 'GUIDE_CREATED', trackingNumber: 'GUIDE-123',
        canonicalEvidence: { observedAt: new Date('2026-10-01T12:10:00Z') } },
    raw: { carrierTracking: { lastCheckedAt: new Date(Date.now() - (5 * 60 * 1000)),
        lastResult: { ok: true, carrier: 'servientrega', trackingNumber: 'GUIDE-123',
            observedGuide: 'GUIDE-123', providerStatus: 'Guia generada', canonicalStatus: 'GUIDE_CREATED' } } },
    automation: {}
});

test('guia antiga só entra após prova atual da mesma guia pela Servientrega', () => {
    const shipment = oldGuide();
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: cutoff }), true);
    shipment.raw.carrierTracking.lastCheckedAt = new Date(cutoff.getTime() - 60_000);
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: cutoff }), false);
    shipment.raw.carrierTracking.lastCheckedAt = new Date(Date.now() + 60_000);
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: cutoff }), false);
    shipment.raw.carrierTracking.lastCheckedAt = new Date(Date.now() - (11 * 60 * 1000));
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: cutoff }), false);
    shipment.raw.carrierTracking.lastCheckedAt = new Date(Date.now() - (3 * 60 * 60 * 1000));
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: new Date(Date.now() - (4 * 60 * 60 * 1000)) }), false);
});

test('não reabre guia já avisada, divergente ou em estágio posterior', () => {
    const shipment = oldGuide();
    shipment.review = { manualOnly: true };
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: cutoff }), false);
    shipment.review.manualOnly = false;
    shipment.automation.guiaNotifiedAt = new Date('2026-10-01T13:00:00Z');
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: cutoff }), false);
    shipment.automation.guiaNotifiedAt = null;
    shipment.raw.carrierTracking.lastResult.trackingNumber = 'GUIDE-OUTRA';
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: cutoff }), false);
    shipment.raw.carrierTracking.lastResult.trackingNumber = 'GUIDE-123';
    shipment.raw.carrierTracking.lastResult.observedGuide = '';
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: cutoff }), false);
    shipment.raw.carrierTracking.lastResult.observedGuide = 'GUIDE-123';
    shipment.logistics.canonicalStatus = 'IN_TRANSIT';
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: cutoff }), false);
    shipment.logistics.canonicalStatus = 'GUIDE_CREATED';
    shipment.createdAt = new Date(cutoff.getTime() - 60_000);
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: cutoff }), false);
});

test('retirada baseada na Dropi só entra após prova recente da mesma guia pela Servientrega', () => {
    const shipment = oldGuide();
    shipment.logistics.canonicalStatus = 'READY_FOR_PICKUP';
    shipment.logistics.pickupReadyVerifiedAt = new Date(Date.now() - 10 * 60_000);
    shipment.raw.carrierTracking.lastResult.canonicalStatus = 'READY_FOR_PICKUP';
    assert.equal(eligible({ shipment, stage: 'READY_FOR_PICKUP', forwardOnlySince: cutoff }), true);
    shipment.raw.carrierTracking.lastResult.providerStatus = '';
    assert.equal(eligible({ shipment, stage: 'READY_FOR_PICKUP', forwardOnlySince: cutoff }), false);
});

const dropiProof = (canonicalStatus = 'READY_FOR_PICKUP') => {
    const checkedAt = new Date(Date.now() - 60_000);
    return {
        createdAt: new Date(cutoff.getTime() + 60_000),
        logistics: { canonicalStatus, trackingNumber: '189123456', agencyPickup: true,
            distributionCompany: 'SERVIENTREGA',
            pickupReadyVerified: true, pickupReadyVerifiedSource: 'dropi_orders_api',
            pickupReadyVerifiedAt: checkedAt,
            canonicalEvidence: { provider: 'dropi', source: 'dropi_orders_api',
                dropiOrderId: '6871234', trackingNumber: '189123456',
                rawStatus: 'LISTO PARA RETIRO', observedAt: checkedAt } },
        raw: { postSaleV194DropiSync: { lastState: 'TRACKING_FOUND',
            lastReason: 'exact_dropi_order_id_tracking_found', lastDropiStatus: 'LISTO PARA RETIRO',
            dropiOrderId: '6871234', lastSyncAt: checkedAt, historicalNoReplay: false },
        latestDroppiPayload: { dropiOrderId: '6871234', trackingNumber: '189123456',
            reconciliationSource: 'dropi_orders_api',
            dropiStatus: 'LISTO PARA RETIRO' } },
        automation: {}
    };
};

test('retirada por Dropi exige vínculo exato, status explícito e leitura recente', () => {
    const shipment = dropiProof();
    assert.equal(eligible({ shipment, stage: 'READY_FOR_PICKUP', forwardOnlySince: cutoff }), true);
    shipment.raw.postSaleV194DropiSync.lastSyncAt = new Date(Date.now() - 11 * 60_000);
    assert.equal(eligible({ shipment, stage: 'READY_FOR_PICKUP', forwardOnlySince: cutoff }), false);
    shipment.raw.postSaleV194DropiSync.lastSyncAt = shipment.logistics.canonicalEvidence.observedAt;
    shipment.raw.latestDroppiPayload.dropiOrderId = '6879999';
    assert.equal(eligible({ shipment, stage: 'READY_FOR_PICKUP', forwardOnlySince: cutoff }), false);
    shipment.raw.latestDroppiPayload.dropiOrderId = '6871234';
    shipment.logistics.agencyPickup = false;
    assert.equal(eligible({ shipment, stage: 'READY_FOR_PICKUP', forwardOnlySince: cutoff }), false);
});

test('falha ou ambiguidade na leitura Dropi não libera o aviso', () => {
    const shipment = dropiProof();
    shipment.raw.postSaleV194DropiSync.lastState = 'MANUAL_REVIEW';
    assert.equal(eligible({ shipment, stage: 'READY_FOR_PICKUP', forwardOnlySince: cutoff }), false);
    shipment.raw.postSaleV194DropiSync.lastState = 'TRACKING_FOUND';
    shipment.raw.postSaleV194DropiSync.historicalNoReplay = true;
    assert.equal(eligible({ shipment, stage: 'READY_FOR_PICKUP', forwardOnlySince: cutoff }), false);
    shipment.raw.postSaleV194DropiSync.historicalNoReplay = false;
    shipment.logistics.canonicalEvidence.rawStatus = 'EN RUTA';
    assert.equal(eligible({ shipment, stage: 'READY_FOR_PICKUP', forwardOnlySince: cutoff }), false);
});

test('guia e trânsito aceitam prova Dropi recente; devolução mantém a trava canônica', () => {
    const shipment = dropiProof('GUIDE_CREATED');
    for (const source of [shipment.raw.postSaleV194DropiSync, shipment.raw.latestDroppiPayload,
        shipment.logistics.canonicalEvidence]) source.lastDropiStatus = source.dropiStatus = source.rawStatus = 'GUIA GENERADA';
    shipment.raw.postSaleV194DropiSync.trackingRecoveredAt = new Date();
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: cutoff }), true);
    shipment.automation.guiaNotifiedAt = new Date();
    assert.equal(eligible({ shipment, stage: 'GUIDE', forwardOnlySince: cutoff }), false);
    shipment.automation.guiaNotifiedAt = null;
    shipment.logistics.canonicalStatus = 'IN_TRANSIT';
    shipment.logistics.canonicalEvidence.observedAt = shipment.raw.postSaleV194DropiSync.lastSyncAt;
    assert.equal(eligible({ shipment, stage: 'IN_TRANSIT', forwardOnlySince: cutoff }), true);
    shipment.logistics.canonicalStatus = 'RETURNED';
    assert.equal(eligible({ shipment, stage: 'RETURNED', forwardOnlySince: cutoff }), false);
});
