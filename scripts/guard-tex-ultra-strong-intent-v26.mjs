import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/texUltraStrongIntentFreezeRuntimeGuardV26.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const funnel = read('src/services/texUltraFunnelService.js');
const index = read('src/index.js');
const packageJson = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/ec-panel-quality.yml');
const manifest = JSON.parse(read('docs/freeze/tex-ultra-strong-intent-v26-20260818.json'));

assert.equal(manifest.publicationStatus, 'approved_for_publication');
assert.equal(manifest.operatorPublicationApproval.status, 'approved_in_thread');
assert.equal(manifest.operatorPublicationApproval.scope, 'controlled_deploy_v26_test_phone_5515998038637');
assert.match(index, /import '\.\/services\/texUltraStrongIntentFreezeRuntimeGuardV26\.js';/);
assert.doesNotMatch(index, /^import '.+FreezeRuntimeGuardV(?:17|18|19|20|21|22|23|24|25)\.js';/m);
assert.match(funnel, /texUltraStrongPurchaseIntent/);
assert.match(funnel, /texUltraInboundNeedsHuman/);
assert.match(funnel, /tex_ultra_purchase_intent_after_interrupt/);
assert.match(funnel, /tex_ultra_purchase_intent_after_offer/);
assert.match(funnel, /qué opción desea reservar: 1, 2, 3 o 6 frascos/);
assert.match(packageJson.scripts['senior:check'], /guard-tex-ultra-strong-intent-v26\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tex-ultra-strong-intent-v26\.test\.mjs/);
assert.match(packageJson.scripts['deploy:ec-safe'], /assert-tex-ultra-strong-intent-approved-v26\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-tex-ultra-strong-intent-approved-v26\.mjs/);
assert.match(workflow, /scripts\/guard-tex-ultra-strong-intent-v26\.mjs/);
assert.match(workflow, /tests\/tex-ultra-strong-intent-v26\.test\.mjs/);

console.log('TEX_ULTRA_STRONG_INTENT_V26_GUARD=OK');
