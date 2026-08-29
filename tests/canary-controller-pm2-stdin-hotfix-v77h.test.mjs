import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    buildCanaryControllerV77Bundle
} from '../scripts/lib/canary-controller-contract-v77.mjs';
import {
    CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_CWD,
    CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_EXEC,
    assertRootOnlyArtifactV77H,
    calculatePm2ExternalFingerprintV77H,
    parsePm2JlistV77H,
    verifyCandidatePm2CanaryV77H
} from '../scripts/lib/canary-controller-pm2-stdin-hotfix-v77h-contract.mjs';

const TARGET = Object.freeze({
    release: '20260828T235900Z_production-20260828-5bedd91',
    commit: '5bedd9154c4ba0b69f0477e059473dcf7012d38a',
    tree: '681b6fd3249065e6b745eb346cbc5ff093185d1e',
    tag: 'production-20260828-5bedd91'
});
const CANDIDATE_DIR = `/opt/vitalismen-automacao/releases/${TARGET.release}`;
const HASH = 'a'.repeat(64);

const bundleAt = (nowMs = Date.now()) => buildCanaryControllerV77Bundle({
    ...TARGET,
    permitId: 'v77h-pm2-stdin-test',
    createdAt: new Date(nowMs).toISOString(),
    permitExpiresAt: new Date(nowMs + 10 * 60 * 1000).toISOString(),
    windowExpiresAt: new Date(nowMs + 60 * 60 * 1000).toISOString(),
    manifestSha256: HASH,
    releaseMetadataSha256: HASH,
    stagingCompleteSha256: HASH,
    publicationMetadataSha256: HASH,
    publicationCompleteSha256: HASH
});

const external = () => [
    { name: 'api-proxy', pid: 101, pm2_env: { status: 'online', pm_cwd: '/opt/api', pm_exec_path: '/opt/api/index.js' } },
    { name: 'campaign-worker', pid: 102, pm2_env: { status: 'online', pm_cwd: '/opt/campaign', pm_exec_path: '/opt/campaign/index.js' } },
    { name: 'panel', pid: 103, pm2_env: { status: 'online', pm_cwd: '/opt/panel', pm_exec_path: '/opt/panel/index.js' } },
    { name: 'metrics', pid: 104, pm2_env: { status: 'online', pm_cwd: '/opt/metrics', pm_exec_path: '/opt/metrics/index.js' } }
];

const fixture = (nowMs = Date.now()) => {
    const bundle = bundleAt(nowMs);
    const target = {
        name: 'vitalismen-automation',
        pid: 4242,
        pm2_env: {
            ...bundle.env,
            status: 'online',
            pm_cwd: CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_CWD,
            pm_exec_path: CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_EXEC
        }
    };
    const entries = [...external(), target];
    return {
        bundle,
        entries,
        fingerprint: calculatePm2ExternalFingerprintV77H(entries),
        nowMs
    };
};

const verify = (state, overrides = {}) => verifyCandidatePm2CanaryV77H({
    entries: state.entries,
    overlay: state.bundle.overlay,
    candidateDir: CANDIDATE_DIR,
    procCwd: CANDIDATE_DIR,
    expectedExternalFingerprint: state.fingerprint,
    nowMs: state.nowMs,
    ...overrides
});

const waitExit = (child) => new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
});

test('consome pm2 jlist integralmente pelo stdin real sem EPIPE', async () => {
    const contract = fileURLToPath(new URL(
        '../scripts/lib/canary-controller-pm2-stdin-hotfix-v77h-contract.mjs',
        import.meta.url
    ));
    const producerCode = [
        "const rows = Array.from({length: 50000}, (_, index) => ({name: `external-${index}`, pid: index + 1, pm2_env: {status: 'online'}}));",
        "rows.push({name: 'vitalismen-automation', pid: 999, pm2_env: {status: 'online'}});",
        "process.stdout.write(JSON.stringify(rows));"
    ].join('');
    const producer = spawn(process.execPath, ['-e', producerCode], { stdio: ['ignore', 'pipe', 'pipe'] });
    const consumer = spawn(process.execPath, [contract, 'parse-stdin'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const producerExitPromise = waitExit(producer);
    const consumerExitPromise = waitExit(consumer);
    producer.stdout.pipe(consumer.stdin);

    let producerError = '';
    let consumerError = '';
    let consumerOutput = '';
    producer.stderr.setEncoding('utf8');
    consumer.stderr.setEncoding('utf8');
    consumer.stdout.setEncoding('utf8');
    producer.stderr.on('data', (chunk) => { producerError += chunk; });
    consumer.stderr.on('data', (chunk) => { consumerError += chunk; });
    consumer.stdout.on('data', (chunk) => { consumerOutput += chunk; });

    const [producerExit, consumerExit] = await Promise.all([producerExitPromise, consumerExitPromise]);
    assert.equal(producerExit.code, 0, producerError);
    assert.equal(consumerExit.code, 0, consumerError);
    assert.doesNotMatch(`${producerError}${consumerError}`, /EPIPE/);
    assert.equal(consumerOutput, 'PM2_JSON_COUNT=50001\n');
});

test('snapshot íntegro exige um processo online, PID, cwd/exec, overlay e cinco allowlists QA', () => {
    const state = fixture();
    const result = verify(state);
    assert.equal(result.ok, true);
    assert.equal(result.pid, 4242);
    assert.equal(result.allowlistCount, 5);
    assert.equal(result.externalFingerprint, state.fingerprint);
});

test('JSON vazio ou truncado falha fechado depois de consumir o stdin', () => {
    assert.throws(() => parsePm2JlistV77H(''), /pm2_jlist_empty/);
    assert.throws(() => parsePm2JlistV77H('[{"name":"vitalismen-automation"}'), /pm2_jlist_invalid_or_truncated/);
});

test('processo alvo ausente ou duplicado é bloqueado', () => {
    const state = fixture();
    assert.throws(
        () => verify(state, { entries: state.entries.filter((entry) => entry.name !== 'vitalismen-automation') }),
        /pm2_target_count_invalid:0/
    );
    assert.throws(
        () => verify(state, { entries: [...state.entries, state.entries.at(-1)] }),
        /pm2_target_count_invalid:2/
    );
});

test('status, PID, cwd, exec e cwd runtime divergentes são bloqueados', () => {
    const state = fixture();
    for (const [field, value, pattern] of [
        ['status', 'stopped', /pm2_target_not_online/],
        ['pm_cwd', '/opt/invalid', /pm2_target_cwd_invalid/],
        ['pm_exec_path', '/opt/invalid/index.js', /pm2_target_exec_invalid/]
    ]) {
        const target = structuredClone(state.entries.at(-1));
        target.pm2_env[field] = value;
        assert.throws(() => verify(state, { entries: [...external(), target] }), pattern);
    }
    const noPid = structuredClone(state.entries.at(-1));
    noPid.pid = 0;
    assert.throws(() => verify(state, { entries: [...external(), noPid] }), /pm2_target_pid_invalid/);
    assert.throws(() => verify(state, { procCwd: '/opt/vitalismen-automacao/releases/other' }), /process_runtime_cwd_invalid/);
});

test('overlay divergente, segundo destinatário, Dropi, Meta ou scheduler extra falham fechados', () => {
    const state = fixture();
    const mismatchedTarget = structuredClone(state.entries.at(-1));
    mismatchedTarget.pm2_env.WHATSAPP_AUTO_REPLY_ENABLED = 'false';
    assert.throws(
        () => verify(state, { entries: [...external(), mismatchedTarget] }),
        /pm2_overlay_mismatch:WHATSAPP_AUTO_REPLY_ENABLED/
    );

    for (const [key, value] of [
        ['WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS', '5515998038637,593991234567'],
        ['DROPPI_EC_ACTIVE_SYNC_ENABLED', 'true'],
        ['META_RETRO_SEND', 'true'],
        ['SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED', 'true']
    ]) {
        const env = { ...state.bundle.env, [key]: value };
        const target = structuredClone(state.entries.at(-1));
        Object.assign(target.pm2_env, env);
        assert.throws(
            () => verify(state, { entries: [...external(), target], overlay: env }),
            /canary_(?:controller|isolation)_invalid/
        );
    }
});

test('owner, mode ou symlink divergente em artefato root-only é bloqueado', () => {
    assert.equal(assertRootOnlyArtifactV77H(
        { uid: 0, gid: 0, mode: 0o100400, isSymbolicLink: false },
        { mode: 0o400, label: 'overlay' }
    ), true);
    assert.throws(
        () => assertRootOnlyArtifactV77H({ uid: 1000, gid: 0, mode: 0o400 }, { mode: 0o400, label: 'overlay' }),
        /overlay_owner_invalid/
    );
    assert.throws(
        () => assertRootOnlyArtifactV77H({ uid: 0, gid: 0, mode: 0o600 }, { mode: 0o400, label: 'overlay' }),
        /overlay_mode_invalid/
    );
    assert.throws(
        () => assertRootOnlyArtifactV77H(
            { uid: 0, gid: 0, mode: 0o400, isSymbolicLink: true },
            { mode: 0o400, label: 'overlay' }
        ),
        /overlay_symlink_forbidden/
    );
});

test('alteração em qualquer processo PM2 externo invalida o fingerprint pré-ativação', () => {
    const state = fixture();
    const changed = structuredClone(state.entries);
    changed[0].pid += 1;
    assert.throws(() => verify(state, { entries: changed }), /external_pm2_fingerprint_changed/);
});
