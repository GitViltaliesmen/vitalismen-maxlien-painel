import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/inboundMediaPathPortabilityFreezeRuntimeGuardV38.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const service = read('src/services/ecProductIngredientsService.js');
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
    'guard:ec-product-ingredients-v35',
    'guard:ec-all-products-ingredients-v36',
    'guard:panel-zapi-auth-status-v37',
    'guard:ec-nitrix',
    'guard:ec-identity',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.equal(String(packageJson.scripts[scriptName] || '').startsWith(successor), true, `${scriptName} não preserva V36 sob V38`);
}

assert.match(index, /import '\.\/services\/inboundMediaPathPortabilityFreezeRuntimeGuardV38\.js';/);
assert.doesNotMatch(index, /^import '.+ecProductIngredientsFreezeRuntimeGuardV35\.js';/m);
assert.match(service, /export const EC_ALL_PRODUCTS_INGREDIENTS_TEXT/);
assert.match(service, /🔵 \*Tex Ultra\*[\s\S]+🟠 \*Nitrix Oxide\*[\s\S]+🟢 \*Vit Power\*/);
assert.match(service, /Cada producto tiene una fórmula diferente/);
assert.match(service, /no deben confundirse con los de los demás/);
assert.match(service, /isAllProductsIngredientsQuestion/);
assert.match(service, /explicit\.length >= 2/);
assert.match(service, /scope: 'all_products'/);
assert.match(service, /memoryField: 'productIngredientsFaqAllProducts'/);
assert.match(service, /antiSpamScope = reply\.scope === 'all_products' \? 'all_products' : reply\.productKey/);
assert.match(service, /PRODUCT_KEYS\.has\(activeProductKey\)/);
assert.match(service, /hasSensitiveHealthContext\(text\)/);
assert.doesNotMatch(service, /assignedAgent\s*:/);
assert.doesNotMatch(service, /metadata\.productKey['"]?\s*:/);
assert.doesNotMatch(service, /cura|sin contraindicaciones|100% seguro/i);
assert.match(packageJson.scripts['senior:check'], /ec-all-products-ingredients-v36\.test\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-ec-all-products-ingredients-activation-approved-v36\.mjs/);

console.log('EC_ALL_PRODUCTS_INGREDIENTS_V36_GUARD=OK');
