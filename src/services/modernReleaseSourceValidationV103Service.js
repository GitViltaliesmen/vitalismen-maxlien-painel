import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODERN_RELEASE_SOURCE_VALIDATION_V103_VERSION = 103;
export const MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_COMMIT = 'f26085739b75dd786bfd3d290dd2b2929409976e';
export const MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_TREE = '2da1d98460cd407f2ce3e88d5fde897d8abc084f';
export const MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_MANIFEST_SHA256 = 'b5671d5e9b419321c34c2b4350e6c466e2951e435e287ad4b96041c71c718f73';
export const MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_FREEZE_SHA256 = 'ba7af122db00a4f4e18b17cfe44d8d973f1a4ffa43edfda0edaa0a0e938b7072';
export const MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_ATTESTATION_SHA256 = '7c386ced0a1030ff6834b52a11595e0a8ee808a5612c9268d63a9e0c7e2a27ed';
export const MODERN_RELEASE_SOURCE_VALIDATION_V103_MANIFEST_PATH = 'docs/freeze/modern-release-source-validation-v103-20260902.json';
export const MODERN_RELEASE_SOURCE_VALIDATION_V103_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze(['ops/vitalismen-stage']);
const newProtectedFiles = Object.freeze([
    'docs/MODERN_RELEASE_SOURCE_VALIDATION_FREEZE_V103_20260902.md',
    'docs/evidence/modern-release-source-validation-v103-attestation-20260902.json',
    'scripts/guard-modern-release-source-validation-v103.mjs',
    'scripts/lib/modern-release-source-validation-v103-context.mjs',
    'src/services/modernReleaseSourceValidationFreezeRuntimeGuardV103.js',
    'src/services/modernReleaseSourceValidationV103Service.js',
    'tests/modern-release-source-validation-v103.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[MODERN-RELEASE-SOURCE-V103] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[MODERN-RELEASE-SOURCE-V103] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) throw new Error(`[MODERN-RELEASE-SOURCE-V103] ${label}_not_canonical`);
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[MODERN-RELEASE-SOURCE-V103] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV102 = () => {
    const identities = new Map([
        ['docs/freeze/legacy-baseline-attestation-v102-20260902.json', MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_MANIFEST_SHA256],
        ['docs/LEGACY_BASELINE_ATTESTATION_FREEZE_V102_20260902.md', MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_FREEZE_SHA256],
        ['docs/evidence/legacy-baseline-attestation-v102-attestation-20260902.json', MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) throw new Error(`[MODERN-RELEASE-SOURCE-V103] parent_identity_invalid:${relativePath}`);
    }
    const parent = readCanonicalJson('docs/freeze/legacy-baseline-attestation-v102-20260902.json', 'parent_manifest');
    if (parent.version !== 102 || parent.freezeId !== 'legacy-baseline-attestation-v102'
        || parent.policy?.legacyBaselineProofType !== 'LEGACY_BASELINE_VERIFIED'
        || parent.policy?.modernMetadataFabricationAllowed !== false
        || parent.policy?.guardsBypassed !== false || parent.policy?.otherCountryTouched !== false) {
        throw new Error('[MODERN-RELEASE-SOURCE-V103] parent_policy_invalid');
    }
    const parentSuccessorOverrides = new Set(globalThis[MODERN_RELEASE_SOURCE_VALIDATION_V103_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (parentSuccessorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) throw new Error(`[MODERN-RELEASE-SOURCE-V103] parent_protected_file_invalid:${relativePath}`);
    }
};

const evaluateSourceContract = () => {
    const failures = [];
    const helper = readText('ops/vitalismen-stage');
    const start = helper.indexOf('detect_source_process_state()');
    const end = helper.indexOf('\nvalidate_successor_release()', start);
    const block = start >= 0 && end > start ? helper.slice(start, end) : '';
    const modernStart = block.indexOf('if [[ -f "$source_current/.release-source.json"');
    const modernEnd = block.indexOf('return 0', modernStart);
    const modern = modernStart >= 0 && modernEnd > modernStart ? block.slice(modernStart, modernEnd) : '';
    if (!modern.includes('validate_successor_release "$source_current" "$source_release_name"')) failures.push('successor_validation_missing');
    if (!modern.includes('candidate_publication_status') || !modern.includes('production_published')) failures.push('published_status_gate_missing');
    if (/git_cmd[^\n]+source_current[^\n]+rev-parse/.test(modern)) failures.push('direct_git_read_present');
    if (!block.includes('validate_legacy_baseline_attestation_live')) failures.push('legacy_v102_path_missing');
    if (!helper.includes('release-source ausente') || !helper.includes('envelope de publicação parcial')) failures.push('modern_metadata_fail_closed_missing');
    return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
};

export const assertModernReleaseSourceValidationManifestV103 = () => {
    assertParentV102();
    const manifest = readCanonicalJson(MODERN_RELEASE_SOURCE_VALIDATION_V103_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'modern-release-source-validation-v103'
        || manifest.version !== MODERN_RELEASE_SOURCE_VALIDATION_V103_VERSION
        || manifest.parentVersion !== 'V102'
        || manifest.parentCommit !== MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_COMMIT
        || manifest.parentTree !== MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_TREE
        || manifest.parentManifestSha256 !== MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_MANIFEST_SHA256
        || manifest.parentFreezeSha256 !== MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_FREEZE_SHA256
        || manifest.parentAttestationSha256 !== MODERN_RELEASE_SOURCE_VALIDATION_V103_PARENT_ATTESTATION_SHA256
        || manifest.purpose !== 'VALIDATE_ACTIVE_MODERN_RELEASE_WITHOUT_EMBEDDED_GIT_DIRECTORY'
        || manifest.status !== 'implementation_validated_local_successor'
        || manifest.publicationStatus !== 'authorized_for_helper_recovery_only'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(created) !== JSON.stringify(newProtectedFiles)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)
        || manifest.policy?.embeddedGitDirectoryRequired !== false
        || manifest.policy?.releaseAttestationsRequired !== true
        || manifest.policy?.publishedStatusRequired !== true
        || manifest.policy?.legacyV102Preserved !== true
        || manifest.policy?.guardsBypassed !== false
        || manifest.policy?.operationalBehaviorChanged !== false
        || manifest.policy?.outboundChanged !== false
        || manifest.policy?.databaseChanged !== false
        || manifest.policy?.otherCountryTouched !== false
        || manifest.evidence?.path !== 'docs/evidence/modern-release-source-validation-v103-attestation-20260902.json'
        || manifest.evidence?.sha256 !== sha256File(manifest.evidence.path)) {
        throw new Error('[MODERN-RELEASE-SOURCE-V103] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(Object.entries(manifest.protectedFiles || {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, hash]) => `${relativePath}\0${hash}\n`).join('')));
    if (manifest.logicalBundle?.sha256 !== logicalHash) throw new Error('[MODERN-RELEASE-SOURCE-V103] logical_bundle_invalid');
    const successorOverrides = new Set(globalThis[MODERN_RELEASE_SOURCE_VALIDATION_V103_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (successorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) throw new Error(`[MODERN-RELEASE-SOURCE-V103] protected_file_invalid:${relativePath}`);
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(MODERN_RELEASE_SOURCE_VALIDATION_V103_MANIFEST_PATH) });
};

export const assertModernReleaseSourceValidationV103 = () => {
    const identity = assertModernReleaseSourceValidationManifestV103();
    const result = evaluateSourceContract();
    if (!result.ok) throw new Error(`[MODERN-RELEASE-SOURCE-V103] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, ready: true, manifestSha256: identity.manifestSha256 });
};

export const modernReleaseSourceValidationV103Files = Object.freeze({ modifiedAncestorProtectedFiles, newProtectedFiles });
