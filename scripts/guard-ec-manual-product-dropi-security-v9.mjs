import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/texUltraApprovedFreezeRuntimeGuardV9.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/ec-manual-product-dropi-security-v9-20260815.json'));

assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.country, 'EC');
assert.equal(manifest.productKey, 'tex_ultra_ec');
assert.equal(manifest.dropiSessionStorage.mode, '0600');
assert.equal(manifest.dropiSessionStorage.ownerOnly, true);

const service = read('src/services/droppiEcuadorBrowserService.js');
const sessionScript = read('scripts/save-dropi-session.mjs');
assert.match(service, /fs\.chmodSync\(STORAGE_STATE_PATH, 0o600\)/);
assert.match(sessionScript, /fs\.chmodSync\(config\.storageStatePath, 0o600\)/);

const packageJson = JSON.parse(read('package.json'));
for (const scriptName of ['senior:check', 'guard:tex-ultra-approved', 'deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], /guard-ec-manual-product-dropi-security-v9\.mjs/);
}
assert.match(read('src/index.js'), /texUltraApprovedFreezeRuntimeGuardV9\.js/);

console.log(`OK: ${manifest.freezeId} permanece integro e bloqueante.`);
