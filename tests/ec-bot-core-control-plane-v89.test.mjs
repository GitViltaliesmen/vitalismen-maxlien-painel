import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
    assertEcBotCoreControlPlaneV89,
    evaluateEcBotCoreControlPlaneV89,
    installEcBotCoreControlPlaneContextV89,
    EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreControlPlaneV89Service.js';

await import('../scripts/lib/ec-runtime-successor-v95-context.mjs');

const text = (file) => fs.readFileSync(file, 'utf8');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const helper = path.resolve('scripts/lib/pm2-target-env-restart-v89.mjs');
const canonicalNodeOptions = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v95-context.mjs';

const createMockPm2 = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v89-pm2-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'pm2', version: '6.0.14', main: 'index.cjs' }));
    fs.writeFileSync(path.join(root, 'index.cjs'), `
module.exports = {
  connect(callback) { callback(null); },
  restart(name, options, callback) {
    process.stdout.write('MOCK_PM2|' + name + '|' + options.updateEnv + '|' + process.env.NODE_OPTIONS + '|' + process.env.npm_config_node_options + '\\n');
    callback(null, [{name}]);
  },
  disconnect() {}
};
`);
    return root;
};

test('V89 preserva V88 e instala o primeiro contexto antes dos ancestrais', () => {
    installEcBotCoreControlPlaneContextV89({ mode: 'official_guard' });
    const result = assertEcBotCoreControlPlaneV89();
    assert.equal(result.ready, true);
    assert.equal(result.firstImportInstalled, true);
    assert.equal(result.pm2TargetEnvironmentIsolated, true);
    assert.equal(result.healthAttempts, 30);
    assert.equal(result.healthDelaySeconds, 2);
});

test('helper PM2 inicia sem NODE_OPTIONS e injeta o guard somente no target', () => {
    const mockRoot = createMockPm2();
    try {
        const run = spawnSync(process.execPath, [helper, mockRoot, 'vitalismen-automation', canonicalNodeOptions], {
            cwd: process.cwd(),
            env: { ...process.env, NODE_OPTIONS: '', npm_config_node_options: 'must_be_cleared' },
            encoding: 'utf8'
        });
        assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
        assert.match(run.stdout, /MOCK_PM2\|vitalismen-automation\|true\|--import=file:\/\/\/opt\/vitalismen-automacao\/current\/scripts\/lib\/ec-runtime-successor-v95-context\.mjs\|\n/);
        assert.match(run.stdout, /PM2_TARGET_ENV_RESTART_V89=PASS/);
    } finally {
        fs.rmSync(mockRoot, { recursive: true, force: true });
    }
});

test('helper PM2 rejeita control plane iniciado com NODE_OPTIONS', () => {
    const mockRoot = createMockPm2();
    try {
        const run = spawnSync(process.execPath, [helper, mockRoot, 'vitalismen-automation', canonicalNodeOptions], {
            cwd: process.cwd(),
            env: { ...process.env, NODE_OPTIONS: '--no-warnings' },
            encoding: 'utf8'
        });
        assert.notEqual(run.status, 0);
        assert.match(run.stderr, /controller_node_options_must_start_empty/);
    } finally {
        fs.rmSync(mockRoot, { recursive: true, force: true });
    }
});

test('ops usa helper isolado, limpa controle e permite abortar somente a autorização', () => {
    const source = text('ops/ec-bot-core-v78');
    assert.match(source, /NODE_OPTIONS="" npm_config_node_options=""/);
    assert.match(source, /pm2-target-env-restart-v89\.mjs/);
    assert.match(source, /unset NODE_OPTIONS/);
    assert.match(source, /abort-authorization/);
    assert.match(source, /SAFE_OBSERVATION_ONLY/);
    assert.match(source, /STRICT_READ_ONLY/);
    assert.match(source, /append_audit "authorization_aborted" "\$authorization_release"/);
    assert.match(source, /ABORTED_RELEASE=\$authorization_release/);
    assert.match(source, /PM2_ACTIONS=0/);
});

test('remoção do restart programático falha fechada na avaliação', () => {
    const restartHelperSource = text('scripts/lib/pm2-target-env-restart-v89.mjs')
        .replace('pm2.restart(processName, { updateEnv: true }', 'pm2.stop(processName, { updateEnv: false }');
    const result = evaluateEcBotCoreControlPlaneV89({ restartHelperSource });
    assert.equal(result.ready, false);
    assert.ok(result.failures.includes('programmatic_pm2_restart_missing'));
});

test('V88 aceita somente os arquivos declarados pela sucessora V89', async () => {
    await import('../scripts/lib/ec-bot-core-control-plane-v89-successor-context.mjs');
    const { assertEcBotCoreLifecycleBootV88 } = await import('../src/services/ecBotCoreLifecycleBootV88Service.js');
    assert.equal(assertEcBotCoreLifecycleBootV88().ready, true);
});

test('plan, contrato e runtime exigem somente a sucessora V89', () => {
    assert.match(text('ops/ec-bot-core-v78'), /guard-ec-bot-core-control-plane-v89\.mjs/);
    assert.match(text('scripts/lib/ec-bot-core-operational-contract-v78.mjs'), /assertEcBotCoreControlPlaneV89/);
    assert.match(text('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'), /ec-bot-core-control-plane-v89-successor-context\.mjs/);
});

test('identidades documentais V88 parentais permanecem íntegras', () => {
    assert.equal(sha256('docs/freeze/ec-bot-core-lifecycle-boot-v88-20260830.json'), EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_MANIFEST_SHA256);
    assert.equal(sha256('docs/EC_BOT_CORE_LIFECYCLE_BOOT_FREEZE_V88_20260830.md'), EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_FREEZE_SHA256);
    assert.equal(sha256('docs/evidence/ec-bot-core-lifecycle-boot-v88-attestation-20260830.json'), EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_ATTESTATION_SHA256);
});
