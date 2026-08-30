import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_RUNTIME_SAFE_RESET_V95_PARENT_COMMIT = 'a2a8137fb5ce8f30187ba84824e226871db9409b';
export const EC_RUNTIME_SAFE_RESET_V95_PARENT_TREE = 'f0a506d82fca39a23b3e86ee5a69edb0afbac141';
export const EC_RUNTIME_SAFE_RESET_V95_PARENT_MANIFEST_SHA256 = 'ae86c9e805fff61edec397296e91ff3646a2c248c260537737ea4ff1dc671e48';
export const EC_RUNTIME_SAFE_RESET_V95_PARENT_FREEZE_SHA256 = '0b0a94da91e6c0ed20be56160f21e947b7096a0f4aba2cc84f520a22540b94d8';
export const EC_RUNTIME_SAFE_RESET_V95_PARENT_ATTESTATION_SHA256 = 'b5a3f827b7487fcfa22b236bb1014cf3e9fb2522d9594595beb9898f5a113d67';
export const EC_RUNTIME_SAFE_RESET_V95_MANIFEST_PATH = 'docs/freeze/ec-runtime-safe-reset-v95-20260830.json';
export const EC_RUNTIME_SAFE_RESET_V95_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
export const EC_RUNTIME_SAFE_RESET_V95_NODE_OPTIONS = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v95-context.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze([
    'ops/vitalismen-stage',
    'scripts/lib/pm2-target-env-restart-v89.mjs',
    'scripts/run-deploy-guard-ancestry-predeploy-v91.mjs',
    'src/services/ecBotCoreOperationalV78Service.js',
    'src/services/ecRuntimeCurrentBindingV94Service.js',
    'tests/ec-bot-core-control-plane-v89.test.mjs',
    'tests/ec-runtime-current-binding-v94.test.mjs',
    'tests/ec-runtime-successor-v93.test.mjs'
]);
const newProtectedFiles = Object.freeze([
    'docs/EC_RUNTIME_SAFE_RESET_FREEZE_V95_20260830.md',
    'docs/evidence/ec-runtime-safe-reset-v95-attestation-20260830.json',
    'scripts/guard-ec-runtime-safe-reset-v95.mjs',
    'scripts/lib/ec-runtime-successor-v95-context.mjs',
    'src/services/ecRuntimeSafeResetFreezeRuntimeGuardV95.js',
    'src/services/ecRuntimeSafeResetV95Service.js',
    'tests/ec-runtime-safe-reset-v95.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-RUNTIME-SAFE-RESET-V95] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-RUNTIME-SAFE-RESET-V95] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-RUNTIME-SAFE-RESET-V95] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-RUNTIME-SAFE-RESET-V95] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV94 = () => {
    const identities = new Map([
        ['docs/freeze/ec-runtime-current-binding-v94-20260830.json', EC_RUNTIME_SAFE_RESET_V95_PARENT_MANIFEST_SHA256],
        ['docs/EC_RUNTIME_CURRENT_BINDING_FREEZE_V94_20260830.md', EC_RUNTIME_SAFE_RESET_V95_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-runtime-current-binding-v94-attestation-20260830.json', EC_RUNTIME_SAFE_RESET_V95_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-RUNTIME-SAFE-RESET-V95] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-runtime-current-binding-v94-20260830.json', 'parent_manifest');
    if (parent.version !== 94 || parent.purpose !== 'BIND_SAFE_PM2_PRELOAD_TO_OFFICIAL_CURRENT_SYMLINK'
        || parent.policy?.stagePhysicalReleaseOnly !== true
        || parent.policy?.pm2OfficialCurrentOnly !== true
        || parent.policy?.externalVslFilesChanged !== false
        || parent.policy?.pixelDatasetChanged !== false
        || parent.policy?.databaseChanged !== false) {
        throw new Error('[EC-RUNTIME-SAFE-RESET-V95] parent_policy_invalid');
    }
    const modified = new Set(modifiedAncestorProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-RUNTIME-SAFE-RESET-V95] parent_protected_file_invalid:${relativePath}`);
        }
    }
    return parent;
};

export const evaluateEcRuntimeSafeResetV95 = () => {
    const failures = [];
    const helper = readText('ops/vitalismen-stage');
    const pm2Restart = readText('scripts/lib/pm2-target-env-restart-v89.mjs');
    const predeploy = readText('scripts/run-deploy-guard-ancestry-predeploy-v91.mjs');
    const operational = readText('src/services/ecBotCoreOperationalV78Service.js');
    const v94Service = readText('src/services/ecRuntimeCurrentBindingV94Service.js');
    const successorOverrides = new Set(globalThis[EC_RUNTIME_SAFE_RESET_V95_OVERRIDE_KEY] || []);
    const resetCount = (helper.match(/VITALISMEN_EC_BOT_CORE_OPERATIONAL=false/g) || []).length;
    if (!successorOverrides.has('ops/vitalismen-stage')
        && (resetCount < 2 || !helper.includes('VITALISMEN_EC_BOT_CORE_OPERATIONAL: "false"'))) {
        failures.push('safe_operational_flag_reset_incomplete');
    }
    if (!successorOverrides.has('ops/vitalismen-stage')
        && !helper.includes('VITALISMEN_EC_BOT_CORE_PROFILE_VERSION=')) failures.push('safe_profile_version_reset_missing');
    if (!successorOverrides.has('ops/vitalismen-stage')
        && !helper.includes('VITALISMEN_EC_BOT_CORE_PROFILE_SHA256=')) failures.push('safe_profile_hash_reset_missing');
    if (!successorOverrides.has('ops/vitalismen-stage')
        && !helper.includes('scripts/lib/ec-runtime-successor-v95-context.mjs')) failures.push('helper_v95_context_missing');
    if (!successorOverrides.has('ops/vitalismen-stage')
        && !helper.includes(`target_node_options="${EC_RUNTIME_SAFE_RESET_V95_NODE_OPTIONS}"`)) {
        failures.push('safe_pm2_v95_current_binding_missing');
    }
    if (!successorOverrides.has('scripts/lib/pm2-target-env-restart-v89.mjs')
        && !pm2Restart.includes(EC_RUNTIME_SAFE_RESET_V95_NODE_OPTIONS)) failures.push('pm2_target_v95_context_missing');
    if (!successorOverrides.has('src/services/ecBotCoreOperationalV78Service.js')
        && !operational.includes(EC_RUNTIME_SAFE_RESET_V95_NODE_OPTIONS)) failures.push('operational_v95_context_missing');
    if (!successorOverrides.has('scripts/run-deploy-guard-ancestry-predeploy-v91.mjs')
        && !predeploy.includes("ec-runtime-successor-v95-context.mjs")) failures.push('predeploy_v95_context_missing');
    if (!v94Service.includes('if (successorOverrides.has(relativePath)) continue;')) {
        failures.push('v94_successor_hash_policy_missing');
    }
    return Object.freeze({
        ok: failures.length === 0,
        ready: failures.length === 0,
        failures: Object.freeze(failures),
        safeOperationalIdentityReset: failures.length === 0,
        pm2UsesCurrentSymlink: failures.length === 0
    });
};

export const assertEcRuntimeSafeResetManifestV95 = () => {
    assertParentV94();
    const manifest = readCanonicalJson(EC_RUNTIME_SAFE_RESET_V95_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'ec-runtime-safe-reset-v95'
        || manifest.version !== 95 || manifest.parentVersion !== 'V94'
        || manifest.parentCommit !== EC_RUNTIME_SAFE_RESET_V95_PARENT_COMMIT
        || manifest.parentTree !== EC_RUNTIME_SAFE_RESET_V95_PARENT_TREE
        || manifest.purpose !== 'RESET_OPERATIONAL_IDENTITY_DURING_SAFE_PM2_BOOT'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || manifest.policy?.safeOperationalFlagFalse !== true
        || manifest.policy?.safeProfileIdentityEmpty !== true
        || manifest.policy?.guardsBypassed !== false
        || manifest.policy?.externalVslFilesChanged !== false
        || manifest.policy?.desktopPageChanged !== false
        || manifest.policy?.mobilePageChanged !== false
        || manifest.policy?.pixelDatasetChanged !== false
        || manifest.policy?.ctaChanged !== false
        || manifest.policy?.databaseChanged !== false
        || manifest.policy?.otherCountryTouched !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[EC-RUNTIME-SAFE-RESET-V95] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalHash) {
        throw new Error('[EC-RUNTIME-SAFE-RESET-V95] logical_bundle_invalid');
    }
    const successorOverrides = new Set(globalThis[EC_RUNTIME_SAFE_RESET_V95_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (successorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-RUNTIME-SAFE-RESET-V95] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(EC_RUNTIME_SAFE_RESET_V95_MANIFEST_PATH) });
};

export const assertEcRuntimeSafeResetV95 = () => {
    const identity = assertEcRuntimeSafeResetManifestV95();
    const result = evaluateEcRuntimeSafeResetV95();
    if (!result.ok) throw new Error(`[EC-RUNTIME-SAFE-RESET-V95] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const ecRuntimeSafeResetV95Files = Object.freeze({
    modifiedAncestorProtectedFiles,
    newProtectedFiles
});
