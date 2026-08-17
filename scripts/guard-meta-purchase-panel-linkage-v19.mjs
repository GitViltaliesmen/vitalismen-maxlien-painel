import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/metaPurchasePanelLinkageFreezeRuntimeGuardV19.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/meta-purchase-panel-linkage-v19-20260817.json'));
const index = read('src/index.js');
const packageJson = JSON.parse(read('package.json'));
const panel = read('public/leads-window.html');
const shipmentsRoute = read('src/routes/shipments.js');
const ordersRoute = read('src/routes/orders.js');
const successorPattern = /guard-meta-purchase-panel-linkage-v19\.mjs/;

assert.equal(manifest.freezeId, 'meta-purchase-panel-linkage-v19-20260817');
assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.country, 'EC');
assert.equal(manifest.publicationStatus, 'approved_for_production');
assert.equal(manifest.policy.metaPurchaseDeliveryChanged, false);
assert.equal(manifest.policy.metaPurchaseResendAdded, false);
assert.equal(manifest.policy.purchaseLockDisplayedByLeadId, true);
assert.equal(manifest.policy.offlineLabelForUnlinkedLead, false);
assert.equal(manifest.policy.pricesChanged, false);
assert.equal(manifest.policy.commercialFunnelChanged, false);
assert.equal(manifest.policy.externalSendsAdded, false);

assert.match(index, /import '\.\/services\/metaPurchasePanelLinkageFreezeRuntimeGuardV19\.js';/);
assert.doesNotMatch(index, /^import '\.\/services\/dropiAutomaticSubmitReliabilityFreezeRuntimeGuardV18\.js';/m);
assert.match(shipmentsRoute, /purchase_capi_lock/);
assert.match(shipmentsRoute, /flag\["metaPurchaseSentAt"\]/);
assert.match(panel, />Meta Purchase enviado<\/span>/);
assert.match(panel, />Meta sem vinculo<\/span>/);
assert.doesNotMatch(panel, />Meta offline<\/span>/);
assert.match(ordersRoute, /if \(order\.tracking\.metaPurchaseSentAt\)/);
assert.match(ordersRoute, /order\.tracking\.metaPurchaseEventId = result\.eventId/);

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:operational-mode-zapi-health',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.match(packageJson.scripts[scriptName], successorPattern, `${scriptName} deve usar V19`);
}
assert.match(packageJson.scripts['senior:check'], /tests\/meta-purchase-panel-linkage\.test\.mjs/);
assert.match(packageJson.scripts['deploy:ec-safe'], /tests\/meta-purchase-panel-linkage\.test\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /tests\/meta-purchase-panel-linkage\.test\.mjs/);

console.log(`[META-PURCHASE-PANEL-LINKAGE-GUARD-V19] OK: ${manifest.freezeId}.`);
