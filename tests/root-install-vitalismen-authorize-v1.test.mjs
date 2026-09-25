import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const activationInstaller = path.join(
    projectRoot,
    'scripts',
    'root-install-vitalismen-activation-permit-v5.sh'
);
const installer = path.join(projectRoot, 'scripts', 'root-install-vitalismen-authorize-v1.sh');
const officialRepository = 'GitViltaliesmen/vitalismen-maxlien-painel';

const run = (command, args, options = {}) => spawnSync(command, args, {
    cwd: options.cwd || projectRoot,
    env: options.env || process.env,
    encoding: 'utf8'
});

const mustRun = (command, args, options = {}) => {
    const result = run(command, args, options);
    assert.equal(
        result.status,
        0,
        `${command} ${args.join(' ')} falhou\nstdout=${result.stdout}\nstderr=${result.stderr}`
    );
    return result;
};

const writeJson0600 = (file, value) => {
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    fs.chmodSync(file, 0o600);
};

const createRelease = ({ releasesDir, releaseName, tag, commit, repository = officialRepository }) => {
    const releaseDir = path.join(releasesDir, releaseName);
    fs.mkdirSync(releaseDir, { mode: 0o700 });
    fs.chmodSync(releaseDir, 0o700);
    writeJson0600(path.join(releaseDir, '.release-source.json'), {
        repository,
        branch: 'production',
        commit,
        tag,
        createdAt: '2026-08-18T02:00:00Z',
        releaseName
    });
    writeJson0600(path.join(releaseDir, '.staging-complete.json'), {
        status: 'complete',
        commit,
        tag,
        completedAt: '2026-08-18T02:01:00Z',
        currentUnchanged: true,
        pm2Unchanged: true,
        stdoutSensitiveData: 'redacted'
    });
    return releaseDir;
};

const buildFixture = (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-authorize-v1-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const repoWork = path.join(root, 'repo-work');
    const repoBare = path.join(root, 'repo.git');
    fs.mkdirSync(repoWork);
    mustRun('git', ['init', '-q'], { cwd: repoWork });
    mustRun('git', ['config', 'user.name', 'Fixture Vitalismen'], { cwd: repoWork });
    mustRun('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: repoWork });
    fs.writeFileSync(path.join(repoWork, 'fixture.txt'), 'candidate\n');
    mustRun('git', ['add', 'fixture.txt'], { cwd: repoWork });
    mustRun('git', ['commit', '-q', '-m', 'fixture candidate'], { cwd: repoWork });
    mustRun('git', ['branch', '-M', 'production'], { cwd: repoWork });
    const commit = mustRun('git', ['rev-parse', 'HEAD'], { cwd: repoWork }).stdout.trim();
    const tag = `production-20260818-${commit.slice(0, 7)}`;
    mustRun('git', ['tag', '-a', tag, '-m', 'fixture release'], { cwd: repoWork });
    mustRun('git', ['clone', '--bare', '-q', repoWork, repoBare]);

    const baseDir = path.join(root, 'base');
    const releasesDir = path.join(baseDir, 'releases');
    const stateDir = path.join(root, 'state');
    const lockFile = path.join(root, 'authorize.lock');
    fs.mkdirSync(releasesDir, { recursive: true });

    const rollbackCommit = '1'.repeat(40);
    const rollbackTag = 'production-20260817-1111111';
    const rollbackName = '20260817T010000Z_production-20260817-1111111';
    const rollbackDir = createRelease({
        releasesDir,
        releaseName: rollbackName,
        tag: rollbackTag,
        commit: rollbackCommit
    });

    const releaseName = `20260818T020000Z_${tag}`;
    const releaseDir = createRelease({ releasesDir, releaseName, tag, commit });

    const unrelatedName = '20991231T235959Z_production-20991231-2222222';
    const unrelatedDir = path.join(releasesDir, unrelatedName);
    fs.mkdirSync(unrelatedDir, { mode: 0o700 });
    fs.chmodSync(unrelatedDir, 0o700);

    fs.symlinkSync(rollbackDir, path.join(baseDir, 'current'));

    const renderedHelper = path.join(root, 'vitalismen-authorize');
    const render = mustRun('bash', [installer, '--render-helper', renderedHelper]);
    assert.match(render.stdout, /PERMIT_REAL_CRIADO=NAO/);

    const env = {
        ...process.env,
        VITALISMEN_AUTHORIZE_TEST_MODE: 'true',
        VITALISMEN_AUTHORIZE_TEST_BASE_DIR: baseDir,
        VITALISMEN_AUTHORIZE_TEST_STATE_DIR: stateDir,
        VITALISMEN_AUTHORIZE_TEST_REPO_URL: repoBare,
        VITALISMEN_AUTHORIZE_TEST_LOCK_FILE: lockFile
    };

    return {
        root,
        baseDir,
        releasesDir,
        stateDir,
        lockFile,
        repoBare,
        renderedHelper,
        env,
        commit,
        tag,
        releaseName,
        releaseDir,
        rollbackName,
        rollbackDir,
        unrelatedName
    };
};

test('descobre a release somente pela TAG e usa current como rollback', (t) => {
    const fixture = buildFixture(t);
    const result = run(fixture.renderedHelper, [fixture.tag], { env: fixture.env });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /AUTORIZACAO_CRIADA=SIM/);
    assert.match(result.stdout, /ACTIVATE_EXECUTADO=NAO/);

    const permitPath = path.join(fixture.stateDir, 'activate-permit.json');
    const permit = JSON.parse(fs.readFileSync(permitPath, 'utf8'));
    assert.equal(permit.tag, fixture.tag);
    assert.equal(permit.commit, fixture.commit);
    assert.equal(permit.release, fixture.releaseName);
    assert.equal(permit.rollback, fixture.rollbackName);
    assert.equal(permit.currentExpected, fixture.rollbackName);
    assert.equal(permit.singleUse, true);
    assert.notEqual(permit.release, fixture.unrelatedName);
    assert.equal(fs.statSync(permitPath).mode & 0o777, 0o600);

    const validityMs = Date.parse(permit.expiresAt) - Date.parse(permit.createdAt);
    assert.equal(validityMs, 30 * 60 * 1000);
});

test('recusa sobrescrever um permit existente', (t) => {
    const fixture = buildFixture(t);
    fs.mkdirSync(fixture.stateDir, { mode: 0o700 });
    fs.chmodSync(fixture.stateDir, 0o700);
    const permitPath = path.join(fixture.stateDir, 'activate-permit.json');
    fs.writeFileSync(permitPath, 'sentinela\n', { mode: 0o600 });
    fs.chmodSync(permitPath, 0o600);

    const result = run(fixture.renderedHelper, [fixture.tag], { env: fixture.env });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /sobrescrita recusada/);
    assert.equal(fs.readFileSync(permitPath, 'utf8'), 'sentinela\n');
});

test('recusa duas releases staged para a mesma TAG em vez de escolher latest', (t) => {
    const fixture = buildFixture(t);
    const duplicateName = `20260818T030000Z_${fixture.tag}`;
    createRelease({
        releasesDir: fixture.releasesDir,
        releaseName: duplicateName,
        tag: fixture.tag,
        commit: fixture.commit
    });

    const result = run(fixture.renderedHelper, [fixture.tag], { env: fixture.env });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /release staged não passou na validação/);
    assert.equal(fs.existsSync(path.join(fixture.stateDir, 'activate-permit.json')), false);
});

test('recusa repository adulterado nos metadados staged', (t) => {
    const fixture = buildFixture(t);
    writeJson0600(path.join(fixture.releaseDir, '.release-source.json'), {
        repository: 'OutroProjeto/invalido',
        branch: 'production',
        commit: fixture.commit,
        tag: fixture.tag,
        createdAt: '2026-08-18T02:00:00Z',
        releaseName: fixture.releaseName
    });

    const result = run(fixture.renderedHelper, [fixture.tag], { env: fixture.env });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /release staged não passou na validação/);
    assert.equal(fs.existsSync(path.join(fixture.stateDir, 'activate-permit.json')), false);
});

test('recusa autorizar a release que já está ativa', (t) => {
    const fixture = buildFixture(t);
    fs.unlinkSync(path.join(fixture.baseDir, 'current'));
    fs.symlinkSync(fixture.releaseDir, path.join(fixture.baseDir, 'current'));

    const result = run(fixture.renderedHelper, [fixture.tag], { env: fixture.env });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /release solicitada já está ativa/);
    assert.equal(fs.existsSync(path.join(fixture.stateDir, 'activate-permit.json')), false);
});

test('helper renderizado não contém comandos de ativação, PM2 ou produção', (t) => {
    const fixture = buildFixture(t);
    const source = fs.readFileSync(fixture.renderedHelper, 'utf8');

    assert.doesNotMatch(source, /(?:^|\n)\s*(?:sudo\s+)?\/usr\/local\/sbin\/vitalismen-stage\s+activate\b/);
    assert.doesNotMatch(source, /(?:^|\n)\s*(?:\/usr\/bin\/)?pm2\b/);
    assert.doesNotMatch(source, /(?:^|\n)\s*(?:\/usr\/sbin\/)?nginx\b/);
    assert.doesNotMatch(source, /\bmongosh\b|\bmongodump\b|\/public\/qr\.html|\/n\//);
    mustRun('bash', ['-n', fixture.renderedHelper]);
});

test('bootstrap V5 preserva activate sem argumentos e não executa ativação', () => {
    const source = fs.readFileSync(activationInstaller, 'utf8');

    mustRun('bash', ['-n', activationInstaller]);
    assert.match(
        source,
        /codex ALL=\(root\) NOPASSWD: \/usr\/local\/sbin\/vitalismen-stage activate\n/
    );
    assert.doesNotMatch(
        source,
        /^\s*(?:sudo(?:\s+-n)?\s+)?(?:"\$HELPER"|\/usr\/local\/sbin\/vitalismen-stage)\s+activate(?:\s|$)/m
    );
    assert.equal(
        (source.match(/^readonly HELPER_CANDIDATE=/gm) || []).length,
        1,
        'HELPER_CANDIDATE deve ser declarado readonly uma única vez'
    );
    assert.doesNotMatch(
        source,
        /^\s*HELPER_CANDIDATE=/m,
        'HELPER_CANDIDATE não pode ser reatribuído após readonly'
    );
});
