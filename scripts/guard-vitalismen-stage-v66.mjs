import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperPath = path.join(root, 'ops', 'vitalismen-stage');
const referencePath = path.join(root, 'ops', 'reference', 'vitalismen-stage.installed-20260826.sh');
const source = fs.readFileSync(helperPath, 'utf8');
const reference = fs.readFileSync(referencePath);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

assert.equal(
    sha256(reference),
    '0c2cf0d0b13d0149ad8c76ff8c94e4b7295d42c474ae6d45ff21a2cf1767b9b6',
    'snapshot do helper instalado divergiu do artefato auditado'
);
assert.ok(source.startsWith('#!/usr/bin/env bash\nset -Eeuo pipefail\n'), 'header fail-closed ausente');
assert.match(source, /SOURCE_PROCESS_STATE|source_process_state="STOPPED_CONTAINMENT"/);
assert.match(source, /status" == "stopped" && "\$pid" == "0"/);
assert.match(source, /SOURCE_HEALTH=SKIPPED_EXPECTED_CONTAINMENT/);
assert.match(source, /V66_SAFE_OBSERVATION_ONLY/);
assert.match(source, /DROPPI_EC_ACTIVE_SYNC_MODE=REPORT_ONLY/);
assert.match(source, /POST_SALE_V66_MUTATIONS_ENABLED=false/);
assert.match(source, /POST_SALE_V66_MUTATIONS_AUTHORIZATION=/);
assert.match(source, /POST_SALE_V66_BRIDGE_APPLY_APPROVED=/);
assert.match(source, /DISABLE_SCHEDULER=1/);
assert.match(source, /mutatingSchedulersRegistered": 0/);
assert.match(source, /v66-plan/);
assert.match(source, /DRY_RUN_WRITES=0/);
assert.match(source, /activate legado bloqueado/);

const activateStart = source.indexOf('if [[ "$action" == "v66-activate-safe" ]]');
const containStart = source.indexOf('if [[ "$action" == "v66-contain" ]]');
assert.ok(activateStart >= 0 && containStart > activateStart, 'bloco de ativação V66 ausente');
const activateBlock = source.slice(activateStart, containStart);
const compatibilityIndex = activateBlock.indexOf('run_compatibility_preflight');
const switchIndex = activateBlock.indexOf('switch_current_v66 "$candidate_dir"');
const startupIndex = activateBlock.indexOf('safe_pm2 restart');
assert.ok(compatibilityIndex >= 0, 'compatibility preflight ausente na ativação');
assert.ok(switchIndex > compatibilityIndex, 'compatibility preflight deve preceder o symlink');
assert.ok(startupIndex > switchIndex, 'startup deve ocorrer somente depois do symlink');
assert.match(activateBlock, /verify_candidate_pm2_safe_env\s+wait_candidate_health_v66/);
assert.match(activateBlock, /"\$pm2_cmd" stop "\$process_name"/);
assert.match(activateBlock, /switch_current_v66 "\$previous_dir"/);
assert.match(activateBlock, /RUNTIME_ROLLBACK_EXECUTED=NO/);
assert.match(activateBlock, /OLD_RUNTIME_STARTED=NO/);
const failureHandler = activateBlock.slice(
    activateBlock.indexOf('activation_error_v66() {'),
    activateBlock.indexOf('trap activation_error_v66 ERR')
);
assert.doesNotMatch(failureHandler, /safe_pm2|pm2_cmd" (?:start|restart|reload|resurrect)/);

const rollbackStart = source.indexOf('if [[ "$action" == "v66-rollback-plan" ]]');
const stageStart = source.indexOf('[[ "$action" == "stage" ]]');
assert.ok(rollbackStart >= 0 && stageStart > rollbackStart, 'rollback plan ausente');
const rollbackBlock = source.slice(rollbackStart, stageStart);
assert.match(rollbackBlock, /run_compatibility_preflight/);
assert.match(rollbackBlock, /RUNTIME_ROLLBACK_EXECUTION=BLOCKED/);
assert.match(rollbackBlock, /REQUIRES_SEPARATE_EXPLICIT_AUTHORIZATION/);
assert.match(rollbackBlock, /PM2_ACTIONS=0/);
assert.doesNotMatch(rollbackBlock, /safe_pm2|pm2_cmd" (?:start|restart|reload|resurrect)/);

assert.match(source, /"postSaleCompatibility": \{/);
assert.match(source, /"runtimeVersion": 66/);
assert.match(source, /"readsDataCompatibilityThrough": 66/);
assert.match(source, /"writesDataCompatibilityVersion": 66/);
assert.match(source, /"requiresRollbackTargetPreflight": true/);

const bashCandidates = process.platform === 'win32'
    ? ['C:\\Program Files\\Git\\bin\\bash.exe']
    : ['/bin/bash', '/usr/bin/bash'];
const bash = bashCandidates.find((candidate) => fs.existsSync(candidate));
assert.ok(bash, 'bash compatível não localizado');
const syntax = spawnSync(bash, ['-n', helperPath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, `sintaxe bash inválida:\n${syntax.stderr || syntax.stdout}`);

process.stdout.write(`VITALISMEN_STAGE_V66_GUARD=OK\n`);
process.stdout.write(`SHA256_INSTALLED_SNAPSHOT=${sha256(reference)}\n`);
process.stdout.write(`SHA256_SOURCE_CANDIDATE=${sha256(fs.readFileSync(helperPath))}\n`);
