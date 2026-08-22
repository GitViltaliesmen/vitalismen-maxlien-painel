import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/ecProductIngredientsFreezeRuntimeGuardV35.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const successor = 'node src/services/ecProductIngredientsFreezeRuntimeGuardV35.js';

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
    'guard:ec-nitrix',
    'guard:ec-identity',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.equal(String(packageJson.scripts[scriptName] || '').startsWith(successor), true, `${scriptName} não preserva V33 sob V35`);
}

assert.match(index, /import '\.\/services\/ecProductIngredientsFreezeRuntimeGuardV35\.js';/);
assert.doesNotMatch(index, /import '\.\/services\/officialWhatsappPhoneFreezeRuntimeGuardV32\.js';/);
assert.match(index, /"img-src": \["'self'", "data:", "blob:", "https:"\]/);
assert.match(index, /"media-src": \["'self'", "data:", "blob:", "https:"\]/);
assert.match(packageJson.scripts['senior:check'], /panel-image-csp-v33\.test\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-panel-image-csp-activation-approved-v33\.mjs/);

console.log('PANEL_IMAGE_CSP_V33_GUARD=OK');
