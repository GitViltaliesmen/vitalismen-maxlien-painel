import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/panelZapiAuthStatusFreezeRuntimeGuardV37.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const panel = read('public/qr.html');
const zapiRoute = read('src/routes/zapi.js');
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
    assert.equal(String(packageJson.scripts[scriptName] || '').startsWith(successor), true, `${scriptName} não usa V37`);
}

assert.match(index, /import '\.\/services\/panelZapiAuthStatusFreezeRuntimeGuardV37\.js';/);
assert.doesNotMatch(index, /^import '.+ecAllProductsIngredientsFreezeRuntimeGuardV36\.js';/m);
assert.match(zapiRoute, /router\.get\('\/status', authMiddleware,/);
assert.match(panel, /const signedOutZapiText = 'Faça login para consultar a conexão'/);
assert.match(panel, /async function checkStatus\(\) \{\s*if \(!state\.token\)/);
assert.match(panel, /setSignedOutZapiState\(\);\s*renderOperationalAlerts\(\);\s*return;/);
assert.match(panel, /response\.status === 401 \|\| response\.status === 403/);
assert.match(panel, /new Error\('Sessão expirada\. Entre novamente\.'\)/);
assert.match(panel, /bootstrapAuth\(\);\s*<\/script>/);
assert.doesNotMatch(panel, /checkStatus\(\);\s*bootstrapAuth\(\);/);
assert.match(packageJson.scripts['senior:check'], /panel-zapi-auth-status-v37\.test\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-panel-zapi-auth-status-activation-approved-v37\.mjs/);
assert.doesNotMatch(panel, /ZAPI_TOKEN\s*=/);
assert.doesNotMatch(panel, /ZAPI_INSTANCE_ID\s*=/);

console.log('PANEL_ZAPI_AUTH_STATUS_V37_GUARD=OK');
