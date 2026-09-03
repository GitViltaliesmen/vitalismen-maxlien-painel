import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
    assertEcBotCoreRuntimeBootV87,
    evaluateEcBotCoreRuntimeBootV87,
    installEcBotCoreRuntimeBootContextV87,
    EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreRuntimeBootV87Service.js';

const text = (file) => fs.readFileSync(file, 'utf8');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('contexto V87 é o primeiro guard importado pelo runtime', () => {
    const result = assertEcBotCoreRuntimeBootV87();
    assert.equal(result.ready, true);
    assert.equal(result.firstImportInstalled, true);
    assert.equal(result.healthAttempts, 30);
    assert.equal(result.healthDelaySeconds, 2);
});

test('retorno ao import V82 direto falha fechado', () => {
    const indexSource = text('src/index.js')
        .replace("import '../scripts/lib/ec-bot-core-runtime-boot-v87-successor-context.mjs';", "import './services/runtimeSuccessorContextFreezeRuntimeGuardV82.js';");
    const result = evaluateEcBotCoreRuntimeBootV87({ indexSource });
    assert.equal(result.ready, false);
    assert.ok(result.failures.includes('v87_first_import_missing'));
    assert.ok(result.failures.includes('direct_v82_runtime_import_still_present'));
});

test('runtime V82 reproduz a falha de hash do entrypoint sucedido', () => {
    const run = spawnSync(process.execPath, ['src/services/runtimeSuccessorContextFreezeRuntimeGuardV82.js'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.notEqual(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(`${run.stdout}\n${run.stderr}`, /protected_file_invalid:src\/index\.js/);
});

test('preloader V87 permite a cadeia estrutural V78 no boot', () => {
    const run = spawnSync(process.execPath, [
        '--import=./scripts/lib/ec-bot-core-runtime-boot-v87-successor-context.mjs',
        'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
    ], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
});

test('guard operacional V87 passa isoladamente', () => {
    const run = spawnSync(process.execPath, ['scripts/guard-ec-bot-core-runtime-boot-v87.mjs'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /SUCCESSOR_CONTEXT_FIRST_IMPORT=YES/);
});

test('plan, contrato e runtime V78 exigem o sucessor V87', () => {
    assert.match(text('ops/ec-bot-core-v78'), /guard-ec-bot-core-runtime-boot-v87\.mjs/);
    assert.doesNotMatch(text('ops/ec-bot-core-v78'), /guard-ec-bot-core-operational-plan-v86\.mjs/);
    assert.match(text('scripts/lib/ec-bot-core-operational-contract-v78.mjs'), /assertEcBotCoreRuntimeBootV87/);
    assert.match(text('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'), /ec-bot-core-runtime-boot-v87-successor-context\.mjs/);
});

test('contexto V87 conserva os cinco overrides efetivos', () => {
    const state = installEcBotCoreRuntimeBootContextV87({ mode: 'official_guard' });
    for (const relativePath of [
        'ops/ec-bot-core-v78',
        'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
        'src/index.js',
        'src/services/canaryControllerV77Service.js',
        'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
    ]) assert.ok(state.effectiveOverrides.includes(relativePath));
});

test('identidades documentais da V86 parental permanecem íntegras', () => {
    assert.equal(sha256('docs/freeze/ec-bot-core-operational-plan-v86-20260829.json'), EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_MANIFEST_SHA256);
    assert.equal(sha256('docs/EC_BOT_CORE_OPERATIONAL_PLAN_ALIGNMENT_FREEZE_V86_20260829.md'), EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_FREEZE_SHA256);
    assert.equal(sha256('docs/evidence/ec-bot-core-operational-plan-v86-attestation-20260829.json'), EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_ATTESTATION_SHA256);
});
