#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    R5_PARENT_RELEASE, R5_PARENT_COMMIT, R5_PARENT_TREE,
    R5_ROLLBACK_BUNDLE_HASHES, readRootR5Checkpoint, sha256,
    verifyR5MaterializedRelease
} from '../scripts/lib/unified-successor-v202-r5-authority.mjs';
import { verifyMaterializedRelease } from '../scripts/lib/unified-successor-v202-r4-authority.mjs';

const BASE = '/opt/vitalismen-automacao';
const STATE = '/var/lib/vitalismen-deploy';
const PROCESS = 'vitalismen-automation';
const R4_OPTIONS = '--import=file://' + BASE
    + '/current/scripts/lib/unified-successor-v202-r4-preload.mjs';
const BUNDLE_NAMES = Object.freeze(Object.keys(R5_ROLLBACK_BUNDLE_HASHES));
const regular = (file, mode) => {
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'R5_ROLLBACK_FILE_UNSAFE');
    assert.equal(stat.uid, 0, 'R5_ROLLBACK_FILE_OWNER');
    assert.equal(stat.gid, 0, 'R5_ROLLBACK_FILE_GROUP');
    if (mode !== undefined) assert.equal(stat.mode & 0o777, mode,
        'R5_ROLLBACK_FILE_MODE');
    return stat;
};
const target = path.join(BASE, 'releases', R5_PARENT_RELEASE);
const current = path.join(BASE, 'current');
const bundleMode = (name) => name.endsWith('.consumed.json') ? 0o600 : 0o400;
const hashBundle = (file, name) => {
    regular(file, bundleMode(name));
    assert.equal(sha256(fs.readFileSync(file)), R5_ROLLBACK_BUNDLE_HASHES[name],
        'R5_ROLLBACK_BUNDLE_CHANGED:' + name);
};
export function selectR4RollbackBundle(state, successorRelease) {
    const active = Object.fromEntries(BUNDLE_NAMES.map((name) =>
        [name, path.join(state, name)]));
    const activeComplete = BUNDLE_NAMES.every((name) => fs.existsSync(active[name]));
    if (activeComplete && !fs.existsSync(path.join(state, 'ec-bot-core-v78-permit.json'))
        && BUNDLE_NAMES.every((name) =>
        sha256(fs.readFileSync(active[name])) === R5_ROLLBACK_BUNDLE_HASHES[name])) {
        for (const name of BUNDLE_NAMES) hashBundle(active[name], name);
        return { kind: 'active', files: active };
    }
    const candidates = fs.readdirSync(state).filter((name) =>
        name.startsWith('ec-bot-core-v78.env.superseded.' + successorRelease + '.'));
    assert.equal(candidates.length, 1, 'R5_ROLLBACK_ARCHIVE_NOT_UNIQUE');
    const suffix = candidates[0].slice('ec-bot-core-v78.env.'.length);
    assert.match(suffix, /^superseded\.\d{8}T\d{6}Z_production-\d{8}-[a-f0-9]{7}\.\d{8}T\d{6}Z$/);
    const files = Object.fromEntries(BUNDLE_NAMES.map((name) =>
        [name, path.join(state, name + '.' + suffix)]));
    for (const name of BUNDLE_NAMES) hashBundle(files[name], name);
    return { kind: 'archive', files };
}
const readOverlay = (file) => {
    const env = {};
    for (const line of fs.readFileSync(file, 'utf8').trimEnd().split('\n')) {
        const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
        assert.ok(match && !Object.hasOwn(env, match[1]), 'R5_ROLLBACK_OVERLAY_INVALID');
        env[match[1]] = match[2];
    }
    assert.equal(env.NODE_OPTIONS, R4_OPTIONS, 'R5_ROLLBACK_R4_OPTIONS');
    assert.equal(env.VITALISMEN_EC_BOT_CORE_OPERATIONAL, 'true', 'R5_ROLLBACK_PROFILE');
    assert.equal(env.DROPPI_EC_ACTIVE_SYNC_MODE, 'REPORT_ONLY', 'R5_ROLLBACK_DROPI');
    assert.equal(env.DISABLE_SCHEDULER, '1', 'R5_ROLLBACK_SCHEDULER');
    return env;
};
const pm2App = () => {
    const entries = JSON.parse(execFileSync('/usr/bin/pm2', ['jlist'], { encoding: 'utf8' }));
    const matches = entries.filter((entry) => entry.name === PROCESS);
    assert.equal(matches.length, 1, 'R5_ROLLBACK_PM2_IDENTITY');
    const app = matches[0];
    assert.ok(['online', 'stopped', 'errored'].includes(app.pm2_env?.status),
        'R5_ROLLBACK_PM2_STATUS');
    assert.ok([current, target].includes(app.pm2_env?.pm_cwd), 'R5_ROLLBACK_PM2_CWD');
    assert.ok([current + '/src/index.js', target + '/src/index.js']
        .includes(app.pm2_env?.pm_exec_path), 'R5_ROLLBACK_PM2_EXEC');
    return app;
};
const health = async () => {
    const response = await fetch('http://127.0.0.1:3001/api/health',
        { signal: AbortSignal.timeout(10_000) });
    assert.equal(response.status, 200, 'R5_ROLLBACK_HEALTH_HTTP');
    const body = await response.json();
    assert.equal(body.status, 'online', 'R5_ROLLBACK_HEALTH_STATUS');
    assert.equal(body.zapi?.connected, true, 'R5_ROLLBACK_ZAPI');
    assert.equal(body.zapi?.outboundBlocked, false, 'R5_ROLLBACK_ZAPI_OUTBOUND');
    return body;
};
const verifyTarget = () => {
    const parent = verifyMaterializedRelease(target);
    assert.equal(parent.attestation.commit, R5_PARENT_COMMIT, 'R5_ROLLBACK_OLD_COMMIT');
    assert.equal(parent.attestation.tree, R5_PARENT_TREE, 'R5_ROLLBACK_OLD_TREE');
    const source = JSON.parse(fs.readFileSync(path.join(target, '.release-source.json'), 'utf8'));
    assert.equal(source.releaseName, R5_PARENT_RELEASE, 'R5_ROLLBACK_OLD_RELEASE');
    assert.equal(source.functionalCommit, R5_PARENT_COMMIT, 'R5_ROLLBACK_SOURCE_COMMIT');
    assert.equal(source.functionalTree, R5_PARENT_TREE, 'R5_ROLLBACK_SOURCE_TREE');
    return parent;
};
const currentTarget = () => {
    assert.ok(fs.lstatSync(current).isSymbolicLink(), 'R5_ROLLBACK_CURRENT_UNSAFE');
    return fs.realpathSync(current);
};
export async function rollbackR5(successorRelease, { dryRun = false } = {}) {
    assert.match(successorRelease,
        /^\d{8}T\d{6}Z_production-\d{8}-[a-f0-9]{7}$/,
        'R5_ROLLBACK_SUCCESSOR_NAME');
    const source = path.join(BASE, 'releases', successorRelease);
    const checkpoint = readRootR5Checkpoint(source);
    assert.equal(sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
        checkpoint.value.controlHashes['ops/vitalismen-rollback-v202-r5.mjs'],
        'R5_ROLLBACK_EXECUTOR_CHANGED');
    verifyR5MaterializedRelease(source);
    const parent = verifyTarget();
    const controller = path.join(target, 'scripts/lib/pm2-target-env-restart-v78-r4.mjs');
    const expectedController = parent.checkpoint.r4Pm2ControllerSha256;
    regular(controller);
    assert.equal(sha256(fs.readFileSync(controller)), expectedController,
        'R5_ROLLBACK_R4_CONTROLLER_CHANGED');
    const bundle = selectR4RollbackBundle(STATE, successorRelease);
    const overlay = readOverlay(bundle.files['ec-bot-core-v78.env']);
    const before = currentTarget();
    assert.ok([source, target].includes(before), 'R5_ROLLBACK_UNKNOWN_CURRENT');
    const app = pm2App();
    if (dryRun) return { status: 'READY', current: before, bundle: bundle.kind };
    if (before === target && bundle.kind === 'active'
        && app.pm2_env.status === 'online' && app.pm2_env.NODE_OPTIONS === R4_OPTIONS) {
        await health();
        return { status: 'ALREADY_RECOVERED' };
    }
    const lock = path.join(STATE, '.rollback-v202-r5.lock');
    fs.mkdirSync(lock, { mode: 0o700 });
    let restarted = false;
    try {
        assert.equal(currentTarget(), before, 'R5_ROLLBACK_CURRENT_RACE');
        const lockedBundle = selectR4RollbackBundle(STATE, successorRelease);
        assert.equal(lockedBundle.kind, bundle.kind, 'R5_ROLLBACK_BUNDLE_RACE');
        assert.deepEqual(lockedBundle.files, bundle.files, 'R5_ROLLBACK_ARCHIVE_RACE');
        if (app.pm2_env.status === 'online') {
            execFileSync('/usr/bin/pm2', ['stop', PROCESS], { stdio: 'ignore' });
        }
        if (before !== target) {
            const next = path.join(BASE, '.current.rollback-v202-r5.' + process.pid);
            assert.equal(fs.existsSync(next), false, 'R5_ROLLBACK_SYMLINK_COLLISION');
            fs.symlinkSync(target, next);
            try { fs.renameSync(next, current); } finally {
                if (fs.existsSync(next)) fs.unlinkSync(next);
            }
        }
        assert.equal(currentTarget(), target, 'R5_ROLLBACK_SWITCH_FAILED');
        if (bundle.kind === 'archive') {
            const suffix = '.rollback-v202-r5.' + successorRelease + '.' + Date.now();
            for (const name of BUNDLE_NAMES) {
                const active = path.join(STATE, name);
                if (fs.existsSync(active)) fs.renameSync(active, active + suffix);
            }
            const pending = path.join(STATE, 'ec-bot-core-v78-permit.json');
            if (fs.existsSync(pending)) fs.renameSync(pending, pending + suffix);
            for (const name of BUNDLE_NAMES) {
                const active = path.join(STATE, name);
                fs.copyFileSync(bundle.files[name], active, fs.constants.COPYFILE_EXCL);
                fs.chmodSync(active, bundleMode(name));
            }
        }
        selectR4RollbackBundle(STATE, successorRelease);
        const pm2Root = fs.realpathSync('/usr/bin/pm2').replace(/\/bin\/pm2$/, '');
        const pm2Package = path.join(pm2Root, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(pm2Package, 'utf8'));
        assert.equal(packageJson.name, 'pm2', 'R5_ROLLBACK_PM2_PACKAGE');
        assert.match(packageJson.version, /^6\./, 'R5_ROLLBACK_PM2_VERSION');
        execFileSync('/usr/bin/node', [controller, pm2Root, PROCESS, R4_OPTIONS, target],
            { stdio: 'ignore', env: { ...process.env, ...overlay,
                NODE_OPTIONS: '', npm_config_node_options: '', NPM_CONFIG_NODE_OPTIONS: '' } });
        restarted = true;
        for (let attempt = 0; attempt < 30; attempt += 1) {
            try {
                const online = pm2App();
                if (online.pm2_env.status === 'online'
                    && online.pm2_env.NODE_OPTIONS === R4_OPTIONS) {
                    await health();
                    return { status: 'R4_RECOVERED', pid: online.pid };
                }
            } catch { /* bounded recovery */ }
            await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
        throw new Error('R5_ROLLBACK_HEALTH_TIMEOUT');
    } catch (error) {
        if (restarted) {
            try { execFileSync('/usr/bin/pm2', ['stop', PROCESS], { stdio: 'ignore' }); }
            catch { /* fail closed */ }
        }
        throw error;
    } finally {
        fs.rmdirSync(lock);
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    try {
        assert.equal(process.platform, 'linux', 'R5_ROLLBACK_LINUX_ONLY');
        assert.equal(process.getuid(), 0, 'R5_ROLLBACK_ROOT_ONLY');
        assert.ok(process.argv.length === 3 || (process.argv.length === 4
            && process.argv[3] === '--dry-run'), 'R5_ROLLBACK_EXACT_ARGS');
        const result = await rollbackR5(process.argv[2],
            { dryRun: process.argv[3] === '--dry-run' });
        process.stdout.write('ROLLBACK_R5=' + result.status + '\n');
    } catch (error) {
        process.stderr.write('ROLLBACK_R5_FAILED=' + error.message + '\n');
        process.exitCode = 1;
    }
}
