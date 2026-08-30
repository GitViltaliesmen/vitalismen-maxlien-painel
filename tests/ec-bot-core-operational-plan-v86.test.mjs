import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
    assertEcBotCoreOperationalPlanV86,
    evaluateEcBotCoreOperationalPlanV86,
    installEcBotCoreOperationalPlanContextV86,
    EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreOperationalPlanV86Service.js';

const text = (file) => fs.readFileSync(file, 'utf8');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('plano operacional chama somente o guard sucessor V86', () => {
    const result = assertEcBotCoreOperationalPlanV86();
    assert.equal(result.ready, true);
    assert.equal(result.ancestralPlanGuardCalled, false);
    assert.equal(result.successorPlanGuardCalled, true);
    assert.equal(result.healthAttempts, 30);
    assert.equal(result.healthDelaySeconds, 2);
});

test('reintrodução do guard estrutural ancestral no plan falha fechada', () => {
    const opsSource = text('ops/ec-bot-core-v78')
        .replace('"$node_cmd" scripts/guard-ec-bot-core-operational-plan-v86.mjs', '"$node_cmd" scripts/guard-ec-bot-core-structural-v78.mjs');
    const result = evaluateEcBotCoreOperationalPlanV86({ opsSource });
    assert.equal(result.ready, false);
    assert.ok(result.failures.includes('ancestral_v78_plan_guard_still_called'));
});

test('contrato e runtime guard V78 exigem o sucessor V86', () => {
    assert.match(text('scripts/lib/ec-bot-core-operational-contract-v78.mjs'), /assertEcBotCoreOperationalPlanV86/);
    assert.match(text('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'), /ec-bot-core-operational-plan-v86-successor-context\.mjs/);
});

test('guard operacional V86 passa sem executar o guard ancestral', () => {
    const run = spawnSync(process.execPath, ['scripts/guard-ec-bot-core-operational-plan-v86.mjs'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /ANCESTRAL_V78_PLAN_GUARD_CALLED=NO/);
});

test('guard estrutural runtime V78 passa pelo contexto V86', () => {
    const run = spawnSync(process.execPath, ['src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
});

test('contexto V86 conserva os quatro overrides efetivos da cadeia', () => {
    const state = installEcBotCoreOperationalPlanContextV86({ mode: 'official_guard' });
    for (const relativePath of [
        'ops/ec-bot-core-v78',
        'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
        'src/services/canaryControllerV77Service.js',
        'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
    ]) assert.ok(state.effectiveOverrides.includes(relativePath));
});

test('V85 parental permanece identificada e não é reescrita', () => {
    assert.equal(sha256('docs/freeze/ec-bot-core-canary-classification-v85-20260829.json'), EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_MANIFEST_SHA256);
    assert.equal(sha256('docs/EC_BOT_CORE_CANARY_CLASSIFICATION_FREEZE_V85_20260829.md'), EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_FREEZE_SHA256);
    assert.equal(sha256('docs/evidence/ec-bot-core-canary-classification-v85-attestation-20260829.json'), EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_ATTESTATION_SHA256);
});
