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
const bashPath = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : '/bin/bash';
const releaseName = '20260902T064628Z_production-v60-dropi-bff-a691b7e';
const sourceRef = 'refs/heads/codex/legacy-baseline-v102-test';
const authorization = 'I_UNDERSTAND_LEGACY_BASELINE_V102';

const toBashPath = (value) => {
    const normalized = path.resolve(value).replaceAll('\\', '/');
    return process.platform === 'win32'
        ? normalized.replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`)
        : normalized;
};
const run = (command, args, options = {}) => spawnSync(command, args, {
    cwd: options.cwd || projectRoot,
    env: options.env || process.env,
    encoding: 'utf8',
    timeout: options.timeout || 20_000
});
const mustRun = (command, args, options = {}) => {
    const result = run(command, args, options);
    assert.equal(result.status, 0, `${command} ${args.join(' ')} falhou:\n${result.stdout || ''}\n${result.stderr || ''}`);
    return result;
};
const writeExecutable = (file, content) => {
    fs.writeFileSync(file, content.replace(/^\n/, ''), { encoding: 'utf8', mode: 0o700 });
    fs.chmodSync(file, 0o700);
};
const legacyFingerprint = (root) => {
    const hash = crypto.createHash('sha256');
    const visit = (target, relative) => {
        const stats = fs.lstatSync(target);
        if (stats.isDirectory()) {
            for (const entry of fs.readdirSync(target, { withFileTypes: true })
                .sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
                visit(path.join(target, entry.name), `${relative}/${entry.name}`);
            }
            return;
        }
        hash.update(relative, 'utf8');
        hash.update('\0');
        if (stats.isSymbolicLink()) {
            hash.update('symlink\0');
            hash.update(fs.readlinkSync(target), 'utf8');
            hash.update('\0');
            return;
        }
        hash.update(`file:${(stats.mode & 0o111) !== 0 ? 'x' : '-'}\0`);
        hash.update(fs.readFileSync(target));
        hash.update('\0');
    };
    for (const relative of ['package.json', 'package-lock.json', 'ops', 'scripts', 'src']) {
        visit(path.join(root, relative), relative);
    }
    return hash.digest('hex');
};

function createFixture(t) {
    assert.ok(fs.existsSync(bashPath), `bash ausente: ${bashPath}`);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-legacy-v102-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const baseDir = path.join(root, 'opt', 'vitalismen-automacao');
    const releasesDir = path.join(baseDir, 'releases');
    const releaseDir = path.join(releasesDir, releaseName);
    const stateDir = path.join(root, 'state');
    const logDir = path.join(root, 'log');
    const mocksDir = path.join(root, 'mocks');
    for (const directory of [releaseDir, stateDir, logDir, mocksDir]) fs.mkdirSync(directory, { recursive: true });
    fs.mkdirSync(path.join(releaseDir, 'ops'));
    fs.mkdirSync(path.join(releaseDir, 'scripts'));
    fs.mkdirSync(path.join(releaseDir, 'src'));
    fs.writeFileSync(path.join(releaseDir, 'package.json'), '{"name":"legacy-v102"}\n');
    fs.writeFileSync(path.join(releaseDir, 'package-lock.json'), '{"lockfileVersion":3}\n');
    fs.writeFileSync(path.join(releaseDir, 'ops', 'legacy.sh'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
    fs.chmodSync(path.join(releaseDir, 'ops', 'legacy.sh'), 0o755);
    fs.writeFileSync(path.join(releaseDir, 'scripts', 'legacy.mjs'), 'export const legacy = true;\n');
    fs.writeFileSync(path.join(releaseDir, 'src', 'index.js'), 'export const baseline = true;\n');
    mustRun('git', ['init', releaseDir]);
    mustRun('git', ['-C', releaseDir, 'config', 'user.name', 'Vitalismen V102 Test']);
    mustRun('git', ['-C', releaseDir, 'config', 'user.email', 'v102-test@invalid.local']);
    mustRun('git', ['-C', releaseDir, 'checkout', '-b', 'codex/legacy-baseline-v102-test']);
    mustRun('git', ['-C', releaseDir, 'add', '.']);
    mustRun('git', ['-C', releaseDir, 'commit', '-m', 'test: baseline legado']);
    const commit = mustRun('git', ['-C', releaseDir, 'rev-parse', 'HEAD']).stdout.trim().toLowerCase();
    const tree = mustRun('git', ['-C', releaseDir, 'rev-parse', 'HEAD^{tree}']).stdout.trim().toLowerCase();
    const fingerprint = legacyFingerprint(releaseDir);
    const pm2 = path.join(mocksDir, 'pm2.sh');
    const readlink = path.join(mocksDir, 'readlink.sh');
    const flock = path.join(mocksDir, 'flock.sh');
    writeExecutable(pm2, String.raw`#!/usr/bin/env bash
if [[ "$1" == "pid" ]]; then printf '%s\n' "$V102_PID"; exit 0; fi
if [[ "$1" == "jlist" ]]; then
  printf '[{"name":"vitalismen-automation","pid":%s,"pm2_env":{"status":"%s","pm_cwd":"%s/current","pm_exec_path":"%s/current/src/index.js"}}]' "$V102_PID" "$V102_PM2_STATUS" "$V102_BASE_DIR" "$V102_BASE_DIR"
  exit 0
fi
exit 64
`);
    writeExecutable(readlink, String.raw`#!/usr/bin/env bash
printf '%s\n' "$V102_CURRENT_TARGET"
`);
    writeExecutable(flock, '#!/usr/bin/env bash\nexit 0\n');
    const env = {
        ...process.env,
        VITALISMEN_STAGE_TEST_MODE: 'true',
        VITALISMEN_STAGE_TEST_BASE_DIR: toBashPath(baseDir),
        VITALISMEN_STAGE_TEST_STATE_DIR: toBashPath(stateDir),
        VITALISMEN_STAGE_TEST_LOG_DIR: toBashPath(logDir),
        VITALISMEN_STAGE_TEST_REPO_URL: process.platform === 'win32' ? releaseDir.replaceAll('\\', '/') : releaseDir,
        VITALISMEN_STAGE_NODE_CMD: toBashPath(process.execPath),
        VITALISMEN_STAGE_PM2_CMD: toBashPath(pm2),
        VITALISMEN_STAGE_CURL_CMD: '/usr/bin/true',
        VITALISMEN_STAGE_READLINK_CMD: toBashPath(readlink),
        VITALISMEN_STAGE_LN_CMD: '/usr/bin/ln',
        VITALISMEN_STAGE_MV_CMD: '/usr/bin/mv',
        VITALISMEN_STAGE_UNLINK_CMD: '/usr/bin/rm',
        VITALISMEN_STAGE_ENV_CMD: '/usr/bin/env',
        VITALISMEN_STAGE_SLEEP_CMD: '/usr/bin/true',
        VITALISMEN_STAGE_SHA256_CMD: '/usr/bin/sha256sum',
        VITALISMEN_STAGE_GIT_CMD: 'git',
        VITALISMEN_STAGE_NPM_CMD: '/usr/bin/true',
        VITALISMEN_STAGE_COMPATIBILITY_RUNNER: '/usr/bin/true',
        VITALISMEN_STAGE_GUARD_RUNNER: '/usr/bin/true',
        VITALISMEN_STAGE_FLOCK_CMD: toBashPath(flock),
        VITALISMEN_STAGE_OFFICIAL_HEALTH_URL: 'https://official.invalid/api/health/',
        VITALISMEN_STAGE_OFFICIAL_PANEL_URL: 'https://official.invalid/n/',
        VITALISMEN_STAGE_LOCAL_HEALTH_URL: 'http://127.0.0.1:3001/api/health/',
        VITALISMEN_STAGE_TEST_LEGACY_RELEASE_NAME: releaseName,
        VITALISMEN_STAGE_TEST_LEGACY_COMMIT: commit,
        VITALISMEN_STAGE_TEST_LEGACY_TREE: tree,
        VITALISMEN_STAGE_TEST_LEGACY_FINGERPRINT: fingerprint,
        VITALISMEN_STAGE_TEST_LEGACY_SOURCE_REF: sourceRef,
        VITALISMEN_STAGE_TEST_LEGACY_HOSTNAME: 'v102-official-host',
        VITALISMEN_STAGE_TEST_LEGACY_MACHINE_ID_SHA256: 'a'.repeat(64),
        V102_CURRENT_TARGET: toBashPath(releaseDir),
        V102_BASE_DIR: toBashPath(baseDir),
        V102_PID: '3349852',
        V102_PM2_STATUS: 'online',
        VITALISMEN_LEGACY_BASELINE_AUTHORIZE: authorization
    };
    return { root, baseDir, releaseDir, stateDir, commit, tree, fingerprint, env };
}

function invoke(fixture, extraEnv = {}, args = []) {
    const expected = args.length ? args : [releaseName, fixture.commit, fixture.tree, fixture.fingerprint];
    const result = run(bashPath, [toBashPath(helperPath), 'legacy-baseline-verify', ...expected], {
        env: { ...fixture.env, ...extraEnv }
    });
    return { ...result, combined: `${result.stdout || ''}${result.stderr || ''}${result.error ? `\n${result.error.message}` : ''}` };
}

test('V102 cria somente LEGACY_BASELINE_VERIFIED canônica e não declara STAGED_SOURCE', (t) => {
    const fixture = createFixture(t);
    const result = invoke(fixture);
    assert.equal(result.status, 0, result.combined);
    assert.match(result.stdout, /LEGACY_BASELINE_TESTS|LEGACY_BASELINE_VERIFIED=SIM/);
    const file = path.join(fixture.stateDir, 'legacy-baseline-attestation-v102.json');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(value.status, 'LEGACY_BASELINE_VERIFIED');
    assert.equal(value.proofType, 'LEGACY_BASELINE_VERIFIED');
    assert.equal(value.stagedSourceClaimed, false);
    assert.equal(value.modernMetadataAbsent, true);
    assert.equal(value.singleUse, true);
    assert.equal(value.reusable, false);
});

for (const [name, mutate] of [
    ['commit diferente', (fixture) => ({ args: [releaseName, 'b'.repeat(40), fixture.tree, fixture.fingerprint] })],
    ['tree diferente', (fixture) => ({ args: [releaseName, fixture.commit, 'c'.repeat(40), fixture.fingerprint] })],
    ['fingerprint diferente', (fixture) => ({ args: [releaseName, fixture.commit, fixture.tree, 'd'.repeat(64)] })],
    ['current diferente', (fixture) => ({ env: { V102_CURRENT_TARGET: toBashPath(path.join(fixture.baseDir, 'releases', 'outra-release')) } })],
    ['health falhando', () => ({ env: { VITALISMEN_STAGE_TEST_LEGACY_HEALTH_CODE: '500' } })],
    ['release não ativa', (fixture) => ({ env: { V102_CURRENT_TARGET: toBashPath(fixture.baseDir) } })],
    ['attestation de outra VPS', () => ({ env: { VITALISMEN_STAGE_TEST_LEGACY_OBSERVED_MACHINE_ID_SHA256: 'e'.repeat(64) } })]
]) {
    test(`V102 rejeita ${name}`, (t) => {
        const fixture = createFixture(t);
        const change = mutate(fixture);
        const result = invoke(fixture, change.env || {}, change.args || []);
        assert.notEqual(result.status, 0, result.combined);
    });
}

test('V102 rejeita PID/processo diferente depois da attestation', (t) => {
    const fixture = createFixture(t);
    assert.equal(invoke(fixture).status, 0);
    const result = invoke(fixture, { V102_PID: '3349853' });
    assert.notEqual(result.status, 0, result.combined);
    assert.match(result.combined, /PM2 da attestation divergente/);
});

test('V102 rejeita release staged fingindo ser legacy', (t) => {
    const fixture = createFixture(t);
    fs.writeFileSync(path.join(fixture.releaseDir, '.staging-complete.json'), '{}\n');
    const result = invoke(fixture);
    assert.notEqual(result.status, 0, result.combined);
    assert.match(result.combined, /metadata moderna/);
});

test('V102 rejeita attestation falsa', (t) => {
    const fixture = createFixture(t);
    const file = path.join(fixture.stateDir, 'legacy-baseline-attestation-v102.json');
    const seal = path.join(fixture.stateDir, 'legacy-baseline-attestation-v102.sha256');
    fs.writeFileSync(file, '{"status":"LEGACY_BASELINE_VERIFIED"}\n');
    fs.writeFileSync(seal, `${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}\n`);
    const result = invoke(fixture);
    assert.notEqual(result.status, 0, result.combined);
});

test('V102 rejeita attestation alterada mesmo com JSON ainda parseável', (t) => {
    const fixture = createFixture(t);
    assert.equal(invoke(fixture).status, 0);
    const file = path.join(fixture.stateDir, 'legacy-baseline-attestation-v102.json');
    fs.appendFileSync(file, '\n');
    const result = invoke(fixture);
    assert.notEqual(result.status, 0, result.combined);
    assert.match(result.combined, /attestation legada alterada/);
});

test('V102 rejeita metadata incompleta mesmo se o seal também for recalculado', (t) => {
    const fixture = createFixture(t);
    assert.equal(invoke(fixture).status, 0);
    const file = path.join(fixture.stateDir, 'legacy-baseline-attestation-v102.json');
    const seal = path.join(fixture.stateDir, 'legacy-baseline-attestation-v102.sha256');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete value.tree;
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    fs.writeFileSync(seal, `${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}\n`);
    const result = invoke(fixture);
    assert.notEqual(result.status, 0, result.combined);
    assert.match(result.combined, /campos da attestation legada inválidos/);
});

test('V102 rejeita attestation reaproveitada', (t) => {
    const fixture = createFixture(t);
    assert.equal(invoke(fixture).status, 0);
    fs.writeFileSync(path.join(fixture.stateDir, 'legacy-baseline-attestation-v102.consumed.json'), '{}\n');
    const result = invoke(fixture);
    assert.notEqual(result.status, 0, result.combined);
    assert.match(result.combined, /já foi consumida/);
});

test('V102 rejeita release moderna e permit antigo não autoriza publish', (t) => {
    const fixture = createFixture(t);
    fs.writeFileSync(path.join(fixture.releaseDir, '.release-source.json'), '{}\n');
    const result = invoke(fixture);
    assert.notEqual(result.status, 0, result.combined);
    const helper = fs.readFileSync(helperPath, 'utf8');
    assert.match(helper, /permit de ativação não pode existir durante publicação/);
    assert.match(helper, /require_unconsumed_legacy_baseline_for_publish/);
    assert.match(helper, /baselineProofType/);
    assert.match(helper, /publication\.version === 2/);
});
