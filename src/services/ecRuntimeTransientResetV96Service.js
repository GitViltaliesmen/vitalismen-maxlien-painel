import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_COMMIT = '53f616cb2d885091028d1dbaa0090b5ad5d2d017';
export const EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_TREE = '603ffe82198723236878f67e11bcdc0e577deff6';
export const EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_MANIFEST_SHA256 = 'fe0aca9814be6039df738882637e1c8e5988b1db26782f087f524758a596d851';
export const EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_FREEZE_SHA256 = '3b197667f5b7b68f819e453532b3523a831923897b53b5492aa25624f658d2c5';
export const EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_ATTESTATION_SHA256 = 'f5cd4f05c8308225e98151df8b11187edd5f0dcb6cd0b2ace9ff37e8110c5619';
export const EC_RUNTIME_TRANSIENT_RESET_V96_MANIFEST_PATH = 'docs/freeze/ec-runtime-transient-reset-v96-20260830.json';
export const EC_RUNTIME_TRANSIENT_RESET_V96_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
export const EC_RUNTIME_TRANSIENT_RESET_V96_NODE_OPTIONS = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v96-context.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze([
    'ops/vitalismen-stage',
    'scripts/lib/pm2-target-env-restart-v89.mjs',
    'scripts/run-deploy-guard-ancestry-predeploy-v91.mjs',
    'src/services/ecBotCoreOperationalV78Service.js',
    'src/services/ecRuntimeSafeResetV95Service.js',
    'tests/ec-bot-core-control-plane-v89.test.mjs',
    'tests/ec-runtime-current-binding-v94.test.mjs',
    'tests/ec-runtime-safe-reset-v95.test.mjs',
    'tests/ec-runtime-successor-v93.test.mjs'
]);
const newProtectedFiles = Object.freeze([
    'docs/EC_RUNTIME_TRANSIENT_RESET_FREEZE_V96_20260830.md',
    'docs/evidence/ec-runtime-transient-reset-v96-attestation-20260830.json',
    'scripts/guard-ec-runtime-transient-reset-v96.mjs',
    'scripts/lib/ec-runtime-successor-v96-context.mjs',
    'src/services/ecRuntimeTransientResetFreezeRuntimeGuardV96.js',
    'src/services/ecRuntimeTransientResetV96Service.js',
    'tests/ec-runtime-transient-reset-v96.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) throw new Error('[EC-RUNTIME-TRANSIENT-RESET-V96] protected_path_invalid');
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) throw new Error('[EC-RUNTIME-TRANSIENT-RESET-V96] protected_path_outside_root');
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) throw new Error(`[EC-RUNTIME-TRANSIENT-RESET-V96] ${label}_not_canonical`);
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-RUNTIME-TRANSIENT-RESET-V96] paths_invalid');
    return value.map((relativePath) => { relativeFile(relativePath); return relativePath; });
};
const section = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));

const assertParentV95 = () => {
    const identities = new Map([
        ['docs/freeze/ec-runtime-safe-reset-v95-20260830.json', EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_MANIFEST_SHA256],
        ['docs/EC_RUNTIME_SAFE_RESET_FREEZE_V95_20260830.md', EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-runtime-safe-reset-v95-attestation-20260830.json', EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) throw new Error(`[EC-RUNTIME-TRANSIENT-RESET-V96] parent_identity_invalid:${relativePath}`);
    }
    const parent = readCanonicalJson('docs/freeze/ec-runtime-safe-reset-v95-20260830.json', 'parent_manifest');
    if (parent.version !== 95 || parent.purpose !== 'RESET_OPERATIONAL_IDENTITY_DURING_SAFE_PM2_BOOT'
        || parent.policy?.safeOperationalFlagFalse !== true || parent.policy?.externalVslFilesChanged !== false
        || parent.policy?.pixelDatasetChanged !== false || parent.policy?.databaseChanged !== false) {
        throw new Error('[EC-RUNTIME-TRANSIENT-RESET-V96] parent_policy_invalid');
    }
    const modified = new Set(modifiedAncestorProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) throw new Error(`[EC-RUNTIME-TRANSIENT-RESET-V96] parent_protected_file_invalid:${relativePath}`);
    }
};

export const evaluateEcRuntimeTransientResetV96 = () => {
    const failures = [];
    const helper = readText('ops/vitalismen-stage');
    const safeProfile = section(helper, 'safe_profile_content() {', 'safe_profile_sha256() {');
    const safePm2 = section(helper, 'safe_pm2() {', 'verify_candidate_pm2_safe_env() {');
    const verification = section(helper, 'verify_candidate_pm2_safe_env() {', 'write_audit_event() {');
    const pm2Restart = readText('scripts/lib/pm2-target-env-restart-v89.mjs');
    const predeploy = readText('scripts/run-deploy-guard-ancestry-predeploy-v91.mjs');
    const operational = readText('src/services/ecBotCoreOperationalV78Service.js');
    const v95Service = readText('src/services/ecRuntimeSafeResetV95Service.js');
    if (safeProfile.includes('VITALISMEN_EC_BOT_CORE_')) failures.push('staged_safe_overlay_changed');
    if (!safePm2.includes('VITALISMEN_EC_BOT_CORE_OPERATIONAL=false')) failures.push('transient_operational_reset_missing');
    if (!safePm2.includes('VITALISMEN_EC_BOT_CORE_PROFILE_VERSION=')) failures.push('transient_profile_version_reset_missing');
    if (!safePm2.includes('VITALISMEN_EC_BOT_CORE_PROFILE_SHA256=')) failures.push('transient_profile_hash_reset_missing');
    if (!verification.includes('VITALISMEN_EC_BOT_CORE_OPERATIONAL: "false"')) failures.push('transient_reset_verification_missing');
    if (!helper.includes(`target_node_options="${EC_RUNTIME_TRANSIENT_RESET_V96_NODE_OPTIONS}"`)) failures.push('safe_pm2_v96_binding_missing');
    if (!pm2Restart.includes(EC_RUNTIME_TRANSIENT_RESET_V96_NODE_OPTIONS)) failures.push('pm2_v96_context_missing');
    if (!operational.includes(EC_RUNTIME_TRANSIENT_RESET_V96_NODE_OPTIONS)) failures.push('operational_v96_context_missing');
    if (!predeploy.includes('ec-runtime-successor-v96-context.mjs')) failures.push('predeploy_v96_context_missing');
    if (!v95Service.includes('if (successorOverrides.has(relativePath)) continue;')) failures.push('v95_successor_hash_policy_missing');
    return Object.freeze({ ok: failures.length === 0, ready: failures.length === 0, failures: Object.freeze(failures), stagedOverlayPreserved: failures.length === 0, transientResetBound: failures.length === 0 });
};

export const assertEcRuntimeTransientResetManifestV96 = () => {
    assertParentV95();
    const manifest = readCanonicalJson(EC_RUNTIME_TRANSIENT_RESET_V96_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'ec-runtime-transient-reset-v96' || manifest.version !== 96 || manifest.parentVersion !== 'V95'
        || manifest.parentCommit !== EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_COMMIT || manifest.parentTree !== EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_TREE
        || manifest.purpose !== 'RESET_OPERATIONAL_IDENTITY_ONLY_IN_TRANSIENT_PM2_ENV' || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || manifest.policy?.stagedSafeOverlayUnchanged !== true || manifest.policy?.transientPm2ResetOnly !== true
        || manifest.policy?.guardsBypassed !== false || manifest.policy?.externalVslFilesChanged !== false
        || manifest.policy?.desktopPageChanged !== false || manifest.policy?.mobilePageChanged !== false
        || manifest.policy?.pixelDatasetChanged !== false || manifest.policy?.ctaChanged !== false
        || manifest.policy?.databaseChanged !== false || manifest.policy?.otherCountryTouched !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[EC-RUNTIME-TRANSIENT-RESET-V96] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(Object.entries(manifest.protectedFiles || {}).sort(([a], [b]) => a.localeCompare(b)).map(([p, h]) => `${p}\0${h}\n`).join('')));
    if (manifest.logicalBundle?.sha256 !== logicalHash) throw new Error('[EC-RUNTIME-TRANSIENT-RESET-V96] logical_bundle_invalid');
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (sha256File(relativePath) !== expectedHash) throw new Error(`[EC-RUNTIME-TRANSIENT-RESET-V96] protected_file_invalid:${relativePath}`);
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(EC_RUNTIME_TRANSIENT_RESET_V96_MANIFEST_PATH) });
};

export const assertEcRuntimeTransientResetV96 = () => {
    const identity = assertEcRuntimeTransientResetManifestV96();
    const result = evaluateEcRuntimeTransientResetV96();
    if (!result.ok) throw new Error(`[EC-RUNTIME-TRANSIENT-RESET-V96] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const ecRuntimeTransientResetV96Files = Object.freeze({ modifiedAncestorProtectedFiles, newProtectedFiles });
