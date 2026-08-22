import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/panelZapiAuthStatusFreezeRuntimeGuardV37.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const vsl = read('public/n/index.html');
const panel = read('public/qr.html');
const route = read('src/routes/whatsapp.js');
const successor = 'node src/services/panelZapiAuthStatusFreezeRuntimeGuardV37.js';

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:logistics-clean-chat-v29',
    'guard:deploy-integration-v29-1',
    'guard:operational-mode-zapi-health',
    'guard:media-durability-v30',
    'guard:tex-ultra-how-to-use-v31',
    'guard:official-whatsapp-phone-v32',
    'guard:ec-nitrix',
    'guard:ec-identity',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.equal(String(packageJson.scripts[scriptName] || '').startsWith(successor), true, `${scriptName} não preserva V32 sob V37`);
}

assert.match(index, /import '\.\/services\/panelZapiAuthStatusFreezeRuntimeGuardV37\.js';/);
assert.doesNotMatch(index, /texUltraHowToUseAudioFreezeRuntimeGuardV31/);
assert.match(vsl, /OFFICIAL_ZAPI_SELLER_E164 = "5515991418416"/);
assert.match(vsl, /const TEST_PHONE_OVERRIDES = \{\s*"8637":/);
assert.doesNotMatch(vsl, /"2958"\s*:/);
assert.match(panel, /allowedBrazilTestPhones = new Set\(\['5515991418416', '5515998038637'\]\)/);
assert.match(panel, /sessionId: '5515991418416'/);
assert.match(route, /PUBLIC_VSL_TEST_PHONE_OVERRIDES = \{\s*8637: '5515998038637'/);
assert.match(packageJson.scripts['senior:check'], /official-whatsapp-phone-v32\.test\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-official-whatsapp-phone-activation-approved-v32\.mjs/);

console.log('OFFICIAL_WHATSAPP_PHONE_V32_GUARD=OK');
