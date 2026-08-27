import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    assertPublicationAttestationContractV70,
    expectedRunProtectedLabelsV70
} from '../scripts/lib/deploy-publication-attestation-contract-v70.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperPath = path.join(projectRoot, 'ops', 'vitalismen-stage');
const sourceRef = 'refs/heads/codex/candidate-v70';
const bashPath = process.platform === 'win32'
    ? 'C:\\Program Files\\Git\\bin\\bash.exe'
    : '/bin/bash';

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
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

function createRepository(root) {
    const repository = path.join(root, 'remote');
    fs.mkdirSync(repository, { recursive: true });
    run('git', ['init', repository]);
    run('git', ['-C', repository, 'config', 'user.name', 'Vitalismen V70 Test']);
    run('git', ['-C', repository, 'config', 'user.email', 'v70-test@invalid.local']);
    run('git', ['-C', repository, 'checkout', '-b', 'production']);
    fs.writeFileSync(path.join(repository, 'README.synthetic.md'), 'production A\n');
    run('git', ['-C', repository, 'add', '.']);
    run('git', ['-C', repository, 'commit', '-m', 'test: production A']);
    const productionCommit = run('git', ['-C', repository, 'rev-parse', 'HEAD']).stdout.trim().toLowerCase();

    run('git', ['-C', repository, 'checkout', '-b', 'codex/candidate-v70']);
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
        fs.writeFileSync(file, '// synthetic V70 contract\n');
    }
    run('git', ['-C', repository, 'add', '.']);
    run('git', ['-C', repository, 'commit', '-m', 'test: candidate B']);
    const candidateCommit = run('git', ['-C', repository, 'rev-parse', 'HEAD']).stdout.trim().toLowerCase();
    const candidateTree = run('git', ['-C', repository, 'rev-parse', 'HEAD^{tree}']).stdout.trim().toLowerCase();

    run('git', ['-C', repository, 'checkout', '-b', 'codex/other-v70']);
    fs.writeFileSync(path.join(repository, 'README.synthetic.md'), 'candidate C\n');
    run('git', ['-C', repository, 'add', '.']);
    run('git', ['-C', repository, 'commit', '-m', 'test: candidate C']);
    const otherCommit = run('git', ['-C', repository, 'rev-parse', 'HEAD']).stdout.trim().toLowerCase();
    run('git', ['-C', repository, 'checkout', 'production']);
    return { repository, productionCommit, candidateCommit, candidateTree, otherCommit };
}

function createFixture(t) {
    assert.ok(fs.existsSync(bashPath), `bash de teste ausente: ${bashPath}`);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-v70-'));
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
    const source = createRepository(root);
    const tag = `production-20260827-${source.candidateCommit.slice(0, 7)}`;
    const releaseName = `20260827T120000Z_${tag}`;
    const releaseDir = path.join(releasesDir, releaseName);
    const pm2Actions = path.join(root, 'pm2-actions.log');
    const mockLog = path.join(root, 'mock-commands.log');

    const mockPm2 = path.join(mocksDir, 'pm2.sh');
    const mockReadlink = path.join(mocksDir, 'readlink.sh');
    const mockNode = path.join(mocksDir, 'node.sh');
    const mockNpm = path.join(mocksDir, 'npm.sh');
    const mockFlock = path.join(mocksDir, 'flock.sh');
    const mockGit = path.join(mocksDir, 'git.sh');
    writeExecutable(mockPm2, String.raw`#!/usr/bin/env bash
if [[ "$1" == "pid" ]]; then printf '0\n'; exit 0; fi
if [[ "$1" == "jlist" ]]; then
  printf '[{"name":"vitalismen-automation","pid":0,"pm2_env":{"status":"stopped","restart_time":101,"pm_cwd":"%s/current","pm_exec_path":"%s/current/src/index.js"}}]' "$V70_BASE_DIR" "$V70_BASE_DIR"
  exit 0
fi
printf '%s\n' "$*" >>"$V70_PM2_ACTIONS"
exit 64
`);
    writeExecutable(mockReadlink, String.raw`#!/usr/bin/env bash
printf '%s\n' "$V70_CURRENT_TARGET"
`);
    writeExecutable(mockNode, String.raw`#!/usr/bin/env bash
if [[ "$1" == "-" || "$1" == "-e" ]]; then exec "$V70_REAL_NODE" "$@"; fi
printf 'node|%s\n' "$*" >>"$V70_MOCK_LOG"
exit 0
`);
    writeExecutable(mockNpm, String.raw`#!/usr/bin/env bash
printf 'npm|%s\n' "$*" >>"$V70_MOCK_LOG"
exit 0
`);
    writeExecutable(mockFlock, '#!/usr/bin/env bash\nexit 0\n');
    writeExecutable(mockGit, String.raw`#!/usr/bin/env bash
set -Eeuo pipefail
exec "$V70_REAL_GIT" "$@"
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
        VITALISMEN_STAGE_GIT_CMD: toBashPath(mockGit),
        VITALISMEN_STAGE_NPM_CMD: toBashPath(mockNpm),
        VITALISMEN_STAGE_COMPATIBILITY_RUNNER: '/usr/bin/true',
        VITALISMEN_STAGE_GUARD_RUNNER: '/usr/bin/true',
        VITALISMEN_STAGE_FLOCK_CMD: toBashPath(mockFlock),
        VITALISMEN_STAGE_TEST_STAGE_LOCK_FILE: toBashPath(path.join(stateDir, 'stage.lock')),
        VITALISMEN_STAGE_OFFICIAL_HEALTH_URL: 'https://official.invalid/api/health/',
        VITALISMEN_STAGE_OFFICIAL_PANEL_URL: 'https://official.invalid/n/',
        VITALISMEN_STAGE_LOCAL_HEALTH_URL: 'http://127.0.0.1:3001/api/health/',
        V70_CURRENT_TARGET: toBashPath(oldDir),
        V70_BASE_DIR: toBashPath(baseDir),
        V70_REAL_NODE: toBashPath(process.execPath),
        V70_REAL_GIT: 'git',
        V70_PM2_ACTIONS: toBashPath(pm2Actions),
        V70_MOCK_LOG: toBashPath(mockLog)
    };
    return { root, baseDir, stateDir, logDir, oldDir, source, tag, releaseName, releaseDir, pm2Actions, env };
}

function invoke(fixture, args, extraEnv = {}) {
    const result = spawnSync(bashPath, [toBashPath(helperPath), ...args], {
        cwd: projectRoot,
        env: { ...fixture.env, ...extraEnv },
        encoding: 'utf8',
        timeout: 120000
    });
    return { ...result, combined: `${result.stdout || ''}${result.stderr || ''}` };
}
function stage(fixture) {
    return invoke(fixture, [
        'stage', sourceRef, fixture.source.candidateCommit,
        fixture.source.candidateTree, fixture.releaseName
    ]);
}
function publish(fixture, extraEnv = {}) {
    return invoke(fixture, [
        'v70-publish', fixture.releaseName, sourceRef,
        fixture.source.candidateCommit, fixture.source.candidateTree, fixture.tag
    ], {
        VITALISMEN_PUBLISH_AUTHORIZED_SOURCE_REF: sourceRef,
        VITALISMEN_PUBLISH_AUTHORIZED_TAG: fixture.tag,
        ...extraEnv
    });
}
function createCorrectTag(fixture) {
    run('git', ['-C', fixture.source.repository, 'tag', '-a', fixture.tag, fixture.source.candidateCommit, '-m', 'synthetic V70 publication']);
}
function writePermit(fixture) {
    const now = Date.now();
    const permit = {
        version: 1,
        status: 'authorized',
        singleUse: true,
        release: fixture.releaseName,
        commit: fixture.source.candidateCommit,
        tag: fixture.tag,
        currentExpected: path.basename(fixture.oldDir),
        rollback: path.basename(fixture.oldDir),
        createdAt: new Date(now - 1_000).toISOString(),
        expiresAt: new Date(now + 10 * 60_000).toISOString()
    };
    fs.writeFileSync(path.join(fixture.stateDir, 'activate-permit.json'), `${JSON.stringify(permit, null, 2)}\n`);
}
const noPm2Actions = (fixture) => !fs.existsSync(fixture.pm2Actions) || fs.readFileSync(fixture.pm2Actions, 'utf8') === '';

test('contrato estático V70 preserva os 18 gates e fecha publish/attestation', () => {
    const source = fs.readFileSync(helperPath, 'utf8');
    const contract = assertPublicationAttestationContractV70(source);
    assert.equal(contract.definitions, 1);
    assert.equal(contract.callCount, 18);
    assert.deepEqual(contract.calls.map(({ label }) => label), [...expectedRunProtectedLabelsV70]);
});

test('stage V70 nasce completo, imutável e sem tag/publicação/PM2', (t) => {
    const fixture = createFixture(t);
    const result = stage(fixture);
    assert.equal(result.status, 0, result.combined);
    assert.match(result.stdout, /PUBLICATION_STATUS=staged_candidate/);
    assert.equal(noPm2Actions(fixture), true);
    assert.equal(run('git', ['-C', fixture.source.repository, 'tag', '--list']).stdout, '');
    assert.equal(run('git', ['-C', fixture.source.repository, 'rev-parse', 'production']).stdout.trim(), fixture.source.productionCommit);

    const sourcePath = path.join(fixture.releaseDir, '.release-source.json');
    const stagingPath = path.join(fixture.releaseDir, '.staging-complete.json');
    const overlayPath = path.join(fixture.releaseDir, '.env.v66-safe-observation');
    const metadata = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const stagingMarker = JSON.parse(fs.readFileSync(stagingPath, 'utf8'));
    assert.equal(metadata.publicationStatus, 'staged_candidate');
    assert.equal(metadata.guardChainVersion, 70);
    assert.equal(metadata.dataCompatibilityVersion, 66);
    assert.equal(metadata.functionalCommit, fixture.source.candidateCommit);
    assert.equal(metadata.functionalTree, fixture.source.candidateTree);
    assert.equal(Object.hasOwn(metadata, 'tag'), false);
    assert.equal(Object.hasOwn(metadata, 'branch'), false);
    assert.equal(stagingMarker.releaseMetadataSha256, sha256(sourcePath));
    assert.equal(stagingMarker.safeOverlaySha256, sha256(overlayPath));
    assert.equal(stagingMarker.baseEnvSha256, sha256(path.join(fixture.releaseDir, '.env')));
    assert.equal(stagingMarker.nodeModulesSha256, 'ABSENT');
    assert.match(stagingMarker.functionalPayloadSha256, /^[0-9a-f]{64}$/);
    assert.equal(fs.existsSync(path.join(fixture.releaseDir, '.release-publication.json')), false);
    assert.equal(fs.existsSync(path.join(fixture.releaseDir, '.publication-complete.json')), false);

    const preflight = invoke(fixture, ['v66-preflight', fixture.releaseName]);
    assert.equal(preflight.status, 0, preflight.combined);
    assert.match(preflight.stdout, /PUBLICATION_STATUS=staged_candidate/);
    const activation = invoke(fixture, ['v66-activate-safe', fixture.releaseName]);
    assert.notEqual(activation.status, 0);
    assert.match(activation.combined, /ativação exige publicationStatus production_published/);
});

test('status ausente/desconhecido e envelope parcial falham fechados', (t) => {
    const fixture = createFixture(t);
    assert.equal(stage(fixture).status, 0);
    const sourcePath = path.join(fixture.releaseDir, '.release-source.json');
    const original = fs.readFileSync(sourcePath, 'utf8');
    const metadata = JSON.parse(original);
    delete metadata.publicationStatus;
    fs.writeFileSync(sourcePath, `${JSON.stringify(metadata, null, 2)}\n`);
    assert.notEqual(invoke(fixture, ['v66-plan', fixture.releaseName]).status, 0);
    metadata.publicationStatus = 'mystery';
    fs.writeFileSync(sourcePath, `${JSON.stringify(metadata, null, 2)}\n`);
    assert.notEqual(invoke(fixture, ['v66-plan', fixture.releaseName]).status, 0);
    fs.writeFileSync(sourcePath, original);
    fs.writeFileSync(path.join(fixture.releaseDir, '.release-publication.json'), '{}\n');
    const partial = invoke(fixture, ['v66-plan', fixture.releaseName]);
    assert.notEqual(partial.status, 0);
    assert.match(partial.combined, /envelope de publicação parcial/);
});

test('publish bloqueia tag ausente, tag errada e produção movida', (t) => {
    const missing = createFixture(t);
    assert.equal(stage(missing).status, 0);
    const absent = publish(missing);
    assert.notEqual(absent.status, 0);
    assert.match(absent.combined, /tag remota obrigatória ausente/);
    assert.equal(fs.existsSync(path.join(missing.releaseDir, '.release-publication.json')), false);
    assert.equal(invoke(missing, ['v66-preflight', missing.releaseName]).status, 0);
    writePermit(missing);
    const absentActivation = invoke(missing, ['v66-activate-safe', missing.releaseName]);
    assert.notEqual(absentActivation.status, 0);
    assert.match(absentActivation.combined, /ativação exige publicationStatus production_published/);

    const wrong = createFixture(t);
    assert.equal(stage(wrong).status, 0);
    run('git', ['-C', wrong.source.repository, 'tag', '-a', wrong.tag, wrong.source.otherCommit, '-m', 'wrong target']);
    const wrongTarget = publish(wrong);
    assert.notEqual(wrongTarget.status, 0);
    assert.match(wrongTarget.combined, /tag remota não aponta para o EXPECTED_COMMIT/);

    const moved = createFixture(t);
    assert.equal(stage(moved).status, 0);
    createCorrectTag(moved);
    run('git', ['-C', moved.source.repository, 'update-ref', 'refs/heads/production', moved.source.otherCommit]);
    const movedProduction = publish(moved);
    assert.notEqual(movedProduction.status, 0);
    assert.match(movedProduction.combined, /origin\/production mudou desde o staging/);
    assert.equal(noPm2Actions(moved), true);
});

test('publish atesta hashes sem mudar payload, production, current ou PM2', (t) => {
    const fixture = createFixture(t);
    assert.equal(stage(fixture).status, 0);
    const paths = {
        source: path.join(fixture.releaseDir, '.release-source.json'),
        staging: path.join(fixture.releaseDir, '.staging-complete.json'),
        overlay: path.join(fixture.releaseDir, '.env.v66-safe-observation')
    };
    const before = Object.fromEntries(Object.entries(paths).map(([key, file]) => [key, sha256(file)]));
    const oldPreflight = path.join(fixture.stateDir, `v66-preflight.${fixture.releaseName}.json`);
    const stagedPreflight = invoke(fixture, ['v66-preflight', fixture.releaseName]);
    assert.equal(stagedPreflight.status, 0, stagedPreflight.combined);
    assert.equal(JSON.parse(fs.readFileSync(oldPreflight, 'utf8')).publicationStatus, 'staged_candidate');
    createCorrectTag(fixture);
    const result = publish(fixture);
    assert.equal(result.status, 0, result.combined);
    assert.match(result.stdout, /V70_PUBLICATION=SUCCESS/);
    assert.match(result.stdout, /PM2_ACTIONS=0/);
    assert.match(result.stdout, /PROVIDER_CALLS=0/);
    assert.match(result.stdout, /DROPI_CALLS=0/);
    assert.match(result.stdout, /BRIDGE_EXECUTED=NO/);
    assert.equal(fs.existsSync(oldPreflight), false);
    assert.deepEqual(Object.fromEntries(Object.entries(paths).map(([key, file]) => [key, sha256(file)])), before);
    assert.equal(run('git', ['-C', fixture.source.repository, 'rev-parse', 'production']).stdout.trim(), fixture.source.productionCommit);
    assert.equal(noPm2Actions(fixture), true);

    const publicationPath = path.join(fixture.releaseDir, '.release-publication.json');
    const completePath = path.join(fixture.releaseDir, '.publication-complete.json');
    const publication = JSON.parse(fs.readFileSync(publicationPath, 'utf8'));
    const complete = JSON.parse(fs.readFileSync(completePath, 'utf8'));
    assert.equal(publication.status, 'production_published');
    assert.equal(publication.publicationTagResolvedCommit, fixture.source.candidateCommit);
    assert.equal(publication.releaseMetadataSha256, before.source);
    assert.equal(publication.stagingCompleteSha256, before.staging);
    assert.equal(publication.safeOverlaySha256, before.overlay);
    assert.equal(publication.baseEnvSha256, sha256(path.join(fixture.releaseDir, '.env')));
    assert.equal(publication.nodeModulesSha256, 'ABSENT');
    assert.equal(complete.publicationMetadataSha256, sha256(publicationPath));
    assert.equal(complete.pm2Actions, 0);
    assert.equal(complete.outboundActions, 0);
    assert.equal(complete.dropiActions, 0);
    assert.equal(complete.bridgeExecuted, false);
    assert.equal(complete.mutationsEnabled, false);
});

test('tamper de source, staging, overlay, publication ou attestation bloqueia', (t) => {
    const fixture = createFixture(t);
    assert.equal(stage(fixture).status, 0);
    createCorrectTag(fixture);
    assert.equal(publish(fixture).status, 0);
    const files = [
        '.release-source.json',
        '.staging-complete.json',
        '.env.v66-safe-observation',
        '.release-publication.json',
        '.publication-complete.json'
    ];
    for (const name of files) {
        const file = path.join(fixture.releaseDir, name);
        const original = fs.readFileSync(file);
        fs.appendFileSync(file, '\n');
        const result = invoke(fixture, ['v66-plan', fixture.releaseName]);
        assert.notEqual(result.status, 0, `tamper aceito: ${name}`);
        fs.writeFileSync(file, original);
    }
});

test('alteração de código, .env ou node_modules entre stage e publish é bloqueada', (t) => {
    const fixture = createFixture(t);
    assert.equal(stage(fixture).status, 0);
    createCorrectTag(fixture);
    const codePath = path.join(fixture.releaseDir, 'README.synthetic.md');
    const codeOriginal = fs.readFileSync(codePath);
    fs.appendFileSync(codePath, 'tamper\n');
    const codeResult = publish(fixture);
    assert.notEqual(codeResult.status, 0);
    assert.match(codeResult.combined, /fingerprint funcional divergente/);
    fs.writeFileSync(codePath, codeOriginal);

    const envPath = path.join(fixture.releaseDir, '.env');
    const envOriginal = fs.readFileSync(envPath);
    fs.appendFileSync(envPath, 'TAMPER=true\n');
    const envResult = publish(fixture);
    assert.notEqual(envResult.status, 0);
    assert.match(envResult.combined, /fingerprint de \.env divergente/);
    fs.writeFileSync(envPath, envOriginal);

    const modulesPath = path.join(fixture.releaseDir, 'node_modules');
    fs.mkdirSync(modulesPath);
    fs.writeFileSync(path.join(modulesPath, 'tamper.js'), 'export default true;\n');
    const modulesResult = publish(fixture);
    assert.notEqual(modulesResult.status, 0);
    assert.match(modulesResult.combined, /fingerprint de node_modules divergente/);
    assert.equal(fs.existsSync(path.join(fixture.releaseDir, '.release-publication.json')), false);
    assert.equal(noPm2Actions(fixture), true);
});

test('fluxo stage → publish → novo preflight → validação de ativação é zero-effect', (t) => {
    const fixture = createFixture(t);
    assert.equal(stage(fixture).status, 0);
    createCorrectTag(fixture);
    assert.equal(publish(fixture).status, 0);
    const preflight = invoke(fixture, ['v66-preflight', fixture.releaseName]);
    assert.equal(preflight.status, 0, preflight.combined);
    assert.match(preflight.stdout, /PUBLICATION_STATUS=production_published/);
    assert.match(preflight.stdout, /REMOTE_TAG_VERIFIED=YES/);
    writePermit(fixture);
    const validation = invoke(fixture, ['v70-activation-validate', fixture.releaseName]);
    assert.equal(validation.status, 0, validation.combined);
    assert.match(validation.stdout, /V70_ACTIVATION_VALIDATION=PASS/);
    assert.match(validation.stdout, /PERMIT=VALID_AND_NOT_CONSUMED/);
    assert.match(validation.stdout, /PM2_ACTIONS=0/);
    assert.equal(fs.existsSync(path.join(fixture.stateDir, 'activate-permit.json')), true);
    assert.equal(noPm2Actions(fixture), true);
    assert.equal(run('git', ['-C', fixture.source.repository, 'rev-parse', 'production']).stdout.trim(), fixture.source.productionCommit);
});

test('preflight publicado fica inválido após mudança de attestation ou tag remota', (t) => {
    const fixture = createFixture(t);
    assert.equal(stage(fixture).status, 0);
    createCorrectTag(fixture);
    assert.equal(publish(fixture).status, 0);
    assert.equal(invoke(fixture, ['v66-preflight', fixture.releaseName]).status, 0);
    writePermit(fixture);

    const completePath = path.join(fixture.releaseDir, '.publication-complete.json');
    const originalComplete = fs.readFileSync(completePath);
    fs.appendFileSync(completePath, '\n');
    assert.notEqual(invoke(fixture, ['v70-activation-validate', fixture.releaseName]).status, 0);
    fs.writeFileSync(completePath, originalComplete);

    run('git', ['-C', fixture.source.repository, 'tag', '-d', fixture.tag]);
    const absentTag = invoke(fixture, ['v70-activation-validate', fixture.releaseName]);
    assert.notEqual(absentTag.status, 0);
    assert.match(absentTag.combined, /tag remota obrigatória ausente/);

    run('git', ['-C', fixture.source.repository, 'tag', fixture.tag, fixture.source.otherCommit]);
    const movedTag = invoke(fixture, ['v70-activation-validate', fixture.releaseName]);
    assert.notEqual(movedTag.status, 0);
    assert.match(movedTag.combined, /tag remota não aponta para o functionalCommit/);
    assert.equal(noPm2Actions(fixture), true);
});
