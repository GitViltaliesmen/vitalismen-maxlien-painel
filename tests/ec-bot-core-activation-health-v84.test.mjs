import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
    assertEcBotCoreActivationHealthV84,
    evaluateEcBotCoreActivationHealthV84,
    installEcBotCoreActivationHealthContextV84,
    EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreActivationHealthV84Service.js';

const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const text = (file) => fs.readFileSync(file, 'utf8');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixture = () => ({
    v78Manifest: json('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json'),
    v79Manifest: json('docs/freeze/ec-bot-core-readiness-v79-20260829.json'),
    v79Evidence: json('docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json'),
    v79Attestation: json('docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json')
});

test('V84 preserva readiness V79 e limita estabilização a 30 tentativas de dois segundos', () => {
    const result = evaluateEcBotCoreActivationHealthV84(fixture());
    assert.equal(result.ok, true);
    assert.equal(result.healthAttempts, 30);
    assert.equal(result.healthDelaySeconds, 2);
});

test('readiness removida, scheduler, Dropi ou Meta liberados continuam falhando fechado', () => {
    for (const key of ['mutatingSchedulersAllowed', 'dropiApplyAllowed', 'metaPurchaseAllowed']) {
        const values = fixture();
        values.v79Manifest.policy[key] = true;
        assert.equal(evaluateEcBotCoreActivationHealthV84(values).ok, false, key);
    }
    const values = fixture();
    values.v79Manifest.deployment.ready = false;
    assert.equal(evaluateEcBotCoreActivationHealthV84(values).ok, false);
});

test('helper repete somente o health pós-restart e mantém contenção fail-closed', () => {
    const helper = text('ops/ec-bot-core-v78');
    assert.match(helper, /capture_health_after_restart\(\)/);
    assert.match(helper, /local attempts=30/);
    assert.match(helper, /local delay_seconds=2/);
    assert.match(helper, /attempts.*-le 30/);
    assert.match(helper, /capture_health_after_restart "\$health_file" "\$meta_file"/);
    assert.match(helper, /v66-contain/);
    assert.match(helper, /activation_failed_contained/);
});

test('contrato e guard V78 carregam somente o sucessor V84 necessário', () => {
    const contract = text('scripts/lib/ec-bot-core-operational-contract-v78.mjs');
    const guard = text('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js');
    assert.match(contract, /assertEcBotCoreActivationHealthV84/);
    assert.doesNotMatch(contract, /assertEcBotCoreOperationalReadinessV83/);
    assert.match(guard, /ec-bot-core-activation-health-v84-successor-context\.mjs/);
});

test('contexto V84 declara exatamente os três overrides necessários', () => {
    const readiness = assertEcBotCoreActivationHealthV84();
    assert.equal(readiness.ready, true);
    const state = installEcBotCoreActivationHealthContextV84({ mode: 'official_guard' });
    for (const relativePath of [
        'ops/ec-bot-core-v78',
        'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
        'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
    ]) assert.ok(state.effectiveOverrides.includes(relativePath));
});

test('guard estrutural V78 passa com a herança V84 antes dos hashes ancestrais', () => {
    const run = spawnSync(process.execPath, ['src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
});

test('V83 parental permanece byte intacta', () => {
    assert.equal(sha256('docs/freeze/ec-bot-core-operational-readiness-v83-20260829.json'), EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_MANIFEST_SHA256);
    assert.equal(sha256('docs/EC_BOT_CORE_OPERATIONAL_READINESS_BRIDGE_FREEZE_V83_20260829.md'), EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_FREEZE_SHA256);
    assert.equal(sha256('docs/evidence/ec-bot-core-operational-readiness-v83-attestation-20260829.json'), EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_ATTESTATION_SHA256);
});
