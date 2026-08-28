import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
    assertDeployHelperV71ChainAlignmentContractV72,
    classifyHelperV70ReferencesV72
} from './lib/deploy-helper-v71-chain-alignment-contract-v72.mjs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestPath = 'docs/freeze/deploy-helper-v71-chain-alignment-safety-v72-20260827.json';
const parentManifestPath = 'docs/freeze/strict-read-only-observation-safety-v71-20260827.json';
const manifest = json(manifestPath);
const v73Manifest = json('docs/freeze/meta-partner-destination-registry-v73-20260828.json');
const v74Manifest = json('docs/freeze/freeze-lock-ec-meta-dynamic-v74-20260828.json');
const helper = read('ops/vitalismen-stage');
const packageJson = json('package.json');
const deployReady = read('scripts/deploy-vps-ready.mjs');
const architecture = read('docs/ARQUITETURA_AUTOMACAO_OFICIAL.md');
const officialFiles = read('docs/ARQUIVOS_OFICIAIS.md');

assert.equal(sha256(parentManifestPath), '9321d038b53eaa5148c37fc6662d184a95e6b7fd8e623488b8f54a011df8de86');
assert.equal(manifest.freezeId, 'deploy-helper-v71-chain-alignment-safety-v72');
assert.equal(manifest.parentFreezeId, 'strict-read-only-observation-safety-v71');
assert.equal(manifest.parentManifestSha256, sha256(parentManifestPath));
assert.equal(manifest.policy.freezeVersion, 72);
assert.equal(manifest.policy.deployHelperContractVersion, 72);
assert.equal(manifest.policy.runtimeGuardChainVersion, 71);
assert.equal(manifest.policy.dataCompatibilityVersion, 66);
assert.equal(manifest.policy.stageRuntimeGuardCommand, 'npm run guard:runtime-chain-v71');
assert.equal(manifest.policy.stagePredeployCommand, 'npm run guard:predeploy-v71');
assert.equal(manifest.policy.predeployValidated, 'v71');
assert.equal(manifest.policy.safeObservationPolicy, 'STRICT_READ_ONLY');
assert.deepEqual(manifest.policy.allowedWriteClasses, []);
assert.equal(manifest.policy.productionMutationExecuted, false);

for (const [file, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    const actualHash = sha256(file);
    if (
        v73Manifest.declaredAncestorOverrides?.includes(file)
        && v73Manifest.protectedFiles?.[file] === actualHash
    ) continue;
    if (
        v74Manifest.declaredAncestorOverrides?.includes(file)
        && v74Manifest.protectedFiles?.[file] === actualHash
    ) continue;
    assert.equal(actualHash, approvedHash, `arquivo protegido V72 divergente: ${file}`);
}

const contract = assertDeployHelperV71ChainAlignmentContractV72(helper);
const v70References = classifyHelperV70ReferencesV72(helper);
assert.deepEqual(v70References.filter(({ classification }) => classification === 'ACTIVE_FORBIDDEN'), []);

assert.equal(
    packageJson.scripts['guard:runtime-chain-v71'],
    'node src/services/freezeLockEcMetaDynamicFreezeRuntimeGuardV74.js'
);
assert.equal(packageJson.scripts['guard:deploy-helper-v72'], 'node scripts/guard-deploy-helper-v71-chain-alignment-safety-v72.mjs');
assert.match(packageJson.scripts['guard:predeploy-v71'], /^npm run guard:runtime-chain-v71 && npm run guard:deploy-helper-v72 && /);
assert.match(packageJson.scripts['guard:predeploy-v71'], /guard:meta-partner-v73/);
assert.match(packageJson.scripts['guard:predeploy-v71'], /guard:freeze-lock-v74/);
assert.equal(packageJson.scripts['guard:predeploy-v72'], 'npm run guard:predeploy-v71');
assert.match(packageJson.scripts.test, /^npm run guard:predeploy-v71 && /);
assert.match(deployReady, /'npm run guard:predeploy-v72'/);

const activationPrerequisites = helper.slice(
    helper.indexOf('validate_activation_prerequisites_successor() {'),
    helper.indexOf('if [[ "$stage_test_mode" == "true" && "${VITALISMEN_STAGE_TEST_SOURCE_ONLY:-false}" == "true" ]]')
);
assert.ok(activationPrerequisites.indexOf('validate_successor_release') >= 0);
assert.ok(
    activationPrerequisites.indexOf('validate_preflight_marker')
        < activationPrerequisites.indexOf('load_v66_activation_permit'),
    'preflight versionado deve falhar antes de carregar/consumir permit'
);
const activation = helper.slice(
    helper.indexOf('if [[ "$action" == "v66-activate-safe" ]]'),
    helper.indexOf('if [[ "$action" == "v66-contain" ]]')
);
assert.ok(activation.indexOf('validate_activation_prerequisites_successor') < activation.indexOf('consume_v66_activation_permit'));
assert.ok(activation.indexOf('consume_v66_activation_permit') < activation.indexOf('switch_current_v66 "$candidate_dir"'));

for (const document of [architecture, officialFiles]) {
    assert.match(document, /deploy-helper-v71-chain-alignment-safety-v72/);
    assert.match(document, /RUNTIME_GUARD_CHAIN_VERSION.*71/is);
    assert.match(document, /DATA_COMPATIBILITY_VERSION.*66/is);
}

console.log('DEPLOY_HELPER_V71_CHAIN_ALIGNMENT_SAFETY_V72_STATIC=OK');
console.log(`RUN_PROTECTED_CALLS=${contract.callCount}`);
console.log('FREEZE_VERSION=72');
console.log('DEPLOY_HELPER_CONTRACT_VERSION=72');
console.log('RUNTIME_GUARD_CHAIN_VERSION=71');
console.log('DATA_COMPATIBILITY_VERSION=66');
console.log(`STALE_ACTIVE_V70_REFERENCES=${v70References.filter(({ classification }) => classification === 'ACTIVE_FORBIDDEN').length}`);
for (const reference of v70References) {
    console.log(`HELPER_V70_REFERENCE=${reference.line}|${reference.classification}|${reference.text}`);
}
