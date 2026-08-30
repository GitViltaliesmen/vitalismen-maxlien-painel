import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateEcBotCoreCanaryClassificationV85 } from './ecBotCoreCanaryClassificationV85Service.js';

export const EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_COMMIT = '89a834406ac5ca72d7ecd7b8aae225c44cefdab6';
export const EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_TREE = '189bc3dd52f98ba6dbffb6da3c2ea97e97c0be28';
export const EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_MANIFEST_SHA256 = 'a6f66938180b7cc19f8bcac9af45bf6cd40feb9258f85a9392a5f6c3d6e4e182';
export const EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_FREEZE_SHA256 = '8c42ddaf3888c86172d20df422e3edebbf77f647dd6562a31d7ce2bfbc44d673';
export const EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_ATTESTATION_SHA256 = '5762fb106e854521fc4accf10a0668285995d9f5fe58a76176b294ef3d714412';
export const EC_BOT_CORE_LIFECYCLE_BOOT_V88_MANIFEST_PATH = 'docs/freeze/ec-bot-core-lifecycle-boot-v88-20260830.json';
export const EC_BOT_CORE_LIFECYCLE_BOOT_V88_STATE_KEY = '__VITALISMEN_V88_EC_BOT_CORE_LIFECYCLE_BOOT_STATE';
export const EC_BOT_CORE_LIFECYCLE_BOOT_V88_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ancestorOverrides = Object.freeze([
    'ops/ec-bot-core-v78',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    'src/index.js',
    'src/services/canaryControllerV77Service.js',
    'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
]);
const modifiedParentProtectedFiles = Object.freeze([
    'ops/ec-bot-core-v78',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    'src/index.js',
    'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
]);
const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = (file) => sha256Buffer(fs.readFileSync(file));
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-BOT-CORE-LIFECYCLE-BOOT-V88] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-BOT-CORE-LIFECYCLE-BOOT-V88] protected_path_outside_root');
    }
    return candidate;
};
const readCanonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-BOT-CORE-LIFECYCLE-BOOT-V88] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-BOT-CORE-LIFECYCLE-BOOT-V88] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');

const assertParentV87 = () => {
    const identities = new Map([
        ['docs/freeze/ec-bot-core-runtime-boot-v87-20260829.json', EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_MANIFEST_SHA256],
        ['docs/EC_BOT_CORE_RUNTIME_BOOT_CONTEXT_FREEZE_V87_20260829.md', EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-bot-core-runtime-boot-v87-attestation-20260829.json', EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-LIFECYCLE-BOOT-V88] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-bot-core-runtime-boot-v87-20260829.json', 'parent_manifest');
    if (parent.version !== 87 || parent.purpose !== 'EC_BOT_CORE_FIRST_IMPORT_SUCCESSOR_CONTEXT'
        || parent.policy?.startupPreloadBeforeAncestors !== true
        || parent.policy?.healthAttempts !== 30 || parent.policy?.healthDelaySeconds !== 2
        || parent.policy?.botBusinessLogicChanged !== false
        || parent.policy?.mutatingSchedulersAllowed !== false
        || parent.policy?.dropiApplyAllowed !== false
        || parent.policy?.metaPurchaseAllowed !== false
        || parent.policy?.realCustomerTrafficAuthorized !== false) {
        throw new Error('[EC-BOT-CORE-LIFECYCLE-BOOT-V88] parent_policy_invalid');
    }
    const modified = new Set(modifiedParentProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-LIFECYCLE-BOOT-V88] parent_protected_file_invalid:${relativePath}`);
        }
    }
    return parent;
};

export const evaluateEcBotCoreLifecycleBootV88 = ({
    indexSource = readText('src/index.js'),
    preloaderSource = readText('scripts/lib/ec-bot-core-lifecycle-boot-v88-successor-context.mjs'),
    opsSource = readText('ops/ec-bot-core-v78'),
    contractSource = readText('scripts/lib/ec-bot-core-operational-contract-v78.mjs'),
    structuralGuardSource = readText('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'),
    v85Options = {}
} = {}) => {
    const classification = evaluateEcBotCoreCanaryClassificationV85(v85Options);
    const bootImport = "import '../scripts/lib/ec-bot-core-lifecycle-boot-v88-successor-context.mjs';";
    const nextGuardImport = "import './services/ecEngagementFreezeRuntimeGuardV40.js';";
    const bootIndex = indexSource.indexOf(bootImport);
    const nextGuardIndex = indexSource.indexOf(nextGuardImport);
    const failures = [...classification.failures];
    if (classification.ready !== true) failures.push('v85_classification_readiness_missing');
    if (bootIndex < 0) failures.push('v88_first_import_missing');
    if (nextGuardIndex < 0 || bootIndex > nextGuardIndex) failures.push('v88_context_loaded_after_ancestor');
    for (const relativePath of ancestorOverrides) {
        if (!preloaderSource.includes(`'${relativePath}'`)) failures.push(`preloader_override_missing:${relativePath}`);
    }
    if (!preloaderSource.includes('dependencyLifecycle') || !preloaderSource.includes('npm_package_json')) {
        failures.push('dependency_lifecycle_classification_missing');
    }
    if (!preloaderSource.includes('stripOwnNodeOption')) failures.push('node_options_strip_missing');
    if (!preloaderSource.includes('ec-bot-core-readiness-v79-successor-context.mjs')) failures.push('v79_context_missing');
    if (!preloaderSource.includes('ecBotCoreLifecycleBootFreezeRuntimeGuardV88.js')) failures.push('v88_runtime_guard_missing');
    if (!opsSource.includes('guard-ec-bot-core-lifecycle-boot-v88.mjs')) failures.push('v88_plan_guard_missing');
    if (!contractSource.includes('assertEcBotCoreLifecycleBootV88')) failures.push('contract_v88_assertion_missing');
    if (!structuralGuardSource.includes('ec-bot-core-lifecycle-boot-v88-successor-context.mjs')) {
        failures.push('structural_runtime_v88_context_missing');
    }
    return Object.freeze({
        ok: failures.length === 0,
        ready: failures.length === 0,
        failures: Object.freeze(failures),
        firstImportInstalled: bootIndex >= 0 && bootIndex < nextGuardIndex,
        healthAttempts: 30,
        healthDelaySeconds: 2,
        datasetId: classification.datasetId,
        profile: classification.profile
    });
};

export const assertEcBotCoreLifecycleBootManifestV88 = () => {
    assertParentV87();
    const manifest = readCanonicalJson(EC_BOT_CORE_LIFECYCLE_BOOT_V88_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedParentProtectedFiles);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-bot-core-lifecycle-boot-v88'
        || manifest.version !== 88 || manifest.parentVersion !== 'V87'
        || manifest.parentCommit !== EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_COMMIT
        || manifest.parentTree !== EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_TREE
        || manifest.purpose !== 'EC_BOT_CORE_DEPENDENCY_LIFECYCLE_AWARE_BOOT'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(ancestorOverrides)
        || JSON.stringify(modified) !== JSON.stringify(modifiedParentProtectedFiles)
        || manifest.policy?.dependencyLifecycleGuardBypassOnly !== true
        || manifest.policy?.projectLifecycleGuarded !== true
        || manifest.policy?.runtimeGuarded !== true
        || manifest.policy?.nodeOptionsStrippedBeforeChildren !== true
        || manifest.policy?.botBusinessLogicChanged !== false
        || manifest.policy?.mutatingSchedulersAllowed !== false
        || manifest.policy?.dropiApplyAllowed !== false
        || manifest.policy?.metaPurchaseAllowed !== false
        || manifest.policy?.realCustomerTrafficAuthorized !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[EC-BOT-CORE-LIFECYCLE-BOOT-V88] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalHash) throw new Error('[EC-BOT-CORE-LIFECYCLE-BOOT-V88] logical_bundle_invalid');
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-LIFECYCLE-BOOT-V88] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(relativeFile(EC_BOT_CORE_LIFECYCLE_BOOT_V88_MANIFEST_PATH)) });
};

export const assertEcBotCoreLifecycleBootV88 = ({ expectedRoot = root } = {}) => {
    if (path.resolve(expectedRoot) !== root) throw new Error('[EC-BOT-CORE-LIFECYCLE-BOOT-V88] release_root_mismatch');
    const identity = assertEcBotCoreLifecycleBootManifestV88();
    const result = evaluateEcBotCoreLifecycleBootV88({
        v85Options: {
            v78Manifest: readCanonicalJson('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json', 'v78_manifest'),
            v79Manifest: readCanonicalJson('docs/freeze/ec-bot-core-readiness-v79-20260829.json', 'v79_manifest'),
            v79Evidence: readCanonicalJson('docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json', 'v79_evidence'),
            v79Attestation: readCanonicalJson('docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json', 'v79_attestation')
        }
    });
    if (!result.ok) throw new Error(`[EC-BOT-CORE-LIFECYCLE-BOOT-V88] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const installEcBotCoreLifecycleBootContextV88 = ({ mode = 'runtime' } = {}) => {
    if (!['runtime', 'official_guard'].includes(mode)) throw new Error('[EC-BOT-CORE-LIFECYCLE-BOOT-V88] mode_invalid');
    const identity = assertEcBotCoreLifecycleBootManifestV88();
    const inherited = normalizePaths(globalThis[EC_BOT_CORE_LIFECYCLE_BOOT_V88_OVERRIDE_KEY] || []);
    const effectiveOverrides = [...new Set([...inherited, ...identity.overrides])];
    globalThis[EC_BOT_CORE_LIFECYCLE_BOOT_V88_OVERRIDE_KEY] = effectiveOverrides;
    const state = Object.freeze({
        version: 88,
        mode,
        canonicalRoot: root,
        manifestSha256: identity.manifestSha256,
        effectiveOverrides: Object.freeze([...effectiveOverrides])
    });
    globalThis[EC_BOT_CORE_LIFECYCLE_BOOT_V88_STATE_KEY] = state;
    return state;
};
