import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/texUltraApprovedFreezeRuntimeGuardV12.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/ec-manual-product-lead-badge-v12-20260815.json'));

assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.country, 'EC');
assert.equal(manifest.productKey, 'tex_ultra_ec');
assert.equal(manifest.leadBadge.structuredMarkerIsAuthoritative, true);
assert.equal(manifest.leadBadge.priceInferenceForbidden, true);
assert.equal(manifest.leadBadge.authenticatedReadOnlyHydration, true);

const route = read('src/routes/shipments.js');
assert.match(route, /router\.get\('\/droppi\/ec\/admin-leads\/flags', adminOnly/);
assert.match(route, /marker_pattern = re\.compile\(/);
assert.match(route, /flag\["productSelection"\] = product_selection/);
assert.doesNotMatch(route, /flag\["notes"\]/);
assert.doesNotMatch(route, /"suggestedStatus": suggested_status/);
assert.doesNotMatch(route, /product_key\s*=.*product_value/);

const packageJson = JSON.parse(read('package.json'));
for (const scriptName of ['senior:check', 'guard:tex-ultra-approved', 'deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], /guard-ec-manual-product-lead-badge-v12\.mjs/);
}
assert.match(read('src/index.js'), /texUltraApprovedFreezeRuntimeGuardV12\.js/);

console.log(`OK: ${manifest.freezeId} permanece integro e bloqueante.`);
