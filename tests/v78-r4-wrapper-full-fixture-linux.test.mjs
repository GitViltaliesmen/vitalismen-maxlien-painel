import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const wrapper = process.env.V78_R4_WRAPPER_FIXTURE;
const releaseDir = process.env.V78_R4_RELEASE_FIXTURE;
const parentContract = process.env.V78_R4_PARENT_CONTRACT_FIXTURE || (wrapper &&
    path.join(path.dirname(wrapper), 'ec-bot-core-parent-protection-r4.mjs'));
const enabled = process.platform === 'linux' && process.getuid?.() === 0
    && Boolean(wrapper && releaseDir && parentContract && fs.existsSync(parentContract));

const executable = (file, source) => {
    fs.writeFileSync(file, source, { mode: 0o700 });
    fs.chmodSync(file, 0o700);
};

const fixture = ({ failAfterRestart = false } = {}) => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-v78-r4-fixture-'));
    const state = path.join(base, 'state');
    const logs = path.join(base, 'logs');
    fs.mkdirSync(state, { mode: 0o700 });
    fs.mkdirSync(logs, { mode: 0o700 });
    const marker = path.join(base, 'restarted');
    const rollbackMarker = path.join(base, 'rollback-called');
    const pm2 = path.join(base, 'pm2');
    const curl = path.join(base, 'curl');
    const readlink = path.join(base, 'readlink');
    const stage = path.join(base, 'stage');
    const rollback = path.join(base, 'rollback');
    const releaseName = path.basename(releaseDir);
    const v201 = '/opt/vitalismen-automacao/releases/20260924T015646Z_production-20260924-641759b';
    executable(pm2, `#!/bin/sh\nif [ "$1" = jlist ]; then\n  printf '%s\\n' '[{"name":"vitalismen-automation","pm2_env":{"status":"online","pm_cwd":"${releaseDir}","pm_exec_path":"${releaseDir}/src/index.js"}}]'\n  exit 0\nfi\nif [ "$1" = restart ] && [ "$2" = vitalismen-automation ] && [ "$3" = --update-env ]; then\n  : > '${marker}'\n  exit 0\nfi\nexit 70\n`);
    executable(curl, `#!/bin/sh\ncase "$*" in\n  *meta-destination*) printf '%s\\n' '{"destination":{"profile":"meta_canonical_920_v195","datasetId":"920532663934291","browserPixelId":"920532663934291","browserServerSynchronized":true}}' ;;
  *) if [ -f '${marker}' ]; then\n       printf '%s\\n' '{"status":"${failAfterRestart ? 'degraded' : 'online'}","engine":"Z-API","zapi":{"connected":true,"outboundBlocked":false},"automationSafety":{"mode":"EC_BOT_CORE_OPERATIONAL","botCoreOperational":true,"mutatingSchedulers":0,"dropiApplyAllowed":false,"metaPurchaseAllowed":false}}'\n     else\n       printf '%s\\n' '{"status":"online","engine":"Z-API","zapi":{"connected":true,"outboundBlocked":false},"automationSafety":{"mode":"SAFE_OBSERVATION_ONLY","botCoreOperational":false,"mutatingSchedulers":0,"dropiApplyAllowed":false,"metaPurchaseAllowed":false}}'\n     fi ;;
esac\n`);
    executable(readlink, `#!/bin/sh\n[ "$1" = -f ] && [ "$2" = /opt/vitalismen-automacao/current ] || exit 71\nprintf '%s\\n' '${releaseDir}'\n`);
    executable(stage, '#!/bin/sh\n[ "$1" = v66-plan ] || exit 72\nprintf "%s\\n" "V66_FIXTURE=PASS"\n');
    executable(rollback, `import fs from 'node:fs';\nif (process.argv[2] !== '${releaseName}') process.exit(73);\nfs.writeFileSync('${rollbackMarker}', 'called\\n');\nconsole.log('CURRENT=${v201}');\nconsole.log('NODE_OPTIONS=V199_EXACT');\nconsole.log('V201_BUNDLE=ACTIVE_VALID');\nconsole.log('PM2=online');\nconsole.log('HEALTH=online');\nconsole.log('ZAPI=connected');\nconsole.log('META_DATASET=920532663934291');\n`);
    const env = { ...process.env,
        NODE_OPTIONS: '', npm_config_node_options: '',
        EC_BOT_CORE_V78_TEST_MODE: 'true',
        EC_BOT_CORE_V78_TEST_BASE_DIR: '/opt/vitalismen-automacao',
        EC_BOT_CORE_V78_TEST_STATE_DIR: state,
        EC_BOT_CORE_V78_TEST_LOG_DIR: logs,
        EC_BOT_CORE_V78_TEST_STAGE_HELPER: stage,
        EC_BOT_CORE_V78_TEST_PM2_CMD: pm2,
        EC_BOT_CORE_V78_TEST_CURL_CMD: curl,
        EC_BOT_CORE_V78_TEST_NODE_CMD: '/usr/bin/node',
        EC_BOT_CORE_V78_TEST_NPM_CMD: '/usr/bin/npm',
        EC_BOT_CORE_V78_TEST_READLINK_CMD: readlink,
        EC_BOT_CORE_V78_TEST_FLOCK_CMD: '/usr/bin/flock',
        EC_BOT_CORE_V78_TEST_ROLLBACK_CMD: rollback,
        EC_BOT_CORE_V78_TEST_PARENT_CONTRACT: parentContract,
        EC_BOT_CORE_V78_TEST_HEALTH_ATTEMPTS: '1',
        EC_BOT_CORE_V78_TEST_HEALTH_DELAY_SECONDS: '0'
    };
    const run = (action, additions = {}) => spawnSync('/bin/bash', [wrapper, action, releaseName], {
        env: { ...env, ...additions }, encoding: 'utf8', timeout: 120_000
    });
    const cleanup = () => {
        assert.ok(base.startsWith(`${os.tmpdir()}${path.sep}vitalismen-v78-r4-fixture-`));
        fs.rmSync(base, { recursive: true, force: true });
    };
    return { base, state, logs, marker, rollbackMarker, run, cleanup };
};

test('detector aceita somente URL física ou lógica oficiais com realpath correto',
    { skip: !enabled }, async () => {
        const physical = path.join(releaseDir,
            'scripts/lib/unified-successor-v202-r4-preload.mjs');
        const { importTargetsSelf } = await import(pathToFileURL(physical).href);
        assert.equal(importTargetsSelf(physical), false);
        assert.equal(importTargetsSelf(pathToFileURL(physical).href), true);
        assert.equal(importTargetsSelf('file:///tmp/arbitrary/unified-successor-v202-r4-preload.mjs'), false);
        const logical = 'file:///opt/vitalismen-automacao/current/scripts/lib/unified-successor-v202-r4-preload.mjs';
        assert.throws(() => importTargetsSelf(logical), /R4_LOGICAL_CURRENT_REALPATH_INVALID/);
        const original = fs.realpathSync;
        fs.realpathSync = value => {
            if (value === '/opt/vitalismen-automacao/current') return releaseDir;
            if (value === '/opt/vitalismen-automacao/current/scripts/lib/unified-successor-v202-r4-preload.mjs') return physical;
            return original(value);
        };
        try { assert.equal(importTargetsSelf(logical), true); }
        finally { fs.realpathSync = original; }
    });

test('wrapper R4 executa plan, bundle, permit, consumo e health só com PM2 sintético',
    { skip: !enabled, timeout: 180_000 }, () => {
        const f = fixture();
        try {
            const plan = f.run('plan');
            assert.equal(plan.status, 0, `${plan.stdout}\n${plan.stderr}`);
            assert.match(plan.stdout, /EC_BOT_CORE_V78_PLAN=PASS/);
            const authorize = f.run('authorize', {
                EC_BOT_CORE_V78_AUTHORIZE: 'I_UNDERSTAND_EC_BOT_CORE_V78'
            });
            assert.equal(authorize.status, 0, `${authorize.stdout}\n${authorize.stderr}`);
            assert.match(authorize.stdout, /EC_BOT_CORE_V78_AUTHORIZATION=READY/);
            for (const name of ['ec-bot-core-v78.env', 'ec-bot-core-v78-attestation.json',
                'ec-bot-core-v78-permit.json']) {
                assert.ok(fs.existsSync(path.join(f.state, name)), name);
            }
            const activate = f.run('activate');
            assert.equal(activate.status, 0, `${activate.stdout}\n${activate.stderr}`);
            assert.match(activate.stdout, /EC_BOT_CORE_V78_ACTIVATION=PASS/);
            assert.ok(fs.existsSync(path.join(f.state, 'ec-bot-core-v78-permit.consumed.json')));
            assert.equal(fs.existsSync(path.join(f.state, 'ec-bot-core-v78-permit.json')), false);
            assert.ok(fs.existsSync(f.marker));
            assert.equal(fs.existsSync(f.rollbackMarker), false);
        } finally { f.cleanup(); }
    });

test('falha após restart sintético chama rollback e não consome permit',
    { skip: !enabled, timeout: 180_000 }, () => {
        const f = fixture({ failAfterRestart: true });
        try {
            const authorize = f.run('authorize', {
                EC_BOT_CORE_V78_AUTHORIZE: 'I_UNDERSTAND_EC_BOT_CORE_V78'
            });
            assert.equal(authorize.status, 0, `${authorize.stdout}\n${authorize.stderr}`);
            const activate = f.run('activate');
            assert.notEqual(activate.status, 0);
            assert.match(activate.stderr, /V201_AUTO_ROLLBACK=PASS/);
            assert.ok(fs.existsSync(f.rollbackMarker));
            assert.equal(fs.existsSync(path.join(f.state, 'ec-bot-core-v78-permit.consumed.json')),
                false);
        } finally { f.cleanup(); }
    });
