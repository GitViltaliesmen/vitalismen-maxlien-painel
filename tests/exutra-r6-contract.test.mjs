import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { R6_PARENT_RELEASE, R6_CONTROLS, R6_ALLOWED, R6_FUNCTIONAL, R6_MANIFEST,
    assertR6ParentProcess, verifyR6Manifest, sha } from '../scripts/lib/exutra-r6-authority.mjs';

const appFixture = () => ({ name: 'vitalismen-automation', pid: 2348733, pm2_env: {
    status: 'online', pm_cwd: '/opt/vitalismen-automacao/releases/' + R6_PARENT_RELEASE,
    pm_exec_path: '/opt/vitalismen-automacao/current/src/index.js',
    NODE_OPTIONS: '--import=file:///opt/vitalismen-automacao/current/scripts/lib/unified-successor-v202-r5-preload.mjs'
} });
test('transição aceita somente processo R5 exato e rejeita divergências', () => {
    const verified = { checkpoint: { parentPid: 2348733 } };
    assert.equal(assertR6ParentProcess(verified, appFixture()), true);
    for (const mutate of [a => { a.pid++; }, a => { a.name = 'other'; },
        a => { a.pm2_env.status = 'stopped'; }, a => { a.pm2_env.pm_cwd = '/tmp/other'; },
        a => { a.pm2_env.NODE_OPTIONS = '--import=unknown'; }]) {
        const app = appFixture(); mutate(app);
        assert.throws(() => assertR6ParentProcess(verified, app));
    }
});

test('manifesto aceita só a candidata exata; alteração de hash ou ampliação falha', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-exutra-r6-'));
    try {
        const functionalFiles = {}; const controlFiles = {};
        for (const relative of [R6_FUNCTIONAL, ...R6_CONTROLS]) {
            const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, 'fixture:' + relative + '\n');
            (relative === R6_FUNCTIONAL ? functionalFiles : controlFiles)[relative] = sha(fs.readFileSync(file));
        }
        const manifest = { freezeId: 'EXUTRA_R6_CAPTURE_HOLD_ONLY', allowedDeltaPaths: R6_ALLOWED,
            functionalFiles, controlFiles, policy: { otherFunnelsChanged: false, metaChanged: false,
                providerChanged: false, humanHoldPreserved: true, parentGuardsRequired: true } };
        const file = path.join(root, R6_MANIFEST); fs.mkdirSync(path.dirname(file), { recursive: true });
        const save = value => {
            fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
            return { manifestSha256: sha(fs.readFileSync(file)) };
        };
        const checkpoint = save(manifest); verifyR6Manifest(root, checkpoint);
        fs.appendFileSync(path.join(root, R6_FUNCTIONAL), 'tamper');
        assert.throws(() => verifyR6Manifest(root, checkpoint), /R6_HASH_CHANGED/);
        fs.writeFileSync(path.join(root, R6_FUNCTIONAL), 'fixture:' + R6_FUNCTIONAL + '\n');
        const expanded = { ...manifest, allowedDeltaPaths: [...R6_ALLOWED, 'src/whatsapp/sendText.js'].sort() };
        assert.throws(() => verifyR6Manifest(root, save(expanded)), /R6_SCOPE_EXPANSION/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
