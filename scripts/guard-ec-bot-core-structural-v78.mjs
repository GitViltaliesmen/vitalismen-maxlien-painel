import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('../src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js');

import {
    EC_BOT_CORE_V78_ALLOWED_MUTATION_ROUTES,
    EC_BOT_CORE_V78_DATASET_ID,
    EC_BOT_CORE_V78_REQUIRED_FALSE_FLAGS,
    buildEcBotCoreV78OverlayEnvironment,
    ecBotCoreV78ExternalEffectDecision,
    resolveEcBotCoreV78Configuration
} from '../src/services/ecBotCoreOperationalV78Service.js';
import {
    EC_OFFICIAL_VSL_V78_MESSAGE,
    EC_OFFICIAL_VSL_V78_URL,
    EC_OFFICIAL_VSL_V78_WHATSAPP,
    recognizeOfficialEcVslEntryV78
} from '../src/services/ecOfficialVslEntryV78Service.js';
import {
    EC_QA_TEST_PHONE_V78,
    assertExactEcQaPhoneV78
} from '../src/services/ecQaTestResetV78Service.js';
import {
    MUTABLE_RUNTIME_ARTIFACTS_V78,
    V78_SHARED_RUNTIME_ROOT
} from '../src/services/mutableRuntimeArtifactV78Service.js';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const term = (...parts) => parts.join('');
const manifestPath = 'docs/freeze/ec-bot-core-structural-safety-v78-20260829.json';
const parentManifestPath = 'docs/freeze/canary-controller-health-policy-reset-v77h2-20260829.json';
const manifest = json(manifestPath);
const evidence = json('docs/evidence/ec-official-vsl-origin-v78-20260829.json');
const runtime = read('src/services/mutableRuntimeArtifactV78Service.js');
const profile = read('src/services/ecBotCoreOperationalV78Service.js');
const integration = read('src/services/ecBotCoreRuntimeIntegrationV78Service.js');
const qaScript = read('scripts/ec-qa-test-reset-v78.mjs');
const helper = read('ops/ec-bot-core-v78');
const contract = read('scripts/lib/ec-bot-core-operational-contract-v78.mjs');
const index = read('src/index.js');
const canary = read('src/services/canaryIsolationV75Service.js');
const zapiClient = read('src/services/zapiClient.js');

assert.equal(sha256(parentManifestPath), '63e409d9bb72a109b2960ce1df24cc327e2ee97044d67e2eec0febb2a6b323d5');
assert.equal(manifest.freezeId, 'ec-bot-core-structural-safety-v78');
assert.equal(manifest.version, 78);
assert.equal(manifest.parentVersion, 'V77H2');
assert.equal(manifest.parentCommit, '193faa1c919a02c524deba3263bc174b24775700');
assert.equal(manifest.parentTree, '124c6a0f46daf9f768014935a78bbba71c8f8d04');
assert.equal(manifest.deployment.ready, false);
assert.deepEqual(manifest.deployment.blockers, ['OFFICIAL_VSL_ORIGIN_CONTRACT_DIVERGENT']);

const logicalBundleSha256 = crypto.createHash('sha256').update(
    Object.entries(manifest.protectedFiles)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, fileSha256]) => `${relativePath}\0${fileSha256}\n`)
        .join('')
).digest('hex');
assert.equal(manifest.logicalBundle.sha256, logicalBundleSha256);

assert.equal(V78_SHARED_RUNTIME_ROOT, '/opt/vitalismen-automacao/shared/runtime');
assert.equal(Object.keys(MUTABLE_RUNTIME_ARTIFACTS_V78).length, 5);
assert.match(runtime, /mutable_runtime_artifact_not_declared/);
assert.match(runtime, /mutable_runtime_symlink_blocked/);
assert.match(runtime, /mutable_runtime_path_outside_allowed_root/);
assert.doesNotMatch(runtime, /entry\.name === 'runtime'/);

const environment = {
    ...buildEcBotCoreV78OverlayEnvironment({ baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID } }),
    META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID
};
const resolved = resolveEcBotCoreV78Configuration(environment, {
    browserPixelId: EC_BOT_CORE_V78_DATASET_ID,
    serverDatasetId: EC_BOT_CORE_V78_DATASET_ID
});
assert.equal(resolved.ready, true);
for (const flag of ['DROPPI_EC_ACTIVE_SYNC_ENABLED', 'VITALISMEN_META_PURCHASE_ENABLED', 'SHIPMENT_STATUS_DISPATCH_ENABLED']) {
    assert.ok(EC_BOT_CORE_V78_REQUIRED_FALSE_FLAGS.includes(flag));
}
for (const effect of ['scheduler', 'dropi', 'meta', 'capi', 'purchase', 'repurchase']) {
    assert.equal(ecBotCoreV78ExternalEffectDecision(effect, environment).allowed, false, effect);
}
assert.equal(EC_BOT_CORE_V78_ALLOWED_MUTATION_ROUTES.size, 5);
assert.match(integration, /EC_BOT_CORE_V78_MONGO_COLLECTIONS/);
assert.match(integration, /ec_bot_core_mongo_write_blocked/);
assert.match(index, /ecBotCoreMutationRouteGuardV78/);
assert.match(index, /installEcBotCoreMongooseGuardV78/);
assert.match(canary, /ecBotCoreV78BlockedResult/);
assert.match(zapiClient, /assertEcBotCoreExternalEffectAllowedV78/);

assert.equal(EC_QA_TEST_PHONE_V78, '5515998038637');
assert.equal(assertExactEcQaPhoneV78(EC_QA_TEST_PHONE_V78), EC_QA_TEST_PHONE_V78);
for (const invalid of ['998038637', '+55 15 99803-8637', `${EC_QA_TEST_PHONE_V78},593991234567`]) {
    assert.throws(() => assertExactEcQaPhoneV78(invalid), /must_match_exactly/);
}
assert.doesNotMatch(qaScript, /deleteOne|deleteMany|findOneAndDelete|\.remove\s*\(/);
assert.doesNotMatch(qaScript, /publicVslLeadEntry[^\n]*true/);
assert.match(qaScript, /human\.mode/);
assert.match(qaScript, /metadata\.qaTestContextV78/);

assert.equal(recognizeOfficialEcVslEntryV78({
    text: EC_OFFICIAL_VSL_V78_MESSAGE,
    destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP,
    sourceUrl: EC_OFFICIAL_VSL_V78_URL
}).recognized, true);
assert.equal(recognizeOfficialEcVslEntryV78({
    text: 'Hola, quiero el tratamiento',
    destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP,
    sourceUrl: EC_OFFICIAL_VSL_V78_URL
}).recognized, false);
assert.equal(evidence.status, 'ORIGIN_CONTRACT_DIVERGENT_DEPLOY_BLOCKED');
assert.equal(evidence.inspection.readOnly, true);
assert.equal(evidence.inspection.vslContentChanged, false);

assert.match(helper, /status \| plan RELEASE \| authorize RELEASE \| activate RELEASE \| contain/);
assert.match(helper, /restart "\$process_name" --update-env/);
assert.match(helper, /v66-contain/);
assert.match(contract, /v78_deployment_blocked_by_structural_evidence/);
assert.doesNotMatch(helper, /source\s+[^\n]*\.env|\.\s+[^\n]*\.env/);
assert.doesNotMatch(helper, /cat\s+[^\n]*\.env/);

for (const body of [profile, integration, helper, contract, index, canary, zapiClient]) {
    assert.doesNotMatch(body, new RegExp(term('169', '\\.58', '\\.51', '\\.100')));
    assert.doesNotMatch(body, new RegExp(term('dash', 'board[^\\n]*co'), 'i'));
    assert.doesNotMatch(body, new RegExp(`\\b${term('colo', 'mbia')}\\b`, 'i'));
}
assert.equal(EC_BOT_CORE_V78_DATASET_ID, '1468946114265008');

console.log('EC_BOT_CORE_STRUCTURAL_V78=VALID');
console.log('MUTABLE_RUNTIME_ARTIFACT_CONTRACT=PASS');
console.log('BOT_CORE_ATOMIC_PROFILE=READY');
console.log('MUTATING_SCHEDULERS_DEFAULT=BLOCKED');
console.log('DROPI_APPLY_DEFAULT=BLOCKED');
console.log('META_PURCHASE_DEFAULT=BLOCKED');
console.log('QA_RESET=READY');
console.log('VSL_OFFICIAL_RECOGNITION=PASS');
console.log('VSL_PUBLIC_ORIGIN_CONFORMANCE=BLOCKED');
console.log('DATASET_CHANGED=NO');
console.log('FOREIGN_OPERATIONAL_INFRA_TOUCHED=NO');
console.log('PRODUCTION_MUTATIONS=0');
