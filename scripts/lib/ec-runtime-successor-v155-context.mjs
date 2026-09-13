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

const current = canonicalJson('docs/freeze/ec-zapi-callback-race-reconciliation-v155-20260913.json');
const manifest = current.value;
const overrides = new Set(manifest.overrides || []);
const parent = canonicalJson('docs/freeze/ec-panel-manual-usage-guide-catchup-v154-20260913.json');
assert.equal(parent.value.freezeId, 'EC_PANEL_MANUAL_USAGE_GUIDE_CATCHUP_V154_20260913');
assert.equal(hashBuffer(parent.text), 'd3ee32ea6296625a47fa1bf9bc00ca7c5fd29ee46d99f11cd9733614172c57b8');
for (const [file, expected] of Object.entries(parent.value.protectedFiles || {})) {
    if (overrides.has(file)) continue;
    assert.equal(hashFile(file), expected, `[V155 parent V154] ${file}`);
}
assert.equal(manifest.freezeId, 'EC_ZAPI_CALLBACK_RACE_RECONCILIATION_V155_20260913');
assert.equal(manifest.version, 155);
assert.equal(manifest.parentCommit, '3379df2303dde775c5957d706d4685c8f9bdda36');
assert.equal(manifest.parentTree, '58f2062c0ecbe795666727b8c0b375c0b15cdc4c');
assert.equal(manifest.parentManifestSha256, 'd3ee32ea6296625a47fa1bf9bc00ca7c5fd29ee46d99f11cd9733614172c57b8');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());
for (const [file, expected] of Object.entries(manifest.protectedFiles || {})) {
    assert.equal(hashFile(file), expected, `[V155] ${file}`);
}

globalThis.__VITALISMEN_V155_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: hashBuffer(current.text),
    protectedFiles: Object.freeze({ ...(manifest.protectedFiles || {}) })
});
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...(manifest.overrides || [])])];
}
