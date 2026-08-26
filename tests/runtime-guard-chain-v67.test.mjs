import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from '../src/services/successorGuardContextService.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const freezeDir = path.join(projectRoot, 'docs', 'freeze');
const runtimeV47 = path.join(projectRoot, 'src', 'services', 'ecRepurchaseSqliteSerializationFreezeRuntimeGuardV47.js');
const runtimeV65 = path.join(projectRoot, 'src', 'services', 'postSaleGargalosFreezeRuntimeGuardV65.js');
const runtimeV66 = path.join(projectRoot, 'src', 'services', 'postSaleSafetyFreezeRuntimeGuardV66.js');
const runtimeV67 = path.join(projectRoot, 'src', 'services', 'runtimeGuardChainFreezeRuntimeGuardV67.js');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const cleanEnvironment = () => {
    const allowed = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP'];
    const clean = Object.fromEntries(allowed
        .filter((key) => process.env[key] !== undefined)
        .map((key) => [key, process.env[key]]));
    return {
        ...clean,
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'false',
        WHATSAPP_FUNNEL_ENABLED: 'false',
        POST_SALE_V66_MUTATIONS_ENABLED: 'false',
        DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
        DISABLE_SCHEDULER: '1'
    };
};

const copyRelative = (root, relativePath) => {
    const source = path.join(projectRoot, relativePath);
    const target = path.join(root, relativePath);
    assert.ok(fs.existsSync(source), `fixture-fonte ausente: ${relativePath}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
};

const createSanitizedSnapshot = (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-guard-v67-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const manifests = fs.readdirSync(freezeDir).filter((file) => file.endsWith('.json'));
    const protectedFiles = new Set();

    for (const file of manifests) {
        const relativePath = path.posix.join('docs/freeze', file);
        copyRelative(root, relativePath);
        const manifest = JSON.parse(fs.readFileSync(path.join(freezeDir, file), 'utf8'));
        for (const protectedFile of Object.keys(manifest.protectedFiles || {})) {
            protectedFiles.add(protectedFile);
        }
    }
    for (const relativePath of protectedFiles) copyRelative(root, relativePath);
    return root;
};

const runGuard = (cwd, runtime, env = cleanEnvironment()) => spawnSync(
    process.execPath,
    [runtime],
    { cwd, env, encoding: 'utf8', timeout: 120000 }
);

const assertFailed = (result, label) => {
    assert.equal(result.signal, null, `${label} terminou por sinal: ${result.signal}`);
    assert.equal(result.status, 1, `${label} deveria retornar 1:\n${result.stdout}\n${result.stderr}`);
};

test('V47 original permanece intacto e V66 declara o override legítimo da guia', () => {
    const guidePath = 'src/services/guidePrintDispatcherService.js';
    const v29 = JSON.parse(fs.readFileSync(path.join(freezeDir, 'logistics-clean-chat-v29-20260818.json'), 'utf8'));
    const v47 = JSON.parse(fs.readFileSync(path.join(freezeDir, 'ec-repurchase-sqlite-serialization-v47-20260822.json'), 'utf8'));
    const v65 = JSON.parse(fs.readFileSync(path.join(freezeDir, 'post-sale-gargalos-v65-20260826.json'), 'utf8'));
    const v66 = JSON.parse(fs.readFileSync(path.join(freezeDir, 'post-sale-safety-v66-20260826.json'), 'utf8'));
    const v67 = JSON.parse(fs.readFileSync(path.join(freezeDir, 'runtime-guard-chain-v67-20260826.json'), 'utf8'));

    assert.equal(sha256(path.join(freezeDir, 'ec-repurchase-sqlite-serialization-v47-20260822.json')), '41fb725a5a43393f7c9e52427be6635830d458c3e87a314d7e5a457f2791a88b');
    assert.equal(v29.protectedFiles[guidePath], '86d4feb9d5e93839ce1786c569b10c7d60c55916eb610b1612348dbdb0da547c');
    assert.ok(!v47.declaredAncestorOverrides.includes(guidePath));
    assert.ok(v66.declaredAncestorOverrides.includes(guidePath));
    assert.equal(v66.protectedFiles[guidePath], '6c0240c66cacb6545de48a9fa0531f484b75334d0372d969bfddf9c8e50505da');
    assert.equal(sha256(path.join(projectRoot, guidePath)), v66.protectedFiles[guidePath]);
    assert.equal(v66.parentManifestSha256, sha256(path.join(freezeDir, 'post-sale-gargalos-v65-20260826.json')));
    assert.equal(v67.parentManifestSha256, sha256(path.join(freezeDir, 'post-sale-safety-v66-20260826.json')));
    assert.equal(v65.parentFreezeId, 'dropi-customer-full-name-v64-20260826');
});

test('cadeia canônica reconstrói contexto em processo limpo; ancestral cru não o herda', (t) => {
    const snapshot = createSanitizedSnapshot(t);
    const canonical = runGuard(snapshot, runtimeV67);
    assert.equal(canonical.status, 0, `cadeia canônica falhou:\n${canonical.stdout}\n${canonical.stderr}`);
    assert.match(canonical.stdout, /RUNTIME-GUARD-CHAIN-V67/);

    const directAncestor = runGuard(snapshot, runtimeV65);
    assertFailed(directAncestor, 'V65 cru no tree sucessor');
    assert.match(directAncestor.stderr, /EC-REPURCHASE-SQLITE-V47/);
    assert.match(directAncestor.stderr, /guidePrintDispatcherService\.js/);
});

test('falha real no ancestral retorna 1 no V47, no wrapper V66 e na cadeia V67', (t) => {
    const snapshot = createSanitizedSnapshot(t);
    const ancestorFile = path.join(snapshot, 'approved_freezes', 'APPROVED_EC_REPURCHASE_SQLITE_SERIALIZATION_V47_20260822.txt');
    fs.appendFileSync(ancestorFile, '\nUNDECLARED_BYTE\n');

    const ancestor = runGuard(snapshot, runtimeV47);
    const wrapperV66 = runGuard(snapshot, runtimeV66);
    const canonical = runGuard(snapshot, runtimeV67);
    assertFailed(ancestor, 'V47 adulterado');
    assertFailed(wrapperV66, 'wrapper V66 com ancestral adulterado');
    assertFailed(canonical, 'cadeia V67 com ancestral adulterado');
    assert.match(wrapperV66.stderr, /EC-REPURCHASE-SQLITE-V47/);
    assert.match(canonical.stderr, /EC-REPURCHASE-SQLITE-V47/);
});

test('cadeia falha diante de byte não declarado, remoção do override, V47 adulterado ou parent quebrado', async (t) => {
    const cases = [
        {
            name: 'successor file hash',
            mutate(root) {
                fs.appendFileSync(path.join(root, 'src/services/guidePrintDispatcherService.js'), '\n// byte sem freeze\n');
            }
        },
        {
            name: 'successor override removed',
            mutate(root) {
                const file = path.join(root, 'docs/freeze/post-sale-safety-v66-20260826.json');
                const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
                manifest.declaredAncestorOverrides = manifest.declaredAncestorOverrides
                    .filter((entry) => entry !== 'src/services/guidePrintDispatcherService.js');
                fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
            }
        },
        {
            name: 'V47 manifest',
            mutate(root) {
                const file = path.join(root, 'docs/freeze/ec-repurchase-sqlite-serialization-v47-20260822.json');
                fs.appendFileSync(file, ' ');
            }
        },
        {
            name: 'parent manifest',
            mutate(root) {
                const file = path.join(root, 'docs/freeze/post-sale-gargalos-v65-20260826.json');
                fs.appendFileSync(file, ' ');
            }
        }
    ];

    for (const fixtureCase of cases) {
        await t.test(fixtureCase.name, (subtest) => {
            const snapshot = createSanitizedSnapshot(subtest);
            fixtureCase.mutate(snapshot);
            assertFailed(runGuard(snapshot, runtimeV67), fixtureCase.name);
        });
    }
});

test('contexto formal remove duplicatas, rejeita caminhos inválidos e restaura estado após exceção', async () => {
    const key = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
    globalThis[key] = ['ancestor.txt'];
    const failure = new Error('ancestor failed');

    await assert.rejects(
        withSuccessorGuardContext(['successor.txt', 'successor.txt'], async () => {
            assert.deepEqual(getSuccessorOverrideFiles(), ['ancestor.txt', 'successor.txt']);
            throw failure;
        }),
        failure
    );
    assert.deepEqual(getSuccessorOverrideFiles(), ['ancestor.txt']);
    await assert.rejects(withSuccessorGuardContext(['../escape'], async () => {}), /caminho relativo inválido/);
    delete globalThis[key];
});

test('helper-fonte invoca a cadeia V67 e não executa runtimes ancestrais crus', () => {
    const helper = fs.readFileSync(path.join(projectRoot, 'ops', 'vitalismen-stage'), 'utf8');
    const runtimeAt = helper.indexOf('src/services/runtimeGuardChainFreezeRuntimeGuardV67.js');
    const staticV66At = helper.indexOf('scripts/guard-post-sale-safety-v66.mjs');
    assert.ok(runtimeAt >= 0 && staticV66At > runtimeAt);
    assert.doesNotMatch(helper, /src\/services\/(?:dropiCustomerFullName|postSaleGargalos)FreezeRuntimeGuardV(?:64|65)\.js/);
    assert.match(helper, /runtime_guard_chain_v67/);
});
