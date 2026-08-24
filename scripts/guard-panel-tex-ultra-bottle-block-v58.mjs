import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/panelTexUltraBottleBlockFreezeRuntimeGuardV58.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const panel = read('public/qr.html');
const entryGuard = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const testFile = read('tests/panel-tex-ultra-bottle-block-v58.test.mjs');
const manifest = JSON.parse(read('docs/freeze/panel-tex-ultra-bottle-block-v58-20260824.json'));

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.officialBottlePathRepair, true);
assert.equal(manifest.policy.fullB01SequencePreserved, true);
assert.equal(manifest.policy.promotionalPricesChanged, false);
assert.equal(manifest.policy.realClientSendAuthorized, false);
assert.equal(manifest.policy.qaPhoneCanaryAuthorized, true);
assert.equal(manifest.policy.automaticDropiAuthorization, false);
assert.equal(manifest.policy.metaPurchaseResendAllowed, false);
assert.equal(manifest.policy.otherProductMediaChanged, false);
assert.match(entryGuard, /panelTexUltraBottleBlockFreezeRuntimeGuardV58\.js/);
assert.equal(fs.existsSync('public/media/sales/ec/tex_ultra.png'), true);
assert.doesNotMatch(panel, /tex_ultra_bottle\.png/);
assert.match(panel, /label: 'Frasco Tex Ultra', value: '\/media\/sales\/ec\/tex_ultra\.png'/);
assert.match(panel, /value: 'tex_ultra_inicio_completo'[\s\S]*?value: 'tex_ultra_promotion_1'/);
assert.match(panel, /clientGeneratedId:\s*activePendingMessage\?\.clientGeneratedId/);
assert.match(panel, /confirmPendingLocalMessage\(activePendingMessage\?\._id, result\)/);
assert.match(testFile, /nenhuma referencia ativa de midia do painel aponta para arquivo ausente/);
assert.match(packageJson.scripts.test, /guard:panel-tex-ultra-bottle-v58/);
assert.match(packageJson.scripts['senior:check'], /panel-tex-ultra-bottle-block-v58\.test\.mjs/);
assert.match(packageJson.scripts['deploy:v58'], /assert-panel-tex-ultra-bottle-block-activation-approved-v58\.mjs/);
assert.match(packageJson.scripts['deploy:v58'], /deploy:vps/);

console.log('PANEL_TEX_ULTRA_BOTTLE_BLOCK_V58_GUARD=OK');
