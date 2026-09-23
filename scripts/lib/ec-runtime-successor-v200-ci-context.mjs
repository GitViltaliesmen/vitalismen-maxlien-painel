import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const V195_MANIFEST = 'docs/freeze/meta-canonical-consolidation-v195-20260923.json';
const V200_MANIFEST = 'docs/freeze/ec-panel-quality-successor-v200-20260923.json';
const V138_MANIFEST = 'docs/freeze/ec-dropi-human-authorization-v138-20260907.json';
const read = (relativePath) => fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url));
const hash = (relativePath) => crypto.createHash('sha256').update(read(relativePath)).digest('hex');
const canonicalManifest = (relativePath) => {
    const text = read(relativePath).toString('utf8');
    const manifest = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`, `[V200] manifest_not_canonical:${relativePath}`);
    return manifest;
};

const v195 = canonicalManifest(V195_MANIFEST);
const successor = canonicalManifest(V200_MANIFEST);
const v138 = canonicalManifest(V138_MANIFEST);
assert.equal(v195.freezeId, 'META_CANONICAL_CONSOLIDATION_V195_20260923');
assert.equal(v195.policy?.canonicalDataset, '920532663934291');
assert.equal(successor.freezeId, 'EC_PANEL_QUALITY_SUCCESSOR_V200_20260923');
assert.equal(successor.version, 'V200');
assert.equal(successor.baseCommit, '05b659118ec66644cc36a2083f02af4be4828a42');
assert.deepEqual(successor.overrides, [
    '.github/workflows/ec-panel-quality.yml',
    'tests/ec-auth-login-v78-pass-through.test.mjs'
]);
assert.deepEqual(successor.overrides, Object.keys(successor.protectedFiles || {}));
assert.equal(successor.policy?.canonicalPreload, 'scripts/lib/ec-runtime-successor-v195-context.mjs');
assert.equal(successor.policy?.canonicalDataset, '920532663934291');
assert.equal(successor.policy?.v171ContextExtended, true);
assert.equal(successor.policy?.v138EarlySuccessorValidated, true);
assert.equal(successor.policy?.legacyWhitespaceAllowlistExact, true);
assert.equal(successor.policy?.historicalHashesChanged, false);
assert.equal(successor.policy?.guardBypassAllowed, false);
assert.equal(successor.policy?.productionChanged, false);

const protectedFiles = Object.freeze({
    ...v195.protectedFiles,
    ...successor.protectedFiles
});
const authorizedFiles = Object.freeze(Object.keys(protectedFiles));
const earlySuccessorFiles = Object.freeze(['tests/ec-admin-dropi-draft-bridge-v128.test.mjs']);
assert.equal(v138.version, 138);
for (const relativePath of earlySuccessorFiles) {
    assert.ok(v138.overrides.includes(relativePath), `[V200] v138_override_missing:${relativePath}`);
    assert.equal(hash(relativePath), v138.protectedFiles[relativePath], `[V200] v138_successor_invalid:${relativePath}`);
}
globalThis.__VITALISMEN_V195_META_CANONICAL_PRELOAD = Object.freeze({
    freezeId: v195.freezeId,
    canonicalDataset: v195.policy.canonicalDataset,
    authorizedFiles,
    protectedFiles
});
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...new Set([
        ...(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []),
        ...authorizedFiles,
        ...earlySuccessorFiles
    ])
];

await import('./ec-runtime-successor-v194-context.mjs');

const v171Context = globalThis.__VITALISMEN_V171_TRAFFIC_RESTORATION_CONTEXT;
const v170Context = globalThis.__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT;
assert.equal(v170Context?.loaded, true, '[V200] v170_context_not_loaded');
assert.equal(v171Context?.loaded, true, '[V200] v171_context_not_loaded');
assert.equal(v171Context.freezeId, 'EC_TRAFFIC_RESTORATION_V171_20260917');
globalThis.__VITALISMEN_V171_TRAFFIC_RESTORATION_CONTEXT = Object.freeze({
    ...v171Context,
    protectedFiles: Object.freeze({
        ...v171Context.protectedFiles,
        ...v170Context.protectedFiles,
        ...protectedFiles
    })
});

for (const [relativePath, expected] of Object.entries(protectedFiles)) {
    assert.equal(hash(relativePath), expected, `[V200] protected_file_invalid:${relativePath}`);
}

globalThis.__VITALISMEN_V200_CI_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: successor.freezeId,
    baseCommit: successor.baseCommit,
    canonicalDataset: v195.policy.canonicalDataset,
    authorizedFiles
});

export const assertV200WorkflowHash = (content) => {
    const actual = crypto.createHash('sha256').update(content).digest('hex');
    assert.equal(actual, successor.protectedFiles['.github/workflows/ec-panel-quality.yml'], `V200_WORKFLOW_HASH_MISMATCH:${actual}`);
    return actual;
};
