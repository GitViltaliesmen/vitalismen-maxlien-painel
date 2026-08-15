import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/ecProductFunnelIsolationFreezeRuntimeGuardV13.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/ec-product-funnel-isolation-v13-20260815.json'));
const panel = read('public/qr.html');
const legacy = read('extensions/vitalismen-whatsapp-official/legacy-funnel-library.js');
const assistedTexFunnel = read('extensions/vitalismen-whatsapp-official/product-funnels/tex-ultra-ec.js');
const texCatalog = read('extensions/vitalismen-whatsapp-official/tex-ultra-order-catalog.js');
const sidepanel = read('extensions/vitalismen-whatsapp-official/sidepanel.html');
const extensionManifest = JSON.parse(read('extensions/vitalismen-whatsapp-official/manifest.json'));
const extensionRelease = JSON.parse(read('extensions/vitalismen-whatsapp-official/release.json'));

assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.country, 'EC');
assert.deepEqual(manifest.productKeys, ['nitrix_ec', 'vit_power_ec', 'tex_ultra_ec']);
assert.equal(manifest.manualSendOnly, true);
assert.equal(manifest.realCustomerTestForbidden, true);
assert.equal(manifest.publicationStatus, 'not_published');

assert.match(panel, /const activeFunnelProductKey = \(\) => normalizeCustomerProductKey/);
assert.match(panel, /value: 'tex_ultra_inicio_completo'/);
assert.match(panel, /Frasco Tex Ultra[^\n]+tex_ultra_bottle\.png/);
assert.match(panel, /value: 'tex_ultra_promotion_1'/);
assert.match(panel, /block\.productKey === 'all' \|\| block\.productKey === selectedProductKey/);
assert.match(panel, /1 frasco por solo \$35,99/);
assert.match(panel, /1 frasco por solo \$39,99/);

assert.match(legacy, /\.filter\(\(item\) => item\.productKey === productKey\)/);
assert.doesNotMatch(legacy, /productAwareCustomBlock/);
assert.match(legacy, /custom_text:text_1780282158837_bf20c0/);
for (const source of [assistedTexFunnel, texCatalog]) {
    assert.match(source, /1 frasco por solo \$35,99/);
    assert.doesNotMatch(source, /\b(?:1 mes|2 meses|3 meses|6 meses|1 mês)\b/i);
}
assert.doesNotMatch(sidepanel, /data-kit-quantity="[1236]"[^>]*><span>\d+ (?:mês|meses)</i);

assert.equal(extensionManifest.version, '0.13.7');
assert.equal(extensionRelease.version, extensionManifest.version);
const packageJson = JSON.parse(read('package.json'));
for (const scriptName of ['senior:check', 'guard:tex-ultra-approved', 'deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], /guard-ec-product-funnel-isolation-v13\.mjs/);
}
assert.match(read('src/index.js'), /ecProductFunnelIsolationFreezeRuntimeGuardV13\.js/);

console.log(`OK: ${manifest.freezeId} permanece integro, isolado por produto e bloqueante.`);
