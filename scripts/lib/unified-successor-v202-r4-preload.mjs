import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AUTHORITY_SHA256 = 'e65346ae638080e9731e0aed044de1d73cd8656f4a63b0c6b72b48ad4fb0f520';
const V78_SELECTOR_SHA256 = 'bfd27de60c06ea0925c03cfbebe48383a321c6146a55997ad1b3672349ccc6fa';
const V78_CONTRACT_SHA256 = '2eba907798f15f4b617c9ceeb96d6bf6c79374218d7d64743fb737675aaa33b3';
const CHECKPOINT_PATH =
    '/var/lib/vitalismen-deploy/CHECKPOINT_UNIFIED_SUCCESSOR_OPERATIONAL_R4_FREEZE_SUCCESSOR_READY.json';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const assertRequiredContexts = ({ v199, v146 }) => {
    assert.equal(v199, true, 'R4_V199_CONTEXT_MISSING');
    assert.equal(v146, true, 'R4_V146_CONTEXT_MISSING');
};
const assertRestored = (before, after) => assert.deepEqual(after, before, 'R4_CONTEXT_LEAK');
const assertOperationalLocks = (locks, env) => {
    assert.deepEqual(locks, {
        dropiRealBlocked: true, purchaseRealBlocked: true, productionMutationBlocked: true
    });
    for (const key of ['DROPPI_EC_ACTIVE_SYNC_ENABLED', 'VITALISMEN_META_PURCHASE_ENABLED']) {
        assert.notEqual(String(env[key] ?? '').toLowerCase(), 'true', `R4_EXTERNAL_EFFECT_ENABLED:${key}`);
    }
    assert.equal(String(env.DROPPI_EC_ACTIVE_SYNC_MODE ?? 'REPORT_ONLY').toUpperCase(),
        'REPORT_ONLY', 'R4_DROPI_MODE_NOT_REPORT_ONLY');
};
async function loadVerifiedAuthority(root) {
    for (const directory of ['/var', '/var/lib', path.dirname(CHECKPOINT_PATH)]) {
        const stat = fs.lstatSync(directory);
        assert.ok(stat.isDirectory() && !stat.isSymbolicLink()
            && stat.uid === 0 && stat.gid === 0 && (stat.mode & 0o022) === 0,
        'R4_BOOTSTRAP_CHECKPOINT_PARENT_UNSAFE');
    }
    const stat = fs.lstatSync(CHECKPOINT_PATH);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0
        && stat.gid === 0 && (stat.mode & 0o777) === 0o400,
    'R4_BOOTSTRAP_CHECKPOINT_UNSAFE');
    const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
    assert.equal(checkpoint.checkpointId, 'CHECKPOINT_UNIFIED_SUCCESSOR_OPERATIONAL_R4_FREEZE_SUCCESSOR_READY');
    assert.equal(checkpoint.status, 'FROZEN');
    const authorityPath = path.join(root,
        'scripts/lib/unified-successor-v202-r4-authority.mjs');
    const guardPath = path.join(root, 'scripts/guard-unified-successor-v202-r4.mjs');
    assert.equal(sha256(fs.readFileSync(authorityPath)), AUTHORITY_SHA256,
        'R4_AUTHORITY_CODE_TAMPERED');
    assert.equal(sha256(fs.readFileSync(path.join(root,
        'src/services/ecBotCoreOperationalV78Service.js'))), V78_SELECTOR_SHA256,
    'R4_V78_SELECTOR_TAMPERED');
    assert.equal(sha256(fs.readFileSync(path.join(root,
        'scripts/lib/ec-bot-core-operational-contract-v78.mjs'))), V78_CONTRACT_SHA256,
    'R4_V78_CONTRACT_TAMPERED');
    assert.equal(sha256(fs.readFileSync(guardPath)), checkpoint.r4OperationalGuardSha256,
        'R4_GUARD_CODE_TAMPERED');
    assert.equal(sha256(fs.readFileSync(path.join(root,
        'scripts/guard-freeze-lock-successor-v202-r4.mjs'))),
    checkpoint.r4FreezeLockSuccessorSha256, 'R4_FREEZE_LOCK_SUCCESSOR_TAMPERED');
    assert.equal(sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
        checkpoint.r4OperationalPreloadSha256, 'R4_PRELOAD_CODE_TAMPERED');
    return import(pathToFileURL(authorityPath).href);
}

const contextKeys = () => Object.getOwnPropertyNames(globalThis)
    .filter(key => key.startsWith('__VITALISMEN_')).sort();
const snapshot = () => new Map(contextKeys().map(key => [key,
    Object.getOwnPropertyDescriptor(globalThis, key)]));
const restore = before => {
    for (const key of contextKeys()) {
        if (!before.has(key)) delete globalThis[key];
    }
    for (const [key, descriptor] of before) Object.defineProperty(globalThis, key, descriptor);
};
const values = () => new Map(contextKeys().map(key => [key, globalThis[key]]));

export async function runUnifiedSuccessor({ root, historicalRoot, env = process.env } = {}) {
    const { assertUnifiedSuccessor, assertExternalLocks } = await import(
        '../guard-unified-successor-v202-r4.mjs');
    const verified = assertUnifiedSuccessor({ root, historicalRoot, env });
    const beforeDescriptors = snapshot();
    const beforeValues = values();
    try {
        const paths = verified.manifest.allowlist.map(entry => entry.path);
        assert.equal(new Set(paths).size, 83, 'R4_ALLOWLIST_NOT_STRICT');
        globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = Object.freeze([...paths]);
        const historicalPreload = pathToFileURL(path.join(historicalRoot,
            verified.manifest.historicalV199.preload)).href;
        await import(historicalPreload);
        assertRequiredContexts({
            v199: globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT?.loaded,
            v146: globalThis.__VITALISMEN_V146_CONTEXT?.loaded
        });
        const currentEntry = pathToFileURL(path.join(root, verified.manifest.currentEntrypoint)).href;
        await import(currentEntry);
        assertExternalLocks(verified.manifest.externalEffectLocks, env);
        return Object.freeze({ successorChainContract: 'PASS', chainGuardsCovered: 33,
            canonicalIdentities: 83, historicalGuardsChanged: false,
            productionChanged: false, dropiSent: false, purchaseSent: false });
    } finally {
        restore(beforeDescriptors);
        assertRestored(beforeValues, values());
    }
}

export async function runOperationalR4Import() {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const { verifyMaterializedRelease } = await loadVerifiedAuthority(root);
    const verified = verifyMaterializedRelease(root);
    const beforeDescriptors = snapshot();
    const beforeValues = values();
    let completed = false;
    try {
        const paths = verified.manifest.allowlist.map(entry => entry.path);
        assert.equal(paths.length, 83, 'R4_OPERATIONAL_ALLOWLIST_INVALID');
        globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = Object.freeze([...paths]);
        await import(pathToFileURL(path.join(verified.historicalRoot,
            'scripts/lib/ec-runtime-successor-v199-context.mjs')).href);
        assertRequiredContexts({
            v199: globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT?.loaded,
            v146: globalThis.__VITALISMEN_V146_CONTEXT?.loaded
        });
        await import(pathToFileURL(path.join(root, verified.manifest.currentEntrypoint)).href);
        assertOperationalLocks(verified.manifest.externalEffectLocks, process.env);
        globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT = Object.freeze({
            loaded: true,
            checkpointId: verified.checkpoint.checkpointId,
            checkpointSha256: verified.checkpointSha256,
            releaseCommit: verified.attestation.commit,
            releaseTree: verified.attestation.tree,
            allowlistCount: 83,
            authorizedFiles: Object.freeze([...paths]),
            manifestSha256: verified.attestation.manifestSha256,
            shipmentsSha256: verified.checkpoint.shipmentsSha256,
            releaseAttestationValidated: true,
            gitRuntimeDependency: false,
            externalEffectLocks: Object.freeze({ ...verified.manifest.externalEffectLocks })
        });
        completed = true;
        return globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT;
    } finally {
        if (!completed) {
            restore(beforeDescriptors);
            assertRestored(beforeValues, values());
        }
    }
}

const self = fileURLToPath(import.meta.url);
const importArguments = [...process.execArgv,
    ...String(process.env.NODE_OPTIONS || '').split(/\s+/).filter(Boolean)];
const importTargetsSelf = specifier => {
    try { return fileURLToPath(new URL(specifier)) === self; } catch { /* path form */ }
    return path.resolve(specifier) === self;
};
const requestedAsPreload = importArguments.some((argument, index) =>
    (argument.startsWith('--import=') && importTargetsSelf(argument.slice(9)))
    || (argument === '--import' && importTargetsSelf(importArguments[index + 1] || '')));
if (requestedAsPreload) await runOperationalR4Import();
