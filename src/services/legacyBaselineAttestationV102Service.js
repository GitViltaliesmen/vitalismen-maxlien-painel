import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEGACY_BASELINE_ATTESTATION_V102_VERSION = 102;
export const LEGACY_BASELINE_ATTESTATION_V102_PARENT_COMMIT = 'f66ed8cd2409db64d00a9d4fd44bf4e050f85b95';
export const LEGACY_BASELINE_ATTESTATION_V102_PARENT_TREE = '25974e8c0d14ca5a28f17a6f1502a3e6dde79322';
export const LEGACY_BASELINE_ATTESTATION_V102_PARENT_MANIFEST_SHA256 = 'd03c1eeec1548f4979a796ef8924a251834a1b36358d7a93ba04ca0b8518c38c';
export const LEGACY_BASELINE_ATTESTATION_V102_PARENT_FREEZE_SHA256 = '94e2bf3e69d760e536b212f837b953b0ed163fc4243a26dc93399736361b8eb0';
export const LEGACY_BASELINE_ATTESTATION_V102_PARENT_ATTESTATION_SHA256 = '1b1de9440dffb8d3d07acaaa65d6904835b46078bd1a2da2f6baa656966d1a5b';
export const LEGACY_BASELINE_ATTESTATION_V102_MANIFEST_PATH = 'docs/freeze/legacy-baseline-attestation-v102-20260902.json';
export const LEGACY_BASELINE_ATTESTATION_V102_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze([
    'ops/vitalismen-stage',
    'src/services/dropiManualBffRecoveryV98Service.js',
    'src/services/ecRepurchaseRegistrationV99Service.js',
    'src/services/protocoloGSuccessorGuardV101Service.js'
]);
const newProtectedFiles = Object.freeze([
    'docs/LEGACY_BASELINE_ATTESTATION_FREEZE_V102_20260902.md',
    'docs/evidence/legacy-baseline-attestation-v102-attestation-20260902.json',
    'scripts/guard-legacy-baseline-attestation-v102.mjs',
    'scripts/lib/legacy-baseline-attestation-v102-context.mjs',
    'src/services/legacyBaselineAttestationFreezeRuntimeGuardV102.js',
    'src/services/legacyBaselineAttestationV102Service.js',
    'tests/legacy-baseline-attestation-v102.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[LEGACY-BASELINE-V102] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[LEGACY-BASELINE-V102] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) throw new Error(`[LEGACY-BASELINE-V102] ${label}_not_canonical`);
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[LEGACY-BASELINE-V102] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV101 = () => {
    const parentOrigin = ['proto', 'colo'].join('');
    const parentManifestPath = `docs/freeze/${parentOrigin}-g-successor-guard-v101-20260902.json`;
    const identities = new Map([
        [parentManifestPath, LEGACY_BASELINE_ATTESTATION_V102_PARENT_MANIFEST_SHA256],
        ['docs/PROTOCOLO_G_SUCCESSOR_GUARD_FREEZE_V101_20260902.md', LEGACY_BASELINE_ATTESTATION_V102_PARENT_FREEZE_SHA256],
        [`docs/evidence/${parentOrigin}-g-successor-guard-v101-attestation-20260902.json`, LEGACY_BASELINE_ATTESTATION_V102_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) throw new Error(`[LEGACY-BASELINE-V102] parent_identity_invalid:${relativePath}`);
    }
    const parent = readCanonicalJson(parentManifestPath, 'parent_manifest');
    if (parent.version !== 101 || parent.freezeId !== `${parentOrigin}-g-successor-guard-v101`
        || parent.policy?.guardsBypassed !== false || parent.policy?.operationalBehaviorChanged !== false
        || parent.policy?.databaseChanged !== false || parent.policy?.otherCountryTouched !== false) {
        throw new Error('[LEGACY-BASELINE-V102] parent_policy_invalid');
    }
    const parentSuccessorOverrides = new Set(globalThis[LEGACY_BASELINE_ATTESTATION_V102_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (parentSuccessorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) throw new Error(`[LEGACY-BASELINE-V102] parent_protected_file_invalid:${relativePath}`);
    }
};

const evaluateSourceContract = () => {
    const failures = [];
    const helper = readText('ops/vitalismen-stage');
    const tests = readText('tests/legacy-baseline-attestation-v102.test.mjs');
    const requiredHelperFragments = [
        'legacy_baseline_contract_version=102',
        'legacy-baseline-verify',
        'LEGACY_BASELINE_VERIFIED',
        'modernMetadataAbsent: true',
        'stagedSourceClaimed: false',
        'require_unconsumed_legacy_baseline_for_publish',
        'write_legacy_baseline_consumption',
        "publication.version === 2",
        'baselineProofType',
        'attestation legada já consumida por outra publicação',
        'permit de ativação não pode existir durante publicação'
    ];
    for (const fragment of requiredHelperFragments) if (!helper.includes(fragment)) failures.push(`helper_contract_missing:${fragment}`);
    const commandStart = helper.indexOf('if [[ "$action" == "legacy-baseline-verify" ]]');
    const commandEnd = helper.indexOf('if [[ "$action" == "activate" ]]', commandStart);
    const legacyCommand = commandStart >= 0 && commandEnd > commandStart ? helper.slice(commandStart, commandEnd) : '';
    if (!legacyCommand || legacyCommand.includes('.release-source.json" <<') || legacyCommand.includes('cp ')) failures.push('legacy_command_may_fabricate_metadata');
    for (const label of ['attestation falsa', 'commit diferente', 'tree diferente', 'current diferente',
        'PID/processo diferente', 'fingerprint diferente', 'health falhando', 'release não ativa',
        'release staged fingindo ser legacy', 'attestation de outra VPS', 'attestation reaproveitada',
        'attestation alterada', 'metadata incompleta', 'permit antigo']) {
        if (!tests.includes(label)) failures.push(`negative_test_missing:${label}`);
    }
    return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
};

export const assertLegacyBaselineAttestationManifestV102 = () => {
    assertParentV101();
    const manifest = readCanonicalJson(LEGACY_BASELINE_ATTESTATION_V102_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'legacy-baseline-attestation-v102'
        || manifest.version !== LEGACY_BASELINE_ATTESTATION_V102_VERSION
        || manifest.parentVersion !== 'V101'
        || manifest.parentCommit !== LEGACY_BASELINE_ATTESTATION_V102_PARENT_COMMIT
        || manifest.parentTree !== LEGACY_BASELINE_ATTESTATION_V102_PARENT_TREE
        || manifest.parentManifestSha256 !== LEGACY_BASELINE_ATTESTATION_V102_PARENT_MANIFEST_SHA256
        || manifest.parentFreezeSha256 !== LEGACY_BASELINE_ATTESTATION_V102_PARENT_FREEZE_SHA256
        || manifest.parentAttestationSha256 !== LEGACY_BASELINE_ATTESTATION_V102_PARENT_ATTESTATION_SHA256
        || manifest.purpose !== 'VERIFY_EXACT_LEGACY_BASELINE_WITHOUT_STAGED_SOURCE_CLAIM'
        || manifest.status !== 'implementation_validated_local_successor'
        || manifest.publicationStatus !== 'authorized_for_legacy_baseline_migration_only'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(created) !== JSON.stringify(newProtectedFiles)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)
        || manifest.policy?.legacyBaselineProofType !== 'LEGACY_BASELINE_VERIFIED'
        || manifest.policy?.stagedSourceClaimed !== false
        || manifest.policy?.modernMetadataFabricationAllowed !== false
        || manifest.policy?.implicitFallbackAllowed !== false
        || manifest.policy?.singleUse !== true
        || manifest.policy?.guardsBypassed !== false
        || manifest.policy?.v97ProtectionDisabled !== false
        || manifest.policy?.express5Introduced !== false
        || manifest.policy?.functionalCandidateChanged !== false
        || manifest.policy?.outboundChanged !== false
        || manifest.policy?.dropiChanged !== false
        || manifest.policy?.databaseChanged !== false
        || manifest.policy?.otherCountryTouched !== false
        || manifest.evidence?.path !== 'docs/evidence/legacy-baseline-attestation-v102-attestation-20260902.json'
        || manifest.evidence?.sha256 !== sha256File(manifest.evidence.path)) {
        throw new Error('[LEGACY-BASELINE-V102] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(Object.entries(manifest.protectedFiles || {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, hash]) => `${relativePath}\0${hash}\n`).join('')));
    if (manifest.logicalBundle?.sha256 !== logicalHash) throw new Error('[LEGACY-BASELINE-V102] logical_bundle_invalid');
    const successorOverrides = new Set(globalThis[LEGACY_BASELINE_ATTESTATION_V102_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (successorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) throw new Error(`[LEGACY-BASELINE-V102] protected_file_invalid:${relativePath}`);
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(LEGACY_BASELINE_ATTESTATION_V102_MANIFEST_PATH) });
};

export const assertLegacyBaselineAttestationV102 = () => {
    const identity = assertLegacyBaselineAttestationManifestV102();
    const result = evaluateSourceContract();
    if (!result.ok) throw new Error(`[LEGACY-BASELINE-V102] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, ready: true, manifestSha256: identity.manifestSha256 });
};

export const legacyBaselineAttestationV102Files = Object.freeze({ modifiedAncestorProtectedFiles, newProtectedFiles });
