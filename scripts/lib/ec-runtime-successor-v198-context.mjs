import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const MANIFEST = 'docs/freeze/tex-ultra-first-reply-source-dedupe-v198-20260923.json';
const PARENT_MANIFEST = 'docs/freeze/meta-canonical-consolidation-v195-20260923.json';
const V200_MANIFEST = 'docs/freeze/ec-panel-quality-successor-v200-20260923.json';
const V138_MANIFEST = 'docs/freeze/ec-dropi-human-authorization-v138-20260907.json';
const read = (relativePath) => fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url));
const manifestText = read(MANIFEST).toString('utf8');
const manifest = JSON.parse(manifestText);
const parentManifestText = read(PARENT_MANIFEST).toString('utf8');
const parentManifest = JSON.parse(parentManifestText);
const v200ManifestText = read(V200_MANIFEST).toString('utf8');
const v200Manifest = JSON.parse(v200ManifestText);
const v138ManifestText = read(V138_MANIFEST).toString('utf8');
const v138Manifest = JSON.parse(v138ManifestText);

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, '[V198] manifest_not_canonical');
assert.equal(manifest.freezeId, 'TEX_ULTRA_FIRST_REPLY_SOURCE_DEDUPE_V198_20260923');
assert.equal(manifest.version, 'V198');
assert.equal(manifest.baseCommit, 'e1b7896527f70b414d80eaeb30385364dbbbe321');
assert.equal(manifest.baseFreezeId, 'EC_PANEL_QUALITY_SUCCESSOR_V200_20260923');
assert.equal(manifest.policy?.guardsBypassed, false);
assert.equal(manifest.policy?.sameSourceDuplicateBlocked, true);
assert.equal(manifest.policy?.newSourceSameTextAllowedOnce, true);
assert.equal(manifest.policy?.historicalLedgerMutationAllowed, false);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());
assert.equal(parentManifestText, `${JSON.stringify(parentManifest, null, 2)}\n`, '[V198] parent_manifest_not_canonical');
assert.equal(crypto.createHash('sha256').update(parentManifestText).digest('hex'), 'ffe319bc3f0a336d9353cd4957b23478fe25c788f243cc1f9670d8024ac793a6');
assert.equal(parentManifest.freezeId, 'META_CANONICAL_CONSOLIDATION_V195_20260923');
assert.equal(parentManifest.policy?.canonicalDataset, '920532663934291');
assert.equal(v200ManifestText, `${JSON.stringify(v200Manifest, null, 2)}\n`, '[V198] v200_manifest_not_canonical');
assert.equal(crypto.createHash('sha256').update(v200ManifestText).digest('hex'), 'd8dd5c5c375292c50076cc1f268056960d8f72e9002c8c124289fcda7efa27ee');
assert.equal(v200Manifest.freezeId, manifest.baseFreezeId);
assert.equal(v200Manifest.policy?.guardBypassAllowed, false);
assert.equal(v138ManifestText, `${JSON.stringify(v138Manifest, null, 2)}\n`, '[V198] v138_manifest_not_canonical');
assert.equal(crypto.createHash('sha256').update(v138ManifestText).digest('hex'), '5685b6866a05cfd5307b0084573c2de3a5e0b1c0f948d0efbf8a24b01ed719c7');
assert.equal(v138Manifest.version, 138);

const combinedProtectedFiles = Object.freeze({
    ...parentManifest.protectedFiles,
    ...v200Manifest.protectedFiles,
    ...manifest.protectedFiles
});
const combinedAuthorizedFiles = Object.freeze(Object.keys(combinedProtectedFiles));
const earlySuccessorFiles = Object.freeze(['tests/ec-admin-dropi-draft-bridge-v128.test.mjs']);
for (const relativePath of earlySuccessorFiles) {
    assert.ok(v138Manifest.overrides.includes(relativePath), `[V198] v138_override_missing:${relativePath}`);
    const actual = crypto.createHash('sha256').update(read(relativePath)).digest('hex');
    assert.equal(actual, v138Manifest.protectedFiles[relativePath], `[V198] v138_successor_invalid:${relativePath}`);
}

globalThis.__VITALISMEN_V195_META_CANONICAL_PRELOAD = Object.freeze({
    freezeId: parentManifest.freezeId,
    canonicalDataset: parentManifest.policy.canonicalDataset,
    authorizedFiles: combinedAuthorizedFiles,
    protectedFiles: combinedProtectedFiles
});

globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...new Set([
        ...(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []),
        ...parentManifest.overrides,
        ...v200Manifest.overrides,
        ...earlySuccessorFiles,
        ...manifest.overrides
    ])
];

await import('./ec-runtime-successor-v194-context.mjs');

const v171Context = globalThis.__VITALISMEN_V171_TRAFFIC_RESTORATION_CONTEXT;
const v170Context = globalThis.__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT;
assert.equal(v170Context?.loaded, true, '[V198] v170_context_not_loaded');
assert.equal(v171Context?.loaded, true, '[V198] v171_context_not_loaded');
globalThis.__VITALISMEN_V171_TRAFFIC_RESTORATION_CONTEXT = Object.freeze({
    ...v171Context,
    protectedFiles: Object.freeze({
        ...v171Context.protectedFiles,
        ...v170Context.protectedFiles,
        ...combinedProtectedFiles
    })
});

for (const [relativePath, expected] of Object.entries(parentManifest.protectedFiles || {})) {
    const actual = crypto.createHash('sha256').update(read(relativePath)).digest('hex');
    assert.equal(actual, expected, `[V198/V195] parent_protected_file_invalid:${relativePath}`);
}

globalThis.__VITALISMEN_V195_META_CANONICAL_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: parentManifest.freezeId,
    baseCommit: parentManifest.baseCommit,
    manifestSha256: crypto.createHash('sha256').update(parentManifestText).digest('hex'),
    authorizedFiles: combinedAuthorizedFiles,
    protectedFiles: combinedProtectedFiles,
    policy: Object.freeze({ ...parentManifest.policy })
});

for (const [relativePath, expected] of Object.entries(manifest.protectedFiles || {})) {
    const actual = crypto.createHash('sha256').update(read(relativePath)).digest('hex');
    assert.equal(actual, expected, `[V198] protected_file_invalid:${relativePath}`);
}

globalThis.__VITALISMEN_V198_TEX_ULTRA_FIRST_REPLY_DEDUPE_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    baseCommit: manifest.baseCommit,
    manifestSha256: crypto.createHash('sha256').update(manifestText).digest('hex'),
    authorizedFiles: Object.freeze([...manifest.overrides]),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles }),
    policy: Object.freeze({ ...manifest.policy })
});
