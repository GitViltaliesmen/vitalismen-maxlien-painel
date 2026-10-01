import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { R5_PARENT_RELEASE } from './unified-successor-v202-r5-authority.mjs';
import { verifyMaterializedRelease } from './unified-successor-v202-r4-authority.mjs';
import { assertR4StartupSuccessorIdentity } from './unified-successor-v202-r4-preload.mjs';
import { verifyR6Release, R6_PARENT_RELEASE } from './exutra-r6-authority.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function loadExutraR6() {
    const verified = verifyR6Release(root);
    const r4Root = '/opt/vitalismen-automacao/releases/' + R5_PARENT_RELEASE;
    const r4 = verifyMaterializedRelease(r4Root);
    const before = new Map(Object.getOwnPropertyNames(globalThis)
        .filter(k => k.startsWith('__VITALISMEN_')).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
    try {
        globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = Object.freeze([...new Set([
            ...r4.manifest.allowlist.map(x => x.path),
            ...verified.parent.manifest.allowedDeltaPaths, ...verified.manifest.allowedDeltaPaths
        ])]);
        await import(pathToFileURL(path.join(r4.historicalRoot,
            'scripts/lib/ec-runtime-successor-v199-context.mjs')).href);
        assert.equal(globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT?.loaded, true);
        assert.equal(globalThis.__VITALISMEN_V146_CONTEXT?.loaded, true);
        const parentIdentity = assertR4StartupSuccessorIdentity(r4, r4Root);
        const protectedFiles = Object.freeze({ ...parentIdentity.protectedFiles,
            ...verified.attestation.fileHashes });
        globalThis.__VITALISMEN_V195_META_CANONICAL_PRELOAD = Object.freeze({
            ...parentIdentity, authorizedFiles: Object.freeze(Object.keys(protectedFiles)), protectedFiles
        });
        await import(pathToFileURL(path.join(root, r4.manifest.currentEntrypoint)).href);
        assert.notEqual(String(process.env.VITALISMEN_META_PURCHASE_ENABLED).toLowerCase(), 'true');
        assert.notEqual(String(process.env.DROPPI_EC_ACTIVE_SYNC_ENABLED).toLowerCase(), 'true');
        assert.equal(String(process.env.DROPPI_EC_ACTIVE_SYNC_MODE || 'REPORT_ONLY').toUpperCase(), 'REPORT_ONLY');
        globalThis.__VITALISMEN_EXUTRA_R6_CONTEXT = Object.freeze({ loaded: true,
            parentR5Verified: true, parentR4Verified: true,
            checkpointSha256: verified.checkpointSha256,
            commit: verified.checkpoint.commit, tree: verified.checkpoint.tree,
            manifestSha256: verified.checkpoint.manifestSha256,
            functionalFiles: Object.freeze(['src/routes/zapi.js']) });
        return globalThis.__VITALISMEN_EXUTRA_R6_CONTEXT;
    } catch (error) {
        for (const k of Object.getOwnPropertyNames(globalThis))
            if (k.startsWith('__VITALISMEN_') && !before.has(k)) delete globalThis[k];
        for (const [k, d] of before) Object.defineProperty(globalThis, k, d);
        throw error;
    }
}
const expected = pathToFileURL(fileURLToPath(import.meta.url)).href;
const args = [...process.execArgv, ...String(process.env.NODE_OPTIONS || '').split(/\s+/)];
if (args.some((a, i) => a === '--import=' + expected
    || (a === '--import' && args[i + 1] === expected)
    || a === '--import=file:///opt/vitalismen-automacao/current/scripts/lib/exutra-r6-preload.mjs')) {
    assert.ok([root, '/opt/vitalismen-automacao/releases/' + R6_PARENT_RELEASE]
        .includes(fs.realpathSync('/opt/vitalismen-automacao/current')),
        'R6_PRELOAD_UNEXPECTED_CURRENT');
    await loadExutraR6();
}
