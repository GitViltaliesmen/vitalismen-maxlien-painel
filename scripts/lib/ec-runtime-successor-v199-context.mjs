import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const MANIFEST = 'docs/freeze/ec-bot-core-health-meta-920-successor-v199-20260923.json';
const V198_MANIFEST = 'docs/freeze/tex-ultra-first-reply-source-dedupe-v198-20260923.json';
const V195_MANIFEST = 'docs/freeze/meta-canonical-consolidation-v195-20260923.json';
const V200_MANIFEST = 'docs/freeze/ec-panel-quality-successor-v200-20260923.json';
const V138_MANIFEST = 'docs/freeze/ec-dropi-human-authorization-v138-20260907.json';
const read = (relativePath) => fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const manifestText = read(MANIFEST).toString('utf8');
const manifest = JSON.parse(manifestText);
const v198ManifestText = read(V198_MANIFEST).toString('utf8');
const v198Manifest = JSON.parse(v198ManifestText);
const v195ManifestText = read(V195_MANIFEST).toString('utf8');
const v195Manifest = JSON.parse(v195ManifestText);
const v200ManifestText = read(V200_MANIFEST).toString('utf8');
const v200Manifest = JSON.parse(v200ManifestText);
const v138ManifestText = read(V138_MANIFEST).toString('utf8');
const v138Manifest = JSON.parse(v138ManifestText);

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, '[V199] manifest_not_canonical');
assert.equal(manifest.freezeId, 'EC_BOT_CORE_HEALTH_META_920_SUCCESSOR_V199_20260923');
assert.equal(manifest.version, 'V199');
assert.equal(manifest.baseCommit, '8eacfd4e89ad898803a63753ec2ea026b8e36efb');
assert.equal(manifest.parentFreezeId, 'TEX_ULTRA_FIRST_REPLY_SOURCE_DEDUPE_V198_20260923');
assert.equal(manifest.policy?.legacyDataset, '1468946114265008');
assert.equal(manifest.policy?.canonicalProfile, 'meta_canonical_920_v195');
assert.equal(manifest.policy?.canonicalDataset, '920532663934291');
assert.equal(manifest.policy?.legacyContractPreserved, true);
assert.equal(manifest.policy?.failClosed, true);
assert.equal(manifest.policy?.genericRelaxation, false);
assert.equal(manifest.policy?.guardsBypassed, false);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());

assert.equal(v198ManifestText, `${JSON.stringify(v198Manifest, null, 2)}\n`, '[V199] v198_manifest_not_canonical');
assert.equal(sha256(v198ManifestText), 'a33a5c357fdf87e50ea629ee58d717665c1838eec1bcf21673bc38ce16c30d8d');
assert.equal(v198Manifest.freezeId, manifest.parentFreezeId);
assert.equal(v198Manifest.policy?.guardsBypassed, false);

assert.equal(v195ManifestText, `${JSON.stringify(v195Manifest, null, 2)}\n`, '[V199] v195_manifest_not_canonical');
assert.equal(sha256(v195ManifestText), 'ffe319bc3f0a336d9353cd4957b23478fe25c788f243cc1f9670d8024ac793a6');
assert.equal(v195Manifest.freezeId, 'META_CANONICAL_CONSOLIDATION_V195_20260923');
assert.equal(v195Manifest.policy?.canonicalDataset, manifest.policy.canonicalDataset);
assert.equal(v200ManifestText, `${JSON.stringify(v200Manifest, null, 2)}\n`, '[V199] v200_manifest_not_canonical');
assert.equal(sha256(v200ManifestText), 'd8dd5c5c375292c50076cc1f268056960d8f72e9002c8c124289fcda7efa27ee');
assert.equal(v200Manifest.freezeId, v198Manifest.baseFreezeId);
assert.equal(v200Manifest.policy?.guardBypassAllowed, false);
assert.equal(v138ManifestText, `${JSON.stringify(v138Manifest, null, 2)}\n`, '[V199] v138_manifest_not_canonical');
assert.equal(sha256(v138ManifestText), '5685b6866a05cfd5307b0084573c2de3a5e0b1c0f948d0efbf8a24b01ed719c7');
assert.equal(v138Manifest.version, 138);

const combinedProtectedFiles = Object.freeze({
    ...v195Manifest.protectedFiles,
    ...v200Manifest.protectedFiles,
    ...v198Manifest.protectedFiles,
    ...manifest.protectedFiles
});
const combinedAuthorizedFiles = Object.freeze(Object.keys(combinedProtectedFiles));
const earlySuccessorFiles = Object.freeze(['tests/ec-admin-dropi-draft-bridge-v128.test.mjs']);
for (const relativePath of earlySuccessorFiles) {
    assert.ok(v138Manifest.overrides.includes(relativePath), `[V199] v138_override_missing:${relativePath}`);
    assert.equal(sha256(read(relativePath)), v138Manifest.protectedFiles[relativePath], `[V199] v138_successor_invalid:${relativePath}`);
}

globalThis.__VITALISMEN_V195_META_CANONICAL_PRELOAD = Object.freeze({
    freezeId: v195Manifest.freezeId,
    canonicalDataset: v195Manifest.policy.canonicalDataset,
    authorizedFiles: combinedAuthorizedFiles,
    protectedFiles: combinedProtectedFiles
});

globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...new Set([
        ...(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []),
        ...v195Manifest.overrides,
        ...v200Manifest.overrides,
        ...earlySuccessorFiles,
        ...v198Manifest.overrides,
        ...manifest.overrides
    ])
];

await import('./ec-runtime-successor-v194-context.mjs');

const v171Context = globalThis.__VITALISMEN_V171_TRAFFIC_RESTORATION_CONTEXT;
const v170Context = globalThis.__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT;
assert.equal(v170Context?.loaded, true, '[V199] v170_context_not_loaded');
assert.equal(v171Context?.loaded, true, '[V199] v171_context_not_loaded');
globalThis.__VITALISMEN_V171_TRAFFIC_RESTORATION_CONTEXT = Object.freeze({
    ...v171Context,
    protectedFiles: Object.freeze({
        ...v171Context.protectedFiles,
        ...v170Context.protectedFiles,
        ...combinedProtectedFiles
    })
});

for (const [relativePath, expected] of Object.entries(combinedProtectedFiles)) {
    const actual = sha256(read(relativePath));
    assert.equal(actual, expected, `[V199] protected_file_invalid:${relativePath}`);
}

globalThis.__VITALISMEN_V195_META_CANONICAL_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: v195Manifest.freezeId,
    baseCommit: v195Manifest.baseCommit,
    manifestSha256: sha256(v195ManifestText),
    authorizedFiles: combinedAuthorizedFiles,
    protectedFiles: combinedProtectedFiles,
    policy: Object.freeze({ ...v195Manifest.policy })
});

globalThis.__VITALISMEN_V198_TEX_ULTRA_FIRST_REPLY_DEDUPE_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: v198Manifest.freezeId,
    baseCommit: v198Manifest.baseCommit,
    manifestSha256: sha256(v198ManifestText),
    authorizedFiles: Object.freeze([...v198Manifest.overrides]),
    protectedFiles: Object.freeze({ ...v198Manifest.protectedFiles }),
    policy: Object.freeze({ ...v198Manifest.policy })
});

globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    baseCommit: manifest.baseCommit,
    manifestSha256: sha256(manifestText),
    authorizedFiles: Object.freeze([...manifest.overrides]),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles }),
    policy: Object.freeze({ ...manifest.policy })
});
