import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const release = process.env.V78_R4_RELEASE_FIXTURE;
const moduleFile = process.env.V78_R4_PARENT_CONTRACT_FIXTURE;
const expectedIdentity = process.env.V78_R4_EXPECTED_IDENTITY || 'R4';
const v201 = '/opt/vitalismen-automacao/releases/20260924T015646Z_production-20260924-641759b';
const enabled = process.platform === 'linux' && process.getuid?.() === 0
    && Boolean(release && moduleFile && fs.existsSync(moduleFile));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const parent = enabled ? await import(pathToFileURL(moduleFile).href) : null;

async function withSpoofedRead(file, bytes, callback) {
    const target = path.resolve(file);
    const original = fs.readFileSync;
    fs.readFileSync = (candidate, ...args) => {
        if (typeof candidate === 'string' && path.resolve(candidate) === target) return bytes;
        return original(candidate, ...args);
    };
    try { await callback(); }
    finally { fs.readFileSync = original; }
}

test('contrato sucessor aceita V201 e R4 exatos; ambos têm 46 arquivos parent-protected',
    { skip: !enabled }, async () => {
        for (const [root, identity] of [[v201, 'V201'], [release, expectedIdentity]]) {
            const result = await parent.assertEcBotCoreParentProtectionR4(root);
            assert.equal(result.identity, identity);
            assert.equal(result.protectedFileCount, 46);
        }
    });

test('SHA histórico V89 do helper PM2 sob R4 bloqueia, apesar do override ancestral',
    { skip: !enabled }, async () => {
        const file = path.join(release, 'scripts/lib/pm2-target-env-restart-v89.mjs');
        const current = fs.readFileSync(file, 'utf8');
        const historical = Buffer.from(current.replace(
            '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v97-context.mjs',
            '--import=/opt/vitalismen-automacao/current/src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'));
        assert.equal(sha256(historical),
            'cc90a6845002cce1405012a9f9318948b0821d81d8481acbf90ac2f65b5ffcb3');
        await withSpoofedRead(file, historical, async () => {
            await assert.rejects(parent.assertEcBotCoreParentProtectionR4(release),
                /V78_PARENT_PROTECTED_FILE_INVALID:scripts\/lib\/pm2-target-env-restart-v89\.mjs/);
        });
    });

test('hash R4 sob V201 bloqueia', { skip: !enabled }, async () => {
    const relative = 'scripts/lib/ec-bot-core-operational-contract-v78.mjs';
    await withSpoofedRead(path.join(v201, relative), fs.readFileSync(path.join(release, relative)),
        async () => assert.rejects(parent.assertEcBotCoreParentProtectionR4(v201),
            /V78_PARENT_PROTECTED_FILE_INVALID:scripts\/lib\/ec-bot-core-operational-contract-v78\.mjs/));
});

for (const relative of [
    'src/services/canaryControllerV77Service.js',
    'src/routes/shipments.js', 'src/routes/whatsapp.js', 'src/routes/zapi.js',
    'src/services/metaConversionsService.js'
]) {
    test(`bytes não autorizados bloqueiam ${relative}`, { skip: !enabled }, async () => {
        await withSpoofedRead(path.join(release, relative), Buffer.from('wrong\n'),
            async () => assert.rejects(parent.assertEcBotCoreParentProtectionR4(release)));
    });
}

test('arquivo protegido ausente bloqueia', { skip: !enabled }, async () => {
    const target = path.join(release, 'scripts/lib/pm2-target-env-restart-v89.mjs');
    const original = fs.lstatSync;
    fs.lstatSync = (candidate, ...args) => {
        if (typeof candidate === 'string' && path.resolve(candidate) === target) {
            throw new Error('ENOENT_TEST_PROTECTED_FILE');
        }
        return original(candidate, ...args);
    };
    try {
        await assert.rejects(parent.assertEcBotCoreParentProtectionR4(release),
            /ENOENT_TEST_PROTECTED_FILE/);
    } finally { fs.lstatSync = original; }
});

test('symlink em arquivo protegido bloqueia', { skip: !enabled }, async () => {
    const target = path.join(release, 'scripts/lib/pm2-target-env-restart-v89.mjs');
    const original = fs.lstatSync;
    fs.lstatSync = (candidate, ...args) => {
        if (typeof candidate === 'string' && path.resolve(candidate) === target) {
            return { isFile: () => true, isSymbolicLink: () => true };
        }
        return original(candidate, ...args);
    };
    try {
        await assert.rejects(parent.assertEcBotCoreParentProtectionR4(release),
            /V78_PARENT_SYMLINK_ESCAPE|R4_RELEASE_SYMLINK_ESCAPE/);
    } finally { fs.lstatSync = original; }
});

test('identidade protegida extra bloqueia', { skip: !enabled }, async () => {
    const file = path.join(release, 'docs/freeze/ec-operational-guard-context-v97-20260830.json');
    const value = JSON.parse(fs.readFileSync(file));
    value.protectedFiles['src/services/unauthorized.js'] = '0'.repeat(64);
    await withSpoofedRead(file, Buffer.from(`${JSON.stringify(value, null, 2)}\n`),
        async () => assert.rejects(parent.assertEcBotCoreParentProtectionR4(release),
            /V78_PARENT_MANIFEST_INVALID/));
});

for (const [label, relative, mutate] of [
    ['commit', '.release-source.json', value => { value.functionalCommit = '0'.repeat(40); }],
    ['tree', '.release-source.json', value => { value.functionalTree = '0'.repeat(40); }],
    ['attestation', '.r4-operational-attestation.json', value => { value.commit = '0'.repeat(40); }],
    ['checkpoint', null, value => { value.r4OperationalTree = '0'.repeat(40); }]
]) {
    test(`${label} incorreto bloqueia`, { skip: !enabled }, async () => {
        const file = relative ? path.join(release, relative)
            : expectedIdentity === 'R4_CONTROLLER_PIN'
                ? '/var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_CONTROLLER_PIN_AUTHORITY.json'
                : expectedIdentity === 'R4_SUCCESSOR'
                ? '/var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY.json'
                : '/var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_PAYLOAD_AUTHORITY.json';
        const value = JSON.parse(fs.readFileSync(file));
        mutate(value);
        await withSpoofedRead(file, Buffer.from(`${JSON.stringify(value, null, 2)}\n`),
            async () => assert.rejects(parent.assertEcBotCoreParentProtectionR4(release)));
    });
}

test('SHA incorreto do preload bloqueia', { skip: !enabled }, async () => {
    const file = path.join(release, 'scripts/lib/unified-successor-v202-r4-preload.mjs');
    await withSpoofedRead(file, Buffer.from('wrong preload\n'),
        async () => assert.rejects(parent.assertEcBotCoreParentProtectionR4(release)));
});

test('wrapper adulterado bloqueia sob autoridade sucessora',
    { skip: !enabled || !['R4_SUCCESSOR', 'R4_CONTROLLER_PIN'].includes(expectedIdentity) }, async () => {
        const file = path.join(release, 'ops/ec-bot-core-v78-successor-r4');
        await withSpoofedRead(file, Buffer.from('wrong wrapper\n'),
            async () => assert.rejects(parent.assertEcBotCoreParentProtectionR4(release),
                /R4_RELEASE_HASH_CHANGED:ops\/ec-bot-core-v78-successor-r4/));
    });

test('SHA do checkpoint pai adulterado bloqueia linhagem sucessora',
    { skip: !enabled || !['R4_SUCCESSOR', 'R4_CONTROLLER_PIN'].includes(expectedIdentity) }, async () => {
        const file = expectedIdentity === 'R4_CONTROLLER_PIN'
            ? '/var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY.json'
            : '/var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_PAYLOAD_AUTHORITY.json';
        const value = JSON.parse(fs.readFileSync(file));
        value.r4OperationalTree = '0'.repeat(40);
        await withSpoofedRead(file, Buffer.from(`${JSON.stringify(value, null, 2)}\n`),
            async () => assert.rejects(parent.assertEcBotCoreParentProtectionR4(release),
                /R4_PARENT_CHECKPOINT_CHANGED|R4_SUCCESSOR_CHECKPOINT_CHANGED/));
    });
