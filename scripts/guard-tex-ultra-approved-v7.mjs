import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'docs', 'freeze', 'tex-ultra-real-legacy-order-v7-20260815.json');
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
assert.ok(manifest.parentFreezeIds.includes('tex-ultra-meta-purchase-attribution-v6-20260815'));

assert.equal(manifest.manualQuickFunnel.manualEcOnly, true);
assert.equal(manifest.manualQuickFunnel.automaticVslFunnelUnchanged, true);
assert.equal(manifest.manualQuickFunnel.historicalOrderMutationBlocked, true);
assert.equal(manifest.manualQuickFunnel.currentNegotiationStoredSeparately, true);
assert.equal(manifest.manualQuickFunnel.administrativeHistoryRequiresOldEntry, true);
assert.equal(manifest.manualQuickFunnel.currentNegotiationOwnershipWins, true);
assert.equal(manifest.manualQuickFunnel.realAngelStateCovered, true);
assert.equal(manifest.manualQuickFunnel.noAuditMutation, true);

assert.equal(manifest.metaPurchaseAttributionV2.datasetId, '1468946114265008');
assert.equal(manifest.metaPurchaseAttributionV2.atomicClaimBeforePost, true);
assert.equal(manifest.metaPurchaseAttributionV2.noHistoricalFabricationOrBackfill, true);
assert.equal(manifest.metrics.endpoint, '/api/funnel-metrics');
assert.equal(manifest.metrics.bearerAuthentication, true);
assert.equal(manifest.metrics.adminOnly, true);

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles)) {
    assert.equal(
        sha256(relativePath),
        approvedHash,
        `${relativePath} mudou depois da aprovacao. Nao edite o congelamento v7; obtenha autorizacao escrita e crie uma nova versao.`
    );
}

const policy = read('public/panel-intelligence/customer-order-policy.js');
assert.match(policy, /isAdministrativeOrderId/);
assert.match(policy, /legacyEntry = false/);
assert.match(policy, /importedHistoricalLead/);
assert.match(policy, /!belongsToCurrentNegotiation/);

const panel = read('public/qr.html');
assert.match(panel, /legacyEntry: chatEntryInfo\(chat\)\.className === 'old'/);
assert.match(panel, /reason: 'historical_order_preserved'/);
assert.match(panel, /orderPayload\.previousOrderId = historicalOrderId/);
assert.match(panel, /customerDraft\.currentNegotiationOrderId = created\.orderId/);

const realCaseTest = read('tests/manual-quick-funnel.test.cjs');
assert.match(realCaseTest, /EC-ADMIN-3338/);
assert.match(realCaseTest, /ZAPI_INBOUND_CAPTURED/);
assert.match(realCaseTest, /PANEL_UNIFIED_IMPORTED/);
assert.match(realCaseTest, /legacyEntry: true/);
assert.match(realCaseTest, /legacyEntry: false/);
assert.match(realCaseTest, /currentNegotiationOrderId: 'EC-ADMIN-3338'/);

const packageJson = JSON.parse(read('package.json'));
assert.match(packageJson.scripts['senior:check'], /guard-tex-ultra-approved-v7\.mjs/);
assert.match(packageJson.scripts['guard:tex-ultra-approved'], /guard-tex-ultra-approved-v7\.mjs/);
assert.match(packageJson.scripts['deploy:ec-safe'], /guard-tex-ultra-approved-v7\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /guard-tex-ultra-approved-v7\.mjs/);
assert.match(read('src/index.js'), /texUltraApprovedFreezeRuntimeGuardV7\.js/);

assert.match(read('AUDITORIA_ANGEL_HISTORICO_V7_20260815.md'), /nenhuma muta(?:ção|cao) de cliente/i);
assert.match(read('docs/TEX_ULTRA_REAL_LEGACY_ORDER_FREEZE_V7_20260815.md'), /Não autoriza publicação na VPS/i);

console.log(`OK: ${manifest.freezeId} permanece integro e bloqueante.`);
