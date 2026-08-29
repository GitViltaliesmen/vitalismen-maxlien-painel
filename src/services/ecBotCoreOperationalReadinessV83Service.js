import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    assertEcBotCoreReadinessV79,
    buildEcBotCoreReadinessSnapshotV79
} from './ecBotCoreReadinessV79Service.js';

export const EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_COMMIT = 'b8e208d9c1b2fd3ad616865d5604c0cf81d03c2e';
export const EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_TREE = '850cfb53d9fa553e1ed1391eafc9d2cac8d32555';
export const EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_MANIFEST_SHA256 = '4de1f199fca61a9fa96f65c786df59f23a36db7a55375a3131a7cee7b0871a40';
export const EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_FREEZE_SHA256 = 'e237ba68a65b8c428625804727f3fbb163124114685bf2befc40aa417915bc0a';
export const EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_ATTESTATION_SHA256 = '00c44baa2cb3f851ce72db7e61b9a0195e04a1bbb116dd9fbe16d71b3cf2cbd0';
export const EC_BOT_CORE_OPERATIONAL_READINESS_V83_V78_MANIFEST_SHA256 = '46a9363f203c9e2f4d574e286d2c361b4bd3bb915ee2f0b2398b04af624e12e1';
export const EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_MANIFEST_SHA256 = 'cafcc83ce9594d7e8eb840922e2796818d045124549eede8abdcea67d8b4890e';
export const EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_EVIDENCE_SHA256 = '6bff2507362862bb28363f6d2d4637788f59344242d934ccd34a72a79a9bfb2f';
export const EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_ATTESTATION_SHA256 = 'a1682f2c975f158bb8e8b39d2fdf0660ae3be294b101fc844261d9da235f8439';
export const EC_BOT_CORE_OPERATIONAL_READINESS_V83_MANIFEST_PATH = 'docs/freeze/ec-bot-core-operational-readiness-v83-20260829.json';
export const EC_BOT_CORE_OPERATIONAL_READINESS_V83_STATE_KEY = '__VITALISMEN_V83_EC_BOT_CORE_OPERATIONAL_READINESS_STATE';
export const EC_BOT_CORE_OPERATIONAL_READINESS_V83_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = (file) => sha256Buffer(fs.readFileSync(file));
const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath
        || path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-BOT-CORE-OPERATIONAL-READINESS-V83] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-BOT-CORE-OPERATIONAL-READINESS-V83] protected_path_outside_root');
    }
    return candidate;
};
const readCanonicalJson = (relativePath, label) => {
    const file = relativeFile(relativePath);
    const content = fs.readFileSync(file, 'utf8');
    const value = JSON.parse(content);
    if (content !== canonicalJson(value)) {
        throw new Error(`[EC-BOT-CORE-OPERATIONAL-READINESS-V83] ${label}_not_canonical`);
    }
    return value;
};
const normalizeOverrides = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-BOT-CORE-OPERATIONAL-READINESS-V83] overrides_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

export const evaluateEcBotCoreOperationalReadinessV83 = ({
    v78Manifest = {},
    v79Manifest = {},
    v79Evidence = {},
    v79Attestation = {}
} = {}) => {
    const failures = [];
    const fail = (condition, code) => { if (!condition) failures.push(code); };
    fail(v78Manifest.version === 78 && v78Manifest.status === 'frozen', 'v78_identity_invalid');
    fail(v78Manifest.deployment?.ready === false, 'v78_structural_state_changed');
    fail(JSON.stringify(v78Manifest.deployment?.blockers || []) === JSON.stringify(['OFFICIAL_VSL_ORIGIN_CONTRACT_DIVERGENT']), 'v78_blocker_identity_changed');
    fail(v79Manifest.version === 79 && v79Manifest.parentVersion === 'V78', 'v79_identity_invalid');
    fail(v79Manifest.parentManifestSha256 === EC_BOT_CORE_OPERATIONAL_READINESS_V83_V78_MANIFEST_SHA256, 'v79_parent_invalid');
    fail(v79Manifest.deployment?.ready === true && (v79Manifest.deployment?.blockers || []).length === 0, 'v79_deployment_not_ready');
    fail(v79Manifest.deployment?.requiresExplicitAuthorization === true, 'v79_explicit_authorization_missing');
    fail(v79Attestation.status === 'ATTESTED_READY_FOR_EXPLICITLY_AUTHORIZED_NEXT_STEP', 'v79_attestation_status_invalid');
    fail(v79Attestation.profile?.state === 'READY', 'v79_profile_not_ready');
    fail(v79Attestation.profile?.mutatingSchedulersDefault === 'BLOCKED', 'scheduler_default_not_blocked');
    fail(v79Attestation.profile?.dropiApplyDefault === 'BLOCKED', 'dropi_default_not_blocked');
    fail(v79Attestation.profile?.metaPurchaseDefault === 'BLOCKED', 'meta_default_not_blocked');
    try {
        assertEcBotCoreReadinessV79(buildEcBotCoreReadinessSnapshotV79({
            manifest: v79Manifest,
            evidence: v79Evidence
        }));
    } catch (error) {
        failures.push(`v79_readiness_invalid:${String(error?.message || 'unknown')}`);
    }
    return Object.freeze({
        ok: failures.length === 0,
        failures: Object.freeze(failures),
        ready: failures.length === 0,
        datasetId: v79Manifest.policy?.datasetId || '',
        profile: v79Manifest.policy?.profile || ''
    });
};

export const assertEcBotCoreOperationalReadinessManifestV83 = () => {
    const requiredHashes = new Map([
        ['docs/freeze/runtime-successor-context-v82-20260829.json', EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_MANIFEST_SHA256],
        ['docs/RUNTIME_SUCCESSOR_CONTEXT_FREEZE_V82_20260829.md', EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_FREEZE_SHA256],
        ['docs/evidence/runtime-successor-context-v82-attestation-20260829.json', EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_ATTESTATION_SHA256],
        ['docs/freeze/ec-bot-core-structural-safety-v78-20260829.json', EC_BOT_CORE_OPERATIONAL_READINESS_V83_V78_MANIFEST_SHA256],
        ['docs/freeze/ec-bot-core-readiness-v79-20260829.json', EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_MANIFEST_SHA256],
        ['docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json', EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_EVIDENCE_SHA256],
        ['docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json', EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of requiredHashes) {
        const file = relativeFile(relativePath);
        if (!fs.existsSync(file) || sha256File(file) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-OPERATIONAL-READINESS-V83] required_identity_invalid:${relativePath}`);
        }
    }
    const manifest = readCanonicalJson(EC_BOT_CORE_OPERATIONAL_READINESS_V83_MANIFEST_PATH, 'manifest');
    const overrides = normalizeOverrides(manifest.declaredAncestorOverrides);
    const newProtected = normalizeOverrides(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...newProtected])].sort();
    if (
        manifest.freezeId !== 'ec-bot-core-operational-readiness-v83'
        || manifest.version !== 83
        || manifest.parentVersion !== 'V82'
        || manifest.parentCommit !== EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_COMMIT
        || manifest.parentTree !== EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_TREE
        || manifest.purpose !== 'EC_BOT_CORE_V79_READINESS_BRIDGE'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify([
            'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
            'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
        ])
        || manifest.policy?.profile !== 'EC_BOT_CORE_OPERATIONAL'
        || manifest.policy?.datasetId !== '1468946114265008'
        || manifest.policy?.qaPhone !== '5515998038637'
        || manifest.policy?.v78ByteIntact !== false
        || manifest.policy?.v79ByteIntact !== true
        || manifest.policy?.botBusinessLogicChanged !== false
        || manifest.policy?.mutatingSchedulersAllowed !== false
        || manifest.policy?.dropiApplyAllowed !== false
        || manifest.policy?.metaPurchaseAllowed !== false
        || manifest.policy?.realCustomerTrafficAuthorized !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)
    ) {
        throw new Error('[EC-BOT-CORE-OPERATIONAL-READINESS-V83] manifest_identity_or_policy_invalid');
    }
    const logicalBundleSha256 = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalBundleSha256) {
        throw new Error('[EC-BOT-CORE-OPERATIONAL-READINESS-V83] logical_bundle_invalid');
    }
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        const file = relativeFile(relativePath);
        if (!fs.existsSync(file) || sha256File(file) !== expectedHash) {
            throw new Error(`[EC-BOT-CORE-OPERATIONAL-READINESS-V83] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, manifestSha256: sha256File(relativeFile(EC_BOT_CORE_OPERATIONAL_READINESS_V83_MANIFEST_PATH)), overrides });
};

export const assertEcBotCoreOperationalReadinessV83 = ({ expectedRoot = root } = {}) => {
    if (path.resolve(expectedRoot) !== root) {
        throw new Error('[EC-BOT-CORE-OPERATIONAL-READINESS-V83] release_root_mismatch');
    }
    const identity = assertEcBotCoreOperationalReadinessManifestV83();
    const v78Manifest = readCanonicalJson('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json', 'v78_manifest');
    const v79Manifest = readCanonicalJson('docs/freeze/ec-bot-core-readiness-v79-20260829.json', 'v79_manifest');
    const v79Evidence = readCanonicalJson('docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json', 'v79_evidence');
    const v79Attestation = readCanonicalJson('docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json', 'v79_attestation');
    if (v79Attestation.evidence?.sha256 !== EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_EVIDENCE_SHA256) {
        throw new Error('[EC-BOT-CORE-OPERATIONAL-READINESS-V83] v79_attestation_evidence_invalid');
    }
    const result = evaluateEcBotCoreOperationalReadinessV83({ v78Manifest, v79Manifest, v79Evidence, v79Attestation });
    if (!result.ok) {
        throw new Error(`[EC-BOT-CORE-OPERATIONAL-READINESS-V83] readiness_blocked:${result.failures.join(',')}`);
    }
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const installEcBotCoreOperationalReadinessContextV83 = ({ mode = 'runtime' } = {}) => {
    if (!['runtime', 'official_guard'].includes(mode)) {
        throw new Error('[EC-BOT-CORE-OPERATIONAL-READINESS-V83] mode_invalid');
    }
    const identity = assertEcBotCoreOperationalReadinessManifestV83();
    const inherited = normalizeOverrides(globalThis[EC_BOT_CORE_OPERATIONAL_READINESS_V83_OVERRIDE_KEY] || []);
    const effectiveOverrides = [...new Set([...inherited, ...identity.overrides])];
    globalThis[EC_BOT_CORE_OPERATIONAL_READINESS_V83_OVERRIDE_KEY] = effectiveOverrides;
    const state = Object.freeze({
        version: 83,
        mode,
        canonicalRoot: root,
        manifestSha256: identity.manifestSha256,
        effectiveOverrides: Object.freeze([...effectiveOverrides])
    });
    globalThis[EC_BOT_CORE_OPERATIONAL_READINESS_V83_STATE_KEY] = state;
    return state;
};
