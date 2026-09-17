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

assert.equal(baseline.freezeId, 'EC_RUNTIME_GUARD_BASELINE_BOOTSTRAP_V168B_20260916');
assert.equal(baseline.trustedProductionCommit, '4a259499ccafe286d6650aa95115023f183f58fe');
assert.deepEqual([...baseline.authorizedOverrideFiles].sort(), Object.keys(baseline.protectedFiles).sort());
assert.equal(v168b.freezeId, 'EC_DROPI_PICKUP_STATUS_SYNC_V168B_20260916');
assert.equal(v168b.parentCommit, baseline.trustedProductionCommit);
assert.deepEqual([...v168b.overrides].sort(), Object.keys(v168b.protectedFiles).sort());

const laterSuccessorOverrides = new Set(globalThis.__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT?.authorizedFiles || []);
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
    protectedFiles: Object.freeze({ ...baseline.protectedFiles, ...v168b.protectedFiles })
});
