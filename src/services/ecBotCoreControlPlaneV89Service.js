import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateEcBotCoreCanaryClassificationV85 } from './ecBotCoreCanaryClassificationV85Service.js';

export const EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_COMMIT = '750209b2698b7df4796accb99173e7bee7ee72b4';
export const EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_TREE = '9cf32dca6e1043b9d98ab7d81be5408a3713ce4c';
export const EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_MANIFEST_SHA256 = '3777e44a6166d6367121bcf98964f5be45c079b96d1824894b773e4e6461ad13';
export const EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_FREEZE_SHA256 = '625df3c50f5901f24c229313a3155d4f32e23b806465e5226302d9c9d253285a';
export const EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_ATTESTATION_SHA256 = 'b05feba078747cffe784152badfbd0ec3ba95e5898ebc6e336ef49e0ba840a55';
export const EC_BOT_CORE_CONTROL_PLANE_V89_MANIFEST_PATH = 'docs/freeze/ec-bot-core-control-plane-v89-20260830.json';
export const EC_BOT_CORE_CONTROL_PLANE_V89_STATE_KEY = '__VITALISMEN_V89_EC_BOT_CORE_CONTROL_PLANE_STATE';
export const EC_BOT_CORE_CONTROL_PLANE_V89_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ancestorOverrides = Object.freeze([
    'ops/ec-bot-core-v78',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    'src/index.js',
    'src/services/ecBotCoreLifecycleBootV88Service.js',
    'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js',
    'tests/ec-bot-core-lifecycle-boot-v88.test.mjs'
]);
const modifiedParentProtectedFiles = Object.freeze([...ancestorOverrides]);
const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = (file) => sha256Buffer(fs.readFileSync(file));
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] protected_path_outside_root');
    }
    return candidate;
};
const readCanonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-BOT-CORE-CONTROL-PLANE-V89] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');

const assertParentV88 = () => {
    const identities = new Map([
        ['docs/freeze/ec-bot-core-lifecycle-boot-v88-20260830.json', EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_MANIFEST_SHA256],
        ['docs/EC_BOT_CORE_LIFECYCLE_BOOT_FREEZE_V88_20260830.md', EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-bot-core-lifecycle-boot-v88-attestation-20260830.json', EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-CONTROL-PLANE-V89] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-bot-core-lifecycle-boot-v88-20260830.json', 'parent_manifest');
    if (parent.version !== 88 || parent.purpose !== 'EC_BOT_CORE_DEPENDENCY_LIFECYCLE_AWARE_BOOT'
        || parent.policy?.dependencyLifecycleGuardBypassOnly !== true
        || parent.policy?.projectLifecycleGuarded !== true
        || parent.policy?.runtimeGuarded !== true
        || parent.policy?.healthAttempts !== 30 || parent.policy?.healthDelaySeconds !== 2
        || parent.policy?.botBusinessLogicChanged !== false
        || parent.policy?.mutatingSchedulersAllowed !== false
        || parent.policy?.dropiApplyAllowed !== false
        || parent.policy?.metaPurchaseAllowed !== false
        || parent.policy?.realCustomerTrafficAuthorized !== false) {
        throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] parent_policy_invalid');
    }
    const modified = new Set(modifiedParentProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-CONTROL-PLANE-V89] parent_protected_file_invalid:${relativePath}`);
        }
    }
    return parent;
};

export const evaluateEcBotCoreControlPlaneV89 = ({
    indexSource = readText('src/index.js'),
    preloaderSource = readText('scripts/lib/ec-bot-core-control-plane-v89-successor-context.mjs'),
    opsSource = readText('ops/ec-bot-core-v78'),
    contractSource = readText('scripts/lib/ec-bot-core-operational-contract-v78.mjs'),
    structuralGuardSource = readText('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'),
    parentServiceSource = readText('src/services/ecBotCoreLifecycleBootV88Service.js'),
    restartHelperSource = readText('scripts/lib/pm2-target-env-restart-v89.mjs'),
    v85Options = {}
} = {}) => {
    const classification = evaluateEcBotCoreCanaryClassificationV85(v85Options);
    const bootImport = "import '../scripts/lib/ec-bot-core-control-plane-v89-successor-context.mjs';";
    const nextGuardImport = "import './services/ecEngagementFreezeRuntimeGuardV40.js';";
    const bootIndex = indexSource.indexOf(bootImport);
    const nextGuardIndex = indexSource.indexOf(nextGuardImport);
    const failures = [...classification.failures];
    if (classification.ready !== true) failures.push('v85_classification_readiness_missing');
    if (bootIndex < 0) failures.push('v89_first_import_missing');
    if (nextGuardIndex < 0 || bootIndex > nextGuardIndex) failures.push('v89_context_loaded_after_ancestor');
    for (const relativePath of ancestorOverrides) {
        if (!preloaderSource.includes(`'${relativePath}'`)) failures.push(`preloader_override_missing:${relativePath}`);
    }
    if (!preloaderSource.includes('dependencyLifecycle') || !preloaderSource.includes('npm_package_json')) {
        failures.push('dependency_lifecycle_classification_missing');
    }
    if (!preloaderSource.includes('ec-bot-core-lifecycle-boot-v88-successor-context.mjs')) failures.push('v88_context_missing');
    if (!preloaderSource.includes('ecBotCoreControlPlaneFreezeRuntimeGuardV89.js')) failures.push('v89_runtime_guard_missing');
    if (!opsSource.includes('guard-ec-bot-core-control-plane-v89.mjs')) failures.push('v89_plan_guard_missing');
    if (!opsSource.includes('pm2-target-env-restart-v89.mjs')) failures.push('isolated_pm2_restart_missing');
    if (!opsSource.includes('abort-authorization')) failures.push('safe_authorization_abort_missing');
    if (!contractSource.includes('assertEcBotCoreControlPlaneV89')) failures.push('contract_v89_assertion_missing');
    if (!structuralGuardSource.includes('ec-bot-core-control-plane-v89-successor-context.mjs')) failures.push('structural_v89_context_missing');
    if (!parentServiceSource.includes('successorOverrides.has(relativePath)')) failures.push('parent_successor_override_missing');
    if (!restartHelperSource.includes('pm2.restart(processName, { updateEnv: true }')) failures.push('programmatic_pm2_restart_missing');
    if (!restartHelperSource.includes('process.env.NODE_OPTIONS = targetNodeOptions')) failures.push('target_node_options_injection_missing');
    return Object.freeze({
        ok: failures.length === 0,
        ready: failures.length === 0,
        failures: Object.freeze(failures),
        firstImportInstalled: bootIndex >= 0 && bootIndex < nextGuardIndex,
        pm2TargetEnvironmentIsolated: failures.every((failure) => ![
            'isolated_pm2_restart_missing', 'programmatic_pm2_restart_missing', 'target_node_options_injection_missing'
        ].includes(failure)),
        healthAttempts: 30,
        healthDelaySeconds: 2,
        datasetId: classification.datasetId,
        profile: classification.profile
    });
};

export const assertEcBotCoreControlPlaneManifestV89 = () => {
    assertParentV88();
    const manifest = readCanonicalJson(EC_BOT_CORE_CONTROL_PLANE_V89_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedParentProtectedFiles);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-bot-core-control-plane-v89'
        || manifest.version !== 89 || manifest.parentVersion !== 'V88'
        || manifest.parentCommit !== EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_COMMIT
        || manifest.parentTree !== EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_TREE
        || manifest.purpose !== 'EC_BOT_CORE_PM2_CONTROL_PLANE_ISOLATION'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(ancestorOverrides)
        || JSON.stringify(modified) !== JSON.stringify(modifiedParentProtectedFiles)
        || manifest.policy?.pm2ControllerStartsWithoutNodeOptions !== true
        || manifest.policy?.targetReceivesCanonicalNodeOptions !== true
        || manifest.policy?.failedAuthorizationAbortRequiresSafeHealth !== true
        || manifest.policy?.botBusinessLogicChanged !== false
        || manifest.policy?.mutatingSchedulersAllowed !== false
        || manifest.policy?.dropiApplyAllowed !== false
        || manifest.policy?.metaPurchaseAllowed !== false
        || manifest.policy?.realCustomerTrafficAuthorized !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalHash) throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] logical_bundle_invalid');
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-CONTROL-PLANE-V89] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(relativeFile(EC_BOT_CORE_CONTROL_PLANE_V89_MANIFEST_PATH)) });
};

export const assertEcBotCoreControlPlaneV89 = ({ expectedRoot = root } = {}) => {
    if (path.resolve(expectedRoot) !== root) throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] release_root_mismatch');
    const identity = assertEcBotCoreControlPlaneManifestV89();
    const result = evaluateEcBotCoreControlPlaneV89({
        v85Options: {
            v78Manifest: readCanonicalJson('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json', 'v78_manifest'),
            v79Manifest: readCanonicalJson('docs/freeze/ec-bot-core-readiness-v79-20260829.json', 'v79_manifest'),
            v79Evidence: readCanonicalJson('docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json', 'v79_evidence'),
            v79Attestation: readCanonicalJson('docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json', 'v79_attestation')
        }
    });
    if (!result.ok) throw new Error(`[EC-BOT-CORE-CONTROL-PLANE-V89] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const installEcBotCoreControlPlaneContextV89 = ({ mode = 'runtime' } = {}) => {
    if (!['runtime', 'official_guard'].includes(mode)) throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] mode_invalid');
    const identity = assertEcBotCoreControlPlaneManifestV89();
    const inherited = normalizePaths(globalThis[EC_BOT_CORE_CONTROL_PLANE_V89_OVERRIDE_KEY] || []);
    const effectiveOverrides = [...new Set([...inherited, ...identity.overrides])];
    globalThis[EC_BOT_CORE_CONTROL_PLANE_V89_OVERRIDE_KEY] = effectiveOverrides;
    const state = Object.freeze({
        version: 89,
        mode,
        canonicalRoot: root,
        manifestSha256: identity.manifestSha256,
        effectiveOverrides: Object.freeze([...effectiveOverrides])
    });
    globalThis[EC_BOT_CORE_CONTROL_PLANE_V89_STATE_KEY] = state;
    return state;
};
