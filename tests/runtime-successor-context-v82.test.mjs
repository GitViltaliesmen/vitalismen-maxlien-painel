import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import {
    RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_ATTESTATION_SHA256,
    RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_FREEZE_SHA256,
    RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_MANIFEST_SHA256
} from '../src/services/runtimeSuccessorContextV82Service.js';

const root = process.cwd();
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const output = (result) => `${result.stdout || ''}\n${result.stderr || ''}`;
const runModule = (source, env = process.env) => spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: root,
    env,
    encoding: 'utf8'
});

test('reproduz o bloqueio de boot sem o contexto sucessor V82', () => {
    const result = runModule("await import('./src/services/ecEngagementFreezeRuntimeGuardV40.js')");
    assert.notEqual(result.status, 0);
    assert.match(output(result), /META-PARTNER-DESTINATION-REGISTRY-V73|alteração não autorizada/);
});

test('V82 instala contexto antes da cadeia runtime e elimina o bloqueio V73', () => {
    const result = runModule([
        "await import('./src/services/runtimeSuccessorContextFreezeRuntimeGuardV82.js')",
        "await import('./src/services/ecEngagementFreezeRuntimeGuardV40.js')",
        "const s=globalThis.__VITALISMEN_V82_RUNTIME_SUCCESSOR_CONTEXT_STATE",
        "process.stdout.write(JSON.stringify({version:s.version,mode:s.mode,hasIndex:s.effectiveOverrides.includes('src/index.js')}))"
    ].join(';'));
    assert.equal(result.status, 0, output(result));
    const payload = result.stdout.trim().split(/\r?\n/).at(-1);
    assert.deepEqual(JSON.parse(payload), { version: 82, mode: 'runtime', hasIndex: true });
});

test('entrypoint oficial carrega V82 antes do primeiro guard ancestral', () => {
    const index = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
    const contextPosition = index.indexOf("import './services/runtimeSuccessorContextFreezeRuntimeGuardV82.js';");
    const guardPosition = index.indexOf("import './services/ecEngagementFreezeRuntimeGuardV40.js';");
    assert.ok(contextPosition > 0);
    assert.ok(guardPosition > contextPosition);
});

test('preload V82 conserva contexto sucessor nos guards npm oficiais', () => {
    const preload = pathToFileURL(path.join(root, 'scripts/lib/runtime-successor-context-v82.mjs')).href;
    const option = `--import=${preload}`;
    const env = {
        ...process.env,
        NODE_OPTIONS: option,
        npm_config_node_options: option,
        INIT_CWD: root,
        npm_lifecycle_event: 'guard:runtime-chain-v71',
        npm_package_json: path.join(root, 'package.json')
    };
    const result = spawnSync(process.execPath, ['-e', [
        'const s=globalThis.__VITALISMEN_V82_RUNTIME_SUCCESSOR_CONTEXT_STATE',
        "process.stdout.write(JSON.stringify({version:s.version,contextActive:s.contextActive,hasIndex:s.effectiveOverrides.includes('src/index.js')}))"
    ].join(';')], { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, output(result));
    assert.deepEqual(JSON.parse(result.stdout), { version: 82, contextActive: true, hasIndex: true });
});

test('V81 permanece byte intacta e contratos críticos continuam congelados', () => {
    assert.equal(sha256(path.join(root, 'docs/freeze/npm-lifecycle-stage-envelope-compatibility-v81-20260829.json')), RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_MANIFEST_SHA256);
    assert.equal(sha256(path.join(root, 'docs/NPM_LIFECYCLE_STAGE_ENVELOPE_COMPATIBILITY_FREEZE_V81_20260829.md')), RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_FREEZE_SHA256);
    assert.equal(sha256(path.join(root, 'docs/evidence/npm-lifecycle-stage-envelope-v81-attestation-20260829.json')), RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_ATTESTATION_SHA256);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/freeze/runtime-successor-context-v82-20260829.json'), 'utf8'));
    assert.equal(manifest.policy.datasetId, '1468946114265008');
    assert.equal(manifest.policy.ctaChanged, false);
    assert.equal(manifest.policy.botBusinessLogicChanged, false);
    assert.equal(manifest.policy.mutatingSchedulersAllowed, false);
    assert.equal(manifest.policy.dropiApplyAllowed, false);
    assert.equal(manifest.policy.metaPurchaseAllowed, false);
    assert.equal(manifest.policy.realCustomerTrafficAuthorized, false);
});
