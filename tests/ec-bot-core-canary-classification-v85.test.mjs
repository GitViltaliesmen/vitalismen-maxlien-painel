import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
    EC_BOT_CORE_V78_DATASET_ID,
    buildEcBotCoreV78OverlayEnvironment,
    calculateEcBotCoreV78ProfileSha256
} from '../src/services/ecBotCoreOperationalV78Service.js';
import {
    assertCanaryControllerV77Startup,
    canaryControllerV77EnforcementRequired
} from '../src/services/canaryControllerV77Service.js';
import { canaryV75EnforcementRequired } from '../src/services/canaryIsolationV75Service.js';
import {
    assertEcBotCoreCanaryClassificationV85,
    evaluateEcBotCoreCanaryClassificationV85,
    installEcBotCoreCanaryClassificationContextV85,
    EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreCanaryClassificationV85Service.js';

const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const text = (file) => fs.readFileSync(file, 'utf8');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixture = () => ({
    v78Manifest: json('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json'),
    v79Manifest: json('docs/freeze/ec-bot-core-readiness-v79-20260829.json'),
    v79Evidence: json('docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json'),
    v79Attestation: json('docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json')
});
const coreEnvironment = () => ({
    ...buildEcBotCoreV78OverlayEnvironment({ baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID } }),
    META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID
});

test('perfil V78 íntegro é classificado fora dos controladores V77 e V75', () => {
    const env = coreEnvironment();
    assert.equal(canaryControllerV77EnforcementRequired(env), false);
    assert.equal(canaryV75EnforcementRequired(env), false);
    assert.equal(assertCanaryControllerV77Startup(env).enabled, false);
    const result = evaluateEcBotCoreCanaryClassificationV85({ env, ...fixture() });
    assert.equal(result.ok, true);
});

test('flag V78 isolada ou perfil adulterado continua falhando fechado pelo V77', () => {
    const flagOnly = {
        NODE_ENV: 'production',
        VITALISMEN_EC_BOT_CORE_OPERATIONAL: 'true',
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'true'
    };
    assert.equal(canaryControllerV77EnforcementRequired(flagOnly), true);
    assert.throws(() => assertCanaryControllerV77Startup(flagOnly), /canary_controller_v77_invalid/);

    const invalid = coreEnvironment();
    invalid.DISABLE_SCHEDULER = '0';
    invalid.VITALISMEN_EC_BOT_CORE_PROFILE_SHA256 = calculateEcBotCoreV78ProfileSha256(invalid);
    assert.equal(canaryControllerV77EnforcementRequired(invalid), true);
    assert.throws(() => assertCanaryControllerV77Startup(invalid), /canary_controller_v77_invalid/);
});

test('classificação V85 herda readiness V84 e conserva retry 30x2s', () => {
    const result = assertEcBotCoreCanaryClassificationV85();
    assert.equal(result.ready, true);
    assert.equal(result.healthAttempts, 30);
    assert.equal(result.healthDelaySeconds, 2);
});

test('contexto V85 herda o retry V84 e declara os três overrides novos', () => {
    const state = installEcBotCoreCanaryClassificationContextV85({ mode: 'official_guard' });
    for (const relativePath of [
        'ops/ec-bot-core-v78',
        'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
        'src/services/canaryControllerV77Service.js',
        'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
    ]) assert.ok(state.effectiveOverrides.includes(relativePath));
});

test('contrato e guard V78 exigem o sucessor V85', () => {
    assert.match(text('scripts/lib/ec-bot-core-operational-contract-v78.mjs'), /assertEcBotCoreCanaryClassificationV85/);
    assert.match(text('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'), /ec-bot-core-canary-classification-v85-successor-context\.mjs/);
});

test('guard estrutural V78 passa com o contexto V85 antes dos hashes ancestrais', () => {
    const run = spawnSync(process.execPath, ['src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
});

test('V84 parental permanece byte intacta', () => {
    assert.equal(sha256('docs/freeze/ec-bot-core-activation-health-v84-20260829.json'), EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_MANIFEST_SHA256);
    assert.equal(sha256('docs/EC_BOT_CORE_ACTIVATION_HEALTH_STABILIZATION_FREEZE_V84_20260829.md'), EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_FREEZE_SHA256);
    assert.equal(sha256('docs/evidence/ec-bot-core-activation-health-v84-attestation-20260829.json'), EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_ATTESTATION_SHA256);
});
