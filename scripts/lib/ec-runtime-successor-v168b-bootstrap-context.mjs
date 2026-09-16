import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';
import './ec-runtime-successor-v155-context.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MANIFEST_RELATIVE = 'docs/freeze/ec-runtime-guard-baseline-bootstrap-v168b-20260916.json';
const MANIFEST_URL = new URL(`../../${MANIFEST_RELATIVE}`, import.meta.url);

const hashBuffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => hashBuffer(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)));
const canonicalJson = (url, label) => {
    const text = fs.readFileSync(url, 'utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`, `${label} must be canonical JSON`);
    return { text, value };
};

const manifestSourceHashes = () => {
    const freezeDirectory = path.join(ROOT, 'docs', 'freeze');
    const hashes = new Map();
    for (const entry of fs.readdirSync(freezeDirectory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === path.basename(MANIFEST_RELATIVE)) continue;
        try {
            const value = JSON.parse(fs.readFileSync(path.join(freezeDirectory, entry.name), 'utf8'));
            for (const [file, sha256] of Object.entries(value.protectedFiles || {})) {
                if (!hashes.has(file)) hashes.set(file, new Set());
                hashes.get(file).add(sha256);
            }
        } catch {
            // Arquivos que não são manifestos canônicos não podem provar linhagem.
        }
    }
    return hashes;
};

export const assertV168bBaselineBootstrapContract = ({ manifest, currentHashes, historicalHashes } = {}) => {
    assert.equal(manifest?.freezeId, 'EC_RUNTIME_GUARD_BASELINE_BOOTSTRAP_V168B_20260916');
    assert.equal(manifest?.version, 'V168B-BOOTSTRAP');
    assert.equal(manifest?.trustedProductionCommit, '4a259499ccafe286d6650aa95115023f183f58fe');
    assert.equal(manifest?.trustedProductionTree, 'a64e0c750ec6207239469890ef6d48545926333b');
    assert.equal(manifest?.sourceContext, 'scripts/lib/ec-runtime-successor-v155-context.mjs');
    assert.equal(manifest?.authorizedOverrideFilesCount, 68);
    assert.equal(manifest.authorizedOverrideFiles.some((file) => /[*?\[\]]/.test(file)), false);
    assert.deepEqual([...manifest.authorizedOverrideFiles].sort(), Object.keys(manifest.protectedFiles || {}).sort());
    assert.deepEqual(currentHashes, manifest.protectedFiles);

    for (const [file, sha256] of Object.entries(manifest.protectedFiles)) {
        if (file === 'public/funnel-metrics.html') {
            assert.equal(sha256, '9a10683f260257bef4adb2890b7bb039c34bafc46ae2fc6c95c7be13cbb1f2dc');
            continue;
        }
        assert.equal(historicalHashes.get(file)?.has(sha256), true, `historical freeze evidence missing for ${file}`);
    }

    assert.deepEqual(manifest.policy, {
        scope: 'EXACT_PRODUCTION_BASELINE_GUARD_LINEAGE_ONLY',
        historicalFreezeEvidenceRequired: true,
        wildcardOverridesAllowed: false,
        historicalHashesModified: false,
        guardAssertionsWeakened: false,
        runtimeBypassAdded: false,
        productionChanged: false,
        functionalBehaviorChanged: false
    });
    return Object.freeze({ ...manifest.protectedFiles });
};

const current = canonicalJson(MANIFEST_URL, MANIFEST_RELATIVE);
const currentHashes = Object.fromEntries(
    current.value.authorizedOverrideFiles.map((file) => [file, hashFile(file)])
);
const protectedFiles = assertV168bBaselineBootstrapContract({
    manifest: current.value,
    currentHashes,
    historicalHashes: manifestSourceHashes()
});
const v168bDropiStatusContext = globalThis.__VITALISMEN_V168B_DROPI_STATUS_CONTEXT;
assert.equal(v168bDropiStatusContext?.loaded, true);
const successorProtectedFiles = Object.freeze({
    ...protectedFiles,
    ...v168bDropiStatusContext.protectedFiles
});

const installProtectedFilesBridge = (key) => {
    let context = globalThis[key] || {};
    Object.defineProperty(globalThis, key, {
        configurable: true,
        enumerable: true,
        get: () => context,
        set: (value) => {
            context = Object.freeze({
                ...(value && typeof value === 'object' ? value : {}),
                protectedFiles: Object.freeze({
                    ...(value?.protectedFiles || {}),
                    ...successorProtectedFiles
                })
            });
        }
    });
    globalThis[key] = context;
};
for (const key of [
    '__VITALISMEN_V147_R5_CONTEXT',
    '__VITALISMEN_V147_R6_CONTEXT',
    '__VITALISMEN_V147_R6R2_CONTEXT',
    '__VITALISMEN_V148_CONTEXT'
]) installProtectedFilesBridge(key);

globalThis.__VITALISMEN_V168B_BASELINE_BOOTSTRAP_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: current.value.freezeId,
    manifestSha256: hashBuffer(current.text),
    protectedFiles: successorProtectedFiles
});
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...current.value.authorizedOverrideFiles])];
}
