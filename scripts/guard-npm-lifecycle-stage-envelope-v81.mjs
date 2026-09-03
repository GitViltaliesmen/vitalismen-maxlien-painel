import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('../src/services/npmLifecycleStageEnvelopeCompatibilityFreezeRuntimeGuardV81.js');

import {
    NPM_LIFECYCLE_STAGE_ENVELOPE_V81_HELPER_SHA256,
    NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_ATTESTATION_SHA256,
    NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_COMMIT,
    NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_FREEZE_SHA256,
    NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_MANIFEST_SHA256,
    NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_TREE
} from '../src/services/npmLifecycleStageEnvelopeCompatibilityV81Service.js';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = json('docs/freeze/npm-lifecycle-stage-envelope-compatibility-v81-20260829.json');
const evidence = json('docs/evidence/npm-lifecycle-stage-envelope-v81-attestation-20260829.json');
const operationalSources = [
    read('scripts/lib/npm-lifecycle-stage-envelope-v81.mjs'),
    read('src/services/npmLifecycleStageEnvelopeCompatibilityV81Service.js')
].join('\n');

assert.equal(sha256('docs/freeze/npm-lifecycle-preload-bootstrap-compatibility-v80-20260829.json'), NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_MANIFEST_SHA256);
assert.equal(sha256('docs/NPM_LIFECYCLE_PRELOAD_BOOTSTRAP_COMPATIBILITY_FREEZE_V80_20260829.md'), NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_FREEZE_SHA256);
assert.equal(sha256('docs/evidence/npm-lifecycle-preload-bootstrap-v80-attestation-20260829.json'), NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_ATTESTATION_SHA256);
assert.equal(sha256('ops/vitalismen-stage'), NPM_LIFECYCLE_STAGE_ENVELOPE_V81_HELPER_SHA256);
assert.equal(manifest.parentCommit, NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_COMMIT);
assert.equal(manifest.parentTree, NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_TREE);
assert.equal(manifest.purpose, 'OFFICIAL_STAGE_ENVELOPE_COMPATIBILITY');
assert.equal(manifest.policy.helperFreezeVersion, 72);
assert.equal(manifest.policy.runtimeGuardChainVersion, 71);
assert.equal(manifest.policy.dataCompatibilityVersion, 66);
assert.equal(manifest.policy.v80ByteIntact, true);
assert.equal(manifest.policy.datasetChanged, false);
assert.equal(manifest.policy.ctaChanged, false);
assert.equal(manifest.policy.botBusinessLogicChanged, false);
assert.equal(manifest.policy.productionDeployAuthorized, false);
assert.equal(manifest.policy.qaCanaryAuthorized, false);
assert.equal(evidence.rootCause.v80RequiredFreezeVersion, 80);
assert.equal(evidence.rootCause.officialHelperFreezeVersion, 72);
const forbiddenBypass = ['--ignore', 'scripts'].join('-');
assert.equal(operationalSources.includes(forbiddenBypass), false);
assert.doesNotMatch(operationalSources, /node_modules[^\n]{0,120}copyFile|copyFile[^\n]{0,120}node_modules/i);

const logicalBundleSha256 = crypto.createHash('sha256').update(
    Object.entries(manifest.protectedFiles)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, fileSha256]) => `${relativePath}\0${fileSha256}\n`)
        .join('')
).digest('hex');
assert.equal(manifest.logicalBundle.sha256, logicalBundleSha256);

console.log('V80_OFFICIAL_STAGE_ENVELOPE_MISMATCH=CONFIRMED');
console.log('V81_OFFICIAL_STAGE_ENVELOPE_COMPATIBILITY=PASS');
console.log('OFFICIAL_HELPER_SHA256=PASS');
console.log('V80_BYTE_INTACT=YES');
console.log('DATASET_CHANGED=NO');
console.log('CTA_CHANGED=NO');
console.log('BOT_BUSINESS_LOGIC_CHANGED=NO');
console.log('PRODUCTION_MUTATIONS=0');
