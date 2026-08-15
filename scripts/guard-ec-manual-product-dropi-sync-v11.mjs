import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/texUltraApprovedFreezeRuntimeGuardV11.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/ec-manual-product-dropi-sync-v11-20260815.json'));

assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.country, 'EC');
assert.equal(manifest.productKey, 'tex_ultra_ec');
assert.equal(manifest.dropiSync.submittedReceiptIsStable, true);
assert.equal(manifest.dropiSync.logisticsStatusStoredSeparately, true);

const service = read('src/services/droppiEcuadorService.js');
assert.match(service, /const preserveSubmittedReceipt = Boolean\(/);
assert.match(service, /status: 'submitted'/);
assert.match(service, /dropiStatus: payload\.status/);

const packageJson = JSON.parse(read('package.json'));
for (const scriptName of ['senior:check', 'guard:tex-ultra-approved', 'deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], /guard-ec-manual-product-dropi-sync-v11\.mjs/);
}
assert.match(read('src/index.js'), /texUltraApprovedFreezeRuntimeGuardV11\.js/);

console.log(`OK: ${manifest.freezeId} permanece integro e bloqueante.`);
