import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    evaluateEcBotCoreOperationalReadinessV83
} from './ecBotCoreOperationalReadinessV83Service.js';

export const EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_COMMIT = 'bb3afb410dbd702425728f8c4eadafecc803b258';
export const EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_TREE = '40afa2d22a4bccc015d2d1b0ae5b47d0076d81ed';
export const EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_MANIFEST_SHA256 = 'd0e12977e3053949db6c8afb4529c66d559b3179d1c485893328924f52696ede';
export const EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_FREEZE_SHA256 = '64e3cbe581f26f00a271730d48db57d7cbaa51ebbaeb606ed785a21c00f09721';
export const EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_ATTESTATION_SHA256 = 'c1a1b3767aee1fd24f8539be54557db0feac00bf858998a2ba8c67649a278f09';
export const EC_BOT_CORE_ACTIVATION_HEALTH_V84_MANIFEST_PATH = 'docs/freeze/ec-bot-core-activation-health-v84-20260829.json';
export const EC_BOT_CORE_ACTIVATION_HEALTH_V84_STATE_KEY = '__VITALISMEN_V84_EC_BOT_CORE_ACTIVATION_HEALTH_STATE';
export const EC_BOT_CORE_ACTIVATION_HEALTH_V84_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ancestorOverrides = Object.freeze([
    'ops/ec-bot-core-v78',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
]);
const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = (file) => sha256Buffer(fs.readFileSync(file));
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath
        || path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-BOT-CORE-ACTIVATION-HEALTH-V84] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-BOT-CORE-ACTIVATION-HEALTH-V84] protected_path_outside_root');
    }
    return candidate;
};
const readCanonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-BOT-CORE-ACTIVATION-HEALTH-V84] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-BOT-CORE-ACTIVATION-HEALTH-V84] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV83 = () => {
    const identities = new Map([
        ['docs/freeze/ec-bot-core-operational-readiness-v83-20260829.json', EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_MANIFEST_SHA256],
        ['docs/EC_BOT_CORE_OPERATIONAL_READINESS_BRIDGE_FREEZE_V83_20260829.md', EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-bot-core-operational-readiness-v83-attestation-20260829.json', EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-ACTIVATION-HEALTH-V84] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-bot-core-operational-readiness-v83-20260829.json', 'parent_manifest');
    if (parent.version !== 83 || parent.purpose !== 'EC_BOT_CORE_V79_READINESS_BRIDGE'
        || parent.policy?.botBusinessLogicChanged !== false
        || parent.policy?.mutatingSchedulersAllowed !== false
        || parent.policy?.dropiApplyAllowed !== false
        || parent.policy?.metaPurchaseAllowed !== false
        || parent.policy?.realCustomerTrafficAuthorized !== false) {
        throw new Error('[EC-BOT-CORE-ACTIVATION-HEALTH-V84] parent_policy_invalid');
    }
    const overrideSet = new Set(ancestorOverrides);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (overrideSet.has(relativePath)) continue;
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-ACTIVATION-HEALTH-V84] parent_protected_file_invalid:${relativePath}`);
        }
    }
    return parent;
};

export const evaluateEcBotCoreActivationHealthV84 = ({
    v78Manifest = {},
    v79Manifest = {},
    v79Evidence = {},
    v79Attestation = {}
} = {}) => {
    const readiness = evaluateEcBotCoreOperationalReadinessV83({
        v78Manifest,
        v79Manifest,
        v79Evidence,
        v79Attestation
    });
    const failures = [...readiness.failures];
    if (readiness.ready !== true) failures.push('v83_readiness_missing');
    return Object.freeze({
        ok: failures.length === 0,
        failures: Object.freeze(failures),
        ready: failures.length === 0,
        healthAttempts: 30,
        healthDelaySeconds: 2,
        datasetId: readiness.datasetId,
        profile: readiness.profile
    });
};

export const assertEcBotCoreActivationHealthManifestV84 = () => {
    assertParentV83();
    const manifest = readCanonicalJson(EC_BOT_CORE_ACTIVATION_HEALTH_V84_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-bot-core-activation-health-v84'
        || manifest.version !== 84
        || manifest.parentVersion !== 'V83'
        || manifest.parentCommit !== EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_COMMIT
        || manifest.parentTree !== EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_TREE
        || manifest.purpose !== 'EC_BOT_CORE_BOUNDED_HEALTH_STABILIZATION'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(ancestorOverrides)
        || manifest.policy?.healthAttempts !== 30
        || manifest.policy?.healthDelaySeconds !== 2
        || manifest.policy?.botBusinessLogicChanged !== false
        || manifest.policy?.mutatingSchedulersAllowed !== false
        || manifest.policy?.dropiApplyAllowed !== false
        || manifest.policy?.metaPurchaseAllowed !== false
        || manifest.policy?.realCustomerTrafficAuthorized !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[EC-BOT-CORE-ACTIVATION-HEALTH-V84] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalHash) {
        throw new Error('[EC-BOT-CORE-ACTIVATION-HEALTH-V84] logical_bundle_invalid');
    }
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (sha256File(relativeFile(relativePath)) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-ACTIVATION-HEALTH-V84] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(relativeFile(EC_BOT_CORE_ACTIVATION_HEALTH_V84_MANIFEST_PATH)) });
};

export const assertEcBotCoreActivationHealthV84 = ({ expectedRoot = root } = {}) => {
    if (path.resolve(expectedRoot) !== root) throw new Error('[EC-BOT-CORE-ACTIVATION-HEALTH-V84] release_root_mismatch');
    const identity = assertEcBotCoreActivationHealthManifestV84();
    const result = evaluateEcBotCoreActivationHealthV84({
        v78Manifest: readCanonicalJson('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json', 'v78_manifest'),
        v79Manifest: readCanonicalJson('docs/freeze/ec-bot-core-readiness-v79-20260829.json', 'v79_manifest'),
        v79Evidence: readCanonicalJson('docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json', 'v79_evidence'),
        v79Attestation: readCanonicalJson('docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json', 'v79_attestation')
    });
    if (!result.ok) throw new Error(`[EC-BOT-CORE-ACTIVATION-HEALTH-V84] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const installEcBotCoreActivationHealthContextV84 = ({ mode = 'runtime' } = {}) => {
    if (!['runtime', 'official_guard'].includes(mode)) throw new Error('[EC-BOT-CORE-ACTIVATION-HEALTH-V84] mode_invalid');
    const identity = assertEcBotCoreActivationHealthManifestV84();
    const inherited = normalizePaths(globalThis[EC_BOT_CORE_ACTIVATION_HEALTH_V84_OVERRIDE_KEY] || []);
    const effectiveOverrides = [...new Set([...inherited, ...identity.overrides])];
    globalThis[EC_BOT_CORE_ACTIVATION_HEALTH_V84_OVERRIDE_KEY] = effectiveOverrides;
    const state = Object.freeze({
        version: 84,
        mode,
        canonicalRoot: root,
        manifestSha256: identity.manifestSha256,
        effectiveOverrides: Object.freeze([...effectiveOverrides])
    });
    globalThis[EC_BOT_CORE_ACTIVATION_HEALTH_V84_STATE_KEY] = state;
    return state;
};
