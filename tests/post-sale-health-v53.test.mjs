import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { texUltraConfirmedPostSaleQueuePolicy } from '../src/services/texUltraConfirmedPostSaleLayerService.js';

const shipmentMessages = fs.readFileSync('src/services/shipmentMessageService.js', 'utf8');
const scheduler = fs.readFileSync('src/services/schedulerService.js', 'utf8');
const reengagement = fs.readFileSync('src/services/reengagementService.js', 'utf8');
const texPostSale = fs.readFileSync('src/services/texUltraConfirmedPostSaleLayerService.js', 'utf8');
const shipmentModel = fs.readFileSync('src/models/Shipment.js', 'utf8');
const repurchaseBlock = reengagement.slice(
    reengagement.indexOf('export const processPostSaleRepurchase30dFollowups'),
    reengagement.indexOf('export const processInitialProductFollowups')
);

test('fila Tex Ultra varre janela independente do lote e limita reenvio antigo', () => {
    const now = new Date('2026-08-24T12:00:00.000Z');
    const policy = texUltraConfirmedPostSaleQueuePolicy({
        env: {
            TEX_ULTRA_CONFIRMED_POSTSALE_QUEUE_SCAN_LIMIT: '500',
            TEX_ULTRA_CONFIRMED_POSTSALE_QUEUE_MAX_AGE_HOURS: '72'
        },
        now,
        batchLimit: 1
    });
    assert.equal(policy.batchLimit, 1);
    assert.equal(policy.scanLimit, 500);
    assert.equal(policy.maxAgeHours, 72);
    assert.equal(policy.historyReconcileLimit, 25);
    assert.equal(policy.oldestAutomaticSendAt.toISOString(), '2026-08-21T12:00:00.000Z');
    assert.match(texPostSale, /reconcileStaleConfirmedPostSaleHistory/);
    assert.match(texPostSale, /stale_missing_not_replayed/);
    assert.match(texPostSale, /historicalRecoveryMissingSteps/);
});

test('fila de retirada usa limite de envios e continua depois de bloqueios', () => {
    assert.match(shipmentMessages, /for \(const item of allDueItems\)/);
    assert.match(shipmentMessages, /if \(result\.sent >= safeLimit\) break/);
    assert.match(shipmentMessages, /'review\.manualOnly': \{ \$ne: true \}/);
    assert.match(shipmentMessages, /shipment\?\.review\?\.manualOnly === true/);
    assert.match(shipmentMessages, /pickupReminderDispatchLockedUntil/);
    assert.match(shipmentModel, /pickupReminderDispatchLockedUntil/);
});

test('scheduler inicia a fila Tex Ultra e informa a varredura', () => {
    assert.match(scheduler, /setTimeout\(\(\) => checkTexUltraConfirmedPostSale\(\), 45000\)/);
    assert.match(scheduler, /antigos_nao_reenviados=/);
    assert.match(scheduler, /antigos_reconciliados=/);
    assert.match(scheduler, /antigos_suprimidos=/);
    assert.match(scheduler, /verificados=/);
});

test('recompra nao conserva audio Vit Power como fallback global', () => {
    assert.doesNotMatch(repurchaseBlock, /baseName:\s*'TEMPO_RESULTADO_VIT_POWER'/);
    assert.doesNotMatch(repurchaseBlock, /const agentKey = 'vit_power_ec'/);
    assert.match(repurchaseBlock, /repurchaseProductPolicyForShipment\(shipment\)/);
    assert.match(repurchaseBlock, /state && product\.allowSharedProof/);
    assert.match(repurchaseBlock, /claimRepurchaseShipment\(shipment\)/);
    assert.match(shipmentModel, /refillReminderDispatchLockedUntil/);
});
