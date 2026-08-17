import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/productionSecurityProductIntegrityFreezeRuntimeGuardV17.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/production-security-product-integrity-v17-20260817.json'));
const index = read('src/index.js');
const panel = read('public/qr.html');
const whatsapp = read('src/routes/whatsapp.js');
const zapi = read('src/routes/zapi.js');
const observation = read('src/routes/observation.js');
const products = read('src/services/ecuadorProductService.js');
const meta = read('src/services/metaConversionsService.js');
const browser = read('src/services/droppiEcuadorBrowserService.js');
const envExample = read('.env.example');
const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));
const successorPattern = /guard-production-security-product-integrity-v17\.mjs/;

assert.equal(manifest.freezeId, 'production-security-product-integrity-v17-20260817');
assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.country, 'EC');
assert.equal(manifest.publicationStatus, 'approved_for_production');
assert.equal(manifest.policy.authenticatedSensitiveRoutes, true);
assert.equal(manifest.policy.unknownProductSelectsRealProduct, false);
assert.equal(manifest.policy.pricesChanged, false);
assert.equal(manifest.policy.commercialFunnelChanged, false);
assert.equal(manifest.policy.externalSendsAdded, false);

for (const [modulePath, version] of Object.entries({
    'node_modules/@whiskeysockets/baileys': '6.7.24',
    'node_modules/axios': '1.19.0',
    'node_modules/express': '4.22.2',
    'node_modules/mongoose': '8.24.3',
    'node_modules/protobufjs': '7.6.5',
    'node_modules/sharp': '0.35.3',
    'node_modules/ws': '8.21.3'
})) {
    assert.equal(packageLock.packages?.[modulePath]?.version, version, `lock inesperado para ${modulePath}`);
}

assert.match(whatsapp, /router\.get\('\/status', authMiddleware,/);
for (const routePath of ['config', 'status', 'device']) {
    assert.match(zapi, new RegExp(`router\\.get\\('\\/${routePath}', authMiddleware,`));
}
assert.match(observation, /router\.use\(authMiddleware\)/);
assert.match(panel, /Authorization: `Bearer \$\{state\.token\}`/);
assert.match(zapi, /router\.get\('\/whatsapp-link', async/);
assert.match(zapi, /router\.post\('\/webhook', async/);
assert.match(whatsapp, /router\.post\('\/vsl-entry', async/);

assert.match(products, /return ECUADOR_UNKNOWN_PRODUCT/);
assert.doesNotMatch(products, /if \(!productKey\) return ECUADOR_PRODUCTS\.nitrix/);
assert.match(meta, /META Purchase missing explicit EC product/);
assert.match(browser, /if \(!rowProduct\.key \|\| !shipmentProduct\.key\) return false/);

for (const line of [
    'PANEL_AUTH_DISABLED=false',
    'VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED=false',
    'VIT_POWER_FUNNEL_ACTIVE=false',
    'WHATSAPP_AUTO_REPLY_ENABLED=false',
    'ZAPI_ROUTE_INBOUND_TO_BOT=false',
    'WHATSAPP_FUNNEL_ENABLED=false',
    'DISABLE_SCHEDULER=1',
    'SHIPMENT_STATUS_DISPATCH_ENABLED=false',
    'SHIPMENT_PICKUP_REMINDERS_ENABLED=false',
    'PICKUP_PROOF_SWEEP_ENABLED=false',
    'WHATSAPP_PRODUCT_FOLLOWUP_ENABLED=false',
    'PENDING_CHECKOUT_FOLLOWUP_ENABLED=false',
    'BOT_USE_APPROVED_AUDIO_ONLY=true',
    'OBSERVER_OPENAI_ENABLED=true'
]) {
    assert.match(envExample, new RegExp(`^${line}$`, 'm'), `.env.example ausente: ${line}`);
}

assert.match(index, /import '\.\/services\/productionSecurityProductIntegrityFreezeRuntimeGuardV17\.js';/);
assert.doesNotMatch(index, /^import '\.\/services\/operationalModeZapiHealthFreezeRuntimeGuardV16\.js';/m);
for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:operational-mode-zapi-health',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.match(packageJson.scripts[scriptName], successorPattern, `${scriptName} deve usar V17`);
}
assert.match(packageJson.scripts['senior:check'], /tests\/panel-sensitive-routes-auth\.test\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tests\/ecuador-product-unknown\.test\.mjs/);

console.log(`[PRODUCTION-SECURITY-PRODUCT-INTEGRITY-GUARD-V17] OK: ${manifest.freezeId}.`);
