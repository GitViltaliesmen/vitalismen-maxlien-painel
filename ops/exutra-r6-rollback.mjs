import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { R6_PARENT_RELEASE, verifyR6Release, sha } from '../scripts/lib/exutra-r6-authority.mjs';
import { verifyR5MaterializedRelease } from '../scripts/lib/unified-successor-v202-r5-authority.mjs';
const base = '/opt/vitalismen-automacao';
const state = '/var/lib/vitalismen-deploy';
const bundleNames = ['ec-bot-core-v78.env', 'ec-bot-core-v78-attestation.json', 'ec-bot-core-v78-permit.consumed.json'];
const readOverlay = file => Object.fromEntries(fs.readFileSync(file, 'utf8').trim().split('\n').map(line => {
    const i = line.indexOf('='); assert.ok(i > 0); return [line.slice(0, i), line.slice(i + 1)];
}));
export function verifyR6RollbackBundle(root) {
    const verified = verifyR6Release(root);
    const target = base + '/releases/' + R6_PARENT_RELEASE;
    const parent = verifyR5MaterializedRelease(target);
    const directory = state + '/exutra-r6-rollback-' + verified.checkpoint.commit;
    const manifest = JSON.parse(fs.readFileSync(directory + '/manifest.json', 'utf8'));
    assert.equal(manifest.parentRelease, R6_PARENT_RELEASE);
    assert.equal(manifest.parentCommit, parent.attestation.commit);
    for (const name of bundleNames) {
        const file = directory + '/' + name; const s = fs.lstatSync(file);
        assert.ok(s.isFile() && !s.isSymbolicLink()); assert.equal(s.uid, 0);
        assert.equal(s.mode & 0o077, 0);
        assert.equal(sha(fs.readFileSync(file)), manifest.hashes[name]);
        assert.equal(manifest.hashes[name], verified.checkpoint.rollbackHashes[name], 'R6_ROLLBACK_CHECKPOINT_HASH');
    }
    const overlay = readOverlay(directory + '/ec-bot-core-v78.env');
    assert.equal(overlay.NODE_OPTIONS,
        '--import=file:///opt/vitalismen-automacao/current/scripts/lib/unified-successor-v202-r5-preload.mjs');
    assert.equal(overlay.VITALISMEN_META_PURCHASE_ENABLED, 'false');
    assert.equal(overlay.VITALISMEN_EC_BOT_CORE_OPERATIONAL, 'true');
    return { target, directory, overlay, verified };
}
export async function rollbackExutraR6(root, { dryRun = false } = {}) {
    assert.equal(process.getuid?.(), 0);
    const ready = verifyR6RollbackBundle(root);
    if (dryRun) return { status: 'READY', parentRelease: R6_PARENT_RELEASE };
    const current = fs.realpathSync(base + '/current');
    assert.ok([ready.target, ready.verified.root].includes(current));
    const lock = state + '/.exutra-r6-rollback.lock'; fs.mkdirSync(lock, { mode: 0o700 });
    try {
        if (current !== ready.target) {
            const next = base + '/.current.exutra-r6-rollback-' + process.pid;
            fs.symlinkSync(ready.target, next); fs.renameSync(next, base + '/current');
        }
        for (const name of [...bundleNames, 'ec-bot-core-v78-permit.json']) {
            const active = state + '/' + name;
            if (fs.existsSync(active)) fs.renameSync(active, active + '.exutra-r6-rejected-' + Date.now());
        }
        for (const name of bundleNames) {
            fs.copyFileSync(ready.directory + '/' + name, state + '/' + name, fs.constants.COPYFILE_EXCL);
            fs.chmodSync(state + '/' + name, name.endsWith('consumed.json') ? 0o600 : 0o400);
        }
        const pm2Root = fs.realpathSync('/usr/bin/pm2').replace(/\/bin\/pm2$/, '');
        execFileSync('/usr/bin/node', [ready.target + '/scripts/lib/pm2-target-env-restart-v78-r4.mjs',
            pm2Root, 'vitalismen-automation', ready.overlay.NODE_OPTIONS, ready.target],
        { timeout: 30000, stdio: 'ignore', env: { ...process.env, ...ready.overlay,
            NODE_OPTIONS: '', npm_config_node_options: '' } });
        let response;
        for (let attempt = 0; attempt < 15; attempt++) {
            try { response = await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(3000) });
                if (response.status === 200) break; } catch {}
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        assert.ok(response, 'R6_ROLLBACK_HEALTH_UNAVAILABLE');
        assert.equal(response.status, 200); const h = await response.json();
        assert.equal(h.status, 'online'); assert.equal(h.zapi?.connected, true);
        assert.equal(h.automationSafety?.botCoreOperational, true);
        assert.equal(h.automationSafety?.metaPurchaseAllowed, false);
        return { status: 'RESTORED_R5', parentRelease: R6_PARENT_RELEASE };
    } finally { fs.rmdirSync(lock); }
}
if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
    const root = base + '/releases/' + process.argv[2];
    console.log(JSON.stringify(await rollbackExutraR6(root, { dryRun: process.argv[3] === '--dry-run' })));
}
