import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    NPM_LIFECYCLE_PRELOAD_V80_MANIFEST_PATH,
    NPM_LIFECYCLE_PRELOAD_V80_PRELOAD_PATH,
    buildNpmLifecyclePreloadOptionV80,
    resolveCanonicalProjectRootV80
} from '../src/services/npmLifecyclePreloadBootstrapV80Service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const cleanEnv = () => {
    const env = { ...process.env };
    for (const key of [
        'NODE_OPTIONS',
        'npm_config_node_options',
        'NPM_CONFIG_NODE_OPTIONS',
        'INIT_CWD',
        'npm_lifecycle_event',
        'npm_package_json',
        'VITALISMEN_V80_CANONICAL_PROJECT_ROOT',
        'VITALISMEN_V80_PROCESS_CLASSIFICATION',
        'VITALISMEN_V80_OFFICIAL_GUARD_ID'
    ]) delete env[key];
    return env;
};
const runNode = (args, options = {}) => spawnSync(process.execPath, args, {
    cwd: options.cwd || root,
    env: options.env || cleanEnv(),
    encoding: 'utf8',
    timeout: options.timeout || 120_000
});
const output = (result) => `${result.stdout || ''}${result.stderr || ''}`;
const assertPassed = (result, label) => assert.equal(
    result.status,
    0,
    `${label}\n${result.error?.stack || ''}${output(result)}`
);
const manifest = JSON.parse(fs.readFileSync(path.join(root, NPM_LIFECYCLE_PRELOAD_V80_MANIFEST_PATH), 'utf8'));

test('fixture reproduz a resolução relativa V79 dentro do cwd do Baileys', () => {
    const dependencyCwd = path.join(root, 'node_modules', '@whiskeysockets', 'baileys');
    assert.equal(fs.existsSync(dependencyCwd), true, 'Baileys local necessário para a reprodução');
    const env = cleanEnv();
    env.NODE_OPTIONS = '--import=./scripts/lib/ec-bot-core-readiness-v79-successor-context.mjs';
    const result = runNode(['-e', "process.stdout.write('UNEXPECTED_EXECUTION')"], {
        cwd: dependencyCwd,
        env
    });
    assert.notEqual(result.status, 0);
    assert.match(output(result), /ERR_MODULE_NOT_FOUND/);
    assert.match(output(result), /node_modules[\\/]@whiskeysockets[\\/]baileys[\\/]scripts[\\/]lib/);
});

test('resolvedor canônico usa entrypoint versionado e não confia em process.cwd', () => {
    const dependencyCwd = path.join(root, 'node_modules', '@whiskeysockets', 'baileys');
    const resolved = resolveCanonicalProjectRootV80({ cwd: dependencyCwd });
    assert.equal(resolved.root, fs.realpathSync(root));
    assert.equal(resolved.manifest.version, 80);
    assert.equal(resolved.manifest.parentVersion, 'V79');
    assert.match(resolved.manifestSha256, /^[0-9a-f]{64}$/);
});

test('INIT_CWD falso falha fechado', () => {
    const fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v80-fake-init-'));
    try {
        assert.throws(
            () => resolveCanonicalProjectRootV80({ env: { ...cleanEnv(), INIT_CWD: fakeRoot } }),
            /init_cwd_identity_mismatch/
        );
    } finally {
        fs.rmSync(fakeRoot, { recursive: true, force: true });
    }
});

test('raiz explícita inexistente falha fechado', () => {
    const missing = path.join(os.tmpdir(), `v80-missing-${process.pid}-${Date.now()}`);
    assert.throws(
        () => resolveCanonicalProjectRootV80({
            env: { ...cleanEnv(), VITALISMEN_V80_CANONICAL_PROJECT_ROOT: missing }
        }),
        /explicit_root_missing/
    );
});

test('raiz com traversal falha fechado', () => {
    const traversal = `${root}${path.sep}scripts${path.sep}..`;
    assert.throws(
        () => resolveCanonicalProjectRootV80({
            env: { ...cleanEnv(), VITALISMEN_V80_CANONICAL_PROJECT_ROOT: traversal }
        }),
        /explicit_root_must_be_absolute_without_traversal/
    );
});

test('preload fora da raiz canônica falha fechado', () => {
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v80-outside-preload-'));
    const outsidePreload = path.join(outsideRoot, 'npm-lifecycle-preload-bootstrap-v80.mjs');
    fs.writeFileSync(outsidePreload, 'export {};\n');
    try {
        assert.throws(
            () => resolveCanonicalProjectRootV80({ preloadUrl: pathToFileURL(outsidePreload).href }),
            /preload_outside_canonical_root/
        );
    } finally {
        fs.rmSync(outsideRoot, { recursive: true, force: true });
    }
});

test('lifecycle em node_modules executa sem contexto sucessor e não o repassa ao filho', () => {
    const dependencyCwd = path.join(root, 'node_modules', '@whiskeysockets', 'baileys');
    const preloadOption = buildNpmLifecyclePreloadOptionV80(root);
    const env = {
        ...cleanEnv(),
        NODE_OPTIONS: preloadOption,
        npm_config_node_options: preloadOption,
        INIT_CWD: root,
        npm_lifecycle_event: 'preinstall',
        npm_package_json: path.join(dependencyCwd, 'package.json')
    };
    const probe = [
        "const state=globalThis.__VITALISMEN_V80_BOOTSTRAP_STATE",
        "const child=require('node:child_process').spawnSync(process.execPath,['-e',\"process.stdout.write(String(Boolean(globalThis.__VITALISMEN_V80_BOOTSTRAP_STATE)))\"],{encoding:'utf8',env:process.env})",
        "process.stdout.write(JSON.stringify({state,nodeOptions:process.env.NODE_OPTIONS||null,npmNodeOptions:process.env.npm_config_node_options||null,child:child.stdout,status:child.status}))"
    ].join(';');
    const result = runNode(['-e', probe], { cwd: dependencyCwd, env });
    assertPassed(result, 'dependency lifecycle');
    const observed = JSON.parse(result.stdout);
    assert.equal(observed.state.classification, 'dependency_lifecycle');
    assert.equal(observed.state.contextActive, false);
    assert.equal(observed.nodeOptions, null);
    assert.equal(observed.npmNodeOptions, null);
    assert.equal(observed.child, 'false');
    assert.equal(observed.status, 0);
});

test('guard oficial mantém contexto V80 e transporte para encadeamento npm', () => {
    const preloadOption = buildNpmLifecyclePreloadOptionV80(root);
    const env = {
        ...cleanEnv(),
        NODE_OPTIONS: preloadOption,
        npm_config_node_options: preloadOption,
        INIT_CWD: root,
        npm_lifecycle_event: 'guard:runtime-chain-v71',
        npm_package_json: path.join(root, 'package.json')
    };
    const probe = [
        "const state=globalThis.__VITALISMEN_V80_BOOTSTRAP_STATE",
        "const overrides=globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES||[]",
        "process.stdout.write(JSON.stringify({state,overrideCount:overrides.length,nodeOptions:process.env.NODE_OPTIONS||null,npmNodeOptions:process.env.npm_config_node_options||null}))"
    ].join(';');
    const result = runNode(['-e', probe], { env });
    assertPassed(result, 'official guard bootstrap');
    const observed = JSON.parse(result.stdout);
    assert.equal(observed.state.classification, 'official_guard');
    assert.equal(observed.state.contextActive, true);
    assert.ok(observed.overrideCount > 0);
    assert.equal(observed.nodeOptions, null);
    assert.equal(observed.npmNodeOptions, preloadOption);
});

test('guard V79 executado da raiz passa', () => {
    const result = runNode(['scripts/guard-ec-bot-core-readiness-v79.mjs']);
    assertPassed(result, 'guard V79');
    assert.match(result.stdout, /V79_ATTESTATION=PASS/);
});

test('guard histórico sem contexto sucessor falha fechado', () => {
    const result = runNode(['src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js']);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /alteração não autorizada|manifesto|inválid|bloquead/i);
});

test('guard histórico com contexto V80 passa', () => {
    const preloadOption = buildNpmLifecyclePreloadOptionV80(root);
    const env = {
        ...cleanEnv(),
        NODE_OPTIONS: preloadOption,
        npm_config_node_options: preloadOption,
        INIT_CWD: root,
        npm_lifecycle_event: 'guard:runtime-chain-v71',
        npm_package_json: path.join(root, 'package.json')
    };
    const result = runNode(['src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js'], { env });
    assertPassed(result, 'historical guard with V80 context');
    assert.match(result.stdout, /CANARY-CONTROLLER-HEALTH-POLICY-RESET-V77H2/);
});

const copyIdentityFiles = (targetRoot) => {
    const files = [
        '.vitalismen-official-root',
        'docs/freeze/ec-bot-core-readiness-v79-20260829.json',
        'docs/EC_BOT_CORE_READINESS_FREEZE_V79_20260829.md',
        NPM_LIFECYCLE_PRELOAD_V80_MANIFEST_PATH,
        ...manifest.newProtectedFiles
    ];
    for (const relativePath of new Set(files)) {
        const source = path.join(root, relativePath);
        const target = path.join(targetRoot, relativePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
    }
};

test('npm ci executa postinstall Baileys sintético sem bypass de lifecycle', { timeout: 180_000 }, () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v80-npm-ci-baileys-'));
    try {
        copyIdentityFiles(fixtureRoot);
        const dependencyRoot = path.join(fixtureRoot, 'fixture-packages', 'baileys');
        fs.mkdirSync(dependencyRoot, { recursive: true });
        fs.writeFileSync(path.join(dependencyRoot, 'package.json'), `${JSON.stringify({
            name: '@whiskeysockets/baileys',
            version: '6.7.24-v80-fixture',
            scripts: { postinstall: 'node engine-requirements.js' }
        }, null, 2)}\n`);
        fs.writeFileSync(path.join(dependencyRoot, 'engine-requirements.js'), [
            "const fs=require('node:fs')",
            "const path=require('node:path')",
            "const child=require('node:child_process').spawnSync(process.execPath,['-e',\"process.stdout.write(String(Boolean(globalThis.__VITALISMEN_V80_BOOTSTRAP_STATE)))\"],{encoding:'utf8',env:process.env})",
            "const state=globalThis.__VITALISMEN_V80_BOOTSTRAP_STATE",
            "fs.writeFileSync(path.join(process.env.INIT_CWD,'.baileys-postinstall-v80.json'),JSON.stringify({executed:true,classification:state?.classification,contextActive:state?.contextActive,childContext:child.stdout,nodeOptions:process.env.NODE_OPTIONS||null,npmNodeOptions:process.env.npm_config_node_options||null}))"
        ].join(';'));

        const packResult = spawnSync(npmCommand, ['pack', '--silent'], {
            cwd: dependencyRoot,
            env: cleanEnv(),
            encoding: 'utf8',
            shell: process.platform === 'win32',
            timeout: 120_000
        });
        assertPassed(packResult, 'Baileys fixture pack');
        const tarballName = packResult.stdout.trim().split(/\r?\n/).at(-1);
        assert.match(tarballName, /\.tgz$/);
        fs.writeFileSync(path.join(fixtureRoot, 'package.json'), `${JSON.stringify({
            name: 'v80-npm-ci-fixture',
            version: '1.0.0',
            private: true,
            dependencies: {
                '@whiskeysockets/baileys': `file:fixture-packages/baileys/${tarballName}`
            }
        }, null, 2)}\n`);

        const lockResult = spawnSync(npmCommand, ['install', '--package-lock-only', '--no-audit', '--no-fund'], {
            cwd: fixtureRoot,
            env: cleanEnv(),
            encoding: 'utf8',
            shell: process.platform === 'win32',
            timeout: 120_000
        });
        assertPassed(lockResult, 'package-lock fixture');
        const preloadOption = buildNpmLifecyclePreloadOptionV80(fixtureRoot);
        const ciResult = spawnSync(npmCommand, ['ci', '--foreground-scripts', '--no-audit', '--no-fund'], {
            cwd: fixtureRoot,
            env: { ...cleanEnv(), npm_config_node_options: preloadOption },
            encoding: 'utf8',
            shell: process.platform === 'win32',
            timeout: 120_000
        });
        assertPassed(ciResult, 'npm ci fixture');
        assert.match(output(ciResult), /@whiskeysockets\/baileys@6\.7\.24-v80-fixture postinstall/);
        assert.match(output(ciResult), /node engine-requirements\.js/);
        const marker = JSON.parse(fs.readFileSync(path.join(fixtureRoot, '.baileys-postinstall-v80.json'), 'utf8'));
        assert.equal(marker.executed, true);
        assert.equal(marker.classification, 'dependency_lifecycle');
        assert.equal(marker.contextActive, false);
        assert.equal(marker.childContext, 'false');
        assert.equal(marker.nodeOptions, null);
        assert.equal(marker.npmNodeOptions, null);
    } finally {
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
});

test('fontes V80 não introduzem bypass nem cópia de preload para node_modules', () => {
    const operationalSources = [
        'scripts/lib/npm-lifecycle-preload-bootstrap-v80.mjs',
        'src/services/npmLifecyclePreloadBootstrapV80Service.js',
        'scripts/run-npm-lifecycle-preload-synthetic-stage-v80.mjs'
    ].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
    const forbiddenBypass = ['--ignore', 'scripts'].join('-');
    assert.equal(operationalSources.includes(forbiddenBypass), false);
    assert.doesNotMatch(operationalSources, /node_modules[^\n]{0,120}copyFile|copyFile[^\n]{0,120}node_modules/i);
});

test('V78/V79 e contratos de negócio permanecem imutáveis', () => {
    assert.equal(manifest.declaredAncestorOverrides.length, 0);
    assert.equal(manifest.policy.v78ByteIntact, true);
    assert.equal(manifest.policy.v79ByteIntact, true);
    assert.equal(manifest.policy.datasetId, '1468946114265008');
    assert.equal(manifest.policy.datasetChanged, false);
    assert.equal(manifest.policy.ctaChanged, false);
    assert.equal(manifest.policy.botBusinessLogicChanged, false);
});
