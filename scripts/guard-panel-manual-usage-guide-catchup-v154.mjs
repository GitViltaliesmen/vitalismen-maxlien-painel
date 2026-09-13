import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const manifestPath = 'docs/freeze/ec-panel-manual-usage-guide-catchup-v154-20260913.json';
const text = read(manifestPath);
const manifest = JSON.parse(text);
assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_PANEL_MANUAL_USAGE_GUIDE_CATCHUP_V154_20260913');
assert.equal(manifest.version, 154);
assert.equal(manifest.parentCommit, '3321216fbc75e51636883766860524c050a88d39');
assert.equal(manifest.parentTree, '85063ae8d370ce8328dc0ef3df33c473e69c3df7');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
for (const [relative, expected] of Object.entries(manifest.protectedFiles)) {
    assert.equal(hash(relative), expected, `V154 protected file diverged: ${relative}`);
}
const adapter = read('src/services/postSaleManualPanelV147R6Service.js');
assert.match(adapter, /manualLibraryUsageV154/);
assert.match(adapter, /content\?\.canonicalEvent === 'P7'/);
assert.match(adapter, /if \(manualLibraryUsageV154\) return \{ handled: false \}/);
assert.match(adapter, /MODO_DE_USO_TEX_ULTRA/);
assert.doesNotMatch(adapter, /manualLibraryUsageV154[\s\S]{0,500}Chegou_01/);
const v97Context = read('scripts/lib/ec-runtime-successor-v97-context.mjs');
assert.match(v97Context, /^import '\.\/ec-runtime-successor-v144-bootstrap-context\.mjs';/);
const bootstrap = read('scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs');
assert.ok(bootstrap.indexOf("ec-runtime-successor-v154-context.mjs") < bootstrap.indexOf("ec-runtime-successor-v153-context.mjs"));
assert.equal(manifest.policy.pickupBypassAllowed, false);
assert.equal(manifest.policy.historicalBurstAllowed, false);
console.log('EC_PANEL_MANUAL_USAGE_GUIDE_CATCHUP_V154=PASS');
