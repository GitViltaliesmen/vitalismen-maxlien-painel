import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('../src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestPath = 'docs/freeze/canary-controller-pm2-stdin-hotfix-v77h-20260829.json';
const parentManifestPath = 'docs/freeze/canary-controller-safety-v77-20260828.json';
const manifest = json(manifestPath);
const packageJson = json('package.json');
const helper = read('ops/vitalismen-stage');
const contract = read('scripts/lib/canary-controller-pm2-stdin-hotfix-v77h-contract.mjs');
const freeze = read('docs/CANARY_CONTROLLER_PM2_STDIN_HOTFIX_FREEZE_V77H_20260829.md');
const architecture = read('docs/ARQUITETURA_AUTOMACAO_OFICIAL.md');
const officialFiles = read('docs/ARQUIVOS_OFICIAIS.md');

assert.equal(sha256(parentManifestPath), 'd127adb1220afa00ced0c91e0a295304682ae1142901b97d025823688bde85d1');
assert.equal(sha256('docs/CANARY_CONTROLLER_SAFETY_FREEZE_V77_20260828.md'), '6f6287d6ad6fd0662fb5f696007354b3a0e44bc53f20348059e14ebbfc36a676');
assert.equal(manifest.freezeId, 'canary-controller-pm2-stdin-hotfix-v77h');
assert.equal(manifest.parentFreezeId, 'canary-controller-safety-v77');
assert.equal(manifest.parentV77Commit, '5bedd9154c4ba0b69f0477e059473dcf7012d38a');
assert.equal(manifest.parentV77Tree, '681b6fd3249065e6b745eb346cbc5ff093185d1e');
assert.equal(manifest.policy.hotfixVersion, '77H');
assert.equal(manifest.policy.qaPhone, '5515998038637');
assert.equal(manifest.policy.recipientAllowlistCount, 5);
assert.equal(manifest.policy.canarySemanticsChanged, false);
assert.equal(manifest.policy.productionMutationExecuted, false);
const logicalBundleSha256 = crypto.createHash('sha256').update(
    Object.entries(manifest.protectedFiles)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, fileSha256]) => `${relativePath}\0${fileSha256}\n`)
        .join('')
).digest('hex');
assert.equal(manifest.logicalBundle.algorithm, 'SHA-256');
assert.equal(manifest.logicalBundle.format, 'sorted-relative-path-NUL-file-sha256-LF');
assert.equal(manifest.logicalBundle.sha256, logicalBundleSha256);

const legacyConflict = /"\$pm2_cmd" jlist \| "\$node_cmd" - "\$process_name" "\$canary_v77_overlay" <<'NODE'/;
assert.doesNotMatch(helper, legacyConflict);
assert.match(helper, /"\$pm2_cmd" jlist \| "\$node_cmd" "\$verifier" verify/);
assert.match(helper, /"\$pm2_cmd" jlist \| "\$node_cmd" "\$verifier" fingerprint-others/);
assert.match(contract, /fs\.readFileSync\(0, 'utf8'\)/);
assert.doesNotMatch(contract, /process\.stdin\.on\('end'/);
assert.match(contract, /pm2_target_count_invalid/);
assert.match(contract, /pm2_target_pid_invalid/);
assert.match(contract, /pm2_target_cwd_invalid/);
assert.match(contract, /pm2_target_exec_invalid/);
assert.match(contract, /pm2_overlay_mismatch/);
assert.match(contract, /recipient_allowlist_count_invalid/);
assert.match(contract, /external_pm2_fingerprint_changed/);
assert.match(contract, /`\$\{label\}_owner_invalid`/);
assert.match(contract, /`\$\{label\}_mode_invalid`/);

const activation = helper.slice(
    helper.indexOf('if [[ "$action" == "v77-canary-activate" ]]'),
    helper.indexOf('if [[ "$action" == "v77-canary-contain" ]]')
);
const fingerprintAt = activation.indexOf('external_pm2_fingerprint_before="$(fingerprint_external_pm2_canary_v77)"');
const consumeAt = activation.indexOf('consume_v77_canary_permit');
const restartAt = activation.indexOf('canary_v77_pm2 restart');
const verifyAt = activation.indexOf('verify_candidate_pm2_canary_v77_env "$external_pm2_fingerprint_before"');
assert.ok(fingerprintAt >= 0 && fingerprintAt < consumeAt);
assert.ok(consumeAt < restartAt && restartAt < verifyAt);
assert.match(activation, /trap activation_error_v77 ERR/);
assert.match(activation, /safe_pm2 restart/);
assert.match(activation, /wait_candidate_health_v66/);

const runtimeGuard = 'node src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js';
assert.equal(packageJson.scripts['guard:runtime-chain-v71'], runtimeGuard);
assert.equal(
    packageJson.scripts['guard:canary-controller-pm2-stdin-v77h'],
    `${runtimeGuard} && node scripts/guard-canary-controller-pm2-stdin-hotfix-v77h.mjs && node --test tests/canary-controller-pm2-stdin-hotfix-v77h.test.mjs`
);
assert.match(packageJson.scripts['guard:predeploy-v71'], /guard:canary-controller-pm2-stdin-v77h/);
assert.match(packageJson.scripts['guard:predeploy-v71'], /guard:canary-controller-health-policy-v77h2/);
assert.match(packageJson.scripts['senior:check'], /guard:canary-controller-pm2-stdin-v77h/);
assert.match(packageJson.scripts['senior:check'], /guard:canary-controller-health-policy-v77h2/);

for (const document of [freeze, architecture, officialFiles]) {
    assert.match(document, /V77H/);
    assert.match(document, /EPIPE/);
    assert.match(document, /5515998038637/);
    assert.match(document, /somente local|exclusivamente local/i);
}

console.log('CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H=VALID');
console.log('PM2_STDIN=JSON_EXCLUSIVE_UNTIL_EOF');
console.log('JAVASCRIPT_SOURCE=VERSIONED_FILE');
console.log('EXTERNAL_PM2_FINGERPRINT=REQUIRED');
console.log('CANARY_SEMANTICS_CHANGED=FALSE');
console.log('PRODUCTION_MUTATIONS=0');
