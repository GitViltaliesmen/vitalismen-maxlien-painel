import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import '../scripts/lib/ec-bot-core-control-plane-v89-successor-context.mjs';

import {
    assertEcBotCoreLifecycleBootV88,
    evaluateEcBotCoreLifecycleBootV88,
    installEcBotCoreLifecycleBootContextV88,
    EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreLifecycleBootV88Service.js';

const text = (file) => fs.readFileSync(file, 'utf8');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const preload = './scripts/lib/ec-bot-core-control-plane-v89-successor-context.mjs';
const absolutePreload = path.resolve(preload);
const preloadUrl = pathToFileURL(absolutePreload).href;

test('contexto V88 permanece íntegro sob a sucessora V89 e mantém 30x2s', () => {
    const result = assertEcBotCoreLifecycleBootV88();
    assert.equal(result.ready, true);
    assert.equal(result.firstImportInstalled, true);
    assert.equal(result.healthAttempts, 30);
    assert.equal(result.healthDelaySeconds, 2);
});

test('lifecycle de dependência ignora guards relativos e não falha fora da raiz', () => {
    const dependencyPackage = path.join(process.cwd(), 'node_modules', '@whiskeysockets', 'baileys', 'package.json');
    const run = spawnSync(process.execPath, [
        `--import=${preloadUrl}`,
        '-e',
        "process.stdout.write(globalThis.__VITALISMEN_V88_EC_BOT_CORE_LIFECYCLE_BOOT_STATE ? 'GUARDED' : 'DEPENDENCY_SKIPPED')"
    ], {
        cwd: path.dirname(dependencyPackage),
        env: {
            ...process.env,
            npm_lifecycle_event: 'install',
            npm_package_json: dependencyPackage
        },
        encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.equal(run.stdout, 'DEPENDENCY_SKIPPED');
});

test('lifecycle do projeto instala V89 e remove o próprio NODE_OPTIONS dos filhos', () => {
    const run = spawnSync(process.execPath, [
        `--import=${preloadUrl}`,
        '-e',
        "const s=globalThis.__VITALISMEN_V89_EC_BOT_CORE_CONTROL_PLANE_STATE; process.stdout.write(`${s?.version}|${String(process.env.NODE_OPTIONS || '').includes('control-plane-v89')}`)"
    ], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            NODE_OPTIONS: `--import=${preloadUrl}`,
            npm_lifecycle_event: 'test',
            npm_package_json: path.join(process.cwd(), 'package.json')
        },
        encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.equal(run.stdout, '89|false');
});

test('preloader V88 permite a cadeia estrutural V78', () => {
    const run = spawnSync(process.execPath, [`--import=${preload}`, 'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
});

test('plan, contrato e runtime V78 exigem somente a sucessora V89', () => {
    assert.match(text('ops/ec-bot-core-v78'), /guard-ec-bot-core-control-plane-v89\.mjs/);
    assert.doesNotMatch(text('ops/ec-bot-core-v78'), /guard-ec-bot-core-runtime-boot-v87\.mjs/);
    assert.match(text('scripts/lib/ec-bot-core-operational-contract-v78.mjs'), /assertEcBotCoreControlPlaneV89/);
    assert.match(text('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'), /ec-bot-core-control-plane-v89-successor-context\.mjs/);
});

test('remoção da classificação de dependência falha fechada na avaliação', () => {
    const preloaderSource = text('scripts/lib/ec-bot-core-lifecycle-boot-v88-successor-context.mjs')
        .replaceAll('dependencyLifecycle', 'dependencyRemoved');
    const result = evaluateEcBotCoreLifecycleBootV88({ preloaderSource });
    assert.equal(result.ready, false);
    assert.ok(result.failures.includes('dependency_lifecycle_classification_missing'));
});

test('contexto V88 conserva os cinco overrides efetivos', () => {
    const state = installEcBotCoreLifecycleBootContextV88({ mode: 'official_guard' });
    for (const relativePath of [
        'ops/ec-bot-core-v78',
        'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
        'src/index.js',
        'src/services/canaryControllerV77Service.js',
        'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
    ]) assert.ok(state.effectiveOverrides.includes(relativePath));
});

test('identidades documentais da V87 parental permanecem íntegras', () => {
    assert.equal(sha256('docs/freeze/ec-bot-core-runtime-boot-v87-20260829.json'), EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_MANIFEST_SHA256);
    assert.equal(sha256('docs/EC_BOT_CORE_RUNTIME_BOOT_CONTEXT_FREEZE_V87_20260829.md'), EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_FREEZE_SHA256);
    assert.equal(sha256('docs/evidence/ec-bot-core-runtime-boot-v87-attestation-20260829.json'), EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_ATTESTATION_SHA256);
});
