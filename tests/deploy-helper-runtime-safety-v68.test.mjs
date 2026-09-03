import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    analyzeRunProtectedContract,
    assertRunProtectedContract,
    expectedRunProtectedLabelsV68,
    removeRunProtectedDefinition
} from '../scripts/lib/deploy-helper-contract-v68.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperPath = path.join(projectRoot, 'ops', 'vitalismen-stage');
const freezeDir = path.join(projectRoot, 'docs', 'freeze');
const runtimeV68 = 'src/services/deployHelperRuntimeSafetyFreezeRuntimeGuardV68.js';
const runtimeV67 = 'src/services/runtimeGuardChainFreezeRuntimeGuardV67.js';
const bashPath = process.platform === 'win32'
    ? 'C:\\Program Files\\Git\\bin\\bash.exe'
    : '/bin/bash';

const toBashPath = (value) => {
    const normalized = path.resolve(value).replaceAll('\\', '/');
    if (process.platform !== 'win32') return normalized;
    return normalized.replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
};

const writeExecutable = (file, content) => {
    fs.writeFileSync(file, content.replace(/^\n/, ''), { encoding: 'utf8', mode: 0o700 });
    fs.chmodSync(file, 0o700);
};

const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, {
        cwd: options.cwd || projectRoot,
        env: options.env || process.env,
        encoding: 'utf8',
        timeout: options.timeout || 120000
    });
    assert.equal(
        result.status,
        0,
        `${command} ${args.join(' ')} falhou:\n${result.stdout || ''}\n${result.stderr || ''}`
    );
    return result;
};

function createLocalRepository(root) {
    const repository = path.join(root, 'source-repository');
    fs.mkdirSync(repository, { recursive: true });
    run('git', ['init', repository]);
    run('git', ['-C', repository, 'checkout', '-b', 'production']);
    run('git', ['-C', repository, 'config', 'user.name', 'Vitalismen V68 Test']);
    run('git', ['-C', repository, 'config', 'user.email', 'v68-test@invalid.local']);
    fs.writeFileSync(path.join(repository, 'README.synthetic.md'), 'synthetic stage source\n');
    run('git', ['-C', repository, 'add', 'README.synthetic.md']);
    run('git', ['-C', repository, 'commit', '-m', 'test: synthetic stage source']);
    const commit = run('git', ['-C', repository, 'rev-parse', 'HEAD']).stdout.trim().toLowerCase();
    const tag = `production-20260827-${commit.slice(0, 7)}`;
    run('git', ['-C', repository, 'tag', '-a', tag, '-m', 'synthetic V68 stage']);
    return { repository, commit, tag };
}

function createStageFixture(t, { helper = helperPath, gitCommand = 'git' } = {}) {
    assert.ok(fs.existsSync(bashPath), `bash de teste ausente: ${bashPath}`);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-stage-v68-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const baseDir = path.join(root, 'opt', 'vitalismen-automacao');
    const releasesDir = path.join(baseDir, 'releases');
    const stateDir = path.join(root, 'state');
    const logDir = path.join(root, 'log');
    const mocksDir = path.join(root, 'mocks');
    const oldDir = path.join(releasesDir, '20260826T215201Z_production-20260826-c97c298');
    const mockLog = path.join(root, 'mock-commands.log');
    for (const directory of [releasesDir, stateDir, logDir, mocksDir, oldDir]) {
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(path.join(oldDir, '.env'), 'MONGODB_URI=mongodb://synthetic.invalid/vitalismen\n', { mode: 0o600 });
    const source = createLocalRepository(root);
    const releaseName = `20260827T120000Z_${source.tag}`;
    const releaseDir = path.join(releasesDir, releaseName);

    const mockPm2 = path.join(mocksDir, 'pm2.sh');
    const mockReadlink = path.join(mocksDir, 'readlink.sh');
    const mockNode = path.join(mocksDir, 'node.sh');
    const mockNpm = path.join(mocksDir, 'npm.sh');
    const mockFlock = path.join(mocksDir, 'flock.sh');
    writeExecutable(mockPm2, String.raw`#!/usr/bin/env bash
if [[ "$1" == "pid" ]]; then printf '0\n'; exit 0; fi
printf 'pm2|%s\n' "$*" >>"$V68_MOCK_LOG"
exit 64
`);
    writeExecutable(mockReadlink, String.raw`#!/usr/bin/env bash
printf '%s\n' "$V68_CURRENT_TARGET"
`);
    writeExecutable(mockNode, String.raw`#!/usr/bin/env bash
if [[ "$1" == "-" || "$1" == "-e" ]]; then
  exec "$V68_REAL_NODE" "$@"
fi
printf 'node|%s\n' "$*" >>"$V68_MOCK_LOG"
exit 0
`);
    writeExecutable(mockNpm, String.raw`#!/usr/bin/env bash
printf 'npm|%s\n' "$*" >>"$V68_MOCK_LOG"
exit 0
`);
    writeExecutable(mockFlock, '#!/usr/bin/env bash\nexit 0\n');

    const env = {
        ...process.env,
        VITALISMEN_STAGE_TEST_MODE: 'true',
        VITALISMEN_STAGE_TEST_BASE_DIR: toBashPath(baseDir),
        VITALISMEN_STAGE_TEST_STATE_DIR: toBashPath(stateDir),
        VITALISMEN_STAGE_TEST_LOG_DIR: toBashPath(logDir),
        VITALISMEN_STAGE_TEST_REPO_URL: process.platform === 'win32'
            ? path.resolve(source.repository).replaceAll('\\', '/')
            : toBashPath(source.repository),
        VITALISMEN_STAGE_NODE_CMD: toBashPath(mockNode),
        VITALISMEN_STAGE_PM2_CMD: toBashPath(mockPm2),
        VITALISMEN_STAGE_CURL_CMD: '/usr/bin/true',
        VITALISMEN_STAGE_READLINK_CMD: toBashPath(mockReadlink),
        VITALISMEN_STAGE_LN_CMD: '/usr/bin/ln',
        VITALISMEN_STAGE_MV_CMD: '/usr/bin/mv',
        VITALISMEN_STAGE_UNLINK_CMD: '/usr/bin/rm',
        VITALISMEN_STAGE_ENV_CMD: '/usr/bin/env',
        VITALISMEN_STAGE_SLEEP_CMD: '/usr/bin/true',
        VITALISMEN_STAGE_SHA256_CMD: '/usr/bin/sha256sum',
        VITALISMEN_STAGE_GIT_CMD: gitCommand,
        VITALISMEN_STAGE_NPM_CMD: toBashPath(mockNpm),
        VITALISMEN_STAGE_COMPATIBILITY_RUNNER: '/usr/bin/true',
        VITALISMEN_STAGE_GUARD_RUNNER: '/usr/bin/true',
        VITALISMEN_STAGE_FLOCK_CMD: toBashPath(mockFlock),
        VITALISMEN_STAGE_TEST_STAGE_LOCK_FILE: toBashPath(path.join(stateDir, 'stage.lock')),
        VITALISMEN_STAGE_OFFICIAL_HEALTH_URL: 'https://official.invalid/api/health/',
        VITALISMEN_STAGE_OFFICIAL_PANEL_URL: 'https://official.invalid/n/',
        VITALISMEN_STAGE_LOCAL_HEALTH_URL: 'http://127.0.0.1:3001/api/health/',
        V68_CURRENT_TARGET: toBashPath(oldDir),
        V68_REAL_NODE: toBashPath(process.execPath),
        V68_MOCK_LOG: toBashPath(mockLog)
    };
    return {
        root,
        helper,
        env,
        source,
        releaseName,
        releaseDir,
        oldDir,
        stateDir,
        logDir,
        mockLog,
        mocksDir
    };
}

const invokeStage = (fixture) => {
    const result = spawnSync(
        bashPath,
        [toBashPath(fixture.helper), 'stage', fixture.source.tag, fixture.releaseName],
        { cwd: projectRoot, env: fixture.env, encoding: 'utf8', timeout: 120000 }
    );
    return { ...result, combined: `${result.stdout || ''}${result.stderr || ''}` };
};

const invokeUnit = (fixture, args) => {
    const script = 'source "$1"; shift; run_protected "$@"';
    const result = spawnSync(
        bashPath,
        ['-c', script, 'v68-unit', toBashPath(fixture.helper), ...args],
        {
            cwd: projectRoot,
            env: { ...fixture.env, VITALISMEN_STAGE_TEST_SOURCE_ONLY: 'true' },
            encoding: 'utf8',
            timeout: 30000
        }
    );
    return { ...result, combined: `${result.stdout || ''}${result.stderr || ''}` };
};

const readAudit = (fixture) => {
    const audit = path.join(fixture.logDir, 'vitalismen-stage-operations.jsonl');
    if (!fs.existsSync(audit)) return [];
    return fs.readFileSync(audit, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
};

const cleanEnvironment = () => {
    const allowed = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP'];
    return {
        ...Object.fromEntries(allowed.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]])),
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'false',
        WHATSAPP_FUNNEL_ENABLED: 'false',
        POST_SALE_V66_MUTATIONS_ENABLED: 'false',
        DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
        DISABLE_SCHEDULER: '1'
    };
};

function createGuardSnapshot(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-guard-v68-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const manifests = fs.readdirSync(freezeDir).filter((file) => file.endsWith('.json'));
    const files = new Set();
    for (const file of manifests) {
        const relative = path.posix.join('docs/freeze', file);
        files.add(relative);
        const manifest = JSON.parse(fs.readFileSync(path.join(freezeDir, file), 'utf8'));
        for (const protectedFile of Object.keys(manifest.protectedFiles || {})) files.add(protectedFile);
    }
    for (const relative of files) {
        const source = path.join(projectRoot, relative);
        if (!fs.existsSync(source)) continue;
        const target = path.join(root, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
    }
    return root;
}

const runGuard = (cwd, runtime) => spawnSync(
    process.execPath,
    [runtime],
    { cwd, env: cleanEnvironment(), encoding: 'utf8', timeout: 120000 }
);

test('contrato estático resolve uma definição antes dos 17 sites sem shell reparse', () => {
    const source = fs.readFileSync(helperPath, 'utf8');
    const contract = assertRunProtectedContract(source);
    assert.equal(contract.definitions, 1);
    assert.equal(contract.callCount, 17);
    assert.ok(contract.definitionLine < contract.firstCallLine);
    assert.deepEqual(contract.calls.map(({ label }) => label), [...expectedRunProtectedLabelsV68]);
});

test('run_protected preserva sucesso, falha, validação, argumentos e audit sanitizado', (t) => {
    const fixture = createStageFixture(t);
    assert.equal(invokeUnit(fixture, ['test-success', '/usr/bin/true']).status, 0);
    assert.notEqual(invokeUnit(fixture, ['test-failure', '/usr/bin/false']).status, 0);
    assert.notEqual(invokeUnit(fixture, ['test-missing', '/definitely/missing/v68-command']).status, 0);
    assert.notEqual(invokeUnit(fixture, ['', '/usr/bin/true']).status, 0);
    assert.notEqual(invokeUnit(fixture, ['missing-command']).status, 0);

    const recorder = path.join(fixture.mocksDir, 'record-args.sh');
    const argsFile = path.join(fixture.root, 'arguments.bin');
    const unexpected = path.join(fixture.root, 'unexpected-file');
    writeExecutable(recorder, String.raw`#!/usr/bin/env bash
output="$1"
shift
printf '%s\0' "$@" >"$output"
`);
    const injection = `; touch ${toBashPath(unexpected)}`;
    const sensitive = 'SENSITIVE_TOKEN_V68_DO_NOT_LOG';
    const argumentResult = invokeUnit(fixture, [
        'test-arguments',
        toBashPath(recorder),
        toBashPath(argsFile),
        'value with spaces',
        injection,
        sensitive
    ]);
    assert.equal(argumentResult.status, 0, argumentResult.combined);
    assert.deepEqual(
        fs.readFileSync(argsFile).toString().split('\0').filter(Boolean),
        ['value with spaces', injection, sensitive]
    );
    assert.equal(fs.existsSync(unexpected), false, 'metacaracteres foram reinterpretados pelo shell');
    const auditText = fs.readFileSync(path.join(fixture.logDir, 'vitalismen-stage-operations.jsonl'), 'utf8');
    assert.doesNotMatch(auditText, /SENSITIVE_TOKEN|touch|value with spaces|record-args/);
    for (const record of readAudit(fixture)) {
        assert.deepEqual(Object.keys(record).sort(), ['exitStatus', 'finishedAt', 'label', 'startedAt']);
    }
});

test('stage sintético atravessa os 17 sites, cria metadata e preserva current/PID', (t) => {
    const fixture = createStageFixture(t);
    const result = invokeStage(fixture);
    assert.equal(result.status, 0, result.combined);
    assert.doesNotMatch(result.combined, /run_protected: command not found/);
    assert.match(result.stdout, /STAGING_OFICIAL_CONCLUIDO/);
    assert.match(result.stdout, /ATIVACAO_EXECUTADA=NAO/);
    const audit = readAudit(fixture);
    assert.deepEqual(audit.map(({ label }) => label), [...expectedRunProtectedLabelsV68]);
    assert.ok(audit.every(({ exitStatus }) => exitStatus === 0));
    assert.equal(fs.existsSync(fixture.releaseDir), true);
    const metadata = JSON.parse(fs.readFileSync(path.join(fixture.releaseDir, '.release-source.json'), 'utf8'));
    const staging = JSON.parse(fs.readFileSync(path.join(fixture.releaseDir, '.staging-complete.json'), 'utf8'));
    assert.equal(metadata.commit, fixture.source.commit);
    assert.equal(metadata.postSaleCompatibility.runtimeVersion, 66);
    assert.equal(staging.currentUnchanged, true);
    assert.equal(staging.pm2Unchanged, true);
    assert.equal(staging.v66SafeObservationRequired, true);
});

test('definição ausente falha no guard e no stage antes das operações seguintes', (t) => {
    const source = fs.readFileSync(helperPath, 'utf8');
    const broken = removeRunProtectedDefinition(source);
    assert.throws(() => assertRunProtectedContract(broken), /definitions deve ser exatamente 1/);
    const brokenHelper = path.join(os.tmpdir(), `vitalismen-stage-v68-missing-${process.pid}-${Date.now()}.sh`);
    fs.writeFileSync(brokenHelper, broken, { mode: 0o700 });
    fs.chmodSync(brokenHelper, 0o700);
    t.after(() => fs.rmSync(brokenHelper, { force: true }));
    const fixture = createStageFixture(t, { helper: brokenHelper });
    const result = invokeStage(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.combined, /run_protected: command not found/);
    assert.equal(readAudit(fixture).length, 0);
    assert.equal(fs.existsSync(fixture.releaseDir), false);
});

test('definição duplicada, fora de ordem e eval são bloqueados estaticamente', () => {
    const source = fs.readFileSync(helperPath, 'utf8');
    const contract = analyzeRunProtectedContract(source);
    const duplicate = `${source}\n${contract.definitionBody}\n`;
    assert.throws(() => assertRunProtectedContract(duplicate), /definitions deve ser exatamente 1/);
    const without = removeRunProtectedDefinition(source);
    const moved = `${without}\n${contract.definitionBody}\n`;
    assert.throws(() => assertRunProtectedContract(moved), /definida antes da primeira chamada/);
    const unsafe = source.replace('if "$@" >"$output_file" 2>&1; then', 'if eval "$*" >"$output_file" 2>&1; then');
    assert.throws(() => assertRunProtectedContract(unsafe), /argumentos não são executados|eval proibido/);
});

test('falha do clone preserva exit não-zero, interrompe sequência e remove release incompleta', (t) => {
    const failingGit = path.join(os.tmpdir(), `vitalismen-v68-git-fail-${process.pid}-${Date.now()}.sh`);
    writeExecutable(failingGit, '#!/usr/bin/env bash\nexit 23\n');
    t.after(() => fs.rmSync(failingGit, { force: true }));
    const fixture = createStageFixture(t, { gitCommand: toBashPath(failingGit) });
    const result = invokeStage(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /GATE_clone=FALHOU/);
    assert.deepEqual(readAudit(fixture).map(({ label, exitStatus }) => ({ label, exitStatus })), [
        { label: 'clone', exitStatus: 23 }
    ]);
    assert.equal(fs.existsSync(fixture.releaseDir), false);
});

test('V68 valida V67 no contexto sucessor e propaga falha ancestral real', (t) => {
    const snapshot = createGuardSnapshot(t);
    const canonical = runGuard(snapshot, runtimeV68);
    assert.equal(canonical.status, 0, `${canonical.stdout}\n${canonical.stderr}`);
    assert.match(canonical.stdout, /DEPLOY-HELPER-RUNTIME-SAFETY-V68/);

    const rawV67 = runGuard(snapshot, runtimeV67);
    assert.equal(rawV67.status, 1, 'V67 crua não deve reconhecer override V68 entre processos');
    assert.match(rawV67.stderr, /RUNTIME-GUARD-CHAIN-V67/);

    const ancestor = path.join(snapshot, 'approved_freezes', 'APPROVED_EC_REPURCHASE_SQLITE_SERIALIZATION_V47_20260822.txt');
    fs.appendFileSync(ancestor, '\nUNDECLARED_V68_TEST_BYTE\n');
    const failed = runGuard(snapshot, runtimeV68);
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /EC-REPURCHASE-SQLITE-V47/);
});

test('manifest V67 permanece byte a byte e V68 mantém compatibilidade de dados 66', () => {
    const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.equal(
        sha256(path.join(freezeDir, 'runtime-guard-chain-v67-20260826.json')),
        'b945b6a4174bac311b95f0c653b2e5c2ec14e310a22826b0e5f3c89f6f905b7c'
    );
    const v68 = JSON.parse(fs.readFileSync(path.join(freezeDir, 'deploy-helper-runtime-safety-v68-20260827.json'), 'utf8'));
    assert.equal(v68.policy.dataCompatibilityVersion, 66);
    assert.equal(v68.policy.minimumRuntimeVersionAfterBridge, 66);
    assert.equal(v68.policy.pm2StartAuthorized, false);
    assert.equal(v68.policy.helperInstallAuthorized, false);
    assert.equal(v68.policy.stagingAuthorized, false);
});
