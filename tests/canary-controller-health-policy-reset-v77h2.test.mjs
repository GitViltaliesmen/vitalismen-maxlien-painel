import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    buildCanaryControllerV77Bundle,
    validateCanaryControllerV77Bundle
} from '../scripts/lib/canary-controller-contract-v77.mjs';
import {
    CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_CWD,
    CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_EXEC,
    calculatePm2ExternalFingerprintV77H,
    verifyCandidatePm2CanaryV77H
} from '../scripts/lib/canary-controller-pm2-stdin-hotfix-v77h-contract.mjs';
import {
    assertCanaryControllerV77Health
} from '../src/services/canaryControllerV77Service.js';
import {
    CANARY_V75_RECIPIENT_LIST_FLAGS,
    CANARY_V75_REQUIRED_TRUE_FLAGS,
    buildCanaryV75RecipientQuery,
    evaluateCanaryV75ExternalEffect,
    evaluateCanaryV75Recipient,
    resolveCanaryV75Configuration
} from '../src/services/canaryIsolationV75Service.js';
import {
    resolvePostSaleOperationalMutationGate
} from '../src/services/postSaleSafetyV66Service.js';
import {
    resolveStrictReadOnlyObservation
} from '../src/services/strictReadOnlyObservationService.js';

const QA_PHONE = '5515998038637';
const HASH = 'a'.repeat(64);
const TARGET = Object.freeze({
    release: '20260829T023000Z_production-20260829-8888888',
    commit: '8888888888888888888888888888888888888888',
    tree: '9999999999999999999999999999999999999999',
    tag: 'production-20260829-8888888'
});
const CANDIDATE_DIR = `/opt/vitalismen-automacao/releases/${TARGET.release}`;
const COMPATIBILITY = Object.freeze({
    bridgeComplete: true,
    dataCompatibilityVersion: 66,
    minRuntimeVersion: 66
});

const bundleAt = (nowMs = Date.now()) => buildCanaryControllerV77Bundle({
    ...TARGET,
    permitId: 'v77h2-health-policy-test',
    createdAt: new Date(nowMs).toISOString(),
    permitExpiresAt: new Date(nowMs + 10 * 60 * 1000).toISOString(),
    windowExpiresAt: new Date(nowMs + 15 * 60 * 1000).toISOString(),
    manifestSha256: HASH,
    releaseMetadataSha256: HASH,
    stagingCompleteSha256: HASH,
    publicationMetadataSha256: HASH,
    publicationCompleteSha256: HASH
});

const externalProcesses = () => [
    { name: 'api-proxy', pid: 101, pm2_env: { status: 'online', pm_cwd: '/opt/api', pm_exec_path: '/opt/api/index.js' } },
    { name: 'campaign-worker', pid: 102, pm2_env: { status: 'online', pm_cwd: '/opt/campaign', pm_exec_path: '/opt/campaign/index.js' } },
    { name: 'panel', pid: 103, pm2_env: { status: 'online', pm_cwd: '/opt/panel', pm_exec_path: '/opt/panel/index.js' } },
    { name: 'metrics', pid: 104, pm2_env: { status: 'online', pm_cwd: '/opt/metrics', pm_exec_path: '/opt/metrics/index.js' } }
];

const effectiveQaState = (env) => {
    const strict = resolveStrictReadOnlyObservation(env);
    const canary = resolveCanaryV75Configuration(env);
    const mutations = resolvePostSaleOperationalMutationGate(env, { compatibilityState: COMPATIBILITY });
    return {
        strict,
        canary,
        mutations,
        ready: !strict.strictReadOnly && canary.ready && mutations.allowed
    };
};

test('overlay vazio substitui SAFE_OBSERVATION_POLICY strict herdada do PM2', () => {
    const bundle = bundleAt();
    const previousPm2Env = { SAFE_OBSERVATION_POLICY: 'STRICT_READ_ONLY' };
    const effective = { ...previousPm2Env, ...bundle.env };
    assert.equal(Object.hasOwn(bundle.env, 'SAFE_OBSERVATION_POLICY'), true);
    assert.equal(bundle.env.SAFE_OBSERVATION_POLICY, '');
    assert.match(bundle.overlay, /^SAFE_OBSERVATION_POLICY=$/m);
    assert.equal(effective.SAFE_OBSERVATION_POLICY, '');
});

test('ambiente efetivo integral libera strict somente para o QA temporizado válido', () => {
    const bundle = bundleAt();
    const state = effectiveQaState({ SAFE_OBSERVATION_POLICY: 'STRICT_READ_ONLY', ...bundle.env });
    assert.equal(state.strict.strictReadOnly, false);
    assert.equal(state.strict.mode, 'OPERATIONAL');
    assert.equal(state.canary.ready, true);
    assert.equal(state.mutations.allowed, true);
    assert.equal(state.ready, true);
    assert.deepEqual(assertCanaryControllerV77Health({
        status: 'online',
        degradedReasons: [],
        automationSafety: {
            strictReadOnly: false,
            operationalMutationsEnabled: true,
            compatibilityBridgeComplete: true,
            dataCompatibilityVersion: 66,
            minimumRuntimeVersion: 66,
            dropiSyncMode: 'REPORT_ONLY',
            dropiApplyAllowed: false
        }
    }), { ok: true, failures: [] });
});

test('mutações só ficam prontas com perfil QA coordenado e compatibilidade persistente', () => {
    const bundle = bundleAt();
    assert.equal(effectiveQaState(bundle.env).ready, true);
    for (const [key, value] of [
        ['POST_SALE_V66_MUTATIONS_ENABLED', 'false'],
        ['POST_SALE_V66_MUTATIONS_AUTHORIZATION', ''],
        ['POST_SALE_V66_COMPATIBILITY_BRIDGE_READY', 'false'],
        ['VITALISMEN_CANARY_CTRL_V77_ENABLED', 'false']
    ]) {
        assert.equal(effectiveQaState({ ...bundle.env, [key]: value }).ready, false, key);
    }
    const incompatible = resolvePostSaleOperationalMutationGate(bundle.env, {
        compatibilityState: { ...COMPATIBILITY, bridgeComplete: false }
    });
    assert.equal(incompatible.allowed, false);
});

test('chave ausente ou strict retida reproduz o bloqueio de health observado', () => {
    const bundle = bundleAt();
    const missingPolicy = { ...bundle.env };
    delete missingPolicy.SAFE_OBSERVATION_POLICY;
    for (const effective of [
        { SAFE_OBSERVATION_POLICY: 'STRICT_READ_ONLY', ...missingPolicy },
        { ...bundle.env, SAFE_OBSERVATION_POLICY: 'STRICT_READ_ONLY' }
    ]) {
        const strict = resolveStrictReadOnlyObservation(effective);
        assert.equal(strict.strictReadOnly, true);
        assert.throws(() => assertCanaryControllerV77Health({
            status: 'online',
            degradedReasons: [],
            automationSafety: {
                strictReadOnly: strict.strictReadOnly,
                operationalMutationsEnabled: true,
                compatibilityBridgeComplete: true,
                dataCompatibilityVersion: 66,
                minimumRuntimeVersion: 66,
                dropiSyncMode: 'REPORT_ONLY',
                dropiApplyAllowed: false
            }
        }), /strict_read_only_not_released_for_canary/);
    }
});

test('cinco allowlists preservam somente o telefone QA por igualdade integral', () => {
    const bundle = bundleAt();
    assert.equal(CANARY_V75_RECIPIENT_LIST_FLAGS.length, 5);
    for (const flag of CANARY_V75_RECIPIENT_LIST_FLAGS) assert.equal(bundle.env[flag], QA_PHONE);
    assert.equal(evaluateCanaryV75Recipient(QA_PHONE, { env: bundle.env }).allowed, true);
    for (const invalid of ['593991234567', `9${QA_PHONE}`, `${QA_PHONE}9`, 'identity-missing@lid']) {
        assert.equal(evaluateCanaryV75Recipient(invalid, { env: bundle.env }).allowed, false, invalid);
    }
});

test('permit vencido ou reutilizado continua bloqueado', () => {
    const nowMs = Date.now();
    const bundle = bundleAt(nowMs);
    assert.throws(() => validateCanaryControllerV77Bundle({
        overlay: bundle.overlay,
        attestation: bundle.attestation,
        permit: bundle.permit,
        nowMs: nowMs + 11 * 60 * 1000
    }), /permit_expired_or_invalid/);
    assert.throws(() => validateCanaryControllerV77Bundle({
        overlay: bundle.overlay,
        attestation: bundle.attestation,
        permit: { ...bundle.permit, status: 'consumed' },
        nowMs
    }), /permit_invalid/);
});

test('segundo destinatário, Dropi, Meta, scheduler e PM2 externo alterado falham fechados', () => {
    const bundle = bundleAt();
    for (const [key, value] of [
        ['WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS', `${QA_PHONE},593991234567`],
        ['DROPPI_EC_ACTIVE_SYNC_ENABLED', 'true'],
        ['DROPPI_EC_ACTIVE_SYNC_MODE', 'APPLY'],
        ['META_TEST_EVENT_CODE_EC', 'TEST-V77H2'],
        ['SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED', 'true']
    ]) {
        const invalid = { ...bundle.env, [key]: value };
        assert.equal(resolveCanaryV75Configuration(invalid).ready, false, key);
        assert.deepEqual(buildCanaryV75RecipientQuery('client.phone', invalid), { _id: { $exists: false } });
    }
    assert.equal(evaluateCanaryV75ExternalEffect('provider', bundle.env).allowed, false);
    assert.equal(evaluateCanaryV75ExternalEffect('dropi', bundle.env).allowed, false);
    assert.equal(evaluateCanaryV75ExternalEffect('meta', bundle.env).allowed, false);

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
    const entries = [...externalProcesses(), target];
    const fingerprint = calculatePm2ExternalFingerprintV77H(entries);
    const changed = structuredClone(entries);
    changed[0].pid += 1;
    assert.throws(() => verifyCandidatePm2CanaryV77H({
        entries: changed,
        overlay: bundle.overlay,
        candidateDir: CANDIDATE_DIR,
        procCwd: CANDIDATE_DIR,
        expectedExternalFingerprint: fingerprint
    }), /external_pm2_fingerprint_changed/);
});

test('contenção restaura política strict, desliga mutações e desativa o canário', () => {
    const bundle = bundleAt();
    const contained = {
        ...bundle.env,
        SAFE_OBSERVATION_POLICY: 'STRICT_READ_ONLY',
        VITALISMEN_STRICT_READ_ONLY: 'true',
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'false',
        POST_SALE_V66_MUTATIONS_ENABLED: 'false',
        POST_SALE_V66_MUTATIONS_AUTHORIZATION: '',
        POST_SALE_V66_COMPATIBILITY_BRIDGE_READY: 'false',
        VITALISMEN_CANARY_V75_ENABLED: 'false',
        VITALISMEN_CANARY_CTRL_V77_ENABLED: 'false',
        DISABLE_SCHEDULER: '1'
    };
    for (const flag of CANARY_V75_REQUIRED_TRUE_FLAGS) contained[flag] = 'false';
    assert.equal(resolveStrictReadOnlyObservation(contained).strictReadOnly, true);
    assert.equal(resolvePostSaleOperationalMutationGate(contained, { compatibilityState: COMPATIBILITY }).allowed, false);
    assert.equal(resolveCanaryV75Configuration(contained).enabled, false);
});

const waitExit = (child) => new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
});

test('verificador PM2 V77H continua consumindo JSON integral sem EPIPE', async () => {
    const contract = fileURLToPath(new URL(
        '../scripts/lib/canary-controller-pm2-stdin-hotfix-v77h-contract.mjs',
        import.meta.url
    ));
    const producer = spawn(process.execPath, ['-e', [
        "const rows=Array.from({length:50000},(_,i)=>({name:`external-${i}`,pid:i+1,pm2_env:{status:'online'}}));",
        "rows.push({name:'vitalismen-automation',pid:999,pm2_env:{status:'online'}});",
        'process.stdout.write(JSON.stringify(rows));'
    ].join('')], { stdio: ['ignore', 'pipe', 'pipe'] });
    const consumer = spawn(process.execPath, [contract, 'parse-stdin'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const producerExitPromise = waitExit(producer);
    const consumerExitPromise = waitExit(consumer);
    producer.stdout.pipe(consumer.stdin);
    let stderr = '';
    let stdout = '';
    producer.stderr.setEncoding('utf8');
    consumer.stderr.setEncoding('utf8');
    consumer.stdout.setEncoding('utf8');
    producer.stderr.on('data', (chunk) => { stderr += chunk; });
    consumer.stderr.on('data', (chunk) => { stderr += chunk; });
    consumer.stdout.on('data', (chunk) => { stdout += chunk; });
    const [producerExit, consumerExit] = await Promise.all([producerExitPromise, consumerExitPromise]);
    assert.equal(producerExit.code, 0, stderr);
    assert.equal(consumerExit.code, 0, stderr);
    assert.doesNotMatch(stderr, /EPIPE/);
    assert.equal(stdout, 'PM2_JSON_COUNT=50001\n');
});
