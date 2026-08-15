import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'docs', 'freeze', 'tex-ultra-panel-metrics-v5-20260815.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const sha256 = (relativePath) => crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');

assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.country, 'EC');
assert.equal(manifest.productKey, 'tex_ultra_ec');
assert.equal(manifest.requiresWrittenAuthorizationToChange, true);
assert.ok(manifest.parentFreezeIds.includes('tex-ultra-approved-start-and-confirmed-postsale-v4-20260803'));
assert.equal(manifest.initialLayer.timingMode, 'cumulative_between_steps');
assert.equal(manifest.initialLayer.waveJoinMs, 20000);
assert.equal(manifest.initialLayer.pauseOnCustomerInteraction, true);
assert.equal(manifest.initialLayer.pauseOrphanedFlowsOnStartup, true);
assert.equal(manifest.initialLayer.automaticReplayAfterRestart, false);
assert.deepEqual(manifest.initialLayer.cadence, [
    { key: 'intro01', minMs: 2000, maxMs: 10000 },
    { key: 'intro02', minMs: 11000, maxMs: 20000 },
    { key: 'proof', minMs: 21000, maxMs: 25000 },
    { key: 'bottle', minMs: 28000, maxMs: 33000 },
    { key: 'offer', minMs: 35000, maxMs: 40000 }
]);
assert.deepEqual(manifest.confirmedPostSaleLayer.audioOrder, [
    'AGRADECIMENTO_AGENCIA_DE_ENTREGA',
    'BONUS_RETIRADA'
]);
assert.equal(manifest.confirmedPostSaleLayer.queueIntervalSeconds, 60);
assert.equal(manifest.confirmedPostSaleLayer.batchLimit, 1);
assert.equal(manifest.confirmedPostSaleLayer.duplicateProtection, true);
assert.equal(manifest.confirmedPostSaleLayer.productIsolation, true);
assert.equal(manifest.manualQuickFunnel.manualEcOnly, true);
assert.equal(manifest.manualQuickFunnel.automaticVslFunnelUnchanged, true);
assert.equal(manifest.manualQuickFunnel.historicalOrderMutationBlocked, true);
assert.equal(manifest.manualQuickFunnel.templateDoesNotAutoSend, true);
assert.equal(manifest.metrics.endpoint, '/api/funnel-metrics');
assert.equal(manifest.metrics.bearerAuthentication, true);
assert.equal(manifest.metrics.adminOnly, true);
assert.equal(manifest.metrics.country, 'EC');
assert.equal(manifest.metrics.timeZone, 'America/Guayaquil');

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles)) {
    assert.equal(
        sha256(relativePath),
        approvedHash,
        `${relativePath} mudou depois da aprovacao. Nao edite o congelamento v5; obtenha autorizacao escrita e crie uma nova versao.`
    );
}

const initialLayer = read('src/services/texUltraInitialLayerService.js');
assert.match(initialLayer, /pauseOrphanedTexUltraInitialFlowsOnStartup/);
assert.match(initialLayer, /process_restart_no_automatic_outbound/);
assert.match(initialLayer, /new_customer_interaction_before_queued_send/);

const postSaleLayer = read('src/services/texUltraConfirmedPostSaleLayerService.js');
assert.match(postSaleLayer, /operatorNoAutoResendState/);
assert.match(postSaleLayer, /stepKey: 'thankYouAgency'/);
assert.match(postSaleLayer, /stepKey: 'pickupBonus'/);

const panel = read('public/qr.html');
assert.match(panel, /manualEcSalesQuickFunnelAvailable/);
assert.match(panel, /historical_order_preserved/);
assert.match(panel, /VSL de origem:/);

const metricsRoute = read('src/routes/funnelMetrics.js');
assert.match(metricsRoute, /router\.get\('\/', authMiddleware, adminOnly,/);
const metricsService = read('src/services/funnelMetricsService.js');
assert.match(metricsService, /country: 'EC'/);

console.log(`OK: ${manifest.freezeId} permanece integro e bloqueante.`);
