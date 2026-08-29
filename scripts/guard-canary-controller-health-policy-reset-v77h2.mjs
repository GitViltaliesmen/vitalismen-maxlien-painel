import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('../src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestPath = 'docs/freeze/canary-controller-health-policy-reset-v77h2-20260829.json';
const parentManifestPath = 'docs/freeze/canary-controller-pm2-stdin-hotfix-v77h-20260829.json';
const manifest = json(manifestPath);
const packageJson = json('package.json');
const contract = read('scripts/lib/canary-controller-contract-v77.mjs');
const helper = read('ops/vitalismen-stage');
const pm2Contract = read('scripts/lib/canary-controller-pm2-stdin-hotfix-v77h-contract.mjs');
const freeze = read('docs/CANARY_CONTROLLER_HEALTH_POLICY_RESET_FREEZE_V77H2_20260829.md');
const architecture = read('docs/ARQUITETURA_AUTOMACAO_OFICIAL.md');
const officialFiles = read('docs/ARQUIVOS_OFICIAIS.md');
const tests = read('tests/canary-controller-health-policy-reset-v77h2.test.mjs');

assert.equal(sha256(parentManifestPath), '9c5becbc3db759d7d01b56333e5dea99df615d3ad31c8bcd5b75533f2bdb54c0');
assert.equal(manifest.freezeId, 'canary-controller-health-policy-reset-v77h2');
assert.equal(manifest.parentFreezeId, 'canary-controller-pm2-stdin-hotfix-v77h');
assert.equal(manifest.parentV77HCommit, '23c81c762d58108307860d53770805acbd0e0ba8');
assert.equal(manifest.parentV77HTree, '2c40ec813cf70bb200f7d12d6ebc31443b664f6d');
assert.equal(manifest.policy.hotfixVersion, '77H2');
assert.equal(manifest.policy.qaPhone, '5515998038637');
assert.equal(manifest.policy.recipientAllowlistCount, 5);
assert.equal(manifest.policy.safeObservationPolicyMaterialized, true);
assert.equal(manifest.policy.safeObservationPolicyValue, '');
assert.equal(manifest.policy.pm2InheritedStrictOverwritten, true);
assert.equal(manifest.policy.pm2StdinV77HPreserved, true);
assert.equal(manifest.policy.helperChanged, false);
assert.equal(manifest.policy.productionMutationExecuted, false);
assert.equal(sha256('ops/vitalismen-stage'), 'ff3d9c5ac129a98902b12ecda443cf97876b32142561ad46c70f3540c87c5853');

const logicalBundleSha256 = crypto.createHash('sha256').update(
    Object.entries(manifest.protectedFiles)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, fileSha256]) => `${relativePath}\0${fileSha256}\n`)
        .join('')
).digest('hex');
assert.equal(manifest.logicalBundle.algorithm, 'SHA-256');
assert.equal(manifest.logicalBundle.format, 'sorted-relative-path-NUL-file-sha256-LF');
assert.equal(manifest.logicalBundle.sha256, logicalBundleSha256);
assert.equal(Object.keys(manifest.protectedFiles).length, 15);

assert.match(contract, /SAFE_OBSERVATION_POLICY: ''/);
assert.match(contract, /serializeCanaryControllerV77Overlay/);
assert.match(pm2Contract, /fs\.readFileSync\(0, 'utf8'\)/);
assert.doesNotMatch(helper, /"\$pm2_cmd" jlist \| "\$node_cmd" - "\$process_name" "\$canary_v77_overlay" <<'NODE'/);

const runtimeGuard = 'node src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js';
assert.equal(packageJson.scripts['guard:runtime-chain-v71'], runtimeGuard);
assert.equal(
    packageJson.scripts['guard:canary-controller-health-policy-v77h2'],
    `${runtimeGuard} && node scripts/guard-canary-controller-health-policy-reset-v77h2.mjs && node --test tests/canary-controller-health-policy-reset-v77h2.test.mjs`
);
assert.match(packageJson.scripts['guard:predeploy-v71'], /guard:canary-controller-pm2-stdin-v77h && npm run guard:canary-controller-health-policy-v77h2$/);
assert.match(packageJson.scripts['senior:check'], /guard:canary-controller-pm2-stdin-v77h && npm run guard:canary-controller-health-policy-v77h2/);

for (const document of [freeze, architecture, officialFiles]) {
    assert.match(document, /V77H2/);
    assert.match(document, /SAFE_OBSERVATION_POLICY=/);
    assert.match(document, /5515998038637/);
    assert.match(document, /somente local|exclusivamente local/i);
}
for (const proof of [
    'strict herdada',
    'mutações só ficam prontas',
    'permit vencido ou reutilizado',
    'Dropi, Meta, scheduler',
    'contenção restaura',
    'sem EPIPE'
]) assert.match(tests, new RegExp(proof, 'i'));

console.log('CANARY_CONTROLLER_HEALTH_POLICY_RESET_V77H2=VALID');
console.log('SAFE_OBSERVATION_POLICY=EXPLICIT_EMPTY');
console.log('PM2_INHERITED_STRICT=OVERWRITTEN');
console.log('PM2_STDIN_V77H=PRESERVED');
console.log('HELPER_CHANGED=FALSE');
console.log('QA_PHONE=5515998038637');
console.log('PRODUCTION_MUTATIONS=0');
