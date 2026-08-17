import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/orderPublicProductIntegrityFreezeRuntimeGuardV20.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/order-public-product-integrity-v20-20260817.json'));
const index = read('src/index.js');
const packageJson = JSON.parse(read('package.json'));
const ordersRoute = read('src/routes/orders.js');
const successorPattern = /guard-order-public-product-integrity-v20\.mjs/;

assert.equal(manifest.freezeId, 'order-public-product-integrity-v20-20260817');
assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.country, 'EC');
assert.equal(manifest.publicationStatus, 'candidate_validated_not_published');
assert.equal(manifest.policy.publicOperationalStatusAllowed, false);
assert.equal(manifest.policy.authenticatedOperationalStatusPreserved, true);
assert.equal(manifest.policy.publicMetaPurchaseSendAllowed, false);
assert.equal(manifest.policy.explicitProductRequiredBeforePending, true);
assert.equal(manifest.policy.conflictingProductIdentifiersAccepted, false);
assert.equal(manifest.policy.draftCaptureWithoutProductPreserved, true);
assert.equal(manifest.policy.pricesChanged, false);
assert.equal(manifest.policy.commercialFunnelChanged, false);
assert.equal(manifest.policy.externalSendsAdded, false);

assert.match(index, /import '\.\/services\/orderPublicProductIntegrityFreezeRuntimeGuardV20\.js';/);
assert.doesNotMatch(index, /^import '\.\/services\/metaPurchasePanelLinkageFreezeRuntimeGuardV19\.js';/m);
assert.match(ordersRoute, /const productInfoFromOrderRequest = [\s\S]*?strictEcuadorProductSelection/);
assert.match(ordersRoute, /if \(isLocalPanelAuthBypassRequest\(req\)\) return authMiddleware/);
assert.match(ordersRoute, /if \(!hasBearer \|\| isPanelAuthDisabled\(req\)\) return next\(\)/);

const publicCreateStart = ordersRoute.indexOf("router.post('/', optionalPanelAuth");
const publicCreateEnd = ordersRoute.indexOf("router.patch('/:id'", publicCreateStart);
const publicCreate = ordersRoute.slice(publicCreateStart, publicCreateEnd);
assert.ok(publicCreateStart >= 0, 'criacao direta deve usar autenticacao opcional do painel');
assert.match(publicCreate, /allowedPublicInitialStatuses = new Set\(\['draft', 'pending'\]\)/);
assert.match(publicCreate, /const allowedInitialStatuses = req\.user/);
assert.match(publicCreate, /if \(requestedStatus && !allowedInitialStatuses\.has\(requestedStatus\)\)/);
assert.match(publicCreate, /productInfoFromOrderRequest/);
assert.match(publicCreate, /if \(initialStatus === 'confirmed' && req\.user\)/);

const draftSubmitStart = ordersRoute.indexOf("router.post('/draft/:id/submit'");
const draftSubmitEnd = ordersRoute.indexOf('// LEGACY ROUTES', draftSubmitStart);
const draftSubmit = ordersRoute.slice(draftSubmitStart, draftSubmitEnd);
const productGate = draftSubmit.indexOf('if (!productSelection.ok)');
assert.ok(draftSubmitStart >= 0 && productGate >= 0, 'submit de rascunho deve exigir produto EC explicito');
assert.ok(draftSubmit.indexOf('assertNoActiveDuplicateOrder') > productGate);
assert.ok(draftSubmit.indexOf('await order.save()') > productGate);

const authenticatedPatchStart = ordersRoute.indexOf("router.patch('/:id'");
const authenticatedPatchEnd = ordersRoute.indexOf("router.post('/:id/send-to-review'", authenticatedPatchStart);
const authenticatedPatch = ordersRoute.slice(authenticatedPatchStart, authenticatedPatchEnd);
assert.match(authenticatedPatch, /strictEcuadorProductSelection/);
assert.match(authenticatedPatch, /sendExplicitProductError/);

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:operational-mode-zapi-health',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.match(packageJson.scripts[scriptName], successorPattern, `${scriptName} deve usar V20`);
}
for (const scriptName of ['senior:check', 'deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], /tests\/review-v17-v19-p1\.test\.mjs/);
    assert.match(packageJson.scripts[scriptName], /tests\/order-public-product-integrity-v20\.test\.mjs/);
}

console.log(`[ORDER-PUBLIC-PRODUCT-INTEGRITY-GUARD-V20] OK: ${manifest.freezeId}.`);
