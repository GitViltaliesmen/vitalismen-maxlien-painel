import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/ecDirectProductNameFreezeRuntimeGuardV39.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const directLayer = read('src/services/ecDirectProductInquiryService.js');
const zapi = read('src/routes/zapi.js');
const router = read('src/services/agentRouter.js');
const engine = read('src/services/conversationEngine.js');
const panel = read('public/qr.html');
const chatsRoute = read('src/routes/whatsapp.js');
const postSale = read('src/services/texUltraConfirmedPostSaleLayerService.js');
const successor = 'node src/services/ecDirectProductNameFreezeRuntimeGuardV39.js';

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
    'guard:inbound-media-path-portability-v38',
    'guard:ec-direct-product-name-postsale-v39',
    'guard:ec-nitrix',
    'guard:ec-identity',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.equal(String(packageJson.scripts[scriptName] || '').startsWith(successor), true, `${scriptName} não usa V39`);
}

assert.match(index, /import '\.\/services\/ecDirectProductNameFreezeRuntimeGuardV39\.js';/);
assert.doesNotMatch(index, /^import '.+inboundMediaPathPortabilityFreezeRuntimeGuardV38\.js';/m);
assert.match(engine, /maybeHandleEcuadorDirectProductInquiry/);
assert.match(router, /shouldRouteDirectProductInbound/);
assert.match(router, /directProductInquiryHumanModePreserved: true/);
assert.match(zapi, /normalizedInboundProfileName/);
assert.match(zapi, /directProductInbound/);
assert.match(zapi, /detectedTextProductContext\?\.productSource === 'zapi_explicit_product_text'/);
assert.match(directLayer, /isOperatorProductRouteLock/);
assert.match(directLayer, /isCurrentAuthoritativeVslRequest/);
assert.match(directLayer, /priceCatalog: 'normal'/);
assert.match(directLayer, /priceCatalog: 'promotional'/);
assert.match(directLayer, /explicit_price_objection/);
assert.match(directLayer, /recentOutboundHistoryHasText/);
assert.match(directLayer, /persistent_lock/);
assert.match(directLayer, /\.sentAt/);
assert.doesNotMatch(directLayer, /['"]metadata\.vslProductKey['"]\s*:/);
assert.match(panel, /const displayIdentity = displayName && displayName !== displayPhone/);
assert.match(panel, /activeMeta.*displayIdentity/);
assert.match(chatsRoute, /panelDraft\.name \|\| contactState\?\.metadata\?\.profileName/);
assert.match(postSale, /confirmedAudioHistory/);
assert.match(postSale, /history_already_sent/);
assert.match(postSale, /AGRADECIMENTO_AGENCIA_DE_ENTREGA/);
assert.match(postSale, /BONUS_RETIRADA/);
assert.match(postSale, /dedupeValue/);
assert.match(packageJson.scripts['senior:check'], /ec-direct-product-name-v39\.test\.mjs/);
assert.equal(packageJson.scripts.lint, 'node scripts/lint-js-syntax.mjs');
assert.match(packageJson.scripts['deploy:vps'], /assert-ec-direct-product-name-postsale-activation-approved-v39\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /ec-direct-product-name-v39\.test\.mjs/);
assert.doesNotMatch(panel, /chat\.lastMessage\.body[\s\S]{0,120}class="chat-preview/);

console.log('EC_DIRECT_PRODUCT_NAME_POSTSALE_V39_GUARD=OK');
