import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
    assertEcBotCoreOperationalReadinessV83,
    evaluateEcBotCoreOperationalReadinessV83,
    installEcBotCoreOperationalReadinessContextV83,
    EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreOperationalReadinessV83Service.js';

const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const text = (file) => fs.readFileSync(file, 'utf8');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixture = () => ({
    v78Manifest: json('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json'),
    v79Manifest: json('docs/freeze/ec-bot-core-readiness-v79-20260829.json'),
    v79Evidence: json('docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json'),
    v79Attestation: json('docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json')
});

test('V78 isolada permanece bloqueada e V79 íntegra fornece readiness operacional', () => {
    const values = fixture();
    assert.equal(values.v78Manifest.deployment.ready, false);
    assert.deepEqual(values.v78Manifest.deployment.blockers, ['OFFICIAL_VSL_ORIGIN_CONTRACT_DIVERGENT']);
    const result = evaluateEcBotCoreOperationalReadinessV83(values);
    assert.equal(result.ok, true);
    assert.equal(result.ready, true);
    assert.equal(result.datasetId, '1468946114265008');
    assert.equal(result.profile, 'EC_BOT_CORE_OPERATIONAL');
});

test('readiness V79 ausente ou blocker reintroduzido falha fechado', () => {
    const values = fixture();
    values.v79Manifest.deployment.ready = false;
    values.v79Manifest.deployment.blockers = ['REINTRODUCED'];
    const result = evaluateEcBotCoreOperationalReadinessV83(values);
    assert.equal(result.ok, false);
    assert.ok(result.failures.includes('v79_deployment_not_ready'));
});

test('scheduler, Dropi ou Meta liberados invalidam a ponte V83', () => {
    for (const key of ['mutatingSchedulersAllowed', 'dropiApplyAllowed', 'metaPurchaseAllowed']) {
        const values = fixture();
        values.v79Manifest.policy[key] = true;
        const result = evaluateEcBotCoreOperationalReadinessV83(values);
        assert.equal(result.ok, false, key);
    }
});

test('contrato V78 exige V79 pela V83 sem declarar V78 estruturalmente pronta', () => {
    const contract = text('scripts/lib/ec-bot-core-operational-contract-v78.mjs');
    assert.match(contract, /assertEcBotCoreOperationalReadinessV83/);
    assert.match(contract, /manifest\.deployment\?\.ready !== false/);
    assert.doesNotMatch(contract, /manifest\.deployment\?\.ready !== true/);
});

test('guard estrutural instala o contexto V83 antes de validar hashes V78', () => {
    const guard = text('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js');
    const contextIndex = guard.indexOf('ec-bot-core-operational-readiness-v83-successor-context.mjs');
    const inheritedIndex = guard.indexOf('const inheritedOverrides = getSuccessorOverrideFiles()');
    assert.ok(contextIndex >= 0);
    assert.ok(inheritedIndex > contextIndex);
    const run = spawnSync(process.execPath, ['src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
});

test('manifesto V83 instala somente os dois overrides indispensáveis', () => {
    const readiness = assertEcBotCoreOperationalReadinessV83();
    assert.equal(readiness.ready, true);
    const state = installEcBotCoreOperationalReadinessContextV83({ mode: 'official_guard' });
    assert.ok(state.effectiveOverrides.includes('scripts/lib/ec-bot-core-operational-contract-v78.mjs'));
    assert.ok(state.effectiveOverrides.includes('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'));
});

test('V82 e evidência parental permanecem byte intactas', () => {
    assert.equal(sha256('docs/freeze/runtime-successor-context-v82-20260829.json'), EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_MANIFEST_SHA256);
    assert.equal(sha256('docs/RUNTIME_SUCCESSOR_CONTEXT_FREEZE_V82_20260829.md'), EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_FREEZE_SHA256);
    assert.equal(sha256('docs/evidence/runtime-successor-context-v82-attestation-20260829.json'), EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_ATTESTATION_SHA256);
});
