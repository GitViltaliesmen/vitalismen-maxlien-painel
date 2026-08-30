import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateEcBotCoreCanaryClassificationV85 } from './ecBotCoreCanaryClassificationV85Service.js';

export const EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_COMMIT = '59fd9a53fce9536a6460f5581059bb18a8905779';
export const EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_TREE = '8cd9665cf95646afc474d798ebf799b58d4cacb6';
export const EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_MANIFEST_SHA256 = '93caedc3d8fc4e0d21fa7e8e72a0c9db5213a6bf0bce3e9a19d6576120b193c5';
export const EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_FREEZE_SHA256 = '8110af7a8f5f87cc8e020ff1ec8b3647e4ce6d13861fb8f37538a94e0a63d411';
export const EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_ATTESTATION_SHA256 = 'b326b2baad4c56699e242ece0137de2303cff2602990a34ddb577b4016d9cee2';
export const EC_BOT_CORE_RUNTIME_BOOT_V87_ANCESTOR_V82_MANIFEST_SHA256 = '4de1f199fca61a9fa96f65c786df59f23a36db7a55375a3131a7cee7b0871a40';
export const EC_BOT_CORE_RUNTIME_BOOT_V87_ANCESTOR_V82_FREEZE_SHA256 = 'e237ba68a65b8c428625804727f3fbb163124114685bf2befc40aa417915bc0a';
export const EC_BOT_CORE_RUNTIME_BOOT_V87_ANCESTOR_V82_ATTESTATION_SHA256 = '00c44baa2cb3f851ce72db7e61b9a0195e04a1bbb116dd9fbe16d71b3cf2cbd0';
export const EC_BOT_CORE_RUNTIME_BOOT_V87_MANIFEST_PATH = 'docs/freeze/ec-bot-core-runtime-boot-v87-20260829.json';
export const EC_BOT_CORE_RUNTIME_BOOT_V87_STATE_KEY = '__VITALISMEN_V87_EC_BOT_CORE_RUNTIME_BOOT_STATE';
export const EC_BOT_CORE_RUNTIME_BOOT_V87_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

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
    'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
]);
const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = (file) => sha256Buffer(fs.readFileSync(file));
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath
        || path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-BOT-CORE-RUNTIME-BOOT-V87] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-BOT-CORE-RUNTIME-BOOT-V87] protected_path_outside_root');
    }
    return candidate;
};
const readCanonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-BOT-CORE-RUNTIME-BOOT-V87] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-BOT-CORE-RUNTIME-BOOT-V87] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');

const assertParentV86 = () => {
    const identities = new Map([
        ['docs/freeze/ec-bot-core-operational-plan-v86-20260829.json', EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_MANIFEST_SHA256],
        ['docs/EC_BOT_CORE_OPERATIONAL_PLAN_ALIGNMENT_FREEZE_V86_20260829.md', EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-bot-core-operational-plan-v86-attestation-20260829.json', EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-RUNTIME-BOOT-V87] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-bot-core-operational-plan-v86-20260829.json', 'parent_manifest');
    if (parent.version !== 86 || parent.purpose !== 'EC_BOT_CORE_SUCCESSOR_AWARE_OPERATIONAL_PLAN'
        || parent.policy?.healthAttempts !== 30 || parent.policy?.healthDelaySeconds !== 2
        || parent.policy?.botBusinessLogicChanged !== false
        || parent.policy?.mutatingSchedulersAllowed !== false
        || parent.policy?.dropiApplyAllowed !== false
        || parent.policy?.metaPurchaseAllowed !== false
        || parent.policy?.realCustomerTrafficAuthorized !== false) {
        throw new Error('[EC-BOT-CORE-RUNTIME-BOOT-V87] parent_policy_invalid');
    }
    const modified = new Set(modifiedParentProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-RUNTIME-BOOT-V87] parent_protected_file_invalid:${relativePath}`);
        }
    }
    return parent;
};

const assertAncestorV82 = () => {
    const identities = new Map([
        ['docs/freeze/runtime-successor-context-v82-20260829.json', EC_BOT_CORE_RUNTIME_BOOT_V87_ANCESTOR_V82_MANIFEST_SHA256],
        ['docs/RUNTIME_SUCCESSOR_CONTEXT_FREEZE_V82_20260829.md', EC_BOT_CORE_RUNTIME_BOOT_V87_ANCESTOR_V82_FREEZE_SHA256],
        ['docs/evidence/runtime-successor-context-v82-attestation-20260829.json', EC_BOT_CORE_RUNTIME_BOOT_V87_ANCESTOR_V82_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-RUNTIME-BOOT-V87] v82_identity_invalid:${relativePath}`);
        }
    }
    const manifest = readCanonicalJson('docs/freeze/runtime-successor-context-v82-20260829.json', 'v82_manifest');
    if (manifest.version !== 82 || manifest.purpose !== 'RUNTIME_SUCCESSOR_CONTEXT_BOOTSTRAP'
        || JSON.stringify(manifest.declaredAncestorOverrides) !== JSON.stringify(['src/index.js'])
        || manifest.policy?.botBusinessLogicChanged !== false
        || manifest.policy?.mutatingSchedulersAllowed !== false
        || manifest.policy?.dropiApplyAllowed !== false
        || manifest.policy?.metaPurchaseAllowed !== false
        || manifest.policy?.realCustomerTrafficAuthorized !== false) {
        throw new Error('[EC-BOT-CORE-RUNTIME-BOOT-V87] v82_policy_invalid');
    }
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (relativePath === 'src/index.js') continue;
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-RUNTIME-BOOT-V87] v82_protected_file_invalid:${relativePath}`);
        }
    }
    return manifest;
};

export const evaluateEcBotCoreRuntimeBootV87 = ({
    indexSource = readText('src/index.js'),
    preloaderSource = readText('scripts/lib/ec-bot-core-runtime-boot-v87-successor-context.mjs'),
    opsSource = readText('ops/ec-bot-core-v78'),
    contractSource = readText('scripts/lib/ec-bot-core-operational-contract-v78.mjs'),
    structuralGuardSource = readText('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'),
    v85Options = {}
} = {}) => {
    const classification = evaluateEcBotCoreCanaryClassificationV85(v85Options);
    const bootImport = "import '../scripts/lib/ec-bot-core-runtime-boot-v87-successor-context.mjs';";
    const nextGuardImport = "import './services/ecEngagementFreezeRuntimeGuardV40.js';";
    const bootIndex = indexSource.indexOf(bootImport);
    const nextGuardIndex = indexSource.indexOf(nextGuardImport);
    const failures = [];
    if (classification.ready !== true) failures.push('v85_classification_readiness_missing');
    if (bootIndex < 0) failures.push('v87_first_import_missing');
    if (nextGuardIndex < 0 || bootIndex > nextGuardIndex) failures.push('v87_context_loaded_after_ancestor');
    if (indexSource.includes("import './services/runtimeSuccessorContextFreezeRuntimeGuardV82.js';")) {
        failures.push('direct_v82_runtime_import_still_present');
    }
    for (const relativePath of ancestorOverrides) {
        if (!preloaderSource.includes(`'${relativePath}'`)) failures.push(`preloader_override_missing:${relativePath}`);
    }
    if (!preloaderSource.includes("ec-bot-core-readiness-v79-successor-context.mjs")) {
        failures.push('v79_ancestor_context_missing');
    }
    if (!preloaderSource.includes("ecBotCoreRuntimeBootFreezeRuntimeGuardV87.js")) {
        failures.push('v87_runtime_guard_missing');
    }
    if (opsSource.includes('guard-ec-bot-core-operational-plan-v86.mjs')) failures.push('v86_plan_guard_still_called');
    if (!opsSource.includes('guard-ec-bot-core-runtime-boot-v87.mjs')) failures.push('v87_plan_guard_missing');
    if (!contractSource.includes('assertEcBotCoreRuntimeBootV87')) failures.push('contract_v87_assertion_missing');
    if (!structuralGuardSource.includes('ec-bot-core-runtime-boot-v87-successor-context.mjs')) {
        failures.push('structural_runtime_v87_context_missing');
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

export const assertEcBotCoreRuntimeBootManifestV87 = () => {
    assertParentV86();
    const manifest = readCanonicalJson(EC_BOT_CORE_RUNTIME_BOOT_V87_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedParentProtectedFiles);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-bot-core-runtime-boot-v87'
        || manifest.version !== 87 || manifest.parentVersion !== 'V86'
        || manifest.parentCommit !== EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_COMMIT
        || manifest.parentTree !== EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_TREE
        || manifest.purpose !== 'EC_BOT_CORE_FIRST_IMPORT_SUCCESSOR_CONTEXT'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(ancestorOverrides)
        || JSON.stringify(modified) !== JSON.stringify(modifiedParentProtectedFiles)
        || manifest.policy?.startupPreloadBeforeAncestors !== true
        || manifest.policy?.v82StrictEntrypointSucceeded !== true
        || manifest.policy?.v86OperationalPolicyChanged !== false
        || manifest.policy?.botBusinessLogicChanged !== false
        || manifest.policy?.mutatingSchedulersAllowed !== false
        || manifest.policy?.dropiApplyAllowed !== false
        || manifest.policy?.metaPurchaseAllowed !== false
        || manifest.policy?.realCustomerTrafficAuthorized !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[EC-BOT-CORE-RUNTIME-BOOT-V87] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalHash) {
        throw new Error('[EC-BOT-CORE-RUNTIME-BOOT-V87] logical_bundle_invalid');
    }
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-RUNTIME-BOOT-V87] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(relativeFile(EC_BOT_CORE_RUNTIME_BOOT_V87_MANIFEST_PATH)) });
};

export const assertEcBotCoreRuntimeBootV87 = ({ expectedRoot = root } = {}) => {
    if (path.resolve(expectedRoot) !== root) throw new Error('[EC-BOT-CORE-RUNTIME-BOOT-V87] release_root_mismatch');
    assertAncestorV82();
    const identity = assertEcBotCoreRuntimeBootManifestV87();
    const result = evaluateEcBotCoreRuntimeBootV87({
        v85Options: {
            v78Manifest: readCanonicalJson('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json', 'v78_manifest'),
            v79Manifest: readCanonicalJson('docs/freeze/ec-bot-core-readiness-v79-20260829.json', 'v79_manifest'),
            v79Evidence: readCanonicalJson('docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json', 'v79_evidence'),
            v79Attestation: readCanonicalJson('docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json', 'v79_attestation')
        }
    });
    if (!result.ok) throw new Error(`[EC-BOT-CORE-RUNTIME-BOOT-V87] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const installEcBotCoreRuntimeBootContextV87 = ({ mode = 'runtime' } = {}) => {
    if (!['runtime', 'official_guard'].includes(mode)) throw new Error('[EC-BOT-CORE-RUNTIME-BOOT-V87] mode_invalid');
    const identity = assertEcBotCoreRuntimeBootManifestV87();
    const inherited = normalizePaths(globalThis[EC_BOT_CORE_RUNTIME_BOOT_V87_OVERRIDE_KEY] || []);
    const effectiveOverrides = [...new Set([...inherited, ...identity.overrides])];
    globalThis[EC_BOT_CORE_RUNTIME_BOOT_V87_OVERRIDE_KEY] = effectiveOverrides;
    const state = Object.freeze({
        version: 87,
        mode,
        canonicalRoot: root,
        manifestSha256: identity.manifestSha256,
        effectiveOverrides: Object.freeze([...effectiveOverrides])
    });
    globalThis[EC_BOT_CORE_RUNTIME_BOOT_V87_STATE_KEY] = state;
    return state;
};
