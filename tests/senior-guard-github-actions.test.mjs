import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
