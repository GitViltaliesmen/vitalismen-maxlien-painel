import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    assertRunProtectedContractV69,
    expectedRunProtectedLabelsV69
} from '../scripts/lib/deploy-stage-source-ref-contract-v69.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperPath = path.join(projectRoot, 'ops', 'vitalismen-stage');
const freezeDir = path.join(projectRoot, 'docs', 'freeze');
const runtimeV69 = 'src/services/deployStageSourceRefSafetyFreezeRuntimeGuardV69.js';
const sourceRef = 'refs/heads/codex/candidate-v69';
const bashPath = process.platform === 'win32'
    ? 'C:\\Program Files\\Git\\bin\\bash.exe'
    : '/bin/bash';

const toBashPath = (value) => {
    const normalized = path.resolve(value).replaceAll('\\', '/');
    if (process.platform !== 'win32') return normalized;
    return normalized.replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
};

const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, {
        cwd: options.cwd || projectRoot,
        env: options.env || process.env,
        encoding: 'utf8',
        timeout: options.timeout || 120000
    });
    assert.equal(result.status, 0, `${command} ${args.join(' ')} falhou:\n${result.stdout || ''}\n${result.stderr || ''}`);
    return result;
};

const writeExecutable = (file, content) => {
    fs.writeFileSync(file, content.replace(/^\n/, ''), { encoding: 'utf8', mode: 0o700 });
    fs.chmodSync(file, 0o700);
};

function createLocalRepository(root) {
    const repository = path.join(root, 'source-repository');
    fs.mkdirSync(repository, { recursive: true });
    run('git', ['init', repository]);
    run('git', ['-C', repository, 'config', 'user.name', 'Vitalismen V69 Test']);
    run('git', ['-C', repository, 'config', 'user.email', 'v69-test@invalid.local']);
    run('git', ['-C', repository, 'checkout', '-b', 'production']);
    fs.writeFileSync(path.join(repository, 'README.synthetic.md'), 'production A\n');
    run('git', ['-C', repository, 'add', 'README.synthetic.md']);
    run('git', ['-C', repository, 'commit', '-m', 'test: production A']);
    const productionCommit = run('git', ['-C', repository, 'rev-parse', 'HEAD']).stdout.trim().toLowerCase();

    run('git', ['-C', repository, 'checkout', '-b', 'codex/candidate-v69']);
    fs.writeFileSync(path.join(repository, 'README.synthetic.md'), 'candidate B\n');
    for (const relative of [
        'docs/freeze/post-sale-safety-v66-20260826.json',
        'docs/freeze/runtime-guard-chain-v67-20260826.json',
        'scripts/assert-post-sale-data-compatibility-v66.mjs',
        'scripts/guard-post-sale-safety-v66.mjs',
        'src/services/runtimeGuardChainFreezeRuntimeGuardV67.js'
    ]) {
        const file = path.join(repository, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '// synthetic V69 contract\n');
    }
    run('git', ['-C', repository, 'add', '.']);
    run('git', ['-C', repository, 'commit', '-m', 'test: candidate B']);
    const candidateCommit = run('git', ['-C', repository, 'rev-parse', 'HEAD']).stdout.trim().toLowerCase();
    const candidateTree = run('git', ['-C', repository, 'rev-parse', 'HEAD^{tree}']).stdout.trim().toLowerCase();

    run('git', ['-C', repository, 'checkout', '-b', 'codex/moved-v69']);
    fs.writeFileSync(path.join(repository, 'README.synthetic.md'), 'candidate C moved\n');
    run('git', ['-C', repository, 'add', 'README.synthetic.md']);
    run('git', ['-C', repository, 'commit', '-m', 'test: candidate C']);
    const movedCommit = run('git', ['-C', repository, 'rev-parse', 'HEAD']).stdout.trim().toLowerCase();
    run('git', ['-C', repository, 'checkout', 'production']);

    return { repository, productionCommit, candidateCommit, candidateTree, movedCommit };
}

function createStageFixture(t, { gitWrapper = true } = {}) {
    assert.ok(fs.existsSync(bashPath), `bash de teste ausente: ${bashPath}`);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-stage-v69-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const baseDir = path.join(root, 'opt', 'vitalismen-automacao');
    const releasesDir = path.join(baseDir, 'releases');
    const stateDir = path.join(root, 'state');
    const logDir = path.join(root, 'log');
    const mocksDir = path.join(root, 'mocks');
    const oldDir = path.join(releasesDir, '20260826T215201Z_production-20260826-c97c298');
    for (const directory of [releasesDir, stateDir, logDir, mocksDir, oldDir]) {
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(path.join(oldDir, '.env'), 'MONGODB_URI=mongodb://synthetic.invalid/vitalismen\n', { mode: 0o600 });
    fs.writeFileSync(path.join(oldDir, '.release-source.json'), '{}\n', { mode: 0o600 });
    const source = createLocalRepository(root);
    const releaseName = `20260827T120000Z_production-20260827-${source.candidateCommit.slice(0, 7)}`;
    const releaseDir = path.join(releasesDir, releaseName);
    const mockLog = path.join(root, 'mock-commands.log');

    const mockPm2 = path.join(mocksDir, 'pm2.sh');
    const mockReadlink = path.join(mocksDir, 'readlink.sh');
    const mockNode = path.join(mocksDir, 'node.sh');
    const mockNpm = path.join(mocksDir, 'npm.sh');
    const mockFlock = path.join(mocksDir, 'flock.sh');
    const mockGit = path.join(mocksDir, 'git.sh');
    const candidateMutatingGit = path.join(mocksDir, 'git-move-candidate.sh');
    const productionMutatingGit = path.join(mocksDir, 'git-move-production.sh');
    writeExecutable(mockPm2, String.raw`#!/usr/bin/env bash
if [[ "$1" == "pid" ]]; then printf '0\n'; exit 0; fi
if [[ "$1" == "jlist" ]]; then
  printf '[{"name":"vitalismen-automation","pid":0,"pm2_env":{"status":"stopped","restart_time":101,"pm_cwd":"%s/current","pm_exec_path":"%s/current/src/index.js"}}]' "$V69_BASE_DIR" "$V69_BASE_DIR"
  exit 0
fi
exit 64
`);
    writeExecutable(mockReadlink, String.raw`#!/usr/bin/env bash
printf '%s\n' "$V69_CURRENT_TARGET"
`);
    writeExecutable(mockNode, String.raw`#!/usr/bin/env bash
if [[ "$1" == "-" || "$1" == "-e" ]]; then exec "$V69_REAL_NODE" "$@"; fi
printf 'node|%s\n' "$*" >>"$V69_MOCK_LOG"
exit 0
`);
    writeExecutable(mockNpm, String.raw`#!/usr/bin/env bash
printf 'npm|%s\n' "$*" >>"$V69_MOCK_LOG"
exit 0
`);
    writeExecutable(mockFlock, '#!/usr/bin/env bash\nexit 0\n');
    writeExecutable(mockGit, String.raw`#!/usr/bin/env bash
set -Eeuo pipefail
exec "$V69_REAL_GIT" "$@"
`);
    writeExecutable(candidateMutatingGit, String.raw`#!/usr/bin/env bash
set -Eeuo pipefail
is_checkout=false
for argument in "$@"; do
  if [[ "$argument" == "checkout" ]]; then is_checkout=true; fi
done
if [[ "$is_checkout" == "true" ]]; then
  "$V69_REAL_GIT" -C "$V69_REMOTE_REPO" update-ref refs/heads/codex/candidate-v69 "$V69_MOVED_COMMIT"
fi
exec "$V69_REAL_GIT" "$@"
`);
    writeExecutable(productionMutatingGit, String.raw`#!/usr/bin/env bash
set -Eeuo pipefail
is_fetch=false
for argument in "$@"; do
  if [[ "$argument" == "fetch" ]]; then is_fetch=true; fi
done
"$V69_REAL_GIT" "$@"
if [[ "$is_fetch" == "true" ]]; then
  "$V69_REAL_GIT" -C "$V69_REMOTE_REPO" update-ref refs/heads/production "$V69_MOVED_COMMIT"
fi
`);

    const env = {
        ...process.env,
        VITALISMEN_STAGE_TEST_MODE: 'true',
        VITALISMEN_STAGE_TEST_BASE_DIR: toBashPath(baseDir),
        VITALISMEN_STAGE_TEST_STATE_DIR: toBashPath(stateDir),
        VITALISMEN_STAGE_TEST_LOG_DIR: toBashPath(logDir),
        VITALISMEN_STAGE_TEST_REPO_URL: process.platform === 'win32'
            ? path.resolve(source.repository).replaceAll('\\', '/')
            : toBashPath(source.repository),
        VITALISMEN_STAGE_AUTHORIZED_SOURCE_REF: sourceRef,
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
        VITALISMEN_STAGE_GIT_CMD: gitWrapper ? toBashPath(mockGit) : 'git',
        VITALISMEN_STAGE_NPM_CMD: toBashPath(mockNpm),
        VITALISMEN_STAGE_COMPATIBILITY_RUNNER: '/usr/bin/true',
        VITALISMEN_STAGE_GUARD_RUNNER: '/usr/bin/true',
        VITALISMEN_STAGE_FLOCK_CMD: toBashPath(mockFlock),
        VITALISMEN_STAGE_TEST_STAGE_LOCK_FILE: toBashPath(path.join(stateDir, 'stage.lock')),
        VITALISMEN_STAGE_OFFICIAL_HEALTH_URL: 'https://official.invalid/api/health/',
        VITALISMEN_STAGE_OFFICIAL_PANEL_URL: 'https://official.invalid/n/',
        VITALISMEN_STAGE_LOCAL_HEALTH_URL: 'http://127.0.0.1:3001/api/health/',
        V69_CURRENT_TARGET: toBashPath(oldDir),
        V69_BASE_DIR: toBashPath(baseDir),
        V69_REAL_NODE: toBashPath(process.execPath),
        V69_REAL_GIT: 'git',
        V69_REMOTE_REPO: toBashPath(source.repository),
        V69_MOVED_COMMIT: source.movedCommit,
        V69_MOCK_LOG: toBashPath(mockLog)
    };
    return {
        root,
        env,
        source,
        releaseName,
        releaseDir,
        oldDir,
        logDir,
        mocksDir,
        candidateMutatingGit: toBashPath(candidateMutatingGit),
        productionMutatingGit: toBashPath(productionMutatingGit)
    };
}

function invokeHelper(fixture, args) {
    const result = spawnSync(bashPath, [toBashPath(helperPath), ...args], {
        cwd: projectRoot,
        env: fixture.env,
        encoding: 'utf8',
        timeout: 120000
    });
    return { ...result, combined: `${result.stdout || ''}${result.stderr || ''}` };
}

function invokeStage(fixture, overrides = {}) {
    const requestedRef = overrides.sourceRef ?? sourceRef;
    const expectedCommit = overrides.expectedCommit ?? fixture.source.candidateCommit;
    const expectedTree = overrides.expectedTree ?? fixture.source.candidateTree;
    const releaseName = overrides.releaseName
        ?? `20260827T120000Z_production-20260827-${expectedCommit.slice(0, 7)}`;
    const result = spawnSync(
        bashPath,
        [toBashPath(helperPath), 'stage', requestedRef, expectedCommit, expectedTree, releaseName],
        {
            cwd: projectRoot,
            env: {
                ...fixture.env,
                ...(overrides.authorizedRef === undefined
                    ? {}
                    : { VITALISMEN_STAGE_AUTHORIZED_SOURCE_REF: overrides.authorizedRef }),
                ...(overrides.extraEnv || {})
            },
            encoding: 'utf8',
            timeout: 120000
        }
    );
    return { ...result, combined: `${result.stdout || ''}${result.stderr || ''}` };
}

const readAudit = (fixture) => {
    const file = path.join(fixture.logDir, 'vitalismen-stage-operations.jsonl');
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
};

const remoteHead = (fixture, ref) => run(
    'git', ['-C', fixture.source.repository, 'rev-parse', ref]
).stdout.trim().toLowerCase();

test('contrato estático V69 preserva run_protected e fecha source ref/commit/tree', () => {
    const source = fs.readFileSync(helperPath, 'utf8');
    const contract = assertRunProtectedContractV69(source);
    assert.equal(contract.definitions, 1);
    assert.equal(contract.callCount, 18);
    assert.ok(contract.definitionLine < contract.firstCallLine);
    assert.deepEqual(contract.calls.map(({ label }) => label), [...expectedRunProtectedLabelsV69]);
});

test('stage real sintético usa B com production em A, sem tag, e grava metadata V69', (t) => {
    const fixture = createStageFixture(t);
    const tagsBefore = run('git', ['-C', fixture.source.repository, 'tag', '--list']).stdout;
    const result = invokeStage(fixture);
    assert.equal(result.status, 0, result.combined);
    assert.match(result.stdout, /STAGING_OFICIAL_CONCLUIDO/);
    assert.match(result.stdout, /PRODUCTION_TAG_EXIGIDA=NAO/);
    assert.notEqual(fixture.source.productionCommit, fixture.source.candidateCommit);
    assert.equal(remoteHead(fixture, 'refs/heads/production'), fixture.source.productionCommit);
    assert.equal(run('git', ['-C', fixture.source.repository, 'tag', '--list']).stdout, tagsBefore);
    assert.deepEqual(readAudit(fixture).map(({ label }) => label), [...expectedRunProtectedLabelsV69]);
    assert.ok(readAudit(fixture).every(({ exitStatus }) => exitStatus === 0));

    const metadata = JSON.parse(fs.readFileSync(path.join(fixture.releaseDir, '.release-source.json'), 'utf8'));
    const staging = JSON.parse(fs.readFileSync(path.join(fixture.releaseDir, '.staging-complete.json'), 'utf8'));
    assert.equal(metadata.releaseChannel, 'production');
    assert.equal(metadata.sourceRef, sourceRef);
    assert.equal(metadata.sourceRefResolvedCommit, fixture.source.candidateCommit);
    assert.equal(metadata.functionalCommit, fixture.source.candidateCommit);
    assert.equal(metadata.functionalTree, fixture.source.candidateTree);
    assert.equal(metadata.productionBranchChanged, false);
    assert.equal(metadata.productionTagRequiredForStaging, false);
    assert.equal(metadata.productionTagObservation, 'ABSENT');
    assert.equal(Object.hasOwn(metadata, 'branch'), false);
    assert.equal(Object.hasOwn(metadata, 'tag'), false);
    assert.equal(staging.productionBranchCommitBefore, fixture.source.productionCommit);
    assert.equal(staging.productionBranchCommitAfter, fixture.source.productionCommit);
    assert.equal(staging.productionBranchChanged, false);
    assert.equal(fs.existsSync(path.join(fixture.releaseDir, '.git')), false);
});

test('metadata staged V69 permite plan/preflight e bloqueia ativação sem publicação', (t) => {
    const fixture = createStageFixture(t);
    const staged = invokeStage(fixture);
    assert.equal(staged.status, 0, staged.combined);

    const plan = invokeHelper(fixture, ['v66-plan', fixture.releaseName]);
    assert.equal(plan.status, 0, plan.combined);
    assert.match(plan.stdout, /DRY_RUN_WRITES=0/);
    assert.match(plan.stdout, new RegExp(`CANDIDATE_COMMIT=${fixture.source.candidateCommit}`));

    const preflight = invokeHelper(fixture, ['v66-preflight', fixture.releaseName]);
    assert.equal(preflight.status, 0, preflight.combined);
    assert.match(preflight.stdout, /V66_PREFLIGHT=PASS/);
    assert.match(preflight.stdout, /PM2_ACTIONS=0/);

    const activation = invokeHelper(fixture, ['v66-activate-safe', fixture.releaseName]);
    assert.notEqual(activation.status, 0);
    assert.match(activation.combined, /candidata staged ainda não publicada\/tagueada/);
    assert.equal(fs.existsSync(path.join(fixture.oldDir, '.env')), true);
});

test('commit divergente falha e remove a release incompleta', (t) => {
    const fixture = createStageFixture(t);
    const result = invokeStage(fixture, { expectedCommit: fixture.source.movedCommit });
    assert.notEqual(result.status, 0);
    assert.match(result.combined, /source ref não resolve para o EXPECTED_COMMIT/);
    assert.equal(fs.existsSync(path.join(path.dirname(fixture.releaseDir), `20260827T120000Z_production-20260827-${fixture.source.movedCommit.slice(0, 7)}`)), false);
});

test('tree divergente falha antes de concluir a release', (t) => {
    const fixture = createStageFixture(t);
    const result = invokeStage(fixture, { expectedTree: '0'.repeat(40) });
    assert.notEqual(result.status, 0);
    assert.match(result.combined, /tree funcional divergiu do EXPECTED_TREE/);
    assert.equal(fs.existsSync(fixture.releaseDir), false);
});

test('ref inexistente falha fechada no fetch exato', (t) => {
    const fixture = createStageFixture(t);
    const missing = 'refs/heads/codex/missing-v69';
    const result = invokeStage(fixture, { sourceRef: missing, authorizedRef: missing });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /GATE_fetch_authorized_source=FALHOU/);
    assert.equal(fs.existsSync(fixture.releaseDir), false);
});

test('refs malformadas são rejeitadas antes de materializar release', (t) => {
    const fixture = createStageFixture(t);
    for (const malformed of ['HEAD', 'main~1', 'refs/heads/foo^', '../../x', 'refs/heads/a*', 'refs/heads/codex/a?', 'refs/heads/codex/a[b]']) {
        const result = invokeStage(fixture, { sourceRef: malformed, authorizedRef: malformed });
        assert.notEqual(result.status, 0, `ref aceita indevidamente: ${malformed}`);
        assert.match(result.combined, /source ref/);
    }
    assert.equal(fs.existsSync(fixture.releaseDir), false);
});

test('ref diferente da autorização exata é rejeitada', (t) => {
    const fixture = createStageFixture(t);
    const result = invokeStage(fixture, { authorizedRef: 'refs/heads/codex/other-v69' });
    assert.notEqual(result.status, 0);
    assert.match(result.combined, /não corresponde à ref exata autorizada/);
    assert.equal(fs.existsSync(fixture.releaseDir), false);
});

test('mudança da branch candidata após fetch não altera o commit detached aprovado', (t) => {
    const fixture = createStageFixture(t);
    const result = invokeStage(fixture, {
        extraEnv: { VITALISMEN_STAGE_GIT_CMD: fixture.candidateMutatingGit }
    });
    assert.equal(result.status, 0, result.combined);
    assert.equal(remoteHead(fixture, sourceRef), fixture.source.movedCommit);
    const metadata = JSON.parse(fs.readFileSync(path.join(fixture.releaseDir, '.release-source.json'), 'utf8'));
    assert.equal(metadata.sourceRefResolvedCommit, fixture.source.candidateCommit);
    assert.equal(metadata.functionalCommit, fixture.source.candidateCommit);
    assert.equal(metadata.functionalTree, fixture.source.candidateTree);
});

test('mudança inesperada de production durante o stage bloqueia e limpa a candidata', (t) => {
    const fixture = createStageFixture(t);
    const result = invokeStage(fixture, {
        extraEnv: { VITALISMEN_STAGE_GIT_CMD: fixture.productionMutatingGit }
    });
    assert.notEqual(result.status, 0);
    assert.match(result.combined, /origin\/production mudou durante o staging da candidata/);
    assert.equal(fs.existsSync(fixture.releaseDir), false);
});

test('tag de produção conflitante não substitui commit/tree aprovados', (t) => {
    const fixture = createStageFixture(t);
    const tag = `production-20260827-${fixture.source.candidateCommit.slice(0, 7)}`;
    run('git', ['-C', fixture.source.repository, 'tag', '-a', tag, fixture.source.movedCommit, '-m', 'wrong V69 tag']);
    const result = invokeStage(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.combined, /tag de produção opcional contradiz COMMIT\/TREE aprovados/);
    assert.equal(fs.existsSync(fixture.releaseDir), false);
});

test('run_protected V69 preserva argumentos e não registra conteúdo sensível', (t) => {
    const fixture = createStageFixture(t);
    const recorder = path.join(fixture.mocksDir, 'record-args.sh');
    const output = path.join(fixture.root, 'args.bin');
    const unexpected = path.join(fixture.root, 'unexpected');
    writeExecutable(recorder, String.raw`#!/usr/bin/env bash
target="$1"
shift
printf '%s\0' "$@" >"$target"
`);
    const injection = `; touch ${toBashPath(unexpected)}`;
    const secret = 'V69_SENSITIVE_DO_NOT_LOG';
    const command = 'source "$1"; shift; run_protected "$@"';
    const result = spawnSync(bashPath, [
        '-c', command, 'v69-unit', toBashPath(helperPath), 'args-v69', toBashPath(recorder),
        toBashPath(output), 'value with spaces', injection, secret
    ], {
        cwd: projectRoot,
        env: { ...fixture.env, VITALISMEN_STAGE_TEST_SOURCE_ONLY: 'true' },
        encoding: 'utf8'
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(fs.readFileSync(output).toString().split('\0').filter(Boolean), [
        'value with spaces', injection, secret
    ]);
    assert.equal(fs.existsSync(unexpected), false);
    const auditText = fs.readFileSync(path.join(fixture.logDir, 'vitalismen-stage-operations.jsonl'), 'utf8');
    assert.doesNotMatch(auditText, /V69_SENSITIVE|touch|value with spaces/);
});

function cleanEnvironment() {
    const allowed = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP'];
    return {
        ...Object.fromEntries(allowed.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]])),
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'false',
        WHATSAPP_FUNNEL_ENABLED: 'false',
        POST_SALE_V66_MUTATIONS_ENABLED: 'false',
        DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
        DISABLE_SCHEDULER: '1'
    };
}

function createGuardSnapshot(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-guard-v69-'));
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

test('runtime V69 herda V68 fail-closed e mantém compatibilidade de dados 66', (t) => {
    const snapshot = createGuardSnapshot(t);
    const canonical = spawnSync(process.execPath, [runtimeV69], {
        cwd: snapshot,
        env: cleanEnvironment(),
        encoding: 'utf8',
        timeout: 120000
    });
    assert.equal(canonical.status, 0, `${canonical.stdout}\n${canonical.stderr}`);
    assert.match(canonical.stdout, /DEPLOY-STAGE-SOURCE-REF-SAFETY-V69/);

    const v68Manifest = path.join(freezeDir, 'deploy-helper-runtime-safety-v68-20260827.json');
    assert.equal(
        crypto.createHash('sha256').update(fs.readFileSync(v68Manifest)).digest('hex'),
        '90c1c19433d5f5a2f358be4c0b7aead6f3d8e81615df8005ea62f9348a0dad1e'
    );
    const v69 = JSON.parse(fs.readFileSync(path.join(freezeDir, 'deploy-stage-source-ref-safety-v69-20260827.json'), 'utf8'));
    assert.equal(v69.policy.dataCompatibilityVersion, 66);
    assert.equal(v69.policy.pm2StartAuthorized, false);
    assert.equal(v69.policy.helperInstallAuthorized, false);
    assert.equal(v69.policy.productionMutationExecuted, false);

    const ancestor = path.join(snapshot, 'approved_freezes', 'APPROVED_EC_REPURCHASE_SQLITE_SERIALIZATION_V47_20260822.txt');
    fs.appendFileSync(ancestor, '\nUNDECLARED_V69_TEST_BYTE\n');
    const failed = spawnSync(process.execPath, [runtimeV69], {
        cwd: snapshot,
        env: cleanEnvironment(),
        encoding: 'utf8',
        timeout: 120000
    });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /EC-REPURCHASE-SQLITE-V47/);
});
