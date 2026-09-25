import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollbackV201 } from '../ops/vitalismen-rollback-v201-r4.mjs';

const executor = fileURLToPath(new URL('../ops/vitalismen-rollback-v201-r4.mjs', import.meta.url));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceName = '20260925T120000Z_production-20260925-abcdef0';
const targetName = '20260924T015646Z_production-20260924-641759b';
const v201Commit = '641759b160c2b91e95a3f1df371ad372a74d72e1';
const v201Tree = '1feb02ad1a3f2ae266ef519bf33426b91ac80aa3';
const r4Commit = 'abcdef0123456789abcdef0123456789abcdef01';
const r4Tree = '1234567890abcdef1234567890abcdef12345678';
const nodeOptions = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v199-context.mjs';
const names = ['ec-bot-core-v78.env', 'ec-bot-core-v78-attestation.json',
    'ec-bot-core-v78-permit.consumed.json'];
const write = (file, value, mode = 0o400) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.isBuffer(value) || typeof value === 'string'
        ? value : JSON.stringify(value, null, 2) + '\n');
    fs.chmodSync(file, mode);
    return hash(file);
};
const goodHealth = pid => [{ httpStatus: 200, body: { status: 'online', pid,
    zapi: { connected: true }, automationSafety: { mode: 'EC_BOT_CORE_OPERATIONAL',
        mutatingSchedulers: 0, dropiApplyAllowed: false } } },
{ httpStatus: 200, body: { ok: true, destination: { datasetId: '920532663934291',
    browserPixelId: '920532663934291', browserServerSynchronized: true } } }];

function fixture({ current = 'R4', active = 'R4' } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v201-rollback-r4-'));
    const base = path.join(root, 'opt', 'vitalismen-automacao');
    const state = path.join(root, 'var', 'lib', 'vitalismen-deploy');
    const source = path.join(base, 'releases', sourceName);
    const target = path.join(base, 'releases', targetName);
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(target, { recursive: true });
    fs.mkdirSync(state, { recursive: true });
    fs.symlinkSync(current === 'R4' ? source : target, path.join(base, 'current'));
    const sourceFile = path.join(source, '.release-source.json');
    write(sourceFile, { releaseName: sourceName, functionalCommit: r4Commit,
        functionalTree: r4Tree });
    const controller = path.join(source, 'scripts/lib/pm2-target-env-restart-v78-r4.mjs');
    const controllerSha = write(controller, 'fixture-controller\n', 0o600);
    const authorityCode = path.join(source,
        'scripts/lib/unified-successor-v202-r4-authority.mjs');
    write(authorityCode, fs.readFileSync(new URL(
        '../scripts/lib/unified-successor-v202-r4-authority.mjs', import.meta.url)), 0o600);
    const expected = { release: targetName, commit: v201Commit, tree: v201Tree,
        tag: 'production-20260924-641759b', preload:
        'scripts/lib/ec-runtime-successor-v199-context.mjs', dataset: '920532663934291' };
    expected.sourceSha256 = write(path.join(target, '.release-source.json'),
        { releaseName: targetName, functionalCommit: v201Commit, functionalTree: v201Tree });
    expected.stagingSha256 = write(path.join(target, '.staging-complete.json'), { status: 'complete' });
    expected.publicationSha256 = write(path.join(target, '.release-publication.json'),
        { publicationTag: expected.tag });
    expected.publicationCompleteSha256 = write(path.join(target, '.publication-complete.json'),
        { status: 'complete' });
    expected.preloadSha256 = write(path.join(target, expected.preload), 'fixture-v199-preload\n', 0o600);
    const overlay = `DISABLE_SCHEDULER=1\nDROPPI_EC_ACTIVE_SYNC_MODE=REPORT_ONLY\nNODE_OPTIONS=${nodeOptions}\nVITALISMEN_EC_BOT_CORE_OPERATIONAL=true\n`;
    const attestation = { release: targetName, commit: v201Commit, tree: v201Tree,
        status: 'attested', profile: 'EC_BOT_CORE_OPERATIONAL' };
    const bundleArchive = names.map((name, i) => path.join(state,
        `${name}.superseded.${sourceName}.20260925T120001Z`));
    const values = [overlay, attestation, { release: targetName, status: 'authorized' }];
    const hashes = bundleArchive.map((file, i) => write(file, values[i], i === 2 ? 0o600 : 0o400));
    [expected.bundleSha256, expected.attestationSha256, expected.permitSha256] = hashes;
    if (active === 'V201') names.forEach((name, i) => fs.copyFileSync(bundleArchive[i], path.join(state, name)));
    else {
        const activeOverlay = path.join(state, names[0]);
        write(activeOverlay, 'R4_OVERLAY=true\n');
        const activeAttestation = path.join(state, names[1]);
        write(activeAttestation, { release: sourceName, status: 'attested',
            overlaySha256: hash(activeOverlay) });
        write(path.join(state, active === 'R4_PENDING' ? 'ec-bot-core-v78-permit.json' : names[2]), { release: sourceName,
            attestationSha256: hash(activeAttestation) }, 0o600);
    }
    const authorityCheckpoint = path.join(state,
        'CHECKPOINT_R4_CONTROL_PLANE_SUCCESSOR_AUTHORITY.json');
    const authoritySha = write(authorityCheckpoint, {
        checkpointId: 'CHECKPOINT_R4_CONTROL_PLANE_SUCCESSOR_AUTHORITY',
        status: 'FROZEN',
        parentCheckpoint: 'CHECKPOINT_R4_STARTUP_SUCCESSOR_READY',
        parentR4Commit: '9d640d2700f91675f06b136cd6fe02695596e8cf',
        parentR4Tree: '20c9ea0925cffd8ad2c06a73abd811837330339c',
        parentAuthorityCheckpointSha256:
            'd85725ac5b1b5b70bb104f750af42ce34eeec61dc309f6d655b40785655b4986',
        project: 'MAXLIEN EC — VITALISMEN OFICIAL',
        r4OperationalCommit: r4Commit, r4OperationalTree: r4Tree,
        r4OperationalManifestSha256: 'a'.repeat(64),
        r4OperationalPreloadSha256: 'b'.repeat(64),
        r4OperationalGuardSha256: 'c'.repeat(64),
        r4OperationalRunnerSha256: 'd'.repeat(64),
        r4FreezeLockSuccessorSha256: 'e'.repeat(64),
        r4FinalValidatorSha256: 'f'.repeat(64),
        allowlistCount: 83,
        v201PublishedCommit: v201Commit, v201PublishedTree: v201Tree,
        v201ManifestSha256:
            'e8b82901e8faa4cda1d37a013fd2698401bad9c2039b702e637b88d5e4e56bee',
        shipmentsSha256:
            'c083862ea7123d854fd7260375632d1f4535451b26a53f1e9edf38d7b6ab0ef8',
        v168bSha256:
            'e1ce8093e54f4b3bcf976a140cede0aab06e6b8b3211ceceb94b8b2ccf44dcb3',
        metaDatasetId: '920532663934291'
    });
    const checkpoint = path.join(state, 'CHECKPOINT_R4_CONTROL_PLANE_SUCCESSOR_READY_TO_RESTAGE.json');
    write(checkpoint, { CHECKPOINT_ID: 'CHECKPOINT_R4_CONTROL_PLANE_SUCCESSOR_READY_TO_RESTAGE',
        CHECKPOINT_STATUS: 'FROZEN', PROJECT: 'MAXLIEN EC — VITALISMEN OFICIAL',
        PARENT_AUTHORITY_SHA256: authoritySha,
        COMMIT: r4Commit, TREE: r4Tree, CONTROLLER_SHA256: controllerSha,
        ROLLBACK_EXECUTOR_SHA256: hash(executor),
        ROLLBACK_READY: 'YES', V78_CONTROLLER: 'PASS', STARTUP: 'PASS',
        STAGE_SELECTION: 'PASS', SAFE_PM2: 'PASS' });
    const config = { base, state, checkpoint, authorityCheckpoint, expected, strictOwner: false };
    const pm2 = { name: 'vitalismen-automation', pid: 1993771,
        pm2_env: { status: 'online', pm_cwd: path.join(base, 'current'),
            pm_exec_path: path.join(base, 'current', 'src/index.js'),
            NODE_OPTIONS: current === 'R4' ? '--import=file:///opt/vitalismen-automacao/current/scripts/lib/unified-successor-v202-r4-preload.mjs' : nodeOptions } };
    const calls = { stop: 0, restart: 0, health: 0 };
    let healthOverride = null;
    const io = {
        listPm2: () => [structuredClone(pm2)],
        stopPm2: () => { calls.stop += 1; pm2.pm2_env.status = 'stopped'; },
        restartPm2: (file, release, env) => {
            assert.equal(file, controller);
            assert.equal(release, target);
            assert.equal(env.NODE_OPTIONS, nodeOptions);
            calls.restart += 1;
            pm2.pid += 1;
            pm2.pm2_env.status = 'online';
            pm2.pm2_env.NODE_OPTIONS = nodeOptions;
        },
        getHealth: async () => { calls.health += 1; return healthOverride || goodHealth(pm2.pid); },
        sleep: async () => {}
    };
    return { root, base, state, source, target, config, io, calls, pm2,
        setHealth: value => { healthOverride = value; },
        cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('R4 falho volta ao V201 exato e não reinicia na segunda execução', async () => {
    const f = fixture();
    try {
        const first = await rollbackV201(sourceName, f.config, f.io);
        assert.equal(first.result, 'V201_RECOVERED');
        assert.equal(fs.realpathSync(path.join(f.base, 'current')), f.target);
        assert.equal(hash(path.join(f.state, names[0])), f.config.expected.bundleSha256);
        assert.equal(hash(path.join(f.state, names[1])), f.config.expected.attestationSha256);
        assert.equal(hash(path.join(f.state, names[2])), f.config.expected.permitSha256);
        assert.deepEqual(f.calls, { stop: 1, restart: 1, health: 1 });
        const second = await rollbackV201(sourceName, f.config, f.io);
        assert.equal(second.result, 'ALREADY_RECOVERED');
        assert.deepEqual(f.calls, { stop: 1, restart: 1, health: 2 });
    } finally { f.cleanup(); }
});

test('V201 já operacional retorna sem mutação', async () => {
    const f = fixture({ current: 'V201', active: 'V201' });
    try {
        assert.equal((await rollbackV201(sourceName, f.config, f.io)).result, 'ALREADY_RECOVERED');
        assert.equal(f.calls.stop, 0);
        assert.equal(f.calls.restart, 0);
    } finally { f.cleanup(); }
});

test('falha de health antes de consumir permit pendente restaura V201', async () => {
    const f = fixture({ active: 'R4_PENDING' });
    try {
        const result = await rollbackV201(sourceName, f.config, f.io);
        assert.equal(result.result, 'V201_RECOVERED');
        assert.equal(fs.existsSync(path.join(f.state, 'ec-bot-core-v78-permit.json')), false);
        assert.equal(hash(path.join(f.state, names[2])), f.config.expected.permitSha256);
        assert.equal(fs.realpathSync(path.join(f.base, 'current')), f.target);
    } finally { f.cleanup(); }
});

const negatives = [
    ['wrong V201 commit', f => { const p = path.join(f.target, '.release-source.json');
        const j = JSON.parse(fs.readFileSync(p)); j.functionalCommit = r4Commit; write(p, j); }],
    ['wrong V201 tree', f => { const p = path.join(f.target, '.release-source.json');
        const j = JSON.parse(fs.readFileSync(p)); j.functionalTree = r4Tree; write(p, j); }],
    ['wrong bundle', f => write(path.join(f.state,
        `${names[0]}.superseded.${sourceName}.20260925T120001Z`), 'wrong\n')],
    ['wrong attestation', f => write(path.join(f.state,
        `${names[1]}.superseded.${sourceName}.20260925T120001Z`), 'wrong\n')],
    ['wrong permit', f => write(path.join(f.state,
        `${names[2]}.superseded.${sourceName}.20260925T120001Z`), 'wrong\n', 0o600)],
    ['wrong V199 preload', f => write(path.join(f.target, f.config.expected.preload), 'wrong\n', 0o600)],
    ['wrong PM2 controller', f => write(path.join(f.source,
        'scripts/lib/pm2-target-env-restart-v78-r4.mjs'), 'wrong\n', 0o600)],
    ['wrong R4 authority code', f => write(path.join(f.source,
        'scripts/lib/unified-successor-v202-r4-authority.mjs'), 'wrong\n', 0o600)],
    ['wrong authority checkpoint', f => { const p = f.config.authorityCheckpoint;
        const j = JSON.parse(fs.readFileSync(p)); j.r4OperationalTree = '0'.repeat(40); write(p, j); }],
    ['wrong ready checkpoint', f => { const p = f.config.checkpoint;
        const j = JSON.parse(fs.readFileSync(p)); j.SAFE_PM2 = 'FAIL'; write(p, j); }],
    ['unknown current', f => { const p = path.join(f.base, 'current'); fs.unlinkSync(p);
        const x = path.join(f.base, 'releases', 'unknown'); fs.mkdirSync(x); fs.symlinkSync(x, p); }],
    ['unknown PM2 target', f => { f.pm2.pm2_env.pm_exec_path = '/tmp/unknown.js'; }]
];
for (const [label, mutate] of negatives) {
    test(`fail-closed antes de mutação: ${label}`, async () => {
        const f = fixture();
        try {
            mutate(f);
            await assert.rejects(rollbackV201(sourceName, f.config, f.io));
            assert.equal(f.calls.stop, 0);
            assert.equal(f.calls.restart, 0);
        } finally { f.cleanup(); }
    });
}
for (const [label, mutate] of [
    ['health timeout', pair => { pair[0].body.status = 'degraded'; }],
    ['ZAPI disconnected', pair => { pair[0].body.zapi.connected = false; }],
    ['wrong Meta dataset', pair => { pair[1].body.destination.datasetId = 'unknown'; }]
]) {
    test(`fail-closed após restart: ${label}`, async () => {
        const f = fixture();
        try {
            const pair = goodHealth(1993772);
            mutate(pair);
            f.setHealth(pair);
            await assert.rejects(rollbackV201(sourceName, f.config, f.io), /ROLLBACK_HEALTH_TIMEOUT/);
            assert.equal(f.calls.restart, 1);
            assert.equal(f.pm2.pm2_env.status, 'stopped');
            assert.equal(fs.realpathSync(path.join(f.base, 'current')), f.target);
        } finally { f.cleanup(); }
    });
}
