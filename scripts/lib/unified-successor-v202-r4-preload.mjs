import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AUTHORITY_SHA256 = '4fdef21d6864346b1e770ed39e75fed9cc132a6d601d5a1ce2f6e1cc6e4c58a4';
const V78_SELECTOR_SHA256 = 'bfd27de60c06ea0925c03cfbebe48383a321c6146a55997ad1b3672349ccc6fa';
const V78_CONTRACT_SHA256 = '622cf6f5fb5539ec6dfef2860bf81516bbac592ab677de7906b886ae10c160a9';
const CHECKPOINT_PATH =
    '/var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_PAYLOAD_AUTHORITY.json';
const OFFICIAL_LOGICAL_PRELOAD =
    'file:///opt/vitalismen-automacao/current/scripts/lib/unified-successor-v202-r4-preload.mjs';
const V168B_PATH = 'scripts/lib/ec-runtime-successor-v168b-bootstrap-context.mjs';
const SHIPMENTS_PATH = 'src/routes/shipments.js';
const V195_MANIFEST_SHA256 = 'ffe319bc3f0a336d9353cd4957b23478fe25c788f243cc1f9670d8024ac793a6';
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
    assert.equal(checkpoint.checkpointId, 'CHECKPOINT_R4_V78_PAYLOAD_AUTHORITY');
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
    assert.equal(sha256(fs.readFileSync(path.join(root,
        'scripts/guard-final-release-validator-successor-v202-r4.mjs'))),
    checkpoint.r4FinalValidatorSha256, 'R4_FINAL_VALIDATOR_TAMPERED');
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

export function assertR4StartupSuccessorIdentity(verified, root,
    v195 = globalThis.__VITALISMEN_V195_META_CANONICAL_PRELOAD,
    v195Context = globalThis.__VITALISMEN_V195_META_CANONICAL_CONTEXT) {
    assert.equal(verified?.checkpoint?.checkpointId, 'CHECKPOINT_R4_V78_PAYLOAD_AUTHORITY');
    assert.equal(verified?.attestation?.commit, verified.checkpoint.r4OperationalCommit,
        'R4_STARTUP_COMMIT_INVALID');
    assert.equal(verified?.attestation?.tree, verified.checkpoint.r4OperationalTree,
        'R4_STARTUP_TREE_INVALID');
    assert.equal(v195Context?.loaded, true, 'R4_V195_CONTEXT_MISSING');
    assert.equal(v195Context.manifestSha256, V195_MANIFEST_SHA256,
        'R4_V195_MANIFEST_INVALID');
    assert.equal(v195Context.policy?.canonicalDataset, verified.checkpoint.metaDatasetId,
        'R4_META_PROFILE_INVALID');
    assert.equal(v195?.freezeId, 'META_CANONICAL_CONSOLIDATION_V195_20260923',
        'R4_V195_PRELOAD_INVALID');
    assert.equal(v195.canonicalDataset, verified.checkpoint.metaDatasetId,
        'R4_META_PRELOAD_PROFILE_INVALID');
    assert.equal(v195.protectedFiles?.[V168B_PATH], verified.checkpoint.v168bSha256,
        'R4_V168B_V195_AUTHORITY_MISSING');
    const v168bStat = fs.lstatSync(path.join(root, V168B_PATH));
    assert.ok(v168bStat.isFile() && !v168bStat.isSymbolicLink(),
        'R4_V168B_FILE_UNSAFE');
    assert.equal(sha256(fs.readFileSync(path.join(root, V168B_PATH))),
        verified.checkpoint.v168bSha256, 'R4_V168B_IDENTITY_INVALID');
    const shipments = verified.manifest.allowlist.find(entry => entry.path === SHIPMENTS_PATH);
    assert.equal(shipments?.canonicalSha256, verified.checkpoint.shipmentsSha256,
        'R4_SHIPMENTS_AUTHORITY_INVALID');
    const shipmentsStat = fs.lstatSync(path.join(root, SHIPMENTS_PATH));
    assert.ok(shipmentsStat.isFile() && !shipmentsStat.isSymbolicLink(),
        'R4_SHIPMENTS_FILE_UNSAFE');
    assert.equal(sha256(fs.readFileSync(path.join(root, SHIPMENTS_PATH))),
        verified.checkpoint.shipmentsSha256, 'R4_SHIPMENTS_IDENTITY_INVALID');
    const protectedFiles = Object.freeze({ ...v195.protectedFiles,
        ...Object.fromEntries(verified.manifest.allowlist.map(entry =>
            [entry.path, entry.canonicalSha256])) });
    return Object.freeze({
        freezeId: v195.freezeId,
        canonicalDataset: v195.canonicalDataset,
        authorizedFiles: Object.freeze(Object.keys(protectedFiles)),
        protectedFiles
    });
}

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
        globalThis.__VITALISMEN_V195_META_CANONICAL_PRELOAD =
            assertR4StartupSuccessorIdentity(verified, root);
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
            v168bSha256: verified.checkpoint.v168bSha256,
            metaDatasetId: verified.checkpoint.metaDatasetId,
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
export const importTargetsSelf = specifier => {
    if (specifier === pathToFileURL(self).href) return true;
    if (specifier !== OFFICIAL_LOGICAL_PRELOAD) return false;
    const logicalRoot = '/opt/vitalismen-automacao/current';
    const physicalRoot = path.resolve(path.dirname(self), '../..');
    assert.equal(fs.realpathSync(logicalRoot), physicalRoot,
        'R4_LOGICAL_CURRENT_REALPATH_INVALID');
    assert.equal(fs.realpathSync(fileURLToPath(specifier)), self,
        'R4_LOGICAL_PRELOAD_REALPATH_INVALID');
    return true;
};
const requestedAsPreload = importArguments.some((argument, index) =>
    (argument.startsWith('--import=') && importTargetsSelf(argument.slice(9)))
    || (argument === '--import' && importTargetsSelf(importArguments[index + 1] || '')));
if (requestedAsPreload) await runOperationalR4Import();
