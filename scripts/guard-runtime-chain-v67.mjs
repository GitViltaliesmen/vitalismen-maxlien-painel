import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const immutableArtifacts = Object.freeze({
    'docs/freeze/ec-repurchase-sqlite-serialization-v47-20260822.json': '41fb725a5a43393f7c9e52427be6635830d458c3e87a314d7e5a457f2791a88b',
    'src/services/ecRepurchaseSqliteSerializationFreezeRuntimeGuardV47.js': '39e955857813a8450ba948e4333d8214f6fa5039d869777a12ec89b9bf32a520',
    'docs/freeze/dropi-customer-full-name-v64-20260826.json': '2e0de5487bff72cc36d225a1618ffce2baa62f98ea320ad1c9ad46ea7ebad986',
    'src/services/dropiCustomerFullNameFreezeRuntimeGuardV64.js': '90be9c00e590923cc85f98040c273d68b8ef51a56000486643357d89ff4e6186',
    'docs/freeze/post-sale-gargalos-v65-20260826.json': '62b7321da888d3bd3db2982f7266959e97bd2ecc279197fcf0e4402fd1238643',
    'src/services/postSaleGargalosFreezeRuntimeGuardV65.js': 'fd8701964bb6fb2c3117cd5de814e92d0ee0faa52740c33838f4d92315d3d15e',
    'docs/freeze/post-sale-safety-v66-20260826.json': 'f00afd694d897bfc5d92da69c173bd834612319250b32909b578765b608d2cb9',
    'src/services/postSaleSafetyFreezeRuntimeGuardV66.js': 'd680ab1ad2d27a5486d4932fa1cba79e40c9ae10c7c49449708678e43a2b65e3'
});

for (const [file, expectedHash] of Object.entries(immutableArtifacts)) {
    assert.equal(sha256(file), expectedHash, `freeze histórico alterado: ${file}`);
}

const guidePath = 'src/services/guidePrintDispatcherService.js';
const v29 = json('docs/freeze/logistics-clean-chat-v29-20260818.json');
const v47 = json('docs/freeze/ec-repurchase-sqlite-serialization-v47-20260822.json');
const v64 = json('docs/freeze/dropi-customer-full-name-v64-20260826.json');
const v65 = json('docs/freeze/post-sale-gargalos-v65-20260826.json');
const v66 = json('docs/freeze/post-sale-safety-v66-20260826.json');
const v67 = json('docs/freeze/runtime-guard-chain-v67-20260826.json');

assert.equal(v29.protectedFiles[guidePath], '86d4feb9d5e93839ce1786c569b10c7d60c55916eb610b1612348dbdb0da547c');
assert.equal(v66.protectedFiles[guidePath], '6c0240c66cacb6545de48a9fa0531f484b75334d0372d969bfddf9c8e50505da');
assert.equal(sha256(guidePath), v66.protectedFiles[guidePath]);
assert.ok(v66.declaredAncestorOverrides.includes(guidePath), 'override legítimo V66 da guia ausente');
assert.ok(!v47.declaredAncestorOverrides.includes(guidePath), 'V47 não pode ser adulterado pelo sucessor');
assert.ok(!v64.declaredAncestorOverrides.includes(guidePath), 'V64 não declarou a alteração que ainda não existia');
assert.ok(!v65.declaredAncestorOverrides.includes(guidePath), 'V65 não declarou a alteração que ainda não existia');
assert.equal(v65.parentFreezeId, v64.freezeId);
assert.equal(v66.parentFreezeId, v65.freezeId);
assert.equal(v67.parentFreezeId, v66.freezeId);
assert.equal(v66.parentManifestSha256, sha256('docs/freeze/post-sale-gargalos-v65-20260826.json'));
assert.equal(v67.parentManifestSha256, sha256('docs/freeze/post-sale-safety-v66-20260826.json'));

const runtimeV66 = read('src/services/postSaleSafetyFreezeRuntimeGuardV66.js');
const runtimeV67 = read('src/services/runtimeGuardChainFreezeRuntimeGuardV67.js');
const context = read('src/services/successorGuardContextService.js');
const entry = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const helper = read('ops/vitalismen-stage');
const deploy = read('scripts/deploy-vps-ready.mjs');
const packageJson = json('package.json');

assert.match(runtimeV66, /globalThis\.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES/);
assert.match(runtimeV66, /await import\('\.\/postSaleGargalosFreezeRuntimeGuardV65\.js'\)/);
assert.match(runtimeV66, /finally/);
assert.doesNotMatch(runtimeV66, /spawn|execSync|process\.exitCode|catch\s*\(/);
assert.match(context, /withSuccessorGuardContext/);
assert.match(context, /return await operation\(\)/);
assert.match(context, /finally/);
assert.doesNotMatch(context, /catch\s*\(/);
assert.match(runtimeV67, /await withSuccessorGuardContext/);
assert.match(runtimeV67, /await import\('\.\/postSaleSafetyFreezeRuntimeGuardV66\.js'\)/);
assert.doesNotMatch(runtimeV67, /spawn|execSync|process\.exitCode|catch\s*\(/);
assert.match(entry, /runtimeGuardChainFreezeRuntimeGuardV67\.js/);

for (const alias of [
    'guard:dropi-customer-full-name-v64',
    'guard:post-sale-gargalos-v65',
    'guard:post-sale-safety-v66'
]) {
    assert.match(packageJson.scripts[alias], /^npm run guard:runtime-chain-v67 && /, `${alias} não usa a cadeia canônica`);
}
assert.equal(
    packageJson.scripts['guard:runtime-chain-v67'],
    'node src/services/runtimeGuardChainFreezeRuntimeGuardV67.js'
);
assert.match(packageJson.scripts['guard:predeploy-v67'], /guard:runtime-chain-v67/);
assert.match(packageJson.scripts['guard:predeploy-v67'], /guard-runtime-chain-v67\.mjs/);
assert.match(packageJson.scripts['guard:predeploy-v67'], /runtime-guard-chain-v67\.test\.mjs/);

const helperRuntimeAt = helper.indexOf('src/services/runtimeGuardChainFreezeRuntimeGuardV67.js');
const helperStaticV66At = helper.indexOf('scripts/guard-post-sale-safety-v66.mjs');
assert.ok(helperRuntimeAt >= 0 && helperStaticV66At > helperRuntimeAt, 'helper deve executar V67 antes do guard estático V66');
assert.doesNotMatch(helper, /src\/services\/(?:dropiCustomerFullName|postSaleGargalos)FreezeRuntimeGuardV(?:64|65)\.js/);
assert.match(deploy, /npm run guard:predeploy-v67/);
assert.ok(deploy.indexOf('npm run guard:predeploy-v67') < deploy.indexOf('npm run senior:check'));

for (const preserved of [
    'SAFE_OBSERVATION_ONLY',
    'REPORT_ONLY',
    'postSaleSafetyLedger',
    'central_guide_stage_decision_required',
    'runtime_older_than_persistent_data_contract'
]) {
    assert.ok(
        [
            read('src/index.js'),
            read('src/services/postSaleSafetyV66Service.js'),
            read('src/services/postSaleNotificationDecisionService.js'),
            read('src/services/shipmentMessageService.js')
        ].join('\n').includes(preserved),
        `controle V66 ausente: ${preserved}`
    );
}

console.log('RUNTIME_GUARD_CHAIN_V67_STATIC=OK');
