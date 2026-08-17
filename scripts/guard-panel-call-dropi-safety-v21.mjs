import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/panelCallDropiSafetyFreezeRuntimeGuardV21.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/panel-call-dropi-safety-v21-20260817.json'));
const index = read('src/index.js');
const panel = read('public/qr.html');
const zapi = read('src/routes/zapi.js');
const baileys = read('src/whatsapp/connection.js');
const dropi = read('src/services/droppiEcuadorService.js');
const envExample = read('.env.example');
const packageJson = JSON.parse(read('package.json'));
const successorPattern = /guard-panel-call-dropi-safety-v21\.mjs/;

assert.equal(manifest.freezeId, 'panel-call-dropi-safety-v21-20260817');
assert.equal(manifest.parentFreezeId, 'order-public-product-integrity-v20-20260817');
assert.equal(manifest.publicationStatus, 'candidate_not_published');
assert.equal(manifest.policy.callAutoReplyDefaultEnabled, false);
assert.equal(manifest.policy.persistentCallDedupe, true);
assert.equal(manifest.policy.oneAudioMaximum, true);
assert.equal(manifest.policy.oneTextMaximum, true);
assert.equal(manifest.policy.dropiManualAuthorizationRequired, true);
assert.equal(manifest.policy.pricesChanged, false);
assert.equal(manifest.policy.productionChanged, false);

assert.match(index, /import '\.\/services\/panelCallDropiSafetyFreezeRuntimeGuardV21\.js';/);
assert.doesNotMatch(index, /^import '\.\/services\/orderPublicProductIntegrityFreezeRuntimeGuardV20\.js';/m);
assert.match(envExample, /^WHATSAPP_CALL_AUTO_REPLY_ENABLED=false$/m);
assert.match(panel, /data-sales-quick-media="\/media\/sales\/ec\/tex_ultra\.png"/);
assert.doesNotMatch(panel, /customerCurrentContextV16|customer-current-context-v16/);
assert.match(panel, /id="scanCustomerDataBtn"/);
assert.match(zapi, /handleZapiCallWebhook/);
assert.match(baileys, /reserveCallAutoReply/);
assert.match(dropi, /normalizeEcuadorOrderFieldsForDropi/);

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:operational-mode-zapi-health',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.match(packageJson.scripts[scriptName], successorPattern, `${scriptName} deve usar V21`);
}
for (const scriptName of ['senior:check', 'deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], /tests\/panel-call-dropi-safety\.test\.mjs/);
    assert.match(packageJson.scripts[scriptName], /tests\/panel-call-dropi-safety-v21\.test\.mjs/);
}

console.log(`[PANEL-CALL-DROPI-SAFETY-GUARD-V21] OK: ${manifest.freezeId}.`);
