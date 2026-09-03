import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    NPM_LIFECYCLE_STAGE_ENVELOPE_V81_HELPER_SHA256,
    NPM_LIFECYCLE_STAGE_ENVELOPE_V81_MANIFEST_PATH,
    NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PRELOAD_PATH,
    buildNpmLifecycleStageEnvelopeOptionV81
} from '../src/services/npmLifecycleStageEnvelopeCompatibilityV81Service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const v80Manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/freeze/npm-lifecycle-preload-bootstrap-compatibility-v80-20260829.json'), 'utf8'));
const v81Manifest = JSON.parse(fs.readFileSync(path.join(root, NPM_LIFECYCLE_STAGE_ENVELOPE_V81_MANIFEST_PATH), 'utf8'));
const cleanEnv = () => {
    const env = { ...process.env };
    for (const key of [
        'NODE_OPTIONS', 'npm_config_node_options', 'NPM_CONFIG_NODE_OPTIONS',
        'INIT_CWD', 'npm_lifecycle_event', 'npm_package_json',
        'VITALISMEN_V80_CANONICAL_PROJECT_ROOT', 'VITALISMEN_V80_PROCESS_CLASSIFICATION',
        'VITALISMEN_V80_OFFICIAL_GUARD_ID'
    ]) delete env[key];
    return env;
};
const output = (result) => `${result.stdout || ''}${result.stderr || ''}`;
const runNode = (args, options = {}) => spawnSync(process.execPath, args, {
    cwd: options.cwd || root,
    env: options.env || cleanEnv(),
    encoding: 'utf8',
    timeout: options.timeout || 120_000
});
const assertPassed = (result, label) => assert.equal(result.status, 0, `${label}\n${result.error?.stack || ''}${output(result)}`);
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const releaseMetadata = (overrides = {}) => {
    const commit = overrides.functionalCommit || '1234567890abcdef1234567890abcdef12345678';
    return {
        repository: 'GitViltaliesmen/vitalismen-maxlien-painel',
        publicationStatus: 'staged_candidate',
        releaseChannel: 'production',
        sourceRef: 'refs/heads/codex/v81-stage-envelope-fixture',
        sourceRefResolvedCommit: commit,
        commit,
        functionalCommit: commit,
        functionalTree: 'abcdef1234567890abcdef1234567890abcdef12',
        freezeVersion: 72,
        deployHelperContractVersion: 72,
        guardChainVersion: 71,
        runtimeGuardChainValidated: 71,
        predeployValidated: 'v71',
        dataCompatibilityVersion: 66,
        strictReadOnly: true,
        safeObservationPolicy: 'STRICT_READ_ONLY',
        allowedWriteClasses: [],
        productionBranchCommitBefore: 'fedcba0987654321fedcba0987654321fedcba09',
        productionBranchChanged: false,
        productionTagRequiredForStaging: false,
        productionTagObservation: 'ABSENT',
        createdAt: '2026-08-29T12:00:00Z',
        releaseName: `20260829T120000Z_production-20260829-${commit.slice(0, 7)}`,
        postSaleCompatibility: {
            runtimeVersion: 66,
            readsDataCompatibilityThrough: 66,
            writesDataCompatibilityVersion: 66,
            requiresRollbackTargetPreflight: true
        },
        ...overrides
    };
};
const copyIdentity = (targetRoot) => {
    const files = new Set([
        '.vitalismen-official-root', 'package.json', 'ops/vitalismen-stage',
        'docs/freeze/ec-bot-core-readiness-v79-20260829.json',
        'docs/EC_BOT_CORE_READINESS_FREEZE_V79_20260829.md',
        'docs/freeze/npm-lifecycle-preload-bootstrap-compatibility-v80-20260829.json',
        ...v80Manifest.newProtectedFiles,
        NPM_LIFECYCLE_STAGE_ENVELOPE_V81_MANIFEST_PATH,
        ...v81Manifest.newProtectedFiles
    ]);
    for (const relativePath of files) {
        const source = path.join(root, relativePath);
        const target = path.join(targetRoot, relativePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
    }
    fs.writeFileSync(path.join(targetRoot, '.release-source.json'), `${JSON.stringify(releaseMetadata(), null, 2)}\n`);
};
const createStageFixture = () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'v81-stage-envelope-'));
    copyIdentity(fixture);
    const dependency = path.join(fixture, 'node_modules', '@whiskeysockets', 'baileys');
    fs.mkdirSync(dependency, { recursive: true });
    fs.writeFileSync(path.join(dependency, 'package.json'), '{"name":"@whiskeysockets/baileys","version":"6.7.24"}\n');
    return { fixture, dependency };
};
const lifecycleEnv = (fixture, dependency, preloadRelativePath) => {
    const option = `--import=${pathToFileURL(path.join(fixture, preloadRelativePath)).href}`;
    return {
        ...cleanEnv(),
        NODE_OPTIONS: option,
        npm_config_node_options: option,
        INIT_CWD: fixture,
        npm_lifecycle_event: 'postinstall',
        npm_package_json: path.join(dependency, 'package.json')
    };
};

test('V80 reproduz bloqueio ao receber o envelope real V72 do helper oficial', () => {
    const { fixture, dependency } = createStageFixture();
    try {
        const result = runNode(['-e', "process.stdout.write('UNEXPECTED')"], {
            cwd: dependency,
            env: lifecycleEnv(fixture, dependency, 'scripts/lib/npm-lifecycle-preload-bootstrap-v80.mjs')
        });
        assert.notEqual(result.status, 0);
        assert.match(output(result), /release_source_identity_invalid/);
    } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
    }
});

test('V81 aceita somente o envelope V72/V71/V66 materializado pelo helper atestado', () => {
    const { fixture, dependency } = createStageFixture();
    try {
        const probe = "process.stdout.write(JSON.stringify(globalThis.__VITALISMEN_V81_STAGE_ENVELOPE_STATE))";
        const result = runNode(['-e', probe], {
            cwd: dependency,
            env: lifecycleEnv(fixture, dependency, NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PRELOAD_PATH)
        });
        assertPassed(result, 'V81 dependency lifecycle');
        const state = JSON.parse(result.stdout);
        assert.equal(state.version, 81);
        assert.equal(state.classification, 'dependency_lifecycle');
        assert.equal(state.contextActive, false);
        assert.equal(state.sourceIdentity, 'official-stage-v72-envelope');
    } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
    }
});

test('V81 falha fechado se o freezeVersion divergir do helper oficial', () => {
    const { fixture, dependency } = createStageFixture();
    try {
        fs.writeFileSync(path.join(fixture, '.release-source.json'), `${JSON.stringify(releaseMetadata({ freezeVersion: 80 }), null, 2)}\n`);
        const result = runNode(['-e', '0'], {
            cwd: dependency,
            env: lifecycleEnv(fixture, dependency, NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PRELOAD_PATH)
        });
        assert.notEqual(result.status, 0);
        assert.match(output(result), /official_stage_envelope_invalid/);
    } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
    }
});

test('V81 falha fechado se o helper versionado divergir do SHA instalado', () => {
    const { fixture, dependency } = createStageFixture();
    try {
        fs.appendFileSync(path.join(fixture, 'ops', 'vitalismen-stage'), '\n# drift\n');
        const result = runNode(['-e', '0'], {
            cwd: dependency,
            env: lifecycleEnv(fixture, dependency, NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PRELOAD_PATH)
        });
        assert.notEqual(result.status, 0);
        assert.match(output(result), /manifest_identity_or_policy_invalid|required_identity|helper|protected/i);
    } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
    }
});

test('guard oficial local mantém o contexto sucessor com V81', () => {
    const option = buildNpmLifecycleStageEnvelopeOptionV81(root);
    const env = {
        ...cleanEnv(), NODE_OPTIONS: option, npm_config_node_options: option,
        INIT_CWD: root, npm_lifecycle_event: 'guard:runtime-chain-v71',
        npm_package_json: path.join(root, 'package.json')
    };
    const probe = [
        'const state=globalThis.__VITALISMEN_V81_STAGE_ENVELOPE_STATE',
        'const overrides=globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES||[]',
        'process.stdout.write(JSON.stringify({state,overrideCount:overrides.length,nodeOptions:process.env.NODE_OPTIONS||null,npmNodeOptions:process.env.npm_config_node_options||null}))'
    ].join(';');
    const result = runNode(['-e', probe], { env });
    assertPassed(result, 'V81 official guard');
    const observed = JSON.parse(result.stdout);
    assert.equal(observed.state.contextActive, true);
    assert.equal(observed.state.sourceIdentity, 'git');
    assert.ok(observed.overrideCount > 0);
    assert.equal(observed.nodeOptions, null);
    assert.equal(observed.npmNodeOptions, option);
});

test('npm ci executa postinstall Baileys sob o envelope oficial V81', { timeout: 180_000 }, () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'v81-npm-ci-baileys-'));
    try {
        copyIdentity(fixture);
        const dependencyRoot = path.join(fixture, 'fixture-packages', 'baileys');
        fs.mkdirSync(dependencyRoot, { recursive: true });
        fs.writeFileSync(path.join(dependencyRoot, 'package.json'), `${JSON.stringify({
            name: '@whiskeysockets/baileys', version: '6.7.24-v81-fixture',
            scripts: { postinstall: 'node engine-requirements.js' }
        }, null, 2)}\n`);
        fs.writeFileSync(path.join(dependencyRoot, 'engine-requirements.js'), [
            "const fs=require('node:fs')",
            "const path=require('node:path')",
            "const child=require('node:child_process').spawnSync(process.execPath,['-e',\"process.stdout.write(String(Boolean(globalThis.__VITALISMEN_V81_STAGE_ENVELOPE_STATE)))\"],{encoding:'utf8',env:process.env})",
            "const state=globalThis.__VITALISMEN_V81_STAGE_ENVELOPE_STATE",
            "fs.writeFileSync(path.join(process.env.INIT_CWD,'.baileys-postinstall-v81.json'),JSON.stringify({executed:true,classification:state?.classification,contextActive:state?.contextActive,childContext:child.stdout,nodeOptions:process.env.NODE_OPTIONS||null,npmNodeOptions:process.env.npm_config_node_options||null}))"
        ].join(';'));
        const pack = spawnSync(npmCommand, ['pack', '--silent'], { cwd: dependencyRoot, env: cleanEnv(), encoding: 'utf8', shell: process.platform === 'win32' });
        assertPassed(pack, 'V81 Baileys pack');
        const tarball = pack.stdout.trim().split(/\r?\n/).at(-1);
        fs.writeFileSync(path.join(fixture, 'package.json'), `${JSON.stringify({
            name: 'v81-npm-ci-fixture', version: '1.0.0', private: true,
            dependencies: { '@whiskeysockets/baileys': `file:fixture-packages/baileys/${tarball}` }
        }, null, 2)}\n`);
        const lock = spawnSync(npmCommand, ['install', '--package-lock-only', '--no-audit', '--no-fund'], { cwd: fixture, env: cleanEnv(), encoding: 'utf8', shell: process.platform === 'win32' });
        assertPassed(lock, 'V81 fixture lock');
        const option = `--import=${pathToFileURL(path.join(fixture, NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PRELOAD_PATH)).href}`;
        const ci = spawnSync(npmCommand, ['ci', '--foreground-scripts', '--no-audit', '--no-fund'], {
            cwd: fixture, env: { ...cleanEnv(), npm_config_node_options: option },
            encoding: 'utf8', shell: process.platform === 'win32', timeout: 120_000
        });
        assertPassed(ci, 'V81 npm ci fixture');
        assert.match(output(ci), /@whiskeysockets\/baileys@6\.7\.24-v81-fixture postinstall/);
        const marker = JSON.parse(fs.readFileSync(path.join(fixture, '.baileys-postinstall-v81.json'), 'utf8'));
        assert.equal(marker.executed, true);
        assert.equal(marker.classification, 'dependency_lifecycle');
        assert.equal(marker.contextActive, false);
        assert.equal(marker.childContext, 'false');
        assert.equal(marker.nodeOptions, null);
        assert.equal(marker.npmNodeOptions, null);
    } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
    }
});

test('V80, helper e contratos comerciais permanecem byte intactos', () => {
    assert.equal(sha256(path.join(root, 'docs/freeze/npm-lifecycle-preload-bootstrap-compatibility-v80-20260829.json')), v81Manifest.parentManifestSha256);
    assert.equal(sha256(path.join(root, 'ops/vitalismen-stage')), NPM_LIFECYCLE_STAGE_ENVELOPE_V81_HELPER_SHA256);
    assert.deepEqual(v81Manifest.declaredAncestorOverrides, []);
    assert.equal(v81Manifest.policy.v80ByteIntact, true);
    assert.equal(v81Manifest.policy.datasetId, '1468946114265008');
    assert.equal(v81Manifest.policy.datasetChanged, false);
    assert.equal(v81Manifest.policy.ctaChanged, false);
    assert.equal(v81Manifest.policy.botBusinessLogicChanged, false);
});
