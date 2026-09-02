import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_OPERATIONAL_GUARD_CONTEXT_V97_PARENT_COMMIT = '6117823a19fde9b42facd9c5e8309da4692787d2';
export const EC_OPERATIONAL_GUARD_CONTEXT_V97_PARENT_TREE = '2cb53daa9cc78f5aef01a56b3bb4b1c729c82335';
export const EC_OPERATIONAL_GUARD_CONTEXT_V97_PARENT_MANIFEST_SHA256 = '7300fac662860e142e0573b2983007c2025c18a0b93cd2127201064182c5e23a';
export const EC_OPERATIONAL_GUARD_CONTEXT_V97_PARENT_FREEZE_SHA256 = 'c5acfde0b7c338675071f773daa1014b22d747d8328a8a71fc7dd9840fba19c9';
export const EC_OPERATIONAL_GUARD_CONTEXT_V97_PARENT_ATTESTATION_SHA256 = 'ba51602f4efef4fa59644792911b09546471f356eb0fb968a168478958382149';
export const EC_OPERATIONAL_GUARD_CONTEXT_V97_MANIFEST_PATH = 'docs/freeze/ec-operational-guard-context-v97-20260830.json';
export const EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
export const EC_OPERATIONAL_GUARD_CONTEXT_V97_NODE_OPTIONS = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v97-context.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze([
    'ops/ec-bot-core-v78', 'ops/vitalismen-stage',
    'scripts/lib/pm2-target-env-restart-v89.mjs', 'scripts/run-deploy-guard-ancestry-predeploy-v91.mjs',
    'src/services/ecBotCoreOperationalV78Service.js', 'src/services/ecRuntimeTransientResetV96Service.js',
    'tests/ec-bot-core-control-plane-v89.test.mjs', 'tests/ec-runtime-current-binding-v94.test.mjs',
    'tests/ec-runtime-safe-reset-v95.test.mjs', 'tests/ec-runtime-successor-v93.test.mjs',
    'tests/ec-runtime-transient-reset-v96.test.mjs'
]);
const newProtectedFiles = Object.freeze([
    'docs/EC_OPERATIONAL_GUARD_CONTEXT_FREEZE_V97_20260830.md',
    'docs/evidence/ec-operational-guard-context-v97-attestation-20260830.json',
    'scripts/guard-ec-operational-guard-context-v97.mjs', 'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/services/ecOperationalGuardContextFreezeRuntimeGuardV97.js',
    'src/services/ecOperationalGuardContextV97Service.js', 'tests/ec-operational-guard-context-v97.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) throw new Error('[EC-OPERATIONAL-GUARD-CONTEXT-V97] protected_path_invalid');
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) throw new Error('[EC-OPERATIONAL-GUARD-CONTEXT-V97] protected_path_outside_root');
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath); const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) throw new Error(`[EC-OPERATIONAL-GUARD-CONTEXT-V97] ${label}_not_canonical`);
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-OPERATIONAL-GUARD-CONTEXT-V97] paths_invalid');
    return value.map((relativePath) => { relativeFile(relativePath); return relativePath; });
};

const assertParentV96 = () => {
    const identities = new Map([
        ['docs/freeze/ec-runtime-transient-reset-v96-20260830.json', EC_OPERATIONAL_GUARD_CONTEXT_V97_PARENT_MANIFEST_SHA256],
        ['docs/EC_RUNTIME_TRANSIENT_RESET_FREEZE_V96_20260830.md', EC_OPERATIONAL_GUARD_CONTEXT_V97_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-runtime-transient-reset-v96-attestation-20260830.json', EC_OPERATIONAL_GUARD_CONTEXT_V97_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) if (sha256File(relativePath) !== expectedHash) throw new Error(`[EC-OPERATIONAL-GUARD-CONTEXT-V97] parent_identity_invalid:${relativePath}`);
    const parent = readCanonicalJson('docs/freeze/ec-runtime-transient-reset-v96-20260830.json', 'parent_manifest');
    if (parent.version !== 96 || parent.purpose !== 'RESET_OPERATIONAL_IDENTITY_ONLY_IN_TRANSIENT_PM2_ENV'
        || parent.policy?.stagedSafeOverlayUnchanged !== true || parent.policy?.externalVslFilesChanged !== false
        || parent.policy?.pixelDatasetChanged !== false || parent.policy?.databaseChanged !== false) throw new Error('[EC-OPERATIONAL-GUARD-CONTEXT-V97] parent_policy_invalid');
    const modified = new Set(modifiedAncestorProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) throw new Error(`[EC-OPERATIONAL-GUARD-CONTEXT-V97] parent_protected_file_invalid:${relativePath}`);
    }
};

export const evaluateEcOperationalGuardContextV97 = () => {
    const failures = [];
    const controller = readText('ops/ec-bot-core-v78');
    const helper = readText('ops/vitalismen-stage');
    const pm2 = readText('scripts/lib/pm2-target-env-restart-v89.mjs');
    const predeploy = readText('scripts/run-deploy-guard-ancestry-predeploy-v91.mjs');
    const operational = readText('src/services/ecBotCoreOperationalV78Service.js');
    const v96 = readText('src/services/ecRuntimeTransientResetV96Service.js');
    if (!controller.includes('NODE_OPTIONS="--import=$release_dir/scripts/lib/ec-runtime-successor-v97-context.mjs"')) failures.push('operational_structural_test_context_missing');
    if (controller.includes('NODE_OPTIONS="--import=$release_dir/src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js"')) failures.push('ancestral_direct_preload_present');
    if (!helper.includes(`target_node_options="${EC_OPERATIONAL_GUARD_CONTEXT_V97_NODE_OPTIONS}"`)) failures.push('safe_pm2_v97_binding_missing');
    if (!pm2.includes(EC_OPERATIONAL_GUARD_CONTEXT_V97_NODE_OPTIONS)) failures.push('pm2_v97_context_missing');
    if (!operational.includes(EC_OPERATIONAL_GUARD_CONTEXT_V97_NODE_OPTIONS)) failures.push('operational_v97_context_missing');
    if (!predeploy.includes('ec-runtime-successor-v97-context.mjs')) failures.push('predeploy_v97_context_missing');
    if (!v96.includes('if (successorOverrides.has(relativePath)) continue;')) failures.push('v96_successor_hash_policy_missing');
    return Object.freeze({ ok: failures.length === 0, ready: failures.length === 0, failures: Object.freeze(failures), operationalGuardUsesFullSuccessorContext: failures.length === 0 });
};

export const assertEcOperationalGuardContextManifestV97 = () => {
    assertParentV96();
    const manifest = readCanonicalJson(EC_OPERATIONAL_GUARD_CONTEXT_V97_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides); const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles); const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'ec-operational-guard-context-v97' || manifest.version !== 97 || manifest.parentVersion !== 'V96'
        || manifest.parentCommit !== EC_OPERATIONAL_GUARD_CONTEXT_V97_PARENT_COMMIT || manifest.parentTree !== EC_OPERATIONAL_GUARD_CONTEXT_V97_PARENT_TREE
        || manifest.purpose !== 'LOAD_FULL_SUCCESSOR_CONTEXT_IN_OPERATIONAL_V78_GUARD' || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles) || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || manifest.policy?.operationalGuardFullSuccessorContext !== true || manifest.policy?.guardsBypassed !== false
        || manifest.policy?.externalVslFilesChanged !== false || manifest.policy?.desktopPageChanged !== false || manifest.policy?.mobilePageChanged !== false
        || manifest.policy?.pixelDatasetChanged !== false || manifest.policy?.ctaChanged !== false || manifest.policy?.databaseChanged !== false || manifest.policy?.otherCountryTouched !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) throw new Error('[EC-OPERATIONAL-GUARD-CONTEXT-V97] manifest_identity_or_policy_invalid');
    const logicalHash = sha256Buffer(Buffer.from(Object.entries(manifest.protectedFiles || {}).sort(([a], [b]) => a.localeCompare(b)).map(([p, h]) => `${p}\0${h}\n`).join('')));
    if (manifest.logicalBundle?.sha256 !== logicalHash) throw new Error('[EC-OPERATIONAL-GUARD-CONTEXT-V97] logical_bundle_invalid');
    const successorOverrides = new Set(globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (successorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) throw new Error(`[EC-OPERATIONAL-GUARD-CONTEXT-V97] protected_file_invalid:${relativePath}`);
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(EC_OPERATIONAL_GUARD_CONTEXT_V97_MANIFEST_PATH) });
};

export const assertEcOperationalGuardContextV97 = () => {
    const identity = assertEcOperationalGuardContextManifestV97(); const result = evaluateEcOperationalGuardContextV97();
    if (!result.ok) throw new Error(`[EC-OPERATIONAL-GUARD-CONTEXT-V97] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};
export const ecOperationalGuardContextV97Files = Object.freeze({ modifiedAncestorProtectedFiles, newProtectedFiles });
