import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

import { assertV200WorkflowHash } from '../scripts/lib/ec-runtime-successor-v200-ci-context.mjs';

test('V200 carrega o contexto canônico V195 para o guard V171', () => {
    assert.equal(globalThis.__VITALISMEN_V200_CI_CONTEXT?.loaded, true);
    assert.equal(globalThis.__VITALISMEN_V200_CI_CONTEXT?.canonicalDataset, '920532663934291');
    assertV200WorkflowHash(fs.readFileSync('.github/workflows/ec-panel-quality.yml'));
});

test('V200 mantém o guard fail-closed sem o sucessor', () => {
    const result = spawnSync(process.execPath, ['scripts/guard-ec-traffic-restoration-v171.mjs'], {
        cwd: process.cwd(),
        env: { ...process.env, NODE_OPTIONS: '' },
        encoding: 'utf8',
        shell: false
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /protected_file_invalid:scripts[/\\]lib[/\\]ec-runtime-successor-v168b-bootstrap-context\.mjs/);
});

test('V200 rejeita workflow adulterado', () => {
    const workflow = fs.readFileSync('.github/workflows/ec-panel-quality.yml');
    assert.throws(
        () => assertV200WorkflowHash(Buffer.concat([workflow, Buffer.from('\n# adulterado\n')])),
        /V200_WORKFLOW_HASH_MISMATCH/
    );
});
