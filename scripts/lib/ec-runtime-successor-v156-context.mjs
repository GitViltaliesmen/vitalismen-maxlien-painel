import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const hashBuffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => hashBuffer(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)));
const canonicalJson = (relative) => {
    const text = fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`);
    return { text, value };
};

const current = canonicalJson('docs/freeze/ec-panel-agency-compact-options-v156-20260913.json');
const manifest = current.value;
const overrides = new Set(manifest.overrides || []);
const parent = canonicalJson('docs/freeze/ec-zapi-callback-race-reconciliation-v155-20260913.json');
assert.equal(parent.value.freezeId, 'EC_ZAPI_CALLBACK_RACE_RECONCILIATION_V155_20260913');
assert.equal(hashBuffer(parent.text), '0caaa7c79ddd3582b6736179c733513d2ec91c5e729997476ddd4cc6539bc844');
for (const [file, expected] of Object.entries(parent.value.protectedFiles || {})) {
    if (overrides.has(file)) continue;
    assert.equal(hashFile(file), expected, `[V156 parent V155] ${file}`);
}
assert.equal(manifest.freezeId, 'EC_PANEL_AGENCY_COMPACT_OPTIONS_V156_20260913');
assert.equal(manifest.version, 156);
assert.equal(manifest.parentCommit, '5508829f634b566e826e70e428eae1f9416a0e07');
assert.equal(manifest.parentTree, '23828e7151b54fb339e25808054f84b04c256db2');
assert.equal(manifest.parentManifestSha256, '0caaa7c79ddd3582b6736179c733513d2ec91c5e729997476ddd4cc6539bc844');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());
for (const [file, expected] of Object.entries(manifest.protectedFiles || {})) {
    assert.equal(hashFile(file), expected, `[V156] ${file}`);
}

globalThis.__VITALISMEN_V156_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: hashBuffer(current.text),
    protectedFiles: Object.freeze({ ...(manifest.protectedFiles || {}) })
});
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...(manifest.overrides || [])])];
}
