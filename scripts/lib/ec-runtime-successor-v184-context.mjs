import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const V181_MANIFEST = 'docs/freeze/ec-v51-browser-successor-v181-20260918.json';
const V183_MANIFEST = 'docs/freeze/ec-panel-only-agency-city-scope-v183-20260918.json';
const V184_MANIFEST = 'docs/freeze/ec-v181-v183-canonical-successor-v184-20260918.json';
const V193_MANIFEST = 'docs/freeze/vsl-first-response-watchdog-v193-20260919.json';
const readText = (relativePath) => fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const readCanonicalManifest = (relativePath, label) => {
    const text = readText(relativePath);
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`, `[V184] ${label}_manifest_not_canonical`);
    return { text, value };
};
const sha256 = (relativePath) => crypto.createHash('sha256').update(readText(relativePath)).digest('hex');

const v181 = readCanonicalManifest(V181_MANIFEST, 'v181');
const v183 = readCanonicalManifest(V183_MANIFEST, 'v183');
const v184 = readCanonicalManifest(V184_MANIFEST, 'v184');
const v193 = readCanonicalManifest(V193_MANIFEST, 'v193');
const manifest = v184.value;
const v193RuntimeGuardSuccessor = v193.value.runtimeGuardSuccessor;

const expectedV179ToV183AncestorIntersection = [
    'public/qr.html',
    'scripts/lib/ec-runtime-successor-v170-context.mjs',
    'scripts/test-panel-customer-selection-browser-v51.mjs',
    'src/routes/shipments.js',
    'src/services/servientregaEcuadorAgencyService.js'
];
const expectedDeclaredAncestorOverrides = [
    ...expectedV179ToV183AncestorIntersection,
    'scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs'
].sort();
const expectedNewProtectedFiles = [
    'docs/EC_V181_V183_CANONICAL_SUCCESSOR_FREEZE_V184_20260918.md',
    'scripts/guard-v181-v183-canonical-successor-v184.mjs',
    'scripts/lib/ec-runtime-successor-v184-context.mjs',
    'tests/v181-v183-canonical-successor-v184.test.mjs'
].sort();
const expectedOverrides = [...new Set([...expectedDeclaredAncestorOverrides, ...expectedNewProtectedFiles])].sort();

assert.equal(manifest.freezeId, 'EC_V181_V183_CANONICAL_SUCCESSOR_V184_20260918');
assert.equal(manifest.version, 'V184');
assert.equal(manifest.parentCommit, '9ba5d16da477c3087b93693488a0b3925361e1e9');
assert.equal(manifest.v179Commit, '1c0e1457e0feedf8cd08e76a1593c9018a7ac3a1');
assert.equal(manifest.v181Commit, '2e4d1bd95e5fbd3ebf0109eaacb0eeefbd243ea3');
assert.equal(manifest.rootCause, 'V181_V183_SUCCESSOR_CONTEXT_NOT_REGISTERED_BEFORE_V51_RUNTIME_GUARD');
assert.equal(manifest.canonicalPreloadEntry, 'scripts/lib/ec-runtime-successor-v97-context.mjs');
assert.equal(manifest.successorIntegrationPoint, 'scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs');
assert.deepEqual([...manifest.v179ToV183AncestorIntersection].sort(), expectedV179ToV183AncestorIntersection);
assert.deepEqual([...manifest.declaredAncestorOverrides].sort(), expectedDeclaredAncestorOverrides);
assert.deepEqual([...manifest.newProtectedFiles].sort(), expectedNewProtectedFiles);
assert.deepEqual([...manifest.overrides].sort(), expectedOverrides);
assert.deepEqual(Object.keys(manifest.protectedFiles).sort(), expectedOverrides);
assert.equal(manifest.overrides.some((file) => /[*?\[\]]/.test(file)), false);
assert.equal(manifest.policy.guardLineageOnly, true);
assert.equal(manifest.policy.functionalCodeChanged, false);
assert.equal(manifest.policy.guardsBypassed, false);
assert.equal(manifest.policy.v170AuthorizedFilesBridge, true);
assert.equal(manifest.policy.productionActivationAuthorized, false);
assert.equal(v193.value.version, 'V193');
assert.deepEqual([...v193RuntimeGuardSuccessor.overrides].sort(), Object.keys(v193RuntimeGuardSuccessor.protectedFiles).sort());
assert.equal(v193RuntimeGuardSuccessor.policy.guardBypassAllowed, false);

const successorHash = (relativePath, inherited) => (
    v193RuntimeGuardSuccessor.protectedFiles[relativePath]
    || v193RuntimeGuardSuccessor.inheritedProtectedFiles[relativePath]
    || inherited
);

for (const [relativePath, expectedHash] of Object.entries(v181.value.protectedFiles)) {
    assert.equal(sha256(relativePath), successorHash(relativePath, v183.value.protectedFiles?.[relativePath] || expectedHash), `[V184/V193] v181_file_invalid:${relativePath}`);
}
for (const [relativePath, expectedHash] of Object.entries(v183.value.protectedFiles)) {
    assert.equal(sha256(relativePath), successorHash(relativePath, expectedHash), `[V184/V193] v183_file_invalid:${relativePath}`);
}
for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles)) {
    assert.equal(sha256(relativePath), successorHash(relativePath, expectedHash), `[V184/V193] protected_file_invalid:${relativePath}`);
}

for (const [relativePath, hash] of Object.entries(v193RuntimeGuardSuccessor.protectedFiles)) {
    assert.equal(sha256(relativePath), hash, `[V193] protected_file_invalid:${relativePath}`);
}

const authorizedFiles = [...new Set([
    ...v181.value.overrides,
    ...v183.value.overrides,
    ...manifest.overrides,
    ...v193RuntimeGuardSuccessor.overrides,
    ...Object.keys(v193RuntimeGuardSuccessor.inheritedProtectedFiles)
])];
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...new Set([...(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []), ...authorizedFiles])
];

let v170Context = globalThis.__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT;
Object.defineProperty(globalThis, '__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT', {
    configurable: true,
    enumerable: true,
    get: () => v170Context,
    set: (value) => {
        v170Context = Object.freeze({
            ...(value && typeof value === 'object' ? value : {}),
            authorizedFiles: Object.freeze([...new Set([...(value?.authorizedFiles || []), ...authorizedFiles])]),
            protectedFiles: Object.freeze({
                ...(value?.protectedFiles || {}),
                ...v181.value.protectedFiles,
                ...v183.value.protectedFiles,
                ...manifest.protectedFiles,
                ...v193RuntimeGuardSuccessor.inheritedProtectedFiles,
                ...v193RuntimeGuardSuccessor.protectedFiles
            }),
            successorFreezeId: manifest.freezeId,
            successorManifestSha256: crypto.createHash('sha256').update(v184.text).digest('hex')
        });
    }
});

globalThis.__VITALISMEN_V184_CANONICAL_SUCCESSOR_CONTEXT = Object.freeze({
    loaded: true,
    loadedBeforeV51: true,
    freezeId: manifest.freezeId,
    parentCommit: manifest.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(v184.text).digest('hex'),
    ancestorOverrideFiles: Object.freeze([...manifest.declaredAncestorOverrides]),
    authorizedFiles: Object.freeze(authorizedFiles),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles }),
    policy: Object.freeze({ ...manifest.policy })
});

if (process.env.V184_CANONICAL_SUCCESSOR_AUDIT === '1') {
    console.log('[V184] CONTEXT_LOADED_BEFORE_V51=YES');
}
