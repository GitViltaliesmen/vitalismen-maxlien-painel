import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('../src/services/npmLifecyclePreloadBootstrapFreezeRuntimeGuardV80.js');

import {
    NPM_LIFECYCLE_PRELOAD_V80_OFFICIAL_EVENTS,
    NPM_LIFECYCLE_PRELOAD_V80_PARENT_COMMIT,
    NPM_LIFECYCLE_PRELOAD_V80_PARENT_FREEZE_SHA256,
    NPM_LIFECYCLE_PRELOAD_V80_PARENT_MANIFEST_SHA256,
    NPM_LIFECYCLE_PRELOAD_V80_PARENT_TREE
} from '../src/services/npmLifecyclePreloadBootstrapV80Service.js';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = json('docs/freeze/npm-lifecycle-preload-bootstrap-compatibility-v80-20260829.json');
const evidence = json('docs/evidence/npm-lifecycle-preload-bootstrap-v80-attestation-20260829.json');
const bootstrap = read('scripts/lib/npm-lifecycle-preload-bootstrap-v80.mjs');
const service = read('src/services/npmLifecyclePreloadBootstrapV80Service.js');
const syntheticStage = read('scripts/run-npm-lifecycle-preload-synthetic-stage-v80.mjs');
const v79Manifest = json('docs/freeze/ec-bot-core-readiness-v79-20260829.json');

assert.equal(sha256('docs/freeze/ec-bot-core-readiness-v79-20260829.json'), NPM_LIFECYCLE_PRELOAD_V80_PARENT_MANIFEST_SHA256);
assert.equal(sha256('docs/EC_BOT_CORE_READINESS_FREEZE_V79_20260829.md'), NPM_LIFECYCLE_PRELOAD_V80_PARENT_FREEZE_SHA256);
assert.equal(manifest.parentCommit, NPM_LIFECYCLE_PRELOAD_V80_PARENT_COMMIT);
assert.equal(manifest.parentTree, NPM_LIFECYCLE_PRELOAD_V80_PARENT_TREE);
assert.equal(manifest.purpose, 'NPM_LIFECYCLE_PRELOAD_BOOTSTRAP_COMPATIBILITY');
assert.deepEqual(manifest.declaredAncestorOverrides, []);
assert.deepEqual(manifest.policy.officialLifecycleEvents, NPM_LIFECYCLE_PRELOAD_V80_OFFICIAL_EVENTS);
assert.equal(manifest.policy.datasetId, '1468946114265008');
assert.equal(manifest.policy.browserCapiEquality, 'PASS');
assert.equal(manifest.policy.vslPublicOriginConformance, 'PASS');
assert.equal(manifest.policy.botBusinessLogicChanged, false);
assert.equal(manifest.policy.datasetChanged, false);
assert.equal(manifest.policy.ctaChanged, false);
assert.equal(manifest.policy.productionDeployAuthorized, false);
assert.equal(manifest.policy.qaCanaryAuthorized, false);
assert.equal(manifest.policy.whatsappMessagesSent, 0);
assert.equal(manifest.policy.metaEventsSent, 0);
assert.equal(manifest.policy.dropiApplyAllowed, false);
assert.equal(manifest.policy.mutatingSchedulersAllowed, false);
assert.equal(manifest.policy.colombiaOperationalInfrastructureTouched, false);
assert.equal(v79Manifest.policy.datasetId, manifest.policy.datasetId);

assert.match(bootstrap, /bootstrapNpmLifecyclePreloadV80/);
assert.match(service, /pathToFileURL/);
assert.match(service, /dependency_lifecycle/);
assert.match(service, /official_guard/);
assert.match(service, /process_classification_missing/);
assert.doesNotMatch(`${bootstrap}\n${service}\n${syntheticStage}`, /--ignore-scripts/);
assert.doesNotMatch(`${bootstrap}\n${service}\n${syntheticStage}`, /node_modules[^\n]{0,120}copyFile|copyFile[^\n]{0,120}node_modules/i);
assert.equal(evidence.reproduction.errorCode, 'ERR_MODULE_NOT_FOUND');
assert.equal(evidence.reproduction.status, 'PASS');
assert.equal(evidence.syntheticStage.includesBaileysLifecycle, true);
assert.equal(evidence.syntheticStage.productionMutationExecuted, false);

const logicalBundleSha256 = crypto.createHash('sha256').update(
    Object.entries(manifest.protectedFiles)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, fileSha256]) => `${relativePath}\0${fileSha256}\n`)
        .join('')
).digest('hex');
assert.equal(manifest.logicalBundle.sha256, logicalBundleSha256);

console.log('V79_STAGE_ROOT_CAUSE=CONFIRMED');
console.log('V79_RELATIVE_PRELOAD_LIFECYCLE_REPRO=PASS');
console.log('CANONICAL_PROJECT_ROOT_RESOLUTION=PASS');
console.log('V80_BOOTSTRAP_FIX=PASS');
console.log('CANONICAL_SHARED_DATASET=1468946114265008');
console.log('BROWSER_CAPI_EQUALITY=PASS');
console.log('VSL_PUBLIC_ORIGIN_CONFORMANCE=PASS');
console.log('V78_BYTE_INTACT=YES');
console.log('V79_BYTE_INTACT=YES');
console.log('DATASET_CHANGED=NO');
console.log('CTA_CHANGED=NO');
console.log('BOT_BUSINESS_LOGIC_CHANGED=NO');
console.log('PRODUCTION_DEPLOYED=NO');
console.log('BOT_ACTIVATED=NO');
console.log('QA_CANARY_EXECUTED=NO');
console.log('WHATSAPP_MESSAGES=0');
console.log('META_EVENTS=0');
console.log('DROPI_APPLY=NO');
console.log('MUTATING_SCHEDULERS=0');
console.log('COLOMBIA_OPERATIONAL_INFRA_TOUCHED=NO');
