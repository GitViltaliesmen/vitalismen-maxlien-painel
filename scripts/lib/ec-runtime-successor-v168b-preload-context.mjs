import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import './ec-runtime-successor-v170-context.mjs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const SELF = 'scripts/lib/ec-runtime-successor-v168b-preload-context.mjs';
const hashFile = (relative) => crypto.createHash('sha256')
    .update(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)))
    .digest('hex');
const readCanonicalManifest = (relative) => {
    const text = fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`, `${relative} must be canonical JSON`);
    return value;
};

const baseline = readCanonicalManifest('docs/freeze/ec-runtime-guard-baseline-bootstrap-v168b-20260916.json');
const v168b = readCanonicalManifest('docs/freeze/ec-dropi-pickup-status-sync-v168b-20260916.json');
const v193 = readCanonicalManifest('docs/freeze/vsl-first-response-watchdog-v193-20260919.json');
const v193RuntimeGuardSuccessor = v193.runtimeGuardSuccessor;
const v194 = readCanonicalManifest('docs/freeze/post-sale-dropi-reconciler-v194-20260920.json');

assert.equal(baseline.freezeId, 'EC_RUNTIME_GUARD_BASELINE_BOOTSTRAP_V168B_20260916');
assert.equal(baseline.trustedProductionCommit, '4a259499ccafe286d6650aa95115023f183f58fe');
assert.deepEqual([...baseline.authorizedOverrideFiles].sort(), Object.keys(baseline.protectedFiles).sort());
assert.equal(v168b.freezeId, 'EC_DROPI_PICKUP_STATUS_SYNC_V168B_20260916');
assert.equal(v168b.parentCommit, baseline.trustedProductionCommit);
assert.deepEqual([...v168b.overrides].sort(), Object.keys(v168b.protectedFiles).sort());

assert.equal(v193.version, 'V193');
assert.equal(v193RuntimeGuardSuccessor.policy.guardBypassAllowed, false);
assert.equal(v194.version, 'V194');
assert.equal(v194.policy.guardsBypassed, false);
const v195MetaCanonicalPreload = globalThis.__VITALISMEN_V195_META_CANONICAL_PRELOAD;
if (v195MetaCanonicalPreload) {
    assert.equal(v195MetaCanonicalPreload.freezeId, 'META_CANONICAL_CONSOLIDATION_V195_20260923');
    assert.equal(v195MetaCanonicalPreload.canonicalDataset, '920532663934291');
    assert.deepEqual(
        [...v195MetaCanonicalPreload.authorizedFiles].sort(),
        Object.keys(v195MetaCanonicalPreload.protectedFiles || {}).sort()
    );
}
for (const [file, expected] of Object.entries({
    ...v193RuntimeGuardSuccessor.inheritedProtectedFiles,
    ...v193RuntimeGuardSuccessor.protectedFiles
})) assert.equal(
    hashFile(file),
    v195MetaCanonicalPreload?.protectedFiles?.[file] || v194.protectedFiles[file] || expected,
    `[V193/V194/V195 preload] ${file}`
);
const laterSuccessorOverrides = new Set([
    ...(globalThis.__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT?.authorizedFiles || []),
    ...v193RuntimeGuardSuccessor.overrides,
    ...Object.keys(v193RuntimeGuardSuccessor.inheritedProtectedFiles),
    ...v194.overrides,
    ...(v195MetaCanonicalPreload?.authorizedFiles || [])
]);
const authorizedFiles = [...new Set([
    ...baseline.authorizedOverrideFiles,
    ...v168b.overrides,
    ...laterSuccessorOverrides
])];
assert.equal(authorizedFiles.some((file) => /[*?\[\]]/.test(file)), false);
for (const [file, expected] of Object.entries({ ...baseline.protectedFiles, ...v168b.protectedFiles })) {
    if (file === SELF || laterSuccessorOverrides.has(file)) continue;
    assert.equal(hashFile(file), expected, `[V168B preload] ${file}`);
}

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...authorizedFiles])];
}

globalThis.__VITALISMEN_V168B_PRELOAD_CONTEXT = Object.freeze({
    loaded: true,
    baselineFreezeId: baseline.freezeId,
    functionalFreezeId: v168b.freezeId,
    authorizedFiles: Object.freeze(authorizedFiles)
});
globalThis.__VITALISMEN_V168B_DROPI_STATUS_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: v168b.freezeId,
    protectedFiles: Object.freeze({ ...v168b.protectedFiles })
});
globalThis.__VITALISMEN_V168B_BASELINE_BOOTSTRAP_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: baseline.freezeId,
    protectedFiles: Object.freeze({ ...baseline.protectedFiles, ...v168b.protectedFiles, ...v194.protectedFiles })
});
