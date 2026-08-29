import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    EC_BOT_CORE_V78_DATASET_ID,
    buildEcBotCoreV78OverlayEnvironment,
    resolveEcBotCoreV78Configuration
} from './ecBotCoreOperationalV78Service.js';
import {
    canaryControllerV77EnforcementRequired,
    resolveCanaryControllerV77Runtime
} from './canaryControllerV77Service.js';
import {
    canaryV75EnforcementRequired,
    resolveCanaryV75Configuration
} from './canaryIsolationV75Service.js';
import { evaluateEcBotCoreActivationHealthV84 } from './ecBotCoreActivationHealthV84Service.js';

export const EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_COMMIT = '2edd1eb8b5013f276244783472098f3a80418ef2';
export const EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_TREE = '7ab153a8fa1030dd244f14ae4d2ba5f515e3a5aa';
export const EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_MANIFEST_SHA256 = '04d1f4450058f46bf9af7fc10a15cc7462dc512a330d72f1498762741d868984';
export const EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_FREEZE_SHA256 = 'd2e143a5520e34d53d9153275ee97d27c13c06dfec48ca54147e72fe915b8aa0';
export const EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_ATTESTATION_SHA256 = '0b8f22530e39c2a0c9f8568a2df299e0d97d22563964c4cc01976db9cf8caf9f';
export const EC_BOT_CORE_CANARY_CLASSIFICATION_V85_MANIFEST_PATH = 'docs/freeze/ec-bot-core-canary-classification-v85-20260829.json';
export const EC_BOT_CORE_CANARY_CLASSIFICATION_V85_STATE_KEY = '__VITALISMEN_V85_EC_BOT_CORE_CANARY_CLASSIFICATION_STATE';
export const EC_BOT_CORE_CANARY_CLASSIFICATION_V85_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ancestorOverrides = Object.freeze([
    'ops/ec-bot-core-v78',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    'src/services/canaryControllerV77Service.js',
    'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
]);
const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = (file) => sha256Buffer(fs.readFileSync(file));
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath
        || path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] protected_path_outside_root');
    }
    return candidate;
};
const readCanonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV84 = () => {
    const identities = new Map([
        ['docs/freeze/ec-bot-core-activation-health-v84-20260829.json', EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_MANIFEST_SHA256],
        ['docs/EC_BOT_CORE_ACTIVATION_HEALTH_STABILIZATION_FREEZE_V84_20260829.md', EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-bot-core-activation-health-v84-attestation-20260829.json', EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-bot-core-activation-health-v84-20260829.json', 'parent_manifest');
    if (parent.version !== 84 || parent.purpose !== 'EC_BOT_CORE_BOUNDED_HEALTH_STABILIZATION'
        || parent.policy?.healthAttempts !== 30 || parent.policy?.healthDelaySeconds !== 2
        || parent.policy?.botBusinessLogicChanged !== false
        || parent.policy?.mutatingSchedulersAllowed !== false
        || parent.policy?.dropiApplyAllowed !== false
        || parent.policy?.metaPurchaseAllowed !== false
        || parent.policy?.realCustomerTrafficAuthorized !== false) {
        throw new Error('[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] parent_policy_invalid');
    }
    const overrideSet = new Set(ancestorOverrides);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (overrideSet.has(relativePath)) continue;
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] parent_protected_file_invalid:${relativePath}`);
        }
    }
    return parent;
};

const officialBotCoreEnvironment = () => ({
    ...buildEcBotCoreV78OverlayEnvironment({
        baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID }
    }),
    META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID
});

export const evaluateEcBotCoreCanaryClassificationV85 = ({
    env = officialBotCoreEnvironment(),
    v78Manifest = {},
    v79Manifest = {},
    v79Evidence = {},
    v79Attestation = {}
} = {}) => {
    const activation = evaluateEcBotCoreActivationHealthV84({
        v78Manifest,
        v79Manifest,
        v79Evidence,
        v79Attestation
    });
    const botCore = resolveEcBotCoreV78Configuration(env);
    const v77EnforcementRequired = canaryControllerV77EnforcementRequired(env);
    const v75EnforcementRequired = canaryV75EnforcementRequired(env);
    const v77 = resolveCanaryControllerV77Runtime(env);
    const v75 = resolveCanaryV75Configuration(env);
    const failures = [...activation.failures];
    if (activation.ready !== true) failures.push('v84_activation_readiness_missing');
    if (!botCore.enabled || !botCore.ready) failures.push('v78_profile_not_ready');
    if (v77EnforcementRequired !== false || v77.enabled !== false || v77.ready !== true) {
        failures.push('v77_classification_not_bypassed_for_exact_v78');
    }
    if (v75EnforcementRequired !== false || v75.enabled !== false) {
        failures.push('v75_classification_not_bypassed_for_exact_v78');
    }
    return Object.freeze({
        ok: failures.length === 0,
        failures: Object.freeze(failures),
        ready: failures.length === 0,
        v77EnforcementRequired,
        v75EnforcementRequired,
        healthAttempts: activation.healthAttempts,
        healthDelaySeconds: activation.healthDelaySeconds,
        datasetId: activation.datasetId,
        profile: activation.profile
    });
};

export const assertEcBotCoreCanaryClassificationManifestV85 = () => {
    assertParentV84();
    const manifest = readCanonicalJson(EC_BOT_CORE_CANARY_CLASSIFICATION_V85_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-bot-core-canary-classification-v85'
        || manifest.version !== 85 || manifest.parentVersion !== 'V84'
        || manifest.parentCommit !== EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_COMMIT
        || manifest.parentTree !== EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_TREE
        || manifest.purpose !== 'EC_BOT_CORE_EXACT_V78_CANARY_CLASSIFICATION'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(ancestorOverrides)
        || manifest.policy?.requiresCompleteV78Profile !== true
        || manifest.policy?.v78FlagOnlyAccepted !== false
        || manifest.policy?.v77CanarySemanticsChanged !== false
        || manifest.policy?.botBusinessLogicChanged !== false
        || manifest.policy?.mutatingSchedulersAllowed !== false
        || manifest.policy?.dropiApplyAllowed !== false
        || manifest.policy?.metaPurchaseAllowed !== false
        || manifest.policy?.realCustomerTrafficAuthorized !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalHash) {
        throw new Error('[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] logical_bundle_invalid');
    }
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(relativeFile(EC_BOT_CORE_CANARY_CLASSIFICATION_V85_MANIFEST_PATH)) });
};

export const assertEcBotCoreCanaryClassificationV85 = ({ expectedRoot = root } = {}) => {
    if (path.resolve(expectedRoot) !== root) throw new Error('[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] release_root_mismatch');
    const identity = assertEcBotCoreCanaryClassificationManifestV85();
    const result = evaluateEcBotCoreCanaryClassificationV85({
        v78Manifest: readCanonicalJson('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json', 'v78_manifest'),
        v79Manifest: readCanonicalJson('docs/freeze/ec-bot-core-readiness-v79-20260829.json', 'v79_manifest'),
        v79Evidence: readCanonicalJson('docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json', 'v79_evidence'),
        v79Attestation: readCanonicalJson('docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json', 'v79_attestation')
    });
    if (!result.ok) throw new Error(`[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const installEcBotCoreCanaryClassificationContextV85 = ({ mode = 'runtime' } = {}) => {
    if (!['runtime', 'official_guard'].includes(mode)) throw new Error('[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] mode_invalid');
    const identity = assertEcBotCoreCanaryClassificationManifestV85();
    const inherited = normalizePaths(globalThis[EC_BOT_CORE_CANARY_CLASSIFICATION_V85_OVERRIDE_KEY] || []);
    const effectiveOverrides = [...new Set([...inherited, ...identity.overrides])];
    globalThis[EC_BOT_CORE_CANARY_CLASSIFICATION_V85_OVERRIDE_KEY] = effectiveOverrides;
    const state = Object.freeze({
        version: 85,
        mode,
        canonicalRoot: root,
        manifestSha256: identity.manifestSha256,
        effectiveOverrides: Object.freeze([...effectiveOverrides])
    });
    globalThis[EC_BOT_CORE_CANARY_CLASSIFICATION_V85_STATE_KEY] = state;
    return state;
};
