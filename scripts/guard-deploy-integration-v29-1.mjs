import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/deployIntegrationFreezeRuntimeGuardV291.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const deployVps = read('scripts/deploy-vps-ready.mjs');
const deployEc = read('scripts/deploy-ec-safe.mjs');

for (const scriptName of ['deploy:vps', 'deploy:ec-safe']) {
    const script = packageJson.scripts[scriptName] || '';
    assert.match(script, /^node scripts\/guard-deploy-integration-v29-1\.mjs && node scripts\/assert-deploy-integration-approved-v29-1\.mjs/);
    assert.doesNotMatch(script, /guard-customer-data-resolution-v28\.mjs/);
    assert.doesNotMatch(script, /assert-customer-data-resolution-approved-v28\.mjs/);
    assert.match(script, /tests\/logistics-clean-chat-v29\.test\.mjs/);
    assert.match(script, /tests\/deploy-integration-v29-1\.test\.mjs/);
}

assert.match(index, /import '\.\/services\/deployIntegrationFreezeRuntimeGuardV291\.js';/);
assert.doesNotMatch(index, /^import '\.\/services\/logisticsCleanChatFreezeRuntimeGuardV29\.js';/m);
assert.match(deployVps, /ativação direta bloqueada; use o helper root transacional/);
assert.match(deployEc, /ativação direta bloqueada; use o helper root transacional/);
assert.match(packageJson.scripts['senior:check'], /guard-deploy-integration-v29-1\.mjs/);
assert.match(packageJson.scripts['senior:check'], /deploy-integration-v29-1\.test\.mjs/);

console.log('DEPLOY_INTEGRATION_V29_1_GUARD=OK');
