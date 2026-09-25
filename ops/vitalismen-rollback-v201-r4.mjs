#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const AUTHORITY_SHA256 = 'ae53a56bff65786676fb9ffa0a357c6bcaf18476eed64e0463bf6db33152efaa';
const readCanonical = (file, strictOwner) => {
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'ROLLBACK_CHECKPOINT_UNSAFE');
    if (strictOwner) {
        assert.equal(stat.uid, 0, 'ROLLBACK_CHECKPOINT_OWNER');
        assert.equal(stat.gid, 0, 'ROLLBACK_CHECKPOINT_GROUP');
        assert.equal(stat.mode & 0o777, 0o400, 'ROLLBACK_CHECKPOINT_MODE');
    }
    const bytes = fs.readFileSync(file, 'utf8');
    const value = JSON.parse(bytes);
    assert.equal(bytes, `${JSON.stringify(value, null, 2)}\n`, 'ROLLBACK_CHECKPOINT_NONCANONICAL');
    return value;
};
const V201 = Object.freeze({
    release: '20260924T015646Z_production-20260924-641759b',
    commit: '641759b160c2b91e95a3f1df371ad372a74d72e1',
    tree: '1feb02ad1a3f2ae266ef519bf33426b91ac80aa3',
    tag: 'production-20260924-641759b',
    preload: 'scripts/lib/ec-runtime-successor-v199-context.mjs',
    preloadSha256: '11c700dfaaca18031be79d8cc1d298711b7a7ad60806415d1a974be33f3d4d60',
    sourceSha256: '0496bb60a39070cd46922d5ea2d1f48bb71f67aa06f65daffa39267051e66408',
    stagingSha256: 'aa3ba5365c978cc4aa09ef855d10b0c145d5c548737d221c8f3179850b36d375',
    publicationSha256: 'a3e5dc5f4a084052e68e2cef47c1f229296607461cd5355d7094c4c229bf7aba',
    publicationCompleteSha256: '8b39415d066b51ded68dfcdbdf3cb7d7377c28ae74d8328167a977e4555cadb7',
    bundleSha256: 'd21792ed4a72c64473bc014077c53644730b51ee18e494358907fa3f7dde27ec',
    attestationSha256: '67aeda0b746c7e789b024d21f3f76d1a46c8432c620dfc496597c16f710868d7',
    permitSha256: '47d6c93ee140dda5d16b5b8d778c30d452981ce809540f38f309e28a22af89a6',
    dataset: '920532663934291'
});
const OFFICIAL = Object.freeze({
    base: '/opt/vitalismen-automacao',
    state: '/var/lib/vitalismen-deploy',
    checkpoint: '/var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_CONTROL_PLANE_READY.json',
    authorityCheckpoint: '/var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY.json',
    healthUrl: 'https://ec.maxlien.shop/api/health/',
    metaUrl: 'https://ec.maxlien.shop/api/health/meta-destination',
    expected: V201,
    strictOwner: true
});
const bundleNames = Object.freeze([
    'ec-bot-core-v78.env',
    'ec-bot-core-v78-attestation.json',
    'ec-bot-core-v78-permit.consumed.json'
]);
const bundleHashes = expected => [expected.bundleSha256,
    expected.attestationSha256, expected.permitSha256];
const nodeOptions = '--import=file:///opt/vitalismen-automacao/current/' + V201.preload;
const exactDirectory = (directory, strictOwner) => {
    const stat = fs.lstatSync(directory);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'ROLLBACK_RELEASE_DIRECTORY_UNSAFE');
    assert.equal(fs.realpathSync(directory), directory, 'ROLLBACK_RELEASE_DIRECTORY_ALIAS');
    if (strictOwner) {
        assert.equal(stat.uid, 0, 'ROLLBACK_RELEASE_DIRECTORY_OWNER');
        assert.equal(stat.gid, 0, 'ROLLBACK_RELEASE_DIRECTORY_GROUP');
        assert.equal(stat.mode & 0o022, 0, 'ROLLBACK_RELEASE_DIRECTORY_WRITABLE');
    }
};
const exactFile = (file, hash, mode, strictOwner) => {
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'ROLLBACK_FILE_NOT_REGULAR');
    if (strictOwner) {
        assert.equal(stat.uid, 0, 'ROLLBACK_FILE_OWNER');
        assert.equal(stat.gid, 0, 'ROLLBACK_FILE_GROUP');
        assert.equal(stat.mode & 0o777, mode, 'ROLLBACK_FILE_MODE');
    }
    assert.equal(sha256(file), hash, `ROLLBACK_FILE_SHA:${path.basename(file)}`);
};
const exactRelease = (dir, expected, strictOwner) => {
    const source = path.join(dir, '.release-source.json');
    const staging = path.join(dir, '.staging-complete.json');
    const publication = path.join(dir, '.release-publication.json');
    const completed = path.join(dir, '.publication-complete.json');
    assert.equal(path.basename(dir), expected.release, 'ROLLBACK_V201_RELEASE');
    exactFile(source, expected.sourceSha256, 0o400, strictOwner);
    exactFile(staging, expected.stagingSha256, 0o400, strictOwner);
    exactFile(publication, expected.publicationSha256, 0o400, strictOwner);
    exactFile(completed, expected.publicationCompleteSha256, 0o400, strictOwner);
    exactFile(path.join(dir, expected.preload), expected.preloadSha256, 0o600, strictOwner);
    const identity = readJson(source);
    assert.equal(identity.functionalCommit, expected.commit, 'ROLLBACK_V201_COMMIT');
    assert.equal(identity.functionalTree, expected.tree, 'ROLLBACK_V201_TREE');
    assert.equal(readJson(publication).publicationTag, expected.tag, 'ROLLBACK_V201_TAG');
};
const inspectBundle = (state, sourceRelease, expected, strictOwner) => {
    const hashes = bundleHashes(expected);
    const target = bundleNames.map(name => path.join(state, name));
    const pendingPermit = path.join(state, 'ec-bot-core-v78-permit.json');
    const targetExists = target.map(file => fs.existsSync(file));
    const exactActive = targetExists.every(Boolean) && !fs.existsSync(pendingPermit)
        && target.every((file, i) => sha256(file) === hashes[i]);
    if (exactActive) {
        target.forEach((file, i) => exactFile(file, hashes[i], i === 2 ? 0o600 : 0o400, strictOwner));
        return { active: target, target, archive: null, exactActive: true };
    }
    const suffixes = fs.readdirSync(state)
        .filter(name => name.startsWith(`${bundleNames[0]}.superseded.${sourceRelease}.`))
        .map(name => name.slice(bundleNames[0].length + 1));
    assert.equal(suffixes.length, 1, 'ROLLBACK_V201_ARCHIVE_NOT_UNIQUE');
    const suffix = suffixes[0];
    assert.match(suffix, /^superseded\.\d{8}T\d{6}Z_production-\d{8}-[a-f0-9]{7}\.\d{8}T\d{6}Z$/);
    const archive = bundleNames.map(name => path.join(state, `${name}.${suffix}`));
    archive.forEach((file, i) => exactFile(file, hashes[i], i === 2 ? 0o600 : 0o400, strictOwner));
    const active = [target[0], target[1],
        targetExists[2] ? target[2] : pendingPermit];
    const activeExists = active.map(file => fs.existsSync(file));
    if (activeExists.some(Boolean)) {
        assert.equal(targetExists[2] && fs.existsSync(pendingPermit), false,
            'ROLLBACK_R4_PERMIT_AMBIGUOUS');
        assert.equal(activeExists.every(Boolean), true, 'ROLLBACK_R4_BUNDLE_PARTIAL');
        const a = readJson(active[1]);
        assert.equal(a.release, sourceRelease, 'ROLLBACK_UNKNOWN_ACTIVE_BUNDLE');
        assert.equal(a.status, 'attested', 'ROLLBACK_ACTIVE_ATTESTATION');
        assert.equal(a.overlaySha256, sha256(active[0]), 'ROLLBACK_ACTIVE_OVERLAY_SHA');
        const p = readJson(active[2]);
        assert.equal(p.release, sourceRelease, 'ROLLBACK_UNKNOWN_ACTIVE_PERMIT');
        assert.equal(p.attestationSha256, sha256(active[1]), 'ROLLBACK_ACTIVE_PERMIT_SHA');
    }
    return { active, target, archive, exactActive: false };
};
const parseOverlay = file => {
    const env = {};
    for (const line of fs.readFileSync(file, 'utf8').trimEnd().split('\n')) {
        const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
        assert.ok(match, 'ROLLBACK_OVERLAY_SYNTAX');
        assert.equal(Object.hasOwn(env, match[1]), false, 'ROLLBACK_OVERLAY_DUPLICATE');
        env[match[1]] = match[2];
    }
    assert.equal(env.NODE_OPTIONS, nodeOptions, 'ROLLBACK_V199_NODE_OPTIONS');
    assert.equal(env.VITALISMEN_EC_BOT_CORE_OPERATIONAL, 'true', 'ROLLBACK_V78_PROFILE');
    assert.equal(env.DROPPI_EC_ACTIVE_SYNC_MODE, 'REPORT_ONLY', 'ROLLBACK_DROPI_MODE');
    assert.equal(env.DISABLE_SCHEDULER, '1', 'ROLLBACK_SCHEDULER');
    return env;
};
const assertPm2 = (entries, expected, allowedStatus) => {
    const matches = entries.filter(item => item.name === 'vitalismen-automation');
    assert.equal(matches.length, 1, 'ROLLBACK_PM2_TARGET_UNKNOWN');
    const app = matches[0];
    assert.ok(allowedStatus.includes(app.pm2_env?.status), 'ROLLBACK_PM2_STATUS');
    assert.equal(app.pm2_env?.pm_cwd, expected.base + '/current', 'ROLLBACK_PM2_CWD');
    assert.equal(app.pm2_env?.pm_exec_path, expected.base + '/current/src/index.js', 'ROLLBACK_PM2_EXEC');
    return app;
};
const assertHealth = (health, meta, expected, pid) => {
    assert.equal(health.httpStatus, 200, 'ROLLBACK_HEALTH_HTTP');
    assert.equal(health.body?.status, 'online', 'ROLLBACK_HEALTH_STATUS');
    assert.equal(health.body?.pid, pid, 'ROLLBACK_HEALTH_PID');
    assert.equal(health.body?.zapi?.connected, true, 'ROLLBACK_ZAPI_DISCONNECTED');
    assert.equal(health.body?.automationSafety?.mode, 'EC_BOT_CORE_OPERATIONAL', 'ROLLBACK_V78_INACTIVE');
    assert.equal(health.body?.automationSafety?.mutatingSchedulers, 0, 'ROLLBACK_SCHEDULERS');
    assert.equal(health.body?.automationSafety?.dropiApplyAllowed, false, 'ROLLBACK_DROPI_APPLY');
    assert.equal(meta.httpStatus, 200, 'ROLLBACK_META_HTTP');
    assert.equal(meta.body?.ok, true, 'ROLLBACK_META_UNAVAILABLE');
    assert.equal(meta.body?.destination?.datasetId, expected.dataset, 'ROLLBACK_META_DATASET');
    assert.equal(meta.body?.destination?.browserPixelId, expected.dataset, 'ROLLBACK_META_BROWSER');
    assert.equal(meta.body?.destination?.browserServerSynchronized, true, 'ROLLBACK_META_DIVERGENT');
};
const productionIO = config => ({
    listPm2: () => JSON.parse(execFileSync('/usr/bin/pm2', ['jlist'], { encoding: 'utf8' })),
    stopPm2: () => execFileSync('/usr/bin/pm2', ['stop', 'vitalismen-automation'], { stdio: 'ignore' }),
    restartPm2: (controller, release, overlay) => {
        const pm2Root = fs.realpathSync('/usr/bin/pm2').replace(/\/bin\/pm2$/, '');
        assert.notEqual(pm2Root, fs.realpathSync('/usr/bin/pm2'), 'ROLLBACK_PM2_MODULE_PATH');
        execFileSync('/usr/bin/node', [controller, pm2Root, 'vitalismen-automation',
            nodeOptions, release], { stdio: 'ignore', env: { ...process.env, ...overlay,
                NODE_OPTIONS: '', npm_config_node_options: '', NPM_CONFIG_NODE_OPTIONS: '' } });
    },
    getHealth: async () => {
        const get = async url => {
            const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
            return { httpStatus: response.status, body: await response.json() };
        };
        return [await get(config.healthUrl), await get(config.metaUrl)];
    },
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms))
});
const currentTarget = current => {
    assert.ok(fs.lstatSync(current).isSymbolicLink(), 'ROLLBACK_CURRENT_NOT_SYMLINK');
    return fs.realpathSync(current);
};
const validateAuthority = async (config, sourceRelease) => {
    const authorityCode = path.join(sourceRelease,
        'scripts/lib/unified-successor-v202-r4-authority.mjs');
    exactFile(authorityCode, AUTHORITY_SHA256, 0o600, config.strictOwner);
    const { validateCheckpoint } = await import(pathToFileURL(authorityCode).href);
    const authority = readCanonical(config.authorityCheckpoint, config.strictOwner);
    validateCheckpoint(authority);
    const checkpoint = readCanonical(config.checkpoint, config.strictOwner);
    const successor = authority.checkpointId === 'CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY';
    const commonFields = ['CHECKPOINT_ID', 'CHECKPOINT_STATUS',
        'PARENT_AUTHORITY_SHA256', 'COMMIT', 'TREE', 'CONTROLLER_SHA256',
        'ROLLBACK_EXECUTOR_SHA256', 'ROLLBACK_READY', 'V78_CONTROLLER',
        'STARTUP', 'STAGE_SELECTION', 'SAFE_PM2', 'PROJECT'];
    assert.deepEqual(Object.keys(checkpoint).sort(), [
        ...commonFields, ...(successor ? ['NEW_AUTHORITY_SHA256', 'WRAPPER_CANONICAL',
            'PRELOAD', 'V88_SUCCESSION', 'V89_V97_SUCCESSION',
            'FULL_V78_SIMULATION', 'ROLLBACK_SIMULATION',
            'BUSINESS_RUNTIME_CHANGED'] : [])
    ].sort(), 'ROLLBACK_CHECKPOINT_FIELDS');
    assert.equal(checkpoint.CHECKPOINT_ID, successor
        ? 'CHECKPOINT_R4_V78_CONTROL_PLANE_READY'
        : 'CHECKPOINT_R4_V78_PAYLOAD_READY', 'ROLLBACK_CHECKPOINT_ID');
    assert.equal(checkpoint.CHECKPOINT_STATUS, 'FROZEN', 'ROLLBACK_CHECKPOINT_STATUS');
    if (successor) {
        assert.equal(checkpoint.PARENT_AUTHORITY_SHA256,
            '8ba9fd21befdb6a73698d726aea7e340dce0dc93cbb4f0ff91d3b3c507f5be6d',
        'ROLLBACK_CHECKPOINT_PARENT');
        assert.equal(checkpoint.NEW_AUTHORITY_SHA256, sha256(config.authorityCheckpoint),
            'ROLLBACK_CHECKPOINT_NEW_AUTHORITY');
        assert.equal(authority.parentCheckpointSha256, checkpoint.PARENT_AUTHORITY_SHA256);
        for (const key of ['WRAPPER_CANONICAL', 'PRELOAD', 'V88_SUCCESSION',
            'V89_V97_SUCCESSION', 'FULL_V78_SIMULATION', 'ROLLBACK_SIMULATION']) {
            assert.equal(checkpoint[key], 'PASS', `ROLLBACK_CHECKPOINT_GATE:${key}`);
        }
        assert.equal(checkpoint.BUSINESS_RUNTIME_CHANGED, 'NO');
    } else {
        assert.equal(checkpoint.PARENT_AUTHORITY_SHA256, sha256(config.authorityCheckpoint),
            'ROLLBACK_CHECKPOINT_PARENT');
    }
    assert.equal(checkpoint.PROJECT, 'MAXLIEN EC — VITALISMEN OFICIAL',
        'ROLLBACK_CHECKPOINT_PROJECT');
    assert.equal(checkpoint.ROLLBACK_READY, 'YES', 'ROLLBACK_CHECKPOINT_NOT_READY');
    for (const key of ['V78_CONTROLLER', 'STARTUP', 'STAGE_SELECTION', 'SAFE_PM2']) {
        assert.equal(checkpoint[key], 'PASS', `ROLLBACK_CHECKPOINT_GATE:${key}`);
    }
    const source = readCanonical(path.join(sourceRelease, '.release-source.json'), false);
    assert.equal(source.releaseName, path.basename(sourceRelease), 'ROLLBACK_R4_RELEASE');
    assert.equal(checkpoint.COMMIT, authority.r4OperationalCommit, 'ROLLBACK_AUTHORITY_COMMIT');
    assert.equal(checkpoint.TREE, authority.r4OperationalTree, 'ROLLBACK_AUTHORITY_TREE');
    assert.equal(checkpoint.COMMIT, source.functionalCommit,
        'ROLLBACK_R4_COMMIT');
    assert.equal(checkpoint.TREE, source.functionalTree,
        'ROLLBACK_R4_TREE');
    assert.equal(checkpoint.ROLLBACK_EXECUTOR_SHA256, sha256(fileURLToPath(import.meta.url)),
        'ROLLBACK_EXECUTOR_SHA');
    return checkpoint;
};
export async function rollbackV201(sourceName, config = OFFICIAL, io = productionIO(config)) {
    assert.match(sourceName, /^\d{8}T\d{6}Z_production-\d{8}-[a-f0-9]{7}$/,
        'ROLLBACK_R4_RELEASE_NAME');
    const expected = config.expected;
    const sourceRelease = path.join(config.base, 'releases', sourceName);
    const targetRelease = path.join(config.base, 'releases', expected.release);
    const current = path.join(config.base, 'current');
    exactDirectory(sourceRelease, config.strictOwner);
    exactDirectory(targetRelease, config.strictOwner);
    const checkpoint = await validateAuthority(config, sourceRelease);
    assert.equal(path.basename(sourceRelease).slice(-7), checkpoint.COMMIT.slice(0, 7),
        'ROLLBACK_R4_SHORT_COMMIT');
    exactRelease(targetRelease, expected, config.strictOwner);
    const controller = path.join(sourceRelease, 'scripts/lib/pm2-target-env-restart-v78-r4.mjs');
    exactFile(controller, checkpoint.CONTROLLER_SHA256, 0o600, config.strictOwner);
    const beforeCurrent = currentTarget(current);
    assert.ok([sourceRelease, targetRelease].includes(beforeCurrent), 'ROLLBACK_UNKNOWN_CURRENT');
    let bundle = inspectBundle(config.state, sourceName, expected, config.strictOwner);
    const bundleFile = bundle.exactActive ? bundle.active[0] : bundle.archive[0];
    const overlay = parseOverlay(bundleFile);
    let app = assertPm2(io.listPm2(), config, ['online', 'stopped', 'errored']);
    if (beforeCurrent === targetRelease && bundle.exactActive && app.pm2_env.status === 'online'
        && app.pm2_env.NODE_OPTIONS === nodeOptions) {
        const [health, meta] = await io.getHealth();
        assertHealth(health, meta, expected, app.pid);
        return { result: 'ALREADY_RECOVERED', mutated: false, pid: app.pid };
    }
    const lock = path.join(config.state, '.rollback-v201-r4.lock');
    fs.mkdirSync(lock, { mode: 0o700 });
    let restarted = false;
    try {
        assert.equal(currentTarget(current), beforeCurrent, 'ROLLBACK_CURRENT_RACE');
        bundle = inspectBundle(config.state, sourceName, expected, config.strictOwner);
        if (app.pm2_env.status === 'online') io.stopPm2();
        app = assertPm2(io.listPm2(), config, ['stopped']);
        if (beforeCurrent !== targetRelease) {
            const next = path.join(config.base, `.current.rollback-v201.${process.pid}.next`);
            assert.equal(fs.existsSync(next), false, 'ROLLBACK_LINK_COLLISION');
            fs.symlinkSync(targetRelease, next);
            try { fs.renameSync(next, current); } finally {
                if (fs.existsSync(next)) fs.unlinkSync(next);
            }
        }
        assert.equal(currentTarget(current), targetRelease, 'ROLLBACK_CURRENT_NOT_V201');
        if (!bundle.exactActive) {
            const suffix = `.rollback-r4.${sourceName}.${Date.now()}`;
            for (const file of bundle.active) {
                if (fs.existsSync(file)) fs.renameSync(file, file + suffix);
            }
            bundle.target.forEach((file, i) => {
                assert.equal(fs.existsSync(file), false, 'ROLLBACK_BUNDLE_ACTIVE_COLLISION');
                fs.copyFileSync(bundle.archive[i], file, fs.constants.COPYFILE_EXCL);
                fs.chmodSync(file, i === 2 ? 0o600 : 0o400);
            });
        }
        inspectBundle(config.state, sourceName, expected, config.strictOwner);
        io.restartPm2(controller, targetRelease, overlay);
        restarted = true;
        for (let attempt = 0; attempt < 30; attempt += 1) {
            app = assertPm2(io.listPm2(), config, ['online', 'stopped', 'errored']);
            if (app.pm2_env.status === 'online' && app.pm2_env.NODE_OPTIONS === nodeOptions) {
                try {
                    const [health, meta] = await io.getHealth();
                    assertHealth(health, meta, expected, app.pid);
                    const receipt = path.join(config.state,
                        `CHECKPOINT_V201_ROLLBACK_COMPLETE.${sourceName}.json`);
                    const tmp = receipt + `.${process.pid}.tmp`;
                    assert.equal(fs.existsSync(receipt), false, 'ROLLBACK_RECEIPT_EXISTS');
                    fs.writeFileSync(tmp, JSON.stringify({ status: 'FROZEN', result: 'V201_RECOVERED',
                        sourceRelease: sourceName, targetRelease: expected.release,
                        targetCommit: expected.commit, targetTree: expected.tree,
                        bundleSha256: expected.bundleSha256, attestationSha256: expected.attestationSha256,
                        permitSha256: expected.permitSha256, nodeOptions, pm2Pid: app.pid,
                        dataset: expected.dataset, completedAt: new Date().toISOString() }, null, 2) + '\n',
                    { mode: 0o400, flag: 'wx' });
                    fs.renameSync(tmp, receipt);
                    return { result: 'V201_RECOVERED', mutated: true, pid: app.pid, receipt };
                } catch { /* await bounded health recovery */ }
            }
            await io.sleep(2_000);
        }
        throw new Error('ROLLBACK_HEALTH_TIMEOUT');
    } catch (error) {
        if (restarted) {
            try { io.stopPm2(); } catch { /* remain fail-closed */ }
        }
        throw error;
    } finally {
        fs.rmdirSync(lock);
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    try {
        assert.equal(process.platform, 'linux', 'ROLLBACK_LINUX_ONLY');
        assert.equal(process.getuid(), 0, 'ROLLBACK_ROOT_ONLY');
        assert.equal(process.argv.length, 3, 'ROLLBACK_EXACT_ARGS');
        const result = await rollbackV201(process.argv[2]);
        process.stdout.write(`ROLLBACK_RESULT=${result.result}\n`);
    } catch (error) {
        process.stderr.write(`ROLLBACK_FAILED=${error.message}\n`);
        process.exitCode = 1;
    }
}
