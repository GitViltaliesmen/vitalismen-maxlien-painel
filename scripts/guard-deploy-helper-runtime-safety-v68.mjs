import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
    assertRunProtectedContract,
    expectedRunProtectedLabelsV68
} from './lib/deploy-helper-contract-v68.mjs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const immutableV67 = Object.freeze({
    'docs/freeze/runtime-guard-chain-v67-20260826.json': 'b945b6a4174bac311b95f0c653b2e5c2ec14e310a22826b0e5f3c89f6f905b7c',
    'docs/GUARD_CHAIN_SEMANTICS_FREEZE_V67_20260826.md': 'f07b0afcf64d5acdddbaaceeafdc00c5f766d87b8615cf9545da5354f50d7c1b',
    'scripts/guard-runtime-chain-v67.mjs': '3c1483f93076bebb6c490184ed56f7fe64d3b72e52c93bd578857797875eb0ec',
    'src/services/runtimeGuardChainFreezeRuntimeGuardV67.js': 'c58c51f4b2b32992fb4f1d65b6a450fa690ad6025f8fbfdef5d799ed1de0d4f3'
});
for (const [file, approvedHash] of Object.entries(immutableV67)) {
    assert.equal(sha256(file), approvedHash, `V67 histórica alterada: ${file}`);
}

const helper = read('ops/vitalismen-stage');
const contract = assertRunProtectedContract(helper);
const manifest = json('docs/freeze/deploy-helper-runtime-safety-v68-20260827.json');
const packageJson = json('package.json');
const entry = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const deploy = read('scripts/deploy-vps-ready.mjs');
const runtimeV68 = read('src/services/deployHelperRuntimeSafetyFreezeRuntimeGuardV68.js');

assert.equal(manifest.parentFreezeId, 'runtime-guard-chain-v67-20260826');
assert.equal(manifest.parentManifestSha256, sha256('docs/freeze/runtime-guard-chain-v67-20260826.json'));
assert.equal(manifest.policy.dataCompatibilityVersion, 66);
assert.equal(manifest.policy.minimumRuntimeVersionAfterBridge, 66);
assert.equal(manifest.policy.runProtectedDefinitions, 1);
assert.equal(manifest.policy.runProtectedCalls, expectedRunProtectedLabelsV68.length);
assert.equal(manifest.policy.pm2StartAuthorized, false);
assert.equal(manifest.policy.helperInstallAuthorized, false);
assert.equal(manifest.policy.stagingAuthorized, false);
assert.equal(manifest.policy.productionMutationExecuted, false);
assert.equal(manifest.policy.whatsappSendAuthorized, false);
assert.equal(manifest.policy.dropiApplyAuthorized, false);
assert.ok(manifest.declaredAncestorOverrides.includes('ops/vitalismen-stage'));
assert.match(runtimeV68, /await withSuccessorGuardContext/);
assert.match(runtimeV68, /await import\('\.\/runtimeGuardChainFreezeRuntimeGuardV67\.js'\)/);
assert.doesNotMatch(runtimeV68, /spawn|execSync|process\.exitCode|catch\s*\(/);

assert.match(entry, /await import\('\.\/deployHelperRuntimeSafetyFreezeRuntimeGuardV68\.js'\)/);
assert.match(entry, /runtimeGuardChainFreezeRuntimeGuardV67\.js/);
assert.equal(
    packageJson.scripts['guard:runtime-chain-v68'],
    'node src/services/deployHelperRuntimeSafetyFreezeRuntimeGuardV68.js'
);
assert.match(packageJson.scripts['guard:predeploy-v68'], /guard:runtime-chain-v68/);
assert.match(packageJson.scripts['guard:predeploy-v68'], /guard-deploy-helper-runtime-safety-v68\.mjs/);
assert.match(packageJson.scripts['guard:predeploy-v68'], /guard-vitalismen-stage-v66\.mjs/);
assert.match(packageJson.scripts['guard:predeploy-v68'], /deploy-helper-runtime-safety-v68\.test\.mjs/);
assert.match(packageJson.scripts['guard:predeploy-v68'], /vitalismen-stage-v66\.test\.mjs/);
for (const alias of [
    'guard:dropi-customer-full-name-v64',
    'guard:post-sale-gargalos-v65',
    'guard:post-sale-safety-v66'
]) {
    assert.match(packageJson.scripts[alias], /^npm run guard:runtime-chain-v68 && /, `${alias} não usa V68`);
}
assert.match(packageJson.scripts.test, /^npm run guard:predeploy-v68 && /);

const runtimeAt = helper.indexOf('run_protected runtime_guard_chain_v68');
const predeployAt = helper.indexOf('run_protected predeploy_v68');
const staticV66At = helper.indexOf('run_protected post_sale_safety_guard_v66');
assert.ok(runtimeAt >= 0 && predeployAt > runtimeAt && staticV66At > predeployAt);
assert.match(deploy, /npm run guard:predeploy-v68/);
assert.ok(deploy.indexOf('npm run guard:predeploy-v68') < deploy.indexOf('npm run senior:check'));

for (const preserved of [
    'V66_SAFE_OBSERVATION_ONLY',
    'DROPPI_EC_ACTIVE_SYNC_MODE=REPORT_ONLY',
    'POST_SALE_V66_MUTATIONS_ENABLED=false',
    'POST_SALE_V66_COMPATIBILITY_BRIDGE_READY=false',
    'v66-contain',
    'UNSAFE_OR_NOT_SUPPORTED',
    'autorização root ausente, inválida ou expirada'
]) assert.match(helper, new RegExp(preserved.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

console.log('DEPLOY_HELPER_RUNTIME_SAFETY_V68_STATIC=OK');
console.log(`RUN_PROTECTED_DEFINITIONS=${contract.definitions}`);
console.log(`RUN_PROTECTED_CALLS=${contract.callCount}`);
console.log(`FIRST_DEFINITION_LINE=${contract.definitionLine}`);
console.log(`FIRST_CALL_LINE=${contract.firstCallLine}`);
console.log(`EXPECTED_CALL_SITES=${expectedRunProtectedLabelsV68.length}`);
console.log(`VALID_CALL_SITES=${contract.calls.length}`);
