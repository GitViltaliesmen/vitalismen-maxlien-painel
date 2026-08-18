import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/texUltraEntryInterruptFreezeRuntimeGuardV25.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const greeting = read('src/services/texUltraEntryGreetingService.js');
const funnel = read('src/services/texUltraFunnelService.js');
const layer = read('src/services/texUltraInitialLayerService.js');
const panel = read('public/qr.html');
const index = read('src/index.js');
const packageJson = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/ec-panel-quality.yml');
const manifest = JSON.parse(read('docs/freeze/tex-ultra-entry-interrupt-v25-20260818.json'));

assert.equal(manifest.publicationStatus, 'approved_for_publication');
assert.equal(manifest.operatorPublicationApproval.status, 'approved_in_thread');
assert.equal(manifest.operatorPublicationApproval.scope, 'controlled_deploy_v25_test_phone_5515998038637');
assert.equal(manifest.policy.minimumTotalCadenceMs, 90000);
assert.equal(manifest.policy.maximumTotalCadenceMs, 112000);
assert.match(index, /import '\.\/services\/texUltraEntryInterruptFreezeRuntimeGuardV25\.js';/);
assert.doesNotMatch(index, /^import '.+FreezeRuntimeGuardV(?:17|18|19|20|21|22|23|24)\.js';/m);
assert.match(greeting, /TEX_ULTRA_GREETING_EMOJIS = Object\.freeze/);
assert.match(greeting, /nextTexUltraGreetingEmoji/);
assert.match(greeting, /Soy Ana López, asistente de la Dra\. María Fernandes/);
assert.match(panel, /TEX_ULTRA_ENTRY_GREETING_EMOJIS/);
assert.match(funnel, /interruptTexUltraInitialLayerOnInbound/);
assert.match(funnel, /lastManualBy: 'tex_ultra_customer_question'/);
assert.match(layer, /new_customer_interaction_before_queued_send/);
assert.match(packageJson.scripts['senior:check'], /guard-tex-ultra-entry-interrupt-v25\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tex-ultra-entry-interrupt-v25\.test\.mjs/);
assert.match(packageJson.scripts['deploy:ec-safe'], /assert-tex-ultra-entry-interrupt-approved-v25\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-tex-ultra-entry-interrupt-approved-v25\.mjs/);
assert.match(workflow, /scripts\/guard-tex-ultra-entry-interrupt-v25\.mjs/);
assert.match(workflow, /tests\/tex-ultra-entry-interrupt-v25\.test\.mjs/);

console.log('TEX_ULTRA_ENTRY_INTERRUPT_V25_GUARD=OK');
