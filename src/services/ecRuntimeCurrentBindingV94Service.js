import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_RUNTIME_CURRENT_BINDING_V94_PARENT_COMMIT = 'cec3b934246b9883727d4bbfccf1a9cc1775911d';
export const EC_RUNTIME_CURRENT_BINDING_V94_PARENT_TREE = '88ada004cf07ffe5e44bf279c75af65f35d75ec5';
export const EC_RUNTIME_CURRENT_BINDING_V94_PARENT_MANIFEST_SHA256 = '2d76889c255750b46d6c5931f6e30eb42a1cb728059028e1d51142beafa223d2';
export const EC_RUNTIME_CURRENT_BINDING_V94_PARENT_FREEZE_SHA256 = 'a63ca741ca6fef474d4be9a0e780c2a3890965622e9d36eeb7d3cbf3c5c12838';
export const EC_RUNTIME_CURRENT_BINDING_V94_PARENT_ATTESTATION_SHA256 = '8c41b3727464930d79104d4b138b4e1c103a611afb33199f5287f3c30142d548';
export const EC_RUNTIME_CURRENT_BINDING_V94_MANIFEST_PATH = 'docs/freeze/ec-runtime-current-binding-v94-20260830.json';
export const EC_RUNTIME_CURRENT_BINDING_V94_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
export const EC_RUNTIME_CURRENT_BINDING_V94_NODE_OPTIONS = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v94-context.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze([
    'ops/vitalismen-stage',
    'scripts/lib/pm2-target-env-restart-v89.mjs',
    'scripts/run-deploy-guard-ancestry-predeploy-v91.mjs',
    'src/services/ecBotCoreOperationalV78Service.js',
    'src/services/ecRuntimeSuccessorV93Service.js',
    'tests/ec-bot-core-control-plane-v89.test.mjs',
    'tests/ec-runtime-successor-v93.test.mjs'
]);
const newProtectedFiles = Object.freeze([
    'docs/EC_RUNTIME_CURRENT_BINDING_FREEZE_V94_20260830.md',
    'docs/evidence/ec-runtime-current-binding-v94-attestation-20260830.json',
    'scripts/guard-ec-runtime-current-binding-v94.mjs',
    'scripts/lib/ec-runtime-successor-v94-context.mjs',
    'src/services/ecRuntimeCurrentBindingFreezeRuntimeGuardV94.js',
    'src/services/ecRuntimeCurrentBindingV94Service.js',
    'tests/ec-runtime-current-binding-v94.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-RUNTIME-CURRENT-BINDING-V94] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-RUNTIME-CURRENT-BINDING-V94] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-RUNTIME-CURRENT-BINDING-V94] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-RUNTIME-CURRENT-BINDING-V94] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV93 = () => {
    const identities = new Map([
        ['docs/freeze/ec-runtime-successor-v93-20260830.json', EC_RUNTIME_CURRENT_BINDING_V94_PARENT_MANIFEST_SHA256],
        ['docs/EC_RUNTIME_SUCCESSOR_FREEZE_V93_20260830.md', EC_RUNTIME_CURRENT_BINDING_V94_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-runtime-successor-v93-attestation-20260830.json', EC_RUNTIME_CURRENT_BINDING_V94_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-RUNTIME-CURRENT-BINDING-V94] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-runtime-successor-v93-20260830.json', 'parent_manifest');
    if (parent.version !== 93 || parent.purpose !== 'BIND_SUCCESSOR_CONTEXT_TO_SAFE_AND_OPERATIONAL_PM2_BOOT'
        || parent.policy?.pm2TargetOnly !== true
        || parent.policy?.externalVslFilesChanged !== false
        || parent.policy?.pixelDatasetChanged !== false
        || parent.policy?.databaseChanged !== false) {
        throw new Error('[EC-RUNTIME-CURRENT-BINDING-V94] parent_policy_invalid');
    }
    const modified = new Set(modifiedAncestorProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-RUNTIME-CURRENT-BINDING-V94] parent_protected_file_invalid:${relativePath}`);
        }
    }
    return parent;
};

export const evaluateEcRuntimeCurrentBindingV94 = () => {
    const failures = [];
    const helper = readText('ops/vitalismen-stage');
    const pm2Restart = readText('scripts/lib/pm2-target-env-restart-v89.mjs');
    const predeploy = readText('scripts/run-deploy-guard-ancestry-predeploy-v91.mjs');
    const operational = readText('src/services/ecBotCoreOperationalV78Service.js');
    const v93Service = readText('src/services/ecRuntimeSuccessorV93Service.js');
    if (!helper.includes('scripts/lib/ec-runtime-successor-v94-context.mjs')) failures.push('helper_v94_context_missing');
    if (!helper.includes(`target_node_options="${EC_RUNTIME_CURRENT_BINDING_V94_NODE_OPTIONS}"`)) {
        failures.push('safe_pm2_current_binding_missing');
    }
    if (!helper.includes('preload_path="$candidate_dir/scripts/lib/ec-runtime-successor-v94-context.mjs"')) {
        failures.push('stage_release_binding_missing');
    }
    if (!pm2Restart.includes(EC_RUNTIME_CURRENT_BINDING_V94_NODE_OPTIONS)) failures.push('pm2_target_current_binding_missing');
    if (!operational.includes(EC_RUNTIME_CURRENT_BINDING_V94_NODE_OPTIONS)) failures.push('operational_current_binding_missing');
    if (!predeploy.includes("ec-runtime-successor-v94-context.mjs")) failures.push('predeploy_v94_context_missing');
    if (!v93Service.includes('if (successorOverrides.has(relativePath)) continue;')) {
        failures.push('v93_successor_hash_policy_missing');
    }
    return Object.freeze({
        ok: failures.length === 0,
        ready: failures.length === 0,
        failures: Object.freeze(failures),
        stageUsesPhysicalRelease: failures.length === 0,
        pm2UsesCurrentSymlink: failures.length === 0
    });
};

export const assertEcRuntimeCurrentBindingManifestV94 = () => {
    assertParentV93();
    const manifest = readCanonicalJson(EC_RUNTIME_CURRENT_BINDING_V94_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'ec-runtime-current-binding-v94'
        || manifest.version !== 94 || manifest.parentVersion !== 'V93'
        || manifest.parentCommit !== EC_RUNTIME_CURRENT_BINDING_V94_PARENT_COMMIT
        || manifest.parentTree !== EC_RUNTIME_CURRENT_BINDING_V94_PARENT_TREE
        || manifest.purpose !== 'BIND_SAFE_PM2_PRELOAD_TO_OFFICIAL_CURRENT_SYMLINK'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || manifest.policy?.stagePhysicalReleaseOnly !== true
        || manifest.policy?.pm2OfficialCurrentOnly !== true
        || manifest.policy?.guardsBypassed !== false
        || manifest.policy?.externalVslFilesChanged !== false
        || manifest.policy?.desktopPageChanged !== false
        || manifest.policy?.mobilePageChanged !== false
        || manifest.policy?.pixelDatasetChanged !== false
        || manifest.policy?.ctaChanged !== false
        || manifest.policy?.databaseChanged !== false
        || manifest.policy?.otherCountryTouched !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[EC-RUNTIME-CURRENT-BINDING-V94] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalHash) {
        throw new Error('[EC-RUNTIME-CURRENT-BINDING-V94] logical_bundle_invalid');
    }
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-RUNTIME-CURRENT-BINDING-V94] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(EC_RUNTIME_CURRENT_BINDING_V94_MANIFEST_PATH) });
};

export const assertEcRuntimeCurrentBindingV94 = () => {
    const identity = assertEcRuntimeCurrentBindingManifestV94();
    const result = evaluateEcRuntimeCurrentBindingV94();
    if (!result.ok) throw new Error(`[EC-RUNTIME-CURRENT-BINDING-V94] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const ecRuntimeCurrentBindingV94Files = Object.freeze({
    modifiedAncestorProtectedFiles,
    newProtectedFiles
});
