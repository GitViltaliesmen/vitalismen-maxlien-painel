import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateEcBotCoreCanaryClassificationV85 } from './ecBotCoreCanaryClassificationV85Service.js';

export const EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_COMMIT = '4084bf8ee2dded6a5ce6388aecfe57b7ce50d192';
export const EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_TREE = '616967d32a2d354d2cfed0d8fb5dd4c56655825b';
export const EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_MANIFEST_SHA256 = '4398170c81b95e789a9274714c917aa3ce29170dac6a744d36eb85f1ad45ee25';
export const EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_FREEZE_SHA256 = '9f019822a59d122915c09658fb6b70c2d5951b53026a485a817dc545374bc322';
export const EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_ATTESTATION_SHA256 = '9b80b2908e249517f450690bc2955d4239e979eace765eae2097f232dc968301';
export const EC_BOT_CORE_OPERATIONAL_PLAN_V86_MANIFEST_PATH = 'docs/freeze/ec-bot-core-operational-plan-v86-20260829.json';
export const EC_BOT_CORE_OPERATIONAL_PLAN_V86_STATE_KEY = '__VITALISMEN_V86_EC_BOT_CORE_OPERATIONAL_PLAN_STATE';
export const EC_BOT_CORE_OPERATIONAL_PLAN_V86_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ancestorOverrides = Object.freeze([
    'ops/ec-bot-core-v78',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
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
        throw new Error('[EC-BOT-CORE-OPERATIONAL-PLAN-V86] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-BOT-CORE-OPERATIONAL-PLAN-V86] protected_path_outside_root');
    }
    return candidate;
};
const readCanonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-BOT-CORE-OPERATIONAL-PLAN-V86] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-BOT-CORE-OPERATIONAL-PLAN-V86] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');

const assertParentV85 = () => {
    const identities = new Map([
        ['docs/freeze/ec-bot-core-canary-classification-v85-20260829.json', EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_MANIFEST_SHA256],
        ['docs/EC_BOT_CORE_CANARY_CLASSIFICATION_FREEZE_V85_20260829.md', EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-bot-core-canary-classification-v85-attestation-20260829.json', EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-OPERATIONAL-PLAN-V86] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-bot-core-canary-classification-v85-20260829.json', 'parent_manifest');
    if (parent.version !== 85 || parent.purpose !== 'EC_BOT_CORE_EXACT_V78_CANARY_CLASSIFICATION'
        || parent.policy?.requiresCompleteV78Profile !== true
        || parent.policy?.v77CanarySemanticsChanged !== false
        || parent.policy?.healthAttempts !== 30 || parent.policy?.healthDelaySeconds !== 2
        || parent.policy?.botBusinessLogicChanged !== false
        || parent.policy?.mutatingSchedulersAllowed !== false
        || parent.policy?.dropiApplyAllowed !== false
        || parent.policy?.metaPurchaseAllowed !== false
        || parent.policy?.realCustomerTrafficAuthorized !== false) {
        throw new Error('[EC-BOT-CORE-OPERATIONAL-PLAN-V86] parent_policy_invalid');
    }
    const modified = new Set(modifiedParentProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-OPERATIONAL-PLAN-V86] parent_protected_file_invalid:${relativePath}`);
        }
    }
    return parent;
};

export const evaluateEcBotCoreOperationalPlanV86 = ({
    opsSource = readText('ops/ec-bot-core-v78'),
    contractSource = readText('scripts/lib/ec-bot-core-operational-contract-v78.mjs'),
    structuralGuardSource = readText('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'),
    v85Options = {}
} = {}) => {
    const classification = evaluateEcBotCoreCanaryClassificationV85(v85Options);
    const ancestralPlanGuardCalled = opsSource.includes('"$node_cmd" scripts/guard-ec-bot-core-structural-v78.mjs');
    const successorPlanGuardCalled = opsSource.includes('"$node_cmd" scripts/guard-ec-bot-core-operational-plan-v86.mjs');
    const failures = [...classification.failures];
    if (classification.ready !== true) failures.push('v85_classification_readiness_missing');
    if (ancestralPlanGuardCalled) failures.push('ancestral_v78_plan_guard_still_called');
    if (!successorPlanGuardCalled) failures.push('successor_v86_plan_guard_missing');
    if (!contractSource.includes('assertEcBotCoreOperationalPlanV86')) failures.push('contract_v86_assertion_missing');
    if (!structuralGuardSource.includes('ec-bot-core-operational-plan-v86-successor-context.mjs')) {
        failures.push('structural_runtime_v86_context_missing');
    }
    return Object.freeze({
        ok: failures.length === 0,
        ready: failures.length === 0,
        failures: Object.freeze(failures),
        ancestralPlanGuardCalled,
        successorPlanGuardCalled,
        healthAttempts: classification.healthAttempts,
        healthDelaySeconds: classification.healthDelaySeconds,
        datasetId: classification.datasetId,
        profile: classification.profile
    });
};

export const assertEcBotCoreOperationalPlanManifestV86 = () => {
    assertParentV85();
    const manifest = readCanonicalJson(EC_BOT_CORE_OPERATIONAL_PLAN_V86_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedParentProtectedFiles);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-bot-core-operational-plan-v86'
        || manifest.version !== 86 || manifest.parentVersion !== 'V85'
        || manifest.parentCommit !== EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_COMMIT
        || manifest.parentTree !== EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_TREE
        || manifest.purpose !== 'EC_BOT_CORE_SUCCESSOR_AWARE_OPERATIONAL_PLAN'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(ancestorOverrides)
        || JSON.stringify(modified) !== JSON.stringify(modifiedParentProtectedFiles)
        || manifest.policy?.ancestralGuardModified !== false
        || manifest.policy?.v85ClassificationChanged !== false
        || manifest.policy?.botBusinessLogicChanged !== false
        || manifest.policy?.mutatingSchedulersAllowed !== false
        || manifest.policy?.dropiApplyAllowed !== false
        || manifest.policy?.metaPurchaseAllowed !== false
        || manifest.policy?.realCustomerTrafficAuthorized !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[EC-BOT-CORE-OPERATIONAL-PLAN-V86] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalHash) {
        throw new Error('[EC-BOT-CORE-OPERATIONAL-PLAN-V86] logical_bundle_invalid');
    }
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-OPERATIONAL-PLAN-V86] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(relativeFile(EC_BOT_CORE_OPERATIONAL_PLAN_V86_MANIFEST_PATH)) });
};

export const assertEcBotCoreOperationalPlanV86 = ({ expectedRoot = root } = {}) => {
    if (path.resolve(expectedRoot) !== root) throw new Error('[EC-BOT-CORE-OPERATIONAL-PLAN-V86] release_root_mismatch');
    const identity = assertEcBotCoreOperationalPlanManifestV86();
    const result = evaluateEcBotCoreOperationalPlanV86({
        v85Options: {
            v78Manifest: readCanonicalJson('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json', 'v78_manifest'),
            v79Manifest: readCanonicalJson('docs/freeze/ec-bot-core-readiness-v79-20260829.json', 'v79_manifest'),
            v79Evidence: readCanonicalJson('docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json', 'v79_evidence'),
            v79Attestation: readCanonicalJson('docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json', 'v79_attestation')
        }
    });
    if (!result.ok) throw new Error(`[EC-BOT-CORE-OPERATIONAL-PLAN-V86] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const installEcBotCoreOperationalPlanContextV86 = ({ mode = 'runtime' } = {}) => {
    if (!['runtime', 'official_guard'].includes(mode)) throw new Error('[EC-BOT-CORE-OPERATIONAL-PLAN-V86] mode_invalid');
    const identity = assertEcBotCoreOperationalPlanManifestV86();
    const inherited = normalizePaths(globalThis[EC_BOT_CORE_OPERATIONAL_PLAN_V86_OVERRIDE_KEY] || []);
    const effectiveOverrides = [...new Set([...inherited, ...identity.overrides])];
    globalThis[EC_BOT_CORE_OPERATIONAL_PLAN_V86_OVERRIDE_KEY] = effectiveOverrides;
    const state = Object.freeze({
        version: 86,
        mode,
        canonicalRoot: root,
        manifestSha256: identity.manifestSha256,
        effectiveOverrides: Object.freeze([...effectiveOverrides])
    });
    globalThis[EC_BOT_CORE_OPERATIONAL_PLAN_V86_STATE_KEY] = state;
    return state;
};
