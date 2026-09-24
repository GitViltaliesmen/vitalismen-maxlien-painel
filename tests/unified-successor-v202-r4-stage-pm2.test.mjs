import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const stage = fs.readFileSync(new URL('../ops/vitalismen-stage', import.meta.url), 'utf8');
const verifier = fs.readFileSync(new URL(
    '../scripts/verify-unified-successor-v202-r4-stage.mjs', import.meta.url), 'utf8');
const authority = fs.readFileSync(new URL(
    '../scripts/lib/unified-successor-v202-r4-authority.mjs', import.meta.url), 'utf8');
test('STAGE_HELPER: checkpoint/Git/83 blobs antes de remover .git', () => {
    const select = stage.lastIndexOf('release_guard_node_options="$(successor_guard_node_options "$release_dir")"');
    const attest = stage.indexOf('run_protected r4_git_attestation', select);
    const removeGit = stage.indexOf('rm -rf -- "$release_dir/.git"', attest);
    const materialized = stage.indexOf('run_protected r4_materialized_attestation', removeGit);
    assert.ok(select >= 0 && attest > select && removeGit > attest && materialized > removeGit);
    assert.match(stage, /diff --quiet HEAD -- \\\n    scripts\/verify-unified-successor-v202-r4-stage\.mjs/);
    assert.match(verifier, /assertGitReleaseIdentity\(root, checkpoint\.value, manifest\)/);
    assert.match(verifier, /R4_GIT_OBJECTS=83\/83_PASS/);
    assert.match(stage, /'\.r4-operational-attestation\.json'/);
});
test('SAFE_PM2: identidade exata e attestation antes do controlador', () => {
    const safe = stage.slice(stage.indexOf('safe_pm2() {'), stage.indexOf('verify_candidate_pm2_safe_env() {'));
    assert.match(safe, /successor_guard_node_options "\$target_dir"/);
    assert.match(safe, /verify-unified-successor-v202-r4-stage\.mjs" verify/);
    assert.match(safe, /ec-runtime-successor-v199-context\.mjs/);
    assert.match(safe, /unified-successor-v202-r4-preload\.mjs/);
    assert.match(safe, /NODE_OPTIONS= npm_config_node_options= NPM_CONFIG_NODE_OPTIONS=/);
    assert.match(safe, /PM2_TARGET_IDENTITY_INVALID/);
});
test('STAGE_R4: runner sucessor e predeploy histórico sem alterar o caminho V201', () => {
    const start = stage.indexOf('if [[ "$release_guard_node_options" == *unified-successor-v202-r4-preload.mjs ]]; then',
        stage.indexOf('run_protected post_sale_data_compatibility_v66'));
    const end = stage.indexOf('run_protected post_sale_safety_guard_v66', start);
    assert.ok(start >= 0 && end > start);
    const wiring = stage.slice(start, end);
    assert.match(wiring, /successor_guard_node_options "\$current_before"/);
    assert.match(wiring, /--import=file:\/\/\$current_before\/scripts\/lib\/ec-runtime-successor-v199-context\.mjs/);
    assert.match(wiring, /runtime_guard_command=\([\s\S]*?scripts\/run-unified-successor-v202-r4\.mjs --runtime "\$release_dir"\)/);
    assert.match(wiring, /predeploy_command=\("\$env_cmd" -C "\$current_before"[\s\S]*?"\$npm_cmd" run guard:predeploy-v71\)/);
    const legacy = wiring.slice(wiring.indexOf('\nelse\n'));
    assert.match(legacy, /"\$npm_cmd" run guard:runtime-chain-v71/);
    assert.match(legacy, /"\$npm_cmd" run guard:predeploy-v71/);
    assert.match(wiring, /^run_protected runtime_guard_chain_v71 "\$\{runtime_guard_command\[@\]\}"$/m);
    assert.match(wiring, /^run_protected predeploy_v71 "\$\{predeploy_command\[@\]\}"$/m);
});
test('RUNTIME: autoridade fixa sem Git nem variável de identidade', () => {
    assert.match(authority, /R4_CHECKPOINT_PATH =\s*'\/var\/lib\/vitalismen-deploy\//);
    assert.doesNotMatch(authority, /process\.env\.VITALISMEN_R4_(EXPECTED_COMMIT|EXPECTED_TREE|CHECKPOINT_PATH)/);
    const verify = authority.slice(authority.indexOf('export function verifyMaterializedRelease'));
    assert.doesNotMatch(verify, /execFile|spawn|child_process|\.git', 'rev-parse/);
    assert.match(verify, /requireGitAbsent/);
    assert.match(verify, /validateAttestation\(attestation, checkpoint\.value/);
    assert.match(authority, /materializedFileHashes\.map\(item => item\.path\)/);
});
