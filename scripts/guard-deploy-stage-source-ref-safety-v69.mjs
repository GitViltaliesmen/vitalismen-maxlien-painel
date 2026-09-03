import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
    assertRunProtectedContractV69,
    expectedRunProtectedLabelsV69
} from './lib/deploy-stage-source-ref-contract-v69.mjs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const immutableV68 = Object.freeze({
    'docs/freeze/deploy-helper-runtime-safety-v68-20260827.json': '90c1c19433d5f5a2f358be4c0b7aead6f3d8e81615df8005ea62f9348a0dad1e',
    'docs/DEPLOY_HELPER_RUNTIME_SAFETY_FREEZE_V68_20260827.md': 'de6f73eec5d63f3231f1abc0d0457c96f06cc474e4922c9c66b1c1690d7850ce',
    'scripts/guard-deploy-helper-runtime-safety-v68.mjs': 'f96c3e85cc495f7f2a5e181a4589a4a4cab96981322953158584088bf2582f32',
    'scripts/lib/deploy-helper-contract-v68.mjs': '2acc34b96902dcee899bd5c7a8253da0fb1f10d28fcf92ff537141eab9b3d8bd',
    'src/services/deployHelperRuntimeSafetyFreezeRuntimeGuardV68.js': '8b458ecf70dedeca00067ee20d3cfcfab865b72e4d1fc270dba998880c10e203',
    'tests/deploy-helper-runtime-safety-v68.test.mjs': 'd180d30ecf157ddc7f4c214dfb7c610313ac4155db97298e800ee2ae369ae929'
});
for (const [file, approvedHash] of Object.entries(immutableV68)) {
    assert.equal(sha256(file), approvedHash, `V68 histórica alterada: ${file}`);
}

const helper = read('ops/vitalismen-stage');
const contract = assertRunProtectedContractV69(helper);
const manifest = json('docs/freeze/deploy-stage-source-ref-safety-v69-20260827.json');
const packageJson = json('package.json');
const entry = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const deploy = read('scripts/deploy-vps-ready.mjs');
const runtimeV69 = read('src/services/deployStageSourceRefSafetyFreezeRuntimeGuardV69.js');

assert.equal(manifest.parentFreezeId, 'deploy-helper-runtime-safety-v68-20260827');
assert.equal(manifest.parentManifestSha256, sha256('docs/freeze/deploy-helper-runtime-safety-v68-20260827.json'));
assert.equal(manifest.policy.dataCompatibilityVersion, 66);
assert.equal(manifest.policy.minimumRuntimeVersionAfterBridge, 66);
assert.equal(manifest.policy.runProtectedDefinitions, 1);
assert.equal(manifest.policy.runProtectedCalls, expectedRunProtectedLabelsV69.length);
assert.equal(manifest.policy.authorizedSourceRefPolicy, 'EXACT_FULL_REF');
assert.equal(manifest.policy.expectedCommitRequired, true);
assert.equal(manifest.policy.expectedTreeRequired, true);
assert.equal(manifest.policy.detachedCheckoutRequired, true);
assert.equal(manifest.policy.productionBranchRequirementForStaging, false);
assert.equal(manifest.policy.productionTagRequirementForStaging, false);
assert.equal(manifest.policy.productionBranchMustRemainUnchanged, true);
assert.equal(manifest.policy.pm2StartAuthorized, false);
assert.equal(manifest.policy.helperInstallAuthorized, false);
assert.equal(manifest.policy.stagingAuthorized, false);
assert.equal(manifest.policy.productionMutationExecuted, false);
assert.equal(manifest.policy.whatsappSendAuthorized, false);
assert.equal(manifest.policy.dropiApplyAuthorized, false);

assert.match(runtimeV69, /await withSuccessorGuardContext/);
assert.match(runtimeV69, /await import\('\.\/deployHelperRuntimeSafetyFreezeRuntimeGuardV68\.js'\)/);
assert.doesNotMatch(runtimeV69, /spawn|execSync|process\.exitCode|catch\s*\(/);
assert.match(entry, /await import\('\.\/deployStageSourceRefSafetyFreezeRuntimeGuardV69\.js'\)/);
assert.equal(
    packageJson.scripts['guard:runtime-chain-v69'],
    'node src/services/deployStageSourceRefSafetyFreezeRuntimeGuardV69.js'
);
assert.match(packageJson.scripts['guard:predeploy-v69'], /guard:runtime-chain-v69/);
assert.match(packageJson.scripts['guard:predeploy-v69'], /guard-deploy-stage-source-ref-safety-v69\.mjs/);
assert.match(packageJson.scripts['guard:predeploy-v69'], /guard-vitalismen-stage-v66\.mjs/);
assert.match(packageJson.scripts['guard:predeploy-v69'], /deploy-stage-source-ref-safety-v69\.test\.mjs/);
assert.match(packageJson.scripts['guard:predeploy-v69'], /vitalismen-stage-v66\.test\.mjs/);
for (const alias of [
    'guard:dropi-customer-full-name-v64',
    'guard:post-sale-gargalos-v65',
    'guard:post-sale-safety-v66'
]) {
    assert.match(packageJson.scripts[alias], /^npm run guard:runtime-chain-v69 && /, `${alias} não usa V69`);
}
assert.match(packageJson.scripts.test, /^npm run guard:predeploy-v69 && /);
assert.match(deploy, /npm run guard:predeploy-v69/);
assert.ok(deploy.indexOf('npm run guard:predeploy-v69') < deploy.indexOf('npm run senior:check'));

const runtimeAt = helper.indexOf('run_protected runtime_guard_chain_v69');
const predeployAt = helper.indexOf('run_protected predeploy_v69');
const staticV66At = helper.indexOf('run_protected post_sale_safety_guard_v66');
assert.ok(runtimeAt >= 0 && predeployAt > runtimeAt && staticV66At > predeployAt);
assert.equal(contract.definitions, 1);
assert.equal(contract.callCount, 18);

for (const preserved of [
    'V66_SAFE_OBSERVATION_ONLY',
    'DROPPI_EC_ACTIVE_SYNC_MODE=REPORT_ONLY',
    'POST_SALE_V66_MUTATIONS_ENABLED=false',
    'POST_SALE_V66_COMPATIBILITY_BRIDGE_READY=false',
    'v66-contain',
    'UNSAFE_OR_NOT_SUPPORTED',
    'autorização root ausente, inválida ou expirada'
]) assert.match(helper, new RegExp(preserved.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

console.log('DEPLOY_STAGE_SOURCE_REF_SAFETY_V69_STATIC=OK');
console.log(`RUN_PROTECTED_DEFINITIONS=${contract.definitions}`);
console.log(`RUN_PROTECTED_CALLS=${contract.callCount}`);
console.log(`FIRST_DEFINITION_LINE=${contract.definitionLine}`);
console.log(`FIRST_CALL_LINE=${contract.firstCallLine}`);
console.log(`EXPECTED_CALL_SITES=${expectedRunProtectedLabelsV69.length}`);
console.log(`VALID_CALL_SITES=${contract.calls.length}`);
