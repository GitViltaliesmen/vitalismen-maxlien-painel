import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildNpmLifecyclePreloadOptionV80 } from '../src/services/npmLifecyclePreloadBootstrapV80Service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = 'docs/freeze/npm-lifecycle-preload-bootstrap-compatibility-v80-20260829.json';
const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gitCommand = process.platform === 'win32' ? 'git.exe' : 'git';
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v80-synthetic-stage-'));
const sourceRoot = path.join(tempRoot, 'source');
const candidateRoot = path.join(tempRoot, 'candidate');
const attestationPath = path.join(tempRoot, 'synthetic-stage-v80-attestation.json');
const cleanEnv = () => {
    const env = { ...process.env };
    for (const key of [
        'NODE_OPTIONS',
        'npm_config_node_options',
        'NPM_CONFIG_NODE_OPTIONS',
        'INIT_CWD',
        'npm_lifecycle_event',
        'npm_package_json',
        'VITALISMEN_V80_CANONICAL_PROJECT_ROOT'
    ]) delete env[key];
    return env;
};
const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, {
        cwd: options.cwd || root,
        env: options.env || cleanEnv(),
        encoding: 'utf8',
        shell: process.platform === 'win32' && command === npmCommand,
        timeout: options.timeout || 300_000,
        maxBuffer: 64 * 1024 * 1024
    });
    if (result.status !== 0) {
        throw new Error(`${options.label || command} failed (${result.status})\n${result.stdout || ''}${result.stderr || ''}`);
    }
    return result;
};
const git = (args, options = {}) => run(gitCommand, args, { ...options, label: options.label || `git ${args.join(' ')}` });
const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const payloadFingerprint = (base, relativePaths) => crypto.createHash('sha256').update(
    relativePaths
        .slice()
        .sort((left, right) => left.localeCompare(right))
        .map((relativePath) => `${relativePath}\0${sha256File(path.join(base, relativePath))}\n`)
        .join('')
).digest('hex');
const copyV80Overlay = () => {
    const overlayFiles = [manifestPath, ...manifest.newProtectedFiles];
    for (const relativePath of overlayFiles) {
        const source = path.join(root, relativePath);
        const target = path.join(sourceRoot, relativePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
    }
};

try {
    git(['-c', 'core.autocrlf=false', 'clone', '--quiet', '--no-hardlinks', root, sourceRoot], { label: 'synthetic source checkout' });
    copyV80Overlay();
    git(['-C', sourceRoot, 'add', '--', manifestPath, ...manifest.newProtectedFiles]);
    const overlayStatus = git(['-C', sourceRoot, 'status', '--porcelain=v1'], { label: 'synthetic overlay status' }).stdout.trim();
    if (overlayStatus) {
        git([
            '-C', sourceRoot,
            '-c', 'user.name=Vitalismen V80 Synthetic',
            '-c', 'user.email=v80-synthetic@localhost',
            'commit', '--quiet', '-m', 'test(stage): materializa candidata sintética V80'
        ], { label: 'synthetic overlay commit' });
    }
    const commit = git(['-C', sourceRoot, 'rev-parse', 'HEAD^{commit}']).stdout.trim().toLowerCase();
    const tree = git(['-C', sourceRoot, 'rev-parse', 'HEAD^{tree}']).stdout.trim().toLowerCase();
    const parent = git(['-C', sourceRoot, 'rev-parse', 'HEAD^1']).stdout.trim().toLowerCase();
    if (parent !== manifest.parentCommit) throw new Error('synthetic candidate parent is not exact V79');

    git(['-c', 'core.autocrlf=false', 'clone', '--quiet', '--no-hardlinks', sourceRoot, candidateRoot], { label: 'synthetic candidate checkout' });
    git(['-C', candidateRoot, 'checkout', '--quiet', '--detach', commit], { label: 'synthetic detached checkout' });
    const tracked = git(['-C', candidateRoot, 'ls-files', '-z']).stdout.split('\0').filter(Boolean);
    const fingerprintBefore = payloadFingerprint(candidateRoot, tracked);
    const releaseName = `20260829T120000Z_production-20260829-${commit.slice(0, 7)}`;
    const releaseSource = {
        repository: 'GitViltaliesmen/vitalismen-maxlien-painel',
        publicationStatus: 'staged_candidate',
        releaseChannel: 'production',
        sourceRef: 'refs/heads/synthetic/v80',
        sourceRefResolvedCommit: commit,
        commit,
        functionalCommit: commit,
        functionalTree: tree,
        freezeVersion: 80,
        deployHelperContractVersion: 72,
        guardChainVersion: 71,
        runtimeGuardChainValidated: 71,
        predeployValidated: 'v71',
        dataCompatibilityVersion: 66,
        strictReadOnly: true,
        safeObservationPolicy: 'STRICT_READ_ONLY',
        allowedWriteClasses: [],
        productionBranchChanged: false,
        releaseName
    };
    fs.writeFileSync(
        path.join(candidateRoot, '.release-source.json'),
        `${JSON.stringify(releaseSource, null, 2)}\n`
    );
    const candidateGitPath = path.join(candidateRoot, '.git');
    if (!candidateGitPath.startsWith(tempRoot) || !fs.existsSync(candidateGitPath)) {
        throw new Error('synthetic .git removal target invalid');
    }
    fs.rmSync(candidateGitPath, { recursive: true, force: true });

    const preloadOption = buildNpmLifecyclePreloadOptionV80(candidateRoot);
    const stageEnv = { ...cleanEnv(), npm_config_node_options: preloadOption };
    const npmCi = run(npmCommand, ['ci', '--omit=dev', '--foreground-scripts', '--no-audit', '--no-fund'], {
        cwd: candidateRoot,
        env: stageEnv,
        timeout: 600_000,
        label: 'synthetic npm ci'
    });
    const npmCiOutput = `${npmCi.stdout || ''}${npmCi.stderr || ''}`;
    if (!/@whiskeysockets\/baileys@6\.7\.24 preinstall/.test(npmCiOutput)) {
        throw new Error(`Baileys preinstall was not observed\n${npmCiOutput}`);
    }
    if (!/node \.\/engine-requirements\.js/.test(npmCiOutput)) {
        throw new Error(`Baileys engine lifecycle was not observed\n${npmCiOutput}`);
    }
    if (!fs.existsSync(path.join(candidateRoot, 'node_modules', '@whiskeysockets', 'baileys', 'package.json'))) {
        throw new Error('Baileys package missing after npm ci');
    }

    run(process.execPath, ['src/services/npmLifecyclePreloadBootstrapFreezeRuntimeGuardV80.js'], {
        cwd: candidateRoot,
        env: cleanEnv(),
        label: 'V80 runtime guard'
    });
    run(npmCommand, ['run', 'guard:runtime-chain-v71'], {
        cwd: candidateRoot,
        env: stageEnv,
        label: 'historical runtime guard with V80 context'
    });
    run(process.execPath, ['scripts/guard-ec-bot-core-readiness-v79.mjs'], {
        cwd: candidateRoot,
        env: cleanEnv(),
        label: 'V79 guard'
    });
    run(process.execPath, ['scripts/guard-npm-lifecycle-preload-bootstrap-v80.mjs'], {
        cwd: candidateRoot,
        env: cleanEnv(),
        label: 'V80 static guard'
    });

    const fingerprintAfter = payloadFingerprint(candidateRoot, tracked);
    if (fingerprintAfter !== fingerprintBefore) {
        throw new Error('functional payload changed during synthetic stage');
    }
    const attestation = {
        version: 80,
        flow: 'CHECKOUT_NPM_CI_LIFECYCLE_GUARDS_FINGERPRINT_ATTESTATION',
        commit,
        tree,
        parentCommit: parent,
        releaseName,
        npmCi: 'PASS',
        baileysPreinstall: 'PASS',
        guards: 'PASS',
        fingerprintBefore,
        fingerprintAfter,
        productionMutationExecuted: false,
        pm2Restarted: false,
        qaCanaryExecuted: false
    };
    fs.writeFileSync(attestationPath, `${JSON.stringify(attestation, null, 2)}\n`);
    const observedAttestation = JSON.parse(fs.readFileSync(attestationPath, 'utf8'));
    if (
        observedAttestation.npmCi !== 'PASS'
        || observedAttestation.baileysPreinstall !== 'PASS'
        || observedAttestation.guards !== 'PASS'
        || observedAttestation.fingerprintBefore !== observedAttestation.fingerprintAfter
    ) {
        throw new Error('synthetic attestation invalid');
    }

    console.log('BAILEYS_POSTINSTALL=PASS');
    console.log('NPM_CI_SYNTHETIC=PASS');
    console.log('OFFICIAL_GUARDS=PASS');
    console.log('SYNTHETIC_STAGE_V80=PASS');
    console.log(`SYNTHETIC_COMMIT=${commit}`);
    console.log(`SYNTHETIC_TREE=${tree}`);
    console.log(`SYNTHETIC_FINGERPRINT=${fingerprintAfter}`);
} finally {
    if (!tempRoot.startsWith(os.tmpdir()) || !path.basename(tempRoot).startsWith('v80-synthetic-stage-')) {
        throw new Error('synthetic cleanup target invalid');
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
}
