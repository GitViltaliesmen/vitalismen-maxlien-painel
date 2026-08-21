import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
    OFFICIAL_GITHUB_REPOSITORY,
    isOfficialGithubActionsWorkspace
} from '../scripts/senior-guard-workspace-policy.mjs';

const cwd = '/home/runner/work/vitalismen-maxlien-painel/vitalismen-maxlien-painel';
const officialEnvironment = {
    CI: 'true',
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: OFFICIAL_GITHUB_REPOSITORY,
    GITHUB_WORKSPACE: cwd
};

test('senior guard aceita somente o workspace oficial completo do GitHub Actions', () => {
    assert.equal(isOfficialGithubActionsWorkspace({ env: officialEnvironment, cwd }), true);
});

test('senior guard rejeita ambientes GitHub Actions parcialmente falsificados', () => {
    for (const [field, value] of [
        ['CI', 'false'],
        ['GITHUB_ACTIONS', 'false'],
        ['GITHUB_REPOSITORY', 'outro/repositorio'],
        ['GITHUB_WORKSPACE', '/home/runner/work/outro/outro']
    ]) {
        assert.equal(isOfficialGithubActionsWorkspace({
            env: { ...officialEnvironment, [field]: value },
            cwd
        }), false, `${field} divergente precisa ser rejeitado`);
    }
    assert.equal(isOfficialGithubActionsWorkspace({
        env: { ...officialEnvironment, GITHUB_WORKSPACE: '' },
        cwd
    }), false);
});

test('auditoria de retirada reconhece ledger e evento recuperado com comprovante', () => {
    const result = spawnSync(process.execPath, [
        'scripts/audit-pickup-notification-evidence.mjs',
        '--self-test'
    ], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /PICKUP_NOTIFICATION_EVIDENCE_AUDIT_SELF_TEST=OK/);
});

test('registro final identifica release, rollback e ausência de disparos', () => {
    const result = readFileSync('docs/RESULTADO_ATIVACAO_MEDIA_V30_20260821.md', 'utf8');
    assert.match(result, /production-20260821-7cd0238/);
    assert.match(result, /20260821T185008Z_production-20260821-7cd0238/);
    assert.match(result, /Rollback preservado:.*20260821T180758Z_production-20260821-937ae43/);
    assert.match(result, /nenhuma mensagem enviada/i);
    assert.doesNotMatch(result, /ZAPI_(?:INSTANCE_TOKEN|CLIENT_TOKEN)\s*=/i);
});
