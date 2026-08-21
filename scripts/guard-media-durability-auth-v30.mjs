import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/mediaDurabilityAuthFreezeRuntimeGuardV30.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const panel = read('public/qr.html');
const zapi = read('src/routes/zapi.js');
const whatsapp = read('src/routes/whatsapp.js');
const successor = 'node src/services/mediaDurabilityAuthFreezeRuntimeGuardV30.js';

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:logistics-clean-chat-v29',
    'guard:deploy-integration-v29-1',
    'guard:operational-mode-zapi-health',
    'guard:ec-nitrix',
    'guard:ec-identity',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'guard:media-durability-v30',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.equal(String(packageJson.scripts[scriptName] || '').startsWith(successor), true, `${scriptName} não usa V30`);
}

assert.match(index, /import '\.\/services\/mediaDurabilityAuthFreezeRuntimeGuardV30\.js';/);
assert.doesNotMatch(index, /guardAliasIntegrationFreezeRuntimeGuardV292/);
assert.match(packageJson.scripts['senior:check'], /tests\/inbound-media-storage\.test\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tests\/panel-authenticated-media\.test\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tests\/zapi-outbound-audio-contract\.test\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-media-durability-activation-approved-v30\.mjs/);
assert.match(zapi, /captureInboundMedia/);
assert.match(whatsapp, /router\.get\('\/media\/:messageId'/);
assert.match(panel, /hydrateAuthenticatedMedia\(box\)/);
assert.match(panel, /VitalismenCleanChatV29\?\.presentMessages/);
assert.doesNotMatch(panel, /mediaToken=|access_token=.*media/i);

console.log('MEDIA_DURABILITY_AUTH_V30_GUARD=OK');
