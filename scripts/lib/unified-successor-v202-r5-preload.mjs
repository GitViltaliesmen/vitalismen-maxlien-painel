import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
    R5_PARENT_RELEASE,
    R5_PRELOAD_PATH,
    sha256,
    verifyR5MaterializedRelease
} from './unified-successor-v202-r5-authority.mjs';
import { verifyMaterializedRelease } from './unified-successor-v202-r4-authority.mjs';
import {
    assertR4StartupSuccessorIdentity
} from './unified-successor-v202-r4-preload.mjs';

const self = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(self), '../..');
const parentRoot = path.join('/opt/vitalismen-automacao/releases', R5_PARENT_RELEASE);
const contextKeys = () => Object.getOwnPropertyNames(globalThis)
    .filter((key) => key.startsWith('__VITALISMEN_')).sort();
const snapshot = () => new Map(contextKeys().map((key) =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const restore = (before) => {
    for (const key of contextKeys()) if (!before.has(key)) delete globalThis[key];
    for (const [key, descriptor] of before) Object.defineProperty(globalThis, key, descriptor);
};
const importedAsPreload = () => {
    const physical = path.dirname(root) === '/opt/vitalismen-automacao/releases'
        && /^\d{8}T\d{6}Z_production-\d{8}-[a-f0-9]{7}$/.test(path.basename(root));
    if (!physical) return false;
    const expected = pathToFileURL(self).href;
    const logical = 'file:///opt/vitalismen-automacao/current/' + R5_PRELOAD_PATH;
    const args = [...process.execArgv,
        ...String(process.env.NODE_OPTIONS || '').split(/\s+/).filter(Boolean)];
    return args.some((argument, index) => {
        const specifier = argument.startsWith('--import=') ? argument.slice(9)
            : argument === '--import' ? args[index + 1] : '';
        if (specifier === expected) return true;
        if (specifier !== logical) return false;
        assert.equal(fs.realpathSync('/opt/vitalismen-automacao/current'), root,
            'R5_LOGICAL_CURRENT_MISMATCH');
        assert.equal(fs.realpathSync(fileURLToPath(specifier)), self,
            'R5_LOGICAL_PRELOAD_MISMATCH');
        return true;
    });
};

export async function runOperationalR5Import() {
    const verified = await verifyR5MaterializedRelease(root);
    const parent = verifyMaterializedRelease(parentRoot);
    const before = snapshot();
    let completed = false;
    try {
        const r4Paths = parent.manifest.allowlist.map((entry) => entry.path);
        const newPaths = verified.manifest.allowedDeltaPaths;
        const overrides = [...new Set([...r4Paths, ...newPaths])];
        globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = Object.freeze(overrides);
        await import(pathToFileURL(path.join(parent.historicalRoot,
            'scripts/lib/ec-runtime-successor-v199-context.mjs')).href);
        assert.equal(globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT?.loaded,
            true, 'R5_V199_CONTEXT_MISSING');
        assert.equal(globalThis.__VITALISMEN_V146_CONTEXT?.loaded, true,
            'R5_V146_CONTEXT_MISSING');
        const v195 = assertR4StartupSuccessorIdentity(parent, parentRoot);
        const changedHashes = verified.attestation.changedFileHashes;
        const protectedFiles = Object.freeze({ ...v195.protectedFiles, ...changedHashes });
        globalThis.__VITALISMEN_V195_META_CANONICAL_PRELOAD = Object.freeze({
            ...v195,
            authorizedFiles: Object.freeze(Object.keys(protectedFiles)),
            protectedFiles
        });
        await import(pathToFileURL(path.join(root,
            parent.manifest.currentEntrypoint)).href);
        for (const key of ['DROPPI_EC_ACTIVE_SYNC_ENABLED',
            'VITALISMEN_META_PURCHASE_ENABLED']) {
            assert.notEqual(String(process.env[key] || '').toLowerCase(), 'true',
                'R5_EXTERNAL_EFFECT_ENABLED:' + key);
        }
        assert.equal(String(process.env.DROPPI_EC_ACTIVE_SYNC_MODE || 'REPORT_ONLY')
            .toUpperCase(), 'REPORT_ONLY', 'R5_DROPI_MODE_NOT_REPORT_ONLY');
        assert.equal(sha256(fs.readFileSync(self)),
            verified.checkpoint.controlHashes[R5_PRELOAD_PATH], 'R5_PRELOAD_TAMPERED');
        globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT = Object.freeze({
            loaded: true,
            checkpointId: verified.checkpoint.checkpointId,
            checkpointSha256: verified.checkpointSha256,
            releaseCommit: verified.attestation.commit,
            releaseTree: verified.attestation.tree,
            manifestSha256: verified.attestation.manifestSha256,
            parentR4Verified: true,
            v47SuccessorVerified: true,
            releaseAttestationValidated: true,
            gitRuntimeDependency: false,
            inheritedProtectedFiles: r4Paths.length,
            functionalFiles: Object.freeze(Object.keys(verified.manifest.functionalFiles))
        });
        if (fs.realpathSync('/opt/vitalismen-automacao/current') !== root) {
            assert.equal(fs.realpathSync('/opt/vitalismen-automacao/current'), parentRoot,
                'R5_V71_UNEXPECTED_PREDEPLOY_PARENT');
            await import('./unified-successor-v202-r5-predeploy-v71-context.mjs');
            assert.equal(globalThis.__VITALISMEN_R5_V71_EXACT_SUCCESSOR?.loaded, true,
                'R5_V71_EXACT_SUCCESSOR_MISSING');
        }
        completed = true;
        return globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT;
    } finally {
        if (!completed) restore(before);
    }
}

if (importedAsPreload()) await runOperationalR5Import();
