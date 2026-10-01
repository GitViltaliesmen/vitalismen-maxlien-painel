import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { R6_PARENT_RELEASE, R6_ATTESTATION, R6_ALLOWED, readR6Checkpoint,
    verifyR6GitCandidate, verifyR6Release, assertR6ParentProcess, sha } from './lib/exutra-r6-authority.mjs';
import { verifyR6RollbackBundle, rollbackExutraR6 } from '../ops/exutra-r6-rollback.mjs';
const base = '/opt/vitalismen-automacao'; const state = '/var/lib/vitalismen-deploy';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [action] = process.argv.slice(2);
assert.equal(process.getuid?.(), 0); assert.equal(process.argv.length, 3);
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o400 });
if (action === 'attest') {
    const verified = verifyR6GitCandidate(root); const checkpoint = readR6Checkpoint();
    write(root + '/' + R6_ATTESTATION, { checkpointSha256: checkpoint.sha256,
        commit: verified.checkpoint.commit, tree: verified.checkpoint.tree,
        releaseName: path.basename(root), gitValidated: true,
        changedPaths: R6_ALLOWED, fileHashes: verified.hashes });
    console.log('R6_GIT_ATTESTATION=PASS');
} else if (action === 'parent-process-check') {
    const verified = verifyR6Release(root);
    const apps = JSON.parse(execFileSync('/usr/bin/pm2', ['jlist'], { encoding: 'utf8' }));
    assertR6ParentProcess(verified, apps.find(x => x.name === 'vitalismen-automation'));
    console.log('R6_PARENT_PROCESS=PASS');
} else if (action === 'verify' || action === 'plan') {
    verifyR6Release(root); console.log('R6_RELEASE=PASS');
} else if (['activation-dry-run', 'activate'].includes(action)) {
    const verified = verifyR6Release(root);
    const parent = base + '/releases/' + R6_PARENT_RELEASE;
    assert.equal(fs.realpathSync(base + '/current'), parent, 'R6_BASELINE_DIVERGED');
    assertR6ParentProcess(verified, JSON.parse(execFileSync('/usr/bin/pm2', ['jlist'],
        { encoding: 'utf8' })).find(x => x.name === 'vitalismen-automation'));
    const r = await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(10000) });
    assert.equal(r.status, 200); const h = await r.json();
    assert.equal(h.status, 'online'); assert.equal(h.zapi?.connected, true);
    assert.equal(h.automationSafety?.botCoreOperational, true);
    assert.equal(h.automationSafety?.metaPurchaseAllowed, false);
    // Queue precheck only reads the existing database; no model registration
    // or business service is imported.
    const { default: dotenv } = await import('dotenv');
    const { default: mongoose } = await import('mongoose');
    const env = dotenv.parse(fs.readFileSync(parent + '/.env'));
    const safeEnv = { ...process.env, ...env,
        ...dotenv.parse(fs.readFileSync(state + '/ec-bot-core-v78.env')),
        NODE_OPTIONS: '', npm_config_node_options: '' };
    const preflight = (args, preload = '') => {
        const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8',
            timeout: 180000, maxBuffer: 32 * 1024 * 1024,
            env: { ...safeEnv, NODE_OPTIONS: preload } });
        assert.equal(result.status, 0, 'R6_LIVE_TRAFFIC_PREFLIGHT_FAILED:' + args[0]);
    };
    preflight(['scripts/exutra-r6-guard.mjs']);
    preflight(['--test', 'tests/exutra-capture-hold-r6.test.mjs', 'tests/exutra-r6-contract.test.mjs',
        'tests/protocolo-g-tex-ultra-origin-v34.test.mjs', 'tests/panel-manual-attendant-never-ignored-v160.test.mjs',
        'tests/vsl-first-response-watchdog-v193.test.mjs'], '--import=file://' + root + '/scripts/lib/exutra-r6-preload.mjs');
    const c = await mongoose.createConnection(env.MONGODB_URI,
        { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 }).asPromise();
    try { assert.equal(await c.db.collection('messages').countDocuments({
        queueStatus: { $in: ['PENDING', 'CLAIMED', 'FAILED'] } }), 0, 'R6_QUEUE_NOT_CLEAR'); }
    finally { await c.close(); }
    const directory = state + '/exutra-r6-rollback-' + verified.checkpoint.commit;
    const names = ['ec-bot-core-v78.env', 'ec-bot-core-v78-attestation.json', 'ec-bot-core-v78-permit.consumed.json'];
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { mode: 0o700 }); const hashes = {};
        for (const name of names) {
            const current = state + '/' + name;
            fs.copyFileSync(current, directory + '/' + name, fs.constants.COPYFILE_EXCL);
            fs.chmodSync(directory + '/' + name, 0o400); hashes[name] = sha(fs.readFileSync(current));
        }
        write(directory + '/manifest.json', { parentRelease: R6_PARENT_RELEASE,
            parentCommit: verified.parent.attestation.commit, hashes });
    }
    verifyR6RollbackBundle(root);
    if (action === 'activation-dry-run') {
        console.log('R6_ACTIVATION_DRY_RUN=PASS; ROLLBACK_READY=YES');
    } else {
        assert.equal(process.env.EXUTRA_R6_APPROVAL,
            'AUTORIZO_EXPANSAO_CONTROLE_COMPARTILHADO_EXCLUSIVA_PARA_CORRECAO_EXUTRA_VSL');
        const errorLog = '/root/.pm2/logs/vitalismen-automation-error.log';
        const errorMtime = fs.statSync(errorLog).mtimeMs;
        const lock = state + '/.exutra-r6-activation.lock'; fs.mkdirSync(lock, { mode: 0o700 });
        try {
            assert.equal(fs.realpathSync(base + '/current'), parent);
            const next = base + '/.current.exutra-r6-' + process.pid;
            fs.symlinkSync(root, next); fs.renameSync(next, base + '/current');
            const wrapper = root + '/ops/ec-bot-core-v78-successor-r4';
            const run = (args, extra = {}) => execFileSync('/bin/bash', [wrapper, ...args], {
                timeout: 180000, stdio: 'ignore', env: { ...safeEnv, ...extra,
                    NODE_OPTIONS: '', npm_config_node_options: '', EXUTRA_R6_TRANSITION: 'EXACT_R5_TO_R6' }
            });
            run(['supersede', R6_PARENT_RELEASE], { EC_BOT_CORE_V78_SUPERSEDE: 'I_UNDERSTAND_V78_BUNDLE_SUPERSEDE' });
            run(['authorize', path.basename(root)], { EC_BOT_CORE_V78_AUTHORIZE: 'I_UNDERSTAND_EC_BOT_CORE_V78' });
            run(['activate', path.basename(root)]);
            const status = await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(10000) });
            assert.equal(status.status, 200); const after = await status.json();
            assert.equal(after.status, 'online'); assert.equal(after.zapi?.connected, true);
            assert.equal(after.automationSafety?.botCoreOperational, true);
            assert.equal(after.automationSafety?.metaPurchaseAllowed, false);
            const apps = JSON.parse(execFileSync('/usr/bin/pm2', ['jlist'], { encoding: 'utf8' }));
            const app = apps.find(a => a.name === 'vitalismen-automation');
            assert.equal(app?.pm2_env?.status, 'online');
            assert.ok([root, base + '/current'].includes(app.pm2_env.pm_cwd));
            assert.equal(fs.realpathSync(app.pm2_env.pm_exec_path), root + '/src/index.js');
            assert.equal(app.pm2_env.NODE_OPTIONS, '--import=file://' + base + '/current/scripts/lib/exutra-r6-preload.mjs');
            const post = await mongoose.createConnection(env.MONGODB_URI,
                { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 }).asPromise();
            try { assert.equal(await post.db.collection('messages').countDocuments({
                queueStatus: { $in: ['PENDING', 'CLAIMED', 'FAILED'] } }), 0, 'R6_POST_QUEUE_NOT_CLEAR'); }
            finally { await post.close(); }
            preflight(['scripts/exutra-r6-guard.mjs']);
            preflight(['--test', 'tests/exutra-capture-hold-r6.test.mjs', 'tests/exutra-r6-contract.test.mjs']);
            assert.equal(fs.statSync(errorLog).mtimeMs, errorMtime, 'R6_NEW_ERROR_LOG_ENTRY');
            console.log('R6_ACTIVATION=PASS; PID=' + app.pid);
        } catch (error) {
            await rollbackExutraR6(root);
            console.error('R6_ACTIVATION_FAILED_ROLLBACK_COMPLETE'); throw error;
        } finally { fs.rmdirSync(lock); }
    }
} else throw Error('R6_RELEASE_ACTION_INVALID');
