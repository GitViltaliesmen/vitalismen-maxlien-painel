import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js');

import {
    CANARY_CONTROLLER_V77_BASE_COMMIT,
    CANARY_CONTROLLER_V77_BASE_RELEASE,
    CANARY_CONTROLLER_V77_BASE_TAG,
    CANARY_CONTROLLER_V77_BASE_TREE,
    CANARY_CONTROLLER_V77_MAX_PERMIT_MS,
    CANARY_CONTROLLER_V77_MAX_WINDOW_MS,
    CANARY_CONTROLLER_V77_QA_PHONE
} from '../src/services/canaryControllerV77Service.js';

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const helper = read('ops/vitalismen-stage');
const controller = read('src/services/canaryControllerV77Service.js');
const canary = read('src/services/canaryIsolationV75Service.js');
const index = read('src/index.js');
const contract = read('scripts/lib/canary-controller-contract-v77.mjs');
const freeze = read('docs/CANARY_CONTROLLER_SAFETY_FREEZE_V77_20260828.md');

assert.equal(CANARY_CONTROLLER_V77_QA_PHONE, '5515998038637');
assert.equal(CANARY_CONTROLLER_V77_MAX_PERMIT_MS, 10 * 60 * 1000);
assert.equal(CANARY_CONTROLLER_V77_MAX_WINDOW_MS, 60 * 60 * 1000);
assert.equal(CANARY_CONTROLLER_V77_BASE_RELEASE, '20260828T210000Z_production-20260828-297324a');
assert.equal(CANARY_CONTROLLER_V77_BASE_COMMIT, '297324afa20ae5d59fbcb6080eae2e62c4841c8b');
assert.equal(CANARY_CONTROLLER_V77_BASE_TREE, '56a2b2cdc5c3062d1b90b7906bb48c705ab7d865');
assert.equal(CANARY_CONTROLLER_V77_BASE_TAG, 'production-20260828-297324a');

assert.match(controller, /expiresAt <= nowMs/);
assert.match(controller, /window_exceeds_60_minutes/);
assert.match(controller, /VITALISMEN_CANARY_V75_ENABLED_must_be_true/);
assert.match(controller, /profile_sha256_mismatch/);
assert.match(canary, /resolveCanaryControllerV77Runtime\(env\)/);
assert.match(canary, /return \{ _id: \{ \$exists: false \} \}/);
assert.match(index, /assertCanaryControllerV77Startup\(process\.env\)/);

assert.match(contract, /CANARY_CONTROLLER_V77_AUTHORIZATION_PHRASE = 'I_UNDERSTAND_V77_QA_CANARY'/);
assert.match(contract, /permit\.singleUse !== true/);
assert.match(contract, /permit\.rollbackCompatibility !== 'PASS_SAFE_BOOT'/);
assert.match(contract, /overlay_sha256_mismatch/);
assert.match(contract, /assertCanaryControllerV77Health/);

for (const command of [
    'v77-canary-authorize',
    'v77-canary-validate',
    'v77-canary-activate',
    'v77-canary-contain'
]) {
    assert.match(helper, new RegExp(command));
}
assert.match(helper, /canary-v77-permit\.consumed\.\$\{canary_v77_permit_id\}\.json/);
assert.match(helper, /validate_v77_strict_health/);
assert.match(helper, /validate_v77_baseline/);
assert.match(helper, /V77_CANARY_FAILURE_CONTAINMENT=STRICT_READ_ONLY_RESTORED/);
assert.match(helper, /V77_CANARY_CONTAINMENT=STOPPED_FAIL_CLOSED/);
assert.match(helper, /VITALISMEN_CANARY_CTRL_V77_ENABLED=false/);
assert.match(helper, /VITALISMEN_CANARY_V75_ENABLED=false/);
const activation = helper.slice(
    helper.indexOf('if [[ "$action" == "v77-canary-activate" ]]'),
    helper.indexOf('if [[ "$action" == "v77-canary-contain" ]]')
);
assert.doesNotMatch(activation, /switch_current_v66/);

assert.equal(
    packageJson.scripts['guard:runtime-chain-v71'],
    'node src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js'
);
assert.equal(
    packageJson.scripts['guard:canary-controller-v77'],
    'node src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js && node scripts/guard-canary-controller-v77.mjs && node --test tests/canary-controller-v77.test.mjs'
);
assert.match(packageJson.scripts['guard:predeploy-v71'], /guard:canary-controller-v77/);
assert.match(freeze, /permit.*dez minutos/is);
assert.match(freeze, /janela operacional.*sessenta minutos/is);
assert.match(freeze, /5515998038637/);
assert.match(freeze, /STRICT_READ_ONLY/);

console.log('CANARY_CONTROLLER_V77=VALID');
console.log('QA_PHONE=5515998038637');
console.log('PERMIT_MAX_MINUTES=10');
console.log('WINDOW_MAX_MINUTES=60');
console.log('EXPIRY=FAIL_CLOSED');
console.log('ROLLBACK_PROFILE=V76_STRICT_READ_ONLY');
console.log('PRODUCTION_MUTATIONS=0');
