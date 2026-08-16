import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/customerDataIntelligenceFreezeRuntimeGuardV15.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/customer-data-intelligence-v15-20260815.json'));
const panel = read('public/qr.html');
const zapi = read('src/routes/zapi.js');
const imageReader = read('src/services/customerImageDataReaderService.js');
const whatsappRoute = read('src/routes/whatsapp.js');
const normalizer = read('public/panel-intelligence/customer-data-normalizer.js');
const packageJson = JSON.parse(read('package.json'));

assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.country, 'EC');
assert.deepEqual(manifest.productKeys, ['nitrix_ec', 'vit_power_ec', 'tex_ultra_ec']);
assert.equal(manifest.publicationStatus, 'not_published');
assert.equal(manifest.productionUnchanged, true);

assert.match(zapi, /hola \(\?:quiero\|deseo\) el tratamiento[\s\S]{0,260}nombre\(\?: completo\)\?/);
assert.match(panel, /data-message-read-customer-image/);
assert.match(panel, /window\.confirm\([\s\S]{0,700}Aplicar estes campos à ficha/);
assert.match(imageReader, /store:\s*false/);
assert.match(imageReader, /type:\s*'json_schema'/);
assert.match(whatsappRoute, /read-customer-image', adminOnly/);
assert.match(whatsappRoute, /if \(message\.isFromMe\)/);
assert.match(normalizer, /shouldPreferExplicitPersonName/);

for (const scriptName of ['senior:check', 'guard:tex-ultra-approved', 'deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], /guard-customer-data-intelligence-v15\.mjs/);
}
assert.match(read('src/index.js'), /customerDataIntelligenceFreezeRuntimeGuardV15\.js/);

console.log(`OK: ${manifest.freezeId} preserva os freezes anteriores e bloqueia regressao.`);
