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

const v157ManifestUrl = new URL('../../docs/freeze/ec-dropi-preflight-repair-v157-20260913.json', import.meta.url);
let v157Overrides = new Set();
let v157ProtectedFiles = Object.freeze({});
if (fs.existsSync(v157ManifestUrl)) {
    const v157 = canonicalJson('docs/freeze/ec-dropi-preflight-repair-v157-20260913.json');
    assert.equal(v157.value.freezeId, 'EC_DROPI_PREFLIGHT_REPAIR_V157_20260913');
    assert.equal(v157.value.version, 157);
    assert.equal(v157.value.parentCommit, '398ea6cc233eea0b7dd1b641e0a99f303a9c79ec');
    assert.equal(v157.value.parentTree, 'f7e7f1fa2b445bb05fe3a77a07889c5252617b83');
    assert.equal(v157.value.parentManifestSha256, '2d1baf5011c0d5aebcd8498af6b6895a643e43a7e22947e70e27cce812bd55e2');
    assert.deepEqual([...v157.value.overrides].sort(), Object.keys(v157.value.protectedFiles || {}).sort());
    v157Overrides = new Set(v157.value.overrides || []);
    for (const [file, expected] of Object.entries(v157.value.protectedFiles || {})) {
        assert.equal(hashFile(file), expected, `[V157] ${file}`);
    }
    v157ProtectedFiles = Object.freeze({ ...(v157.value.protectedFiles || {}) });
    globalThis.__VITALISMEN_V157_CONTEXT = Object.freeze({
        loaded: true,
        freezeId: v157.value.freezeId,
        manifestSha256: hashBuffer(v157.text),
        protectedFiles: v157ProtectedFiles
    });
    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...(v157.value.overrides || [])])];
    }
}

const installV157ProtectedFilesBridge = (key) => {
    let context = Object.freeze({ protectedFiles: v157ProtectedFiles });
    Object.defineProperty(globalThis, key, {
        configurable: true,
        enumerable: true,
        get: () => context,
        set: (value) => {
            context = Object.freeze({
                ...(value && typeof value === 'object' ? value : {}),
                protectedFiles: Object.freeze({
                    ...(value?.protectedFiles || {}),
                    ...v157ProtectedFiles
                })
            });
        }
    });
};
if (v157Overrides.size) {
    for (const key of [
        '__VITALISMEN_V147_R5_CONTEXT',
        '__VITALISMEN_V147_R6_CONTEXT',
        '__VITALISMEN_V147_R6R2_CONTEXT',
        '__VITALISMEN_V148_CONTEXT'
    ]) installV157ProtectedFilesBridge(key);
}

const successorManifestUrl = new URL('../../docs/freeze/ec-panel-agency-compact-options-v156-20260913.json', import.meta.url);
let successorOverrides = new Set();
if (fs.existsSync(successorManifestUrl)) {
    const successor = canonicalJson('docs/freeze/ec-panel-agency-compact-options-v156-20260913.json');
    assert.equal(successor.value.freezeId, 'EC_PANEL_AGENCY_COMPACT_OPTIONS_V156_20260913');
    assert.equal(successor.value.version, 156);
    assert.equal(successor.value.parentCommit, '5508829f634b566e826e70e428eae1f9416a0e07');
    assert.equal(successor.value.parentTree, '23828e7151b54fb339e25808054f84b04c256db2');
    assert.equal(successor.value.parentManifestSha256, '0caaa7c79ddd3582b6736179c733513d2ec91c5e729997476ddd4cc6539bc844');
    assert.deepEqual([...successor.value.overrides].sort(), Object.keys(successor.value.protectedFiles || {}).sort());
    successorOverrides = new Set(successor.value.overrides || []);
    for (const [file, expected] of Object.entries(successor.value.protectedFiles || {})) {
        if (v157Overrides.has(file)) continue;
        assert.equal(hashFile(file), expected, `[V156] ${file}`);
    }
    const effectiveV156ProtectedFiles = Object.freeze(Object.fromEntries(
        Object.entries(successor.value.protectedFiles || {}).filter(([file]) => !v157Overrides.has(file))
    ));
    globalThis.__VITALISMEN_V156_CONTEXT = Object.freeze({
        loaded: true,
        freezeId: successor.value.freezeId,
        manifestSha256: hashBuffer(successor.text),
        protectedFiles: effectiveV156ProtectedFiles
    });
    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...(successor.value.overrides || [])])];
    }
}

const current = canonicalJson('docs/freeze/ec-zapi-callback-race-reconciliation-v155-20260913.json');
const manifest = current.value;
const overrides = new Set(manifest.overrides || []);
const parent = canonicalJson('docs/freeze/ec-panel-manual-usage-guide-catchup-v154-20260913.json');
assert.equal(parent.value.freezeId, 'EC_PANEL_MANUAL_USAGE_GUIDE_CATCHUP_V154_20260913');
assert.equal(hashBuffer(parent.text), 'd3ee32ea6296625a47fa1bf9bc00ca7c5fd29ee46d99f11cd9733614172c57b8');
for (const [file, expected] of Object.entries(parent.value.protectedFiles || {})) {
    if (overrides.has(file) || successorOverrides.has(file) || v157Overrides.has(file)) continue;
    assert.equal(hashFile(file), expected, `[V155 parent V154] ${file}`);
}
assert.equal(manifest.freezeId, 'EC_ZAPI_CALLBACK_RACE_RECONCILIATION_V155_20260913');
assert.equal(manifest.version, 155);
assert.equal(manifest.parentCommit, '3379df2303dde775c5957d706d4685c8f9bdda36');
assert.equal(manifest.parentTree, '58f2062c0ecbe795666727b8c0b375c0b15cdc4c');
assert.equal(manifest.parentManifestSha256, 'd3ee32ea6296625a47fa1bf9bc00ca7c5fd29ee46d99f11cd9733614172c57b8');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());
for (const [file, expected] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(file) || v157Overrides.has(file)) continue;
    assert.equal(hashFile(file), expected, `[V155] ${file}`);
}

const effectiveProtectedFiles = Object.freeze(Object.fromEntries(
    Object.entries(manifest.protectedFiles || {}).filter(([file]) => (
        !successorOverrides.has(file) && !v157Overrides.has(file)
    ))
));

globalThis.__VITALISMEN_V155_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: hashBuffer(current.text),
    protectedFiles: Object.freeze({ ...effectiveProtectedFiles, ...v157ProtectedFiles })
});
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...(manifest.overrides || [])])];
}
