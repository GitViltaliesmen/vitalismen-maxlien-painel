import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/texUltraApprovedFreezeRuntimeGuardV8.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/ec-manual-product-dropi-hotfix-v8-20260815.json'));

assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.country, 'EC');
assert.equal(manifest.productKey, 'tex_ultra_ec');
assert.equal(manifest.requiresWrittenAuthorizationToChange, true);
assert.equal(manifest.manualProductPolicy.currentDraftWins, true);
assert.equal(manifest.manualProductPolicy.conversationHistoryIsFallbackOnly, true);
assert.equal(manifest.manualProductPolicy.trackingMetadataFollowsCurrentDraft, true);
assert.deepEqual(manifest.priceTable.original, ['1:39.99', '2:70.00', '3:95.99', '6:167.99']);
assert.deepEqual(manifest.priceTable.promotional, ['1:35.99', '2:70.00', '3:80.99', '6:147.99']);
assert.equal(manifest.dropiSession.releaseLocalPathForbidden, true);
assert.equal(manifest.dropiSession.stableHomeDirectory, '.vitalismen-secrets');

const route = read('src/routes/whatsapp.js');
assert.match(route, /const explicitDraftProductKey = detectExplicitEcuadorProductKey\(draft\)/);
assert.match(route, /productSelectionSource: 'manual_customer_draft'/);
assert.match(route, /\.\.\.ecuadorProductMetadata\(productInfo\)/);

const dropi = read('src/services/droppiEcuadorBrowserService.js');
assert.match(dropi, /DEFAULT_STORAGE_STATE_PATH/);
assert.match(dropi, /path\.isAbsolute\(CONFIGURED_STORAGE_STATE_PATH\)/);
assert.match(dropi, /productSelectionSource === 'manual_customer_draft'/);

const panel = read('public/qr.html');
assert.match(panel, /data-price-preset="2:70\.00"/);
assert.match(panel, /const customerPricePresetsEc = \[/);
assert.doesNotMatch(panel, /data-price-preset="2:70(?:\.00)?"[^>]*\shidden(?:\s|>)/);

const packageJson = JSON.parse(read('package.json'));
for (const scriptName of ['senior:check', 'guard:tex-ultra-approved', 'deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], /guard-ec-manual-product-dropi-hotfix-v8\.mjs/);
}
assert.match(read('src/index.js'), /texUltraApprovedFreezeRuntimeGuardV8\.js/);

console.log(`OK: ${manifest.freezeId} permanece integro e bloqueante.`);
