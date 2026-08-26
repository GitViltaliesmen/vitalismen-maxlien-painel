import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperPath = path.join(projectRoot, 'ops', 'vitalismen-stage');
const bashPath = process.platform === 'win32'
    ? 'C:\\Program Files\\Git\\bin\\bash.exe'
    : '/bin/bash';
const oldReleaseName = '20260826T054900Z_production-20260826-cc85952';
const oldCommit = `cc85952${'0'.repeat(33)}`;
const candidateReleaseName = '20260826T120000Z_production-20260826-66a1b2c';
const candidateCommit = `66a1b2c${'1'.repeat(33)}`;
const safeRollbackName = '20260826T040000Z_production-20260826-aabbccd';
const safeRollbackCommit = `aabbccd${'2'.repeat(33)}`;

const safeHealth = Object.freeze({
    status: 'online',
    degradedReasons: [],
    automationSafety: {
        mode: 'SAFE_OBSERVATION_ONLY',
        operationalMutationsEnabled: false,
        compatibilityBridgeComplete: false,
        dropiSyncMode: 'REPORT_ONLY',
        dropiApplyAllowed: false
    }
});

function toBashPath(value) {
    const normalized = path.resolve(value).replaceAll('\\', '/');
    if (process.platform !== 'win32') return normalized;
    return normalized.replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
}

function writeExecutable(file, content) {
    fs.writeFileSync(file, content.replace(/^\n/, ''), { encoding: 'utf8', mode: 0o700 });
    fs.chmodSync(file, 0o700);
}

function writeJson(file, value, mode = 0o600) {
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode });
    fs.chmodSync(file, mode);
}

function releaseMetadata({ releaseName, commit, compatibility = 'PASS', runtimeVersion = 66 }) {
    return {
        repository: 'GitViltaliesmen/vitalismen-maxlien-painel',
        branch: 'production',
        commit,
        tag: `production-20260826-${commit.slice(0, 7)}`,
        createdAt: '2026-08-26T12:00:00.000Z',
        releaseName,
        testCompatibility: compatibility,
        postSaleCompatibility: {
            runtimeVersion,
            readsDataCompatibilityThrough: runtimeVersion,
            writesDataCompatibilityVersion: runtimeVersion,
            requiresRollbackTargetPreflight: true
        }
    };
}

function createRelease(fixture, { releaseName, commit, compatibility = 'PASS', candidate = false }) {
    const releaseDir = path.join(fixture.releasesDir, releaseName);
    fs.mkdirSync(releaseDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(releaseDir, 0o700);
    writeJson(path.join(releaseDir, '.release-source.json'), releaseMetadata({
        releaseName,
        commit,
        compatibility,
        runtimeVersion: compatibility === 'SAFE' ? 66 : 66
    }));
    fs.writeFileSync(path.join(releaseDir, '.env'), 'MONGODB_URI=mongodb://synthetic.invalid/vitalismen\nSECRET_FOR_TEST=redacted\n', { mode: 0o600 });
    fs.chmodSync(path.join(releaseDir, '.env'), 0o600);

    if (candidate) {
        writeJson(path.join(releaseDir, '.staging-complete.json'), {
            status: 'complete',
            commit,
            tag: `production-20260826-${commit.slice(0, 7)}`,
            completedAt: '2026-08-26T12:01:00.000Z',
            currentUnchanged: true,
            pm2Unchanged: true,
            postSaleCompatibilityPreflight: 'PASS_SAFE_BOOT',
            v66SafeObservationRequired: true,
            stdoutSensitiveData: 'redacted'
        });
        fs.mkdirSync(path.join(releaseDir, 'docs', 'freeze'), { recursive: true });
        fs.mkdirSync(path.join(releaseDir, 'scripts'), { recursive: true });
        writeJson(path.join(releaseDir, 'docs', 'freeze', 'post-sale-safety-v66-20260826.json'), {
            status: 'implementation_validated'
        });
        fs.writeFileSync(path.join(releaseDir, 'scripts', 'assert-post-sale-data-compatibility-v66.mjs'), '// synthetic harness\n');
        fs.writeFileSync(path.join(releaseDir, 'scripts', 'guard-post-sale-safety-v66.mjs'), '// synthetic harness\n');
    }
    return releaseDir;
}

function createFixture(initialStatus = 'stopped') {
    assert.ok(fs.existsSync(bashPath), `bash de teste ausente: ${bashPath}`);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-stage-v66-'));
    const baseDir = path.join(root, 'opt', 'vitalismen-automacao');
    const releasesDir = path.join(baseDir, 'releases');
    const stateDir = path.join(root, 'state');
    const logDir = path.join(root, 'log');
    const mocksDir = path.join(root, 'mocks');
    const commandLog = path.join(root, 'mock-commands.jsonl');
    const pm2StateFile = path.join(root, 'pm2-state.json');
    const currentFile = path.join(baseDir, 'current');
    fs.mkdirSync(releasesDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(logDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(mocksDir, { recursive: true, mode: 0o700 });

    const fixture = {
        root, baseDir, releasesDir, stateDir, logDir, mocksDir,
        commandLog, pm2StateFile, currentFile
    };
    fixture.oldDir = createRelease(fixture, {
        releaseName: oldReleaseName,
        commit: oldCommit,
        compatibility: 'UNSAFE'
    });
    fixture.candidateDir = createRelease(fixture, {
        releaseName: candidateReleaseName,
        commit: candidateCommit,
        compatibility: 'PASS',
        candidate: true
    });
    fs.writeFileSync(currentFile, `${toBashPath(fixture.oldDir)}\n`, 'utf8');
    writeJson(pm2StateFile, {
        status: initialStatus,
        pid: initialStatus === 'online' ? 3131 : 0,
        restart_time: 101,
        env: {},
        providerCalls: 0,
        productionMutationCalls: 0,
        bridgeCalls: 0
    });

    const mockPm2 = path.join(mocksDir, 'pm2.mjs');
    const mockReadlink = path.join(mocksDir, 'readlink.mjs');
    const mockLn = path.join(mocksDir, 'ln.mjs');
    const mockCurl = path.join(mocksDir, 'curl.mjs');
    const mockCompatibility = path.join(mocksDir, 'compatibility.mjs');
    const mockGuard = path.join(mocksDir, 'guard.mjs');
    const mockFlock = path.join(mocksDir, 'flock.sh');
    const mockSleep = path.join(mocksDir, 'sleep.sh');

    writeExecutable(mockPm2, String.raw`#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const stateFile = process.env.FAKE_PM2_STATE;
const currentFile = process.env.FAKE_CURRENT_FILE;
const logFile = process.env.FAKE_COMMAND_LOG;
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const args = process.argv.slice(2);
const action = args[0] || '';
const current = () => fs.readFileSync(currentFile, 'utf8').trim();
const posix = (value) => String(value).replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase());
const record = (value) => fs.appendFileSync(logFile, JSON.stringify(value) + '\n');
const persist = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
if (action === 'jlist') {
  process.stdout.write(JSON.stringify([{
    name: 'vitalismen-automation',
    pid: state.pid,
    pm2_env: {
      ...state.env,
      status: state.status,
      restart_time: state.restart_time,
      pm_cwd: posix(process.env.FAKE_PM_CWD),
      pm_exec_path: posix(process.env.FAKE_PM_EXEC_PATH)
    }
  }]));
  process.exit(0);
}
if (action === 'pid') {
  process.stdout.write(String(state.pid) + '\n');
  process.exit(0);
}
if (action === 'start' || action === 'restart') {
  const safeKeys = [
    'VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED', 'VIT_POWER_FUNNEL_ACTIVE',
    'WHATSAPP_AUTO_REPLY_ENABLED', 'ZAPI_ROUTE_INBOUND_TO_BOT', 'WHATSAPP_FUNNEL_ENABLED',
    'DISABLE_SCHEDULER', 'SHIPMENT_STATUS_DISPATCH_ENABLED',
    'SHIPMENT_PICKUP_REMINDERS_ENABLED', 'WHATSAPP_PRODUCT_FOLLOWUP_ENABLED',
    'PENDING_CHECKOUT_FOLLOWUP_ENABLED', 'ADMIN_BUY_LATER_FOLLOWUP_ENABLED',
    'POST_SALE_REPURCHASE_30D_ENABLED', 'EC_ENGAGEMENT_AUTO_REPLY_ENABLED',
    'PICKUP_PROOF_SWEEP_ENABLED', 'DROPPI_EC_ACTIVE_SYNC_ENABLED',
    'DROPPI_EC_ACTIVE_SYNC_MODE', 'POST_SALE_V66_MUTATIONS_ENABLED',
    'POST_SALE_V66_MUTATIONS_AUTHORIZATION', 'POST_SALE_V66_COMPATIBILITY_BRIDGE_READY',
    'POST_SALE_V66_BRIDGE_APPLY_APPROVED'
  ];
  state.env = Object.fromEntries(safeKeys.map((key) => [key, process.env[key] || '']));
  record({ component: 'pm2', action, target: current(), safeEnv: state.env });
  if (process.env.FAKE_START_RESULT === 'fail') {
    state.status = 'stopped';
    state.pid = 0;
    persist();
    process.exit(42);
  }
  state.status = 'online';
  state.pid = 4242;
  persist();
  process.exit(0);
}
if (action === 'stop') {
  record({ component: 'pm2', action: 'stop', target: current() });
  state.status = 'stopped';
  state.pid = 0;
  persist();
  process.exit(0);
}
if (action === 'save') {
  record({ component: 'pm2', action: 'save', target: current() });
  process.exit(0);
}
record({ component: 'pm2', action, args });
process.exit(64);
`);

    writeExecutable(mockReadlink, String.raw`#!/usr/bin/env node
import fs from 'node:fs';
const current = fs.readFileSync(process.env.FAKE_CURRENT_FILE, 'utf8').trim();
process.stdout.write(current + '\n');
`);

    writeExecutable(mockLn, String.raw`#!/usr/bin/env node
import fs from 'node:fs';
const args = process.argv.slice(2);
const target = args.at(-2).replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase());
const destination = args.at(-1);
fs.writeFileSync(destination, target + '\n', { flag: 'wx' });
`);

    writeExecutable(mockCurl, String.raw`#!/usr/bin/env node
import fs from 'node:fs';
const url = process.argv.at(-1);
fs.appendFileSync(process.env.FAKE_COMMAND_LOG, JSON.stringify({ component: 'curl', url }) + '\n');
if (String(url).includes('127.0.0.1')) {
  process.stdout.write(process.env.FAKE_HEALTH_JSON);
} else {
  process.stdout.write('{}');
}
`);

    writeExecutable(mockCompatibility, String.raw`#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const targetMetadata = process.argv[3];
const metadata = JSON.parse(fs.readFileSync(targetMetadata, 'utf8'));
const result = String(metadata.testCompatibility || 'INCONCLUSIVE');
fs.appendFileSync(process.env.FAKE_COMMAND_LOG, JSON.stringify({
  component: 'compatibility',
  target: path.basename(path.dirname(targetMetadata)),
  result
}) + '\n');
if (result === 'PASS' || result === 'SAFE') {
  process.stdout.write('POST_SALE_DATA_COMPATIBILITY=OK\n');
  process.exit(0);
}
process.exit(result === 'UNSAFE' ? 23 : 24);
`);

    writeExecutable(mockGuard, String.raw`#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const candidate = process.argv[2];
fs.appendFileSync(process.env.FAKE_COMMAND_LOG, JSON.stringify({ component: 'guard', candidate: path.basename(candidate) }) + '\n');
if (fs.existsSync(path.join(candidate, '.force-guard-fail'))) process.exit(31);
process.exit(0);
`);
    writeExecutable(mockFlock, '#!/usr/bin/env bash\nexit 0\n');
    writeExecutable(mockSleep, '#!/usr/bin/env bash\nexit 0\n');

    fixture.env = {
        ...process.env,
        VITALISMEN_STAGE_TEST_MODE: 'true',
        VITALISMEN_STAGE_TEST_BASE_DIR: toBashPath(baseDir),
        VITALISMEN_STAGE_TEST_STATE_DIR: toBashPath(stateDir),
        VITALISMEN_STAGE_TEST_LOG_DIR: toBashPath(logDir),
        VITALISMEN_STAGE_NODE_CMD: toBashPath(process.execPath),
        VITALISMEN_STAGE_PM2_CMD: toBashPath(mockPm2),
        VITALISMEN_STAGE_CURL_CMD: toBashPath(mockCurl),
        VITALISMEN_STAGE_READLINK_CMD: toBashPath(mockReadlink),
        VITALISMEN_STAGE_LN_CMD: toBashPath(mockLn),
        VITALISMEN_STAGE_MV_CMD: '/usr/bin/mv',
        VITALISMEN_STAGE_UNLINK_CMD: '/usr/bin/rm',
        VITALISMEN_STAGE_ENV_CMD: '/usr/bin/env',
        VITALISMEN_STAGE_SLEEP_CMD: toBashPath(mockSleep),
        VITALISMEN_STAGE_SHA256_CMD: '/usr/bin/sha256sum',
        VITALISMEN_STAGE_COMPATIBILITY_RUNNER: toBashPath(mockCompatibility),
        VITALISMEN_STAGE_GUARD_RUNNER: toBashPath(mockGuard),
        VITALISMEN_STAGE_FLOCK_CMD: toBashPath(mockFlock),
        VITALISMEN_STAGE_HEALTH_ATTEMPTS: '1',
        VITALISMEN_STAGE_OFFICIAL_HEALTH_URL: 'https://official.invalid/api/health/',
        VITALISMEN_STAGE_OFFICIAL_PANEL_URL: 'https://official.invalid/n/',
        VITALISMEN_STAGE_LOCAL_HEALTH_URL: 'http://127.0.0.1:3001/api/health/',
        FAKE_PM2_STATE: pm2StateFile,
        FAKE_CURRENT_FILE: currentFile,
        FAKE_COMMAND_LOG: commandLog,
        FAKE_PM_CWD: `${toBashPath(baseDir)}/current`,
        FAKE_PM_EXEC_PATH: `${toBashPath(baseDir)}/current/src/index.js`,
        FAKE_HEALTH_JSON: JSON.stringify(safeHealth)
    };
    return fixture;
}

function invoke(fixture, args, extraEnv = {}) {
    const result = spawnSync(bashPath, [helperPath, ...args], {
        cwd: projectRoot,
        env: { ...fixture.env, ...extraEnv },
        encoding: 'utf8',
        timeout: 30_000
    });
    return {
        ...result,
        combined: `${result.stdout || ''}${result.stderr || ''}`
    };
}

function createPermit(fixture) {
    const now = Date.now();
    writeJson(path.join(fixture.stateDir, 'activate-permit.json'), {
        version: 1,
        status: 'authorized',
        singleUse: true,
        createdAt: new Date(now - 1_000).toISOString(),
        expiresAt: new Date(now + 10 * 60_000).toISOString(),
        release: candidateReleaseName,
        commit: candidateCommit,
        tag: `production-20260826-${candidateCommit.slice(0, 7)}`,
        rollback: oldReleaseName,
        currentExpected: oldReleaseName
    });
}

function readState(fixture) {
    return JSON.parse(fs.readFileSync(fixture.pm2StateFile, 'utf8'));
}

function currentTarget(fixture) {
    return fs.readFileSync(fixture.currentFile, 'utf8').trim();
}

function commands(fixture) {
    if (!fs.existsSync(fixture.commandLog)) return [];
    return fs.readFileSync(fixture.commandLog, 'utf8')
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

function pm2Mutations(fixture) {
    return commands(fixture).filter((entry) => entry.component === 'pm2');
}

function oldRuntimeStartCalls(fixture) {
    return pm2Mutations(fixture).filter((entry) =>
        ['start', 'restart', 'reload', 'resurrect'].includes(entry.action)
        && entry.target === toBashPath(fixture.oldDir)
    );
}

function digestTree(paths) {
    const hash = crypto.createHash('sha256');
    const visit = (target, relative = '') => {
        if (!fs.existsSync(target)) return;
        const stat = fs.statSync(target);
        hash.update(`${relative}:${stat.isDirectory() ? 'd' : 'f'}\n`);
        if (stat.isDirectory()) {
            for (const name of fs.readdirSync(target).sort()) visit(path.join(target, name), path.join(relative, name));
        } else {
            hash.update(fs.readFileSync(target));
        }
    };
    for (const target of paths) visit(target, path.basename(target));
    return hash.digest('hex');
}

function prepare(fixture) {
    const result = invoke(fixture, ['v66-preflight', candidateReleaseName]);
    assert.equal(result.status, 0, result.combined);
    assert.match(result.stdout, /V66_PREFLIGHT=PASS/);
    return result;
}

function cleanupFixture(t, fixture) {
    t.after(() => {
        assert.ok(path.basename(fixture.root).startsWith('vitalismen-stage-v66-'));
        fs.rmSync(fixture.root, { recursive: true, force: true });
    });
}

test('dry-run/plan é read-only e planeja somente startup da candidata', (t) => {
    const fixture = createFixture('stopped');
    cleanupFixture(t, fixture);
    const before = digestTree([fixture.baseDir, fixture.stateDir, fixture.logDir]);
    const result = invoke(fixture, ['v66-plan', candidateReleaseName]);
    const after = digestTree([fixture.baseDir, fixture.stateDir, fixture.logDir]);
    assert.equal(result.status, 0, result.combined);
    assert.equal(after, before, 'plan alterou árvore operacional sintética');
    assert.match(result.stdout, /INITIAL_STATE=STOPPED_CONTAINMENT/);
    assert.match(result.stdout, /ACTION_START_CANDIDATE=PLANNED/);
    assert.match(result.stdout, /ACTION_START_OLD_RUNTIME=NEVER/);
    assert.match(result.stdout, /DRY_RUN_WRITES=0/);
    assert.equal(pm2Mutations(fixture).length, 0);
});

test('cenário 1: old runtime ONLINE, candidata inicia com sucesso sem fallback antigo', (t) => {
    const fixture = createFixture('online');
    cleanupFixture(t, fixture);
    prepare(fixture);
    createPermit(fixture);
    const result = invoke(fixture, ['v66-activate-safe', candidateReleaseName]);
    assert.equal(result.status, 0, result.combined);
    assert.match(result.stdout, /SOURCE_HEALTH=OK/);
    assert.match(result.stdout, /V66_ACTIVATION=SUCCESS_SAFE_OBSERVATION_ONLY/);
    assert.equal(currentTarget(fixture), toBashPath(fixture.candidateDir));
    assert.equal(readState(fixture).status, 'online');
    assert.equal(oldRuntimeStartCalls(fixture).length, 0);
    const startup = pm2Mutations(fixture).find((entry) => entry.action === 'restart');
    assert.equal(startup.target, toBashPath(fixture.candidateDir));
    assert.equal(startup.safeEnv.DROPPI_EC_ACTIVE_SYNC_MODE, 'REPORT_ONLY');
    assert.equal(startup.safeEnv.DISABLE_SCHEDULER, '1');
    const ordered = commands(fixture);
    const startupIndex = ordered.findIndex((entry) => entry.component === 'pm2' && entry.action === 'restart');
    const lastPreSwitchCompatibility = ordered
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry, index }) => index < startupIndex && entry.component === 'compatibility')
        .at(-1);
    assert.ok(lastPreSwitchCompatibility, 'compatibility preflight não precedeu startup');
});

test('cenário 2 e caminho de sucesso: old STOPPED/PID 0 aceita health indisponível e inicia V66 safe', (t) => {
    const fixture = createFixture('stopped');
    cleanupFixture(t, fixture);
    prepare(fixture);
    createPermit(fixture);
    const result = invoke(fixture, ['v66-activate-safe', candidateReleaseName]);
    assert.equal(result.status, 0, result.combined);
    assert.match(result.stdout, /SOURCE_HEALTH=SKIPPED_EXPECTED_CONTAINMENT/);
    assert.match(result.stdout, /MUTATING_SCHEDULERS_REGISTERED=0/);
    assert.equal(currentTarget(fixture), toBashPath(fixture.candidateDir));
    const state = readState(fixture);
    assert.equal(state.status, 'online');
    assert.equal(state.pid, 4242);
    assert.equal(state.providerCalls, 0);
    assert.equal(state.productionMutationCalls, 0);
    assert.equal(state.bridgeCalls, 0);
    assert.equal(state.env.POST_SALE_V66_MUTATIONS_ENABLED, 'false');
    assert.equal(state.env.POST_SALE_V66_MUTATIONS_AUTHORIZATION, '');
    assert.equal(state.env.POST_SALE_V66_COMPATIBILITY_BRIDGE_READY, 'false');
    assert.equal(state.env.POST_SALE_V66_BRIDGE_APPLY_APPROVED, '');
    assert.equal(state.env.DROPPI_EC_ACTIVE_SYNC_MODE, 'REPORT_ONLY');
    assert.equal(oldRuntimeStartCalls(fixture).length, 0);
});

test('cenário 3: falha antes do symlink é fail-closed e não consome baseline', (t) => {
    const fixture = createFixture('stopped');
    cleanupFixture(t, fixture);
    prepare(fixture);
    createPermit(fixture);
    fs.writeFileSync(path.join(fixture.candidateDir, '.force-guard-fail'), 'fail\n');
    const result = invoke(fixture, ['v66-activate-safe', candidateReleaseName]);
    assert.notEqual(result.status, 0);
    assert.match(result.combined, /manifesto\/guard V66 falhou/);
    assert.equal(currentTarget(fixture), toBashPath(fixture.oldDir));
    assert.equal(readState(fixture).status, 'stopped');
    assert.equal(pm2Mutations(fixture).length, 0);
    assert.equal(oldRuntimeStartCalls(fixture).length, 0);
});

test('cenário 4 e incidente exato: startup V66 falha após symlink, cc85952 UNSAFE não é iniciado', (t) => {
    const fixture = createFixture('stopped');
    cleanupFixture(t, fixture);
    prepare(fixture);
    createPermit(fixture);
    const result = invoke(fixture, ['v66-activate-safe', candidateReleaseName], { FAKE_START_RESULT: 'fail' });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /V66_ACTIVATION=CONTAINED/);
    assert.match(result.stdout, /CANDIDATE_STOPPED=YES/);
    assert.match(result.stdout, /SYMLINK_ROLLBACK_EXECUTED=restored_without_runtime_start/);
    assert.match(result.stdout, /RUNTIME_ROLLBACK_EXECUTED=NO/);
    assert.match(result.stdout, /RUNTIME_ROLLBACK_BLOCKED_REASON=UNSAFE_OR_NOT_SUPPORTED/);
    assert.match(result.stdout, /OLD_RUNTIME_STARTED=NO/);
    assert.match(result.stdout, /FINAL_PM2_STATE=stopped/);
    assert.equal(currentTarget(fixture), toBashPath(fixture.oldDir));
    const state = readState(fixture);
    assert.equal(state.status, 'stopped');
    assert.equal(state.pid, 0);
    assert.equal(state.providerCalls, 0);
    assert.equal(state.productionMutationCalls, 0);
    assert.equal(state.bridgeCalls, 0);
    assert.equal(oldRuntimeStartCalls(fixture).length, 0);
    assert.ok(pm2Mutations(fixture).some((entry) => entry.action === 'stop'));
    assert.ok(!pm2Mutations(fixture).some((entry) => entry.action === 'save'));
    const audit = fs.readFileSync(path.join(fixture.logDir, 'vitalismen-stage-v66-audit.jsonl'), 'utf8');
    assert.match(audit, /"event":"activation_contained"/);
    assert.match(audit, /"rollbackTargetCompatibility":"UNSAFE_OR_NOT_SUPPORTED"/);
    assert.match(audit, /"oldRuntimeStarted":"no"/);
    assert.doesNotMatch(audit, /mongodb:\/\/|SECRET_FOR_TEST/);
});

test('cenário 5: rollback target UNSAFE é bloqueado sem qualquer ação PM2', (t) => {
    const fixture = createFixture('stopped');
    cleanupFixture(t, fixture);
    const result = invoke(fixture, ['v66-rollback-plan', candidateReleaseName, oldReleaseName]);
    assert.equal(result.status, 0, result.combined);
    assert.match(result.stdout, /ROLLBACK_TARGET_COMPATIBILITY=UNSAFE_OR_NOT_SUPPORTED/);
    assert.match(result.stdout, /RUNTIME_ROLLBACK_EXECUTION=BLOCKED/);
    assert.match(result.stdout, /OLD_RUNTIME_STARTED=NO/);
    assert.equal(pm2Mutations(fixture).length, 0);
});

test('cenário 6: rollback target SAFE exige autorização separada e não executa fallback', (t) => {
    const fixture = createFixture('stopped');
    cleanupFixture(t, fixture);
    createRelease(fixture, {
        releaseName: safeRollbackName,
        commit: safeRollbackCommit,
        compatibility: 'SAFE'
    });
    const result = invoke(fixture, ['v66-rollback-plan', candidateReleaseName, safeRollbackName]);
    assert.equal(result.status, 0, result.combined);
    assert.match(result.stdout, /ROLLBACK_TARGET_COMPATIBILITY=SAFE/);
    assert.match(result.stdout, /RUNTIME_ROLLBACK_EXECUTION=REQUIRES_SEPARATE_EXPLICIT_AUTHORIZATION/);
    assert.match(result.stdout, /PM2_ACTIONS=0/);
    assert.equal(pm2Mutations(fixture).length, 0);
    assert.equal(oldRuntimeStartCalls(fixture).length, 0);
});

test('contain para somente o processo nomeado e preserva current e dados', (t) => {
    const fixture = createFixture('online');
    cleanupFixture(t, fixture);
    const result = invoke(fixture, ['v66-contain']);
    assert.equal(result.status, 0, result.combined);
    assert.match(result.stdout, /V66_CONTAINMENT=COMPLETE/);
    assert.match(result.stdout, /FINAL_PID=0/);
    assert.match(result.stdout, /OLD_RUNTIME_STARTED=NO/);
    assert.equal(currentTarget(fixture), toBashPath(fixture.oldDir));
    const state = readState(fixture);
    assert.equal(state.status, 'stopped');
    assert.equal(state.pid, 0);
    assert.equal(state.providerCalls, 0);
    assert.equal(state.productionMutationCalls, 0);
    assert.deepEqual(pm2Mutations(fixture).map((entry) => entry.action), ['stop']);
});

test('metadata V66 ausente bloqueia antes do symlink', (t) => {
    const fixture = createFixture('stopped');
    cleanupFixture(t, fixture);
    const sourcePath = path.join(fixture.candidateDir, '.release-source.json');
    const metadata = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    delete metadata.postSaleCompatibility;
    writeJson(sourcePath, metadata);
    const result = invoke(fixture, ['v66-plan', candidateReleaseName]);
    assert.notEqual(result.status, 0);
    assert.match(result.combined, /metadata V66 inválida/);
    assert.equal(currentTarget(fixture), toBashPath(fixture.oldDir));
    assert.equal(pm2Mutations(fixture).length, 0);
});

test('overlay safe alterado bloqueia antes do symlink e preserva permit', (t) => {
    const fixture = createFixture('stopped');
    cleanupFixture(t, fixture);
    prepare(fixture);
    createPermit(fixture);
    fs.appendFileSync(path.join(fixture.candidateDir, '.env.v66-safe-observation'), 'DROPPI_EC_ACTIVE_SYNC_MODE=APPLY\n');
    const result = invoke(fixture, ['v66-activate-safe', candidateReleaseName]);
    assert.notEqual(result.status, 0);
    assert.match(result.combined, /overlay safe foi alterado/);
    assert.equal(currentTarget(fixture), toBashPath(fixture.oldDir));
    assert.equal(pm2Mutations(fixture).length, 0);
    assert.ok(fs.existsSync(path.join(fixture.stateDir, 'activate-permit.json')));
});
