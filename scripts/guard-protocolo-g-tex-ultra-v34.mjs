import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/inboundMediaPathPortabilityFreezeRuntimeGuardV38.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const zapi = read('src/routes/zapi.js');
const whatsapp = read('src/routes/whatsapp.js');
const panel = read('public/qr.html');
const successor = 'node src/services/inboundMediaPathPortabilityFreezeRuntimeGuardV38.js';

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:logistics-clean-chat-v29',
    'guard:deploy-integration-v29-1',
    'guard:operational-mode-zapi-health',
    'guard:media-durability-v30',
    'guard:tex-ultra-how-to-use-v31',
    'guard:official-whatsapp-phone-v32',
    'guard:panel-image-csp-v33',
    'guard:protocolo-g-tex-ultra-v34',
    'guard:ec-nitrix',
    'guard:ec-identity',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.equal(String(packageJson.scripts[scriptName] || '').startsWith(successor), true, `${scriptName} não preserva V34 sob V38`);
}

assert.match(index, /import '\.\/services\/inboundMediaPathPortabilityFreezeRuntimeGuardV38\.js';/);
assert.match(zapi, /zapi_protocolo_g_tex_ultra_payload/);
assert.match(zapi, /vslProductAssignmentPolicy/);
assert.match(whatsapp, /ec_protocolo_g_tex_ultra_vsl/);
assert.match(whatsapp, /operatorProductRouteLock/);
assert.match(panel, /<option value="tex_ultra_ec">Tex Ultra Ecuador<\/option>/);
assert.match(panel, /id="customerDataQuality"/);
assert.match(panel, /allowedBrazilTestPhones = new Set\(\['5515991418416', '5515998038637'\]\)/);
assert.match(packageJson.scripts['senior:check'], /protocolo-g-tex-ultra-origin-v34\.test\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-protocolo-g-tex-ultra-activation-approved-v34\.mjs/);

console.log('PROTOCOLO_G_TEX_ULTRA_V34_GUARD=OK');
