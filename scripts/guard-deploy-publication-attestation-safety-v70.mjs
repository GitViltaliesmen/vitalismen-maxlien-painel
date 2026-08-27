import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
    assertPublicationAttestationContractV70,
    expectedRunProtectedLabelsV70
} from './lib/deploy-publication-attestation-contract-v70.mjs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const immutableV69 = Object.freeze({
    'docs/freeze/deploy-stage-source-ref-safety-v69-20260827.json': '92d9f0d973cb7488fa736e054c3159544fe49a95cafe1659a2b85ec9ee74b88b',
    'docs/DEPLOY_STAGE_SOURCE_REF_SAFETY_FREEZE_V69_20260827.md': '7ff298a620778ce33808228d69c500de1e8741464f14efcfbb2ee71a647eb3e4',
    'scripts/guard-deploy-stage-source-ref-safety-v69.mjs': '1f1c84e6963bde807b21859a60521179a3362dce9d04227fe97d28e32c415fb5',
    'scripts/lib/deploy-stage-source-ref-contract-v69.mjs': 'e040f10e8a51e1d09cd19ac616be773f5c3dee9e4ae6c420b4a579c7928d7054',
    'src/services/deployStageSourceRefSafetyFreezeRuntimeGuardV69.js': '65a4ef5b395aa53f0cdf6036ef3d9ed2b4eb8d3c98a8d2e1eee61039f528e605',
    'tests/deploy-stage-source-ref-safety-v69.test.mjs': '26af1285fc30139fe609791627f496c28b13d123250ecba66ae39d66051cf810'
});
for (const [file, approvedHash] of Object.entries(immutableV69)) {
    assert.equal(sha256(file), approvedHash, `V69 histórica alterada: ${file}`);
}

const helper = read('ops/vitalismen-stage');
const contract = assertPublicationAttestationContractV70(helper);
const manifest = json('docs/freeze/deploy-publication-attestation-safety-v70-20260827.json');
const packageJson = json('package.json');
const entry = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const deploy = read('scripts/deploy-vps-ready.mjs');
const runtimeV70 = read('src/services/deployPublicationAttestationSafetyFreezeRuntimeGuardV70.js');

assert.equal(manifest.parentFreezeId, 'deploy-stage-source-ref-safety-v69-20260827');
assert.equal(manifest.parentManifestSha256, sha256('docs/freeze/deploy-stage-source-ref-safety-v69-20260827.json'));
assert.equal(manifest.policy.guardChainVersion, 70);
assert.equal(manifest.policy.dataCompatibilityVersion, 66);
assert.equal(manifest.policy.publicationStateMachine, 'CLOSED_TWO_STATE');
assert.deepEqual(manifest.policy.allowedPublicationStatuses, ['staged_candidate', 'production_published']);
assert.equal(manifest.policy.sourceMetadataImmutableAfterStaging, true);
assert.equal(manifest.policy.publicationMetadataSeparateAndImmutable, true);
assert.equal(manifest.policy.remoteProductionTagRequiredForPublication, true);
assert.equal(manifest.policy.remoteTagMustResolveToFunctionalCommit, true);
assert.equal(manifest.policy.productionBranchMustRemainUnchanged, true);
assert.equal(manifest.policy.baseEnvBoundToStagingAndPublication, true);
assert.equal(manifest.policy.nodeModulesBoundToStagingAndPublication, true);
assert.equal(manifest.policy.stagedPreflightInvalidAfterPublication, true);
assert.equal(manifest.policy.freshPublishedPreflightRequiredForActivation, true);
assert.equal(manifest.policy.activationPermitRequired, true);
assert.equal(manifest.policy.runProtectedDefinitions, 1);
assert.equal(manifest.policy.runProtectedCalls, expectedRunProtectedLabelsV70.length);
assert.equal(manifest.policy.pm2ActionsDuringPublication, 0);
assert.equal(manifest.policy.providerCallsDuringPublication, 0);
assert.equal(manifest.policy.dropiCallsDuringPublication, 0);
assert.equal(manifest.policy.helperInstallAuthorized, false);
assert.equal(manifest.policy.stagingAuthorized, false);
assert.equal(manifest.policy.realPublicationAuthorized, false);
assert.equal(manifest.policy.activationAuthorized, false);
assert.equal(manifest.policy.productionMutationExecuted, false);

assert.match(runtimeV70, /await withSuccessorGuardContext/);
assert.match(runtimeV70, /await import\('\.\/deployStageSourceRefSafetyFreezeRuntimeGuardV69\.js'\)/);
assert.doesNotMatch(runtimeV70, /spawn|execSync|process\.exitCode|catch\s*\(/);
assert.match(entry, /await import\('\.\/deployPublicationAttestationSafetyFreezeRuntimeGuardV70\.js'\)/);
assert.equal(
    packageJson.scripts['guard:runtime-chain-v70'],
    'node src/services/deployPublicationAttestationSafetyFreezeRuntimeGuardV70.js'
);
assert.match(packageJson.scripts['guard:predeploy-v70'], /guard:runtime-chain-v70/);
assert.match(packageJson.scripts['guard:predeploy-v70'], /guard-deploy-publication-attestation-safety-v70\.mjs/);
assert.match(packageJson.scripts['guard:predeploy-v70'], /guard-vitalismen-stage-v66\.mjs/);
assert.match(packageJson.scripts['guard:predeploy-v70'], /deploy-publication-attestation-safety-v70\.test\.mjs/);
for (const alias of [
    'guard:dropi-customer-full-name-v64',
    'guard:post-sale-gargalos-v65',
    'guard:post-sale-safety-v66'
]) {
    assert.match(packageJson.scripts[alias], /^npm run guard:runtime-chain-v70 && /, `${alias} não usa V70`);
}
assert.match(packageJson.scripts.test, /^npm run guard:predeploy-v70 && /);
assert.match(deploy, /npm run guard:predeploy-v70/);
assert.ok(deploy.indexOf('npm run guard:predeploy-v70') < deploy.indexOf('npm run senior:check'));
assert.equal(contract.definitions, 1);
assert.equal(contract.callCount, 18);

console.log('DEPLOY_PUBLICATION_ATTESTATION_SAFETY_V70_STATIC=OK');
console.log(`RUN_PROTECTED_DEFINITIONS=${contract.definitions}`);
console.log(`RUN_PROTECTED_CALLS=${contract.callCount}`);
console.log('PUBLICATION_STATES=staged_candidate,production_published');
console.log('DATA_COMPATIBILITY_VERSION=66');
