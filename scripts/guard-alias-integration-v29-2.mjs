import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/guardAliasIntegrationFreezeRuntimeGuardV292.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const successor = 'node src/services/guardAliasIntegrationFreezeRuntimeGuardV292.js';
const migratedAliases = [
    'guard:whatsapp-chats-readonly',
    'guard:logistics-clean-chat-v29',
    'guard:deploy-integration-v29-1',
    'guard:operational-mode-zapi-health',
    'guard:ec-nitrix',
    'guard:ec-identity',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation'
];

for (const scriptName of migratedAliases) {
    const script = packageJson.scripts[scriptName] || '';
    assert.equal(script.startsWith(successor), true, `${scriptName} não usa o sucessor V29.2`);
    assert.doesNotMatch(script, /guard-customer-data-resolution-v28\.mjs/);
    assert.doesNotMatch(script, /deployIntegrationFreezeRuntimeGuardV291\.js/);
}

assert.match(index, /import '\.\/services\/guardAliasIntegrationFreezeRuntimeGuardV292\.js';/);
assert.doesNotMatch(index, /import '\.\/services\/deployIntegrationFreezeRuntimeGuardV291\.js';/);
assert.match(packageJson.scripts['senior:check'], /^node src\/services\/guardAliasIntegrationFreezeRuntimeGuardV292\.js && node scripts\/guard-alias-integration-v29-2\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tests\/guard-alias-integration-v29-2\.test\.mjs/);
assert.match(packageJson.scripts['guard:tex-ultra-approved'], /audit-ec-tex-ultra-isolation\.mjs/);
assert.match(packageJson.scripts['guard:tex-ultra-approved'], /audit-ec-product-micro-layer\.mjs/);
assert.match(packageJson.scripts['guard:ec-product-funnel-isolation'], /tests\/ec-product-funnel-isolation-v13\.test\.mjs/);

for (const scriptName of ['deploy:ec-safe', 'deploy:vps']) {
    const script = packageJson.scripts[scriptName] || '';
    assert.match(script, /^node src\/services\/guardAliasIntegrationFreezeRuntimeGuardV292\.js && node scripts\/assert-guard-alias-integration-approved-v29-2\.mjs/);
    assert.doesNotMatch(script, /assert-deploy-integration-approved-v29-1\.mjs/);
}

console.log('GUARD_ALIAS_INTEGRATION_V29_2_GUARD=OK');
