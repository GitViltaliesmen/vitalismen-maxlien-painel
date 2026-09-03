import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const POST_SALE_HEALTH_ENVELOPE_V107_VERSION = 107;
export const POST_SALE_HEALTH_ENVELOPE_V107_MANIFEST_PATH = 'docs/freeze/post-sale-health-envelope-v107-20260903.json';
export const POST_SALE_HEALTH_ENVELOPE_V107_PARENT_COMMIT = 'f0457d2bee280b44fc6c13a42078f3100a202a75';
export const POST_SALE_HEALTH_ENVELOPE_V107_PARENT_TREE = 'ddb0a132c83c6450b308d126037379a02459bf01';
export const POST_SALE_HEALTH_ENVELOPE_V107_PARENT_MANIFEST_SHA256 = 'c8de0795227662ba1f28072815bc35a72ada6d5ec2bd41264bd4be15897ba0ad';
export const POST_SALE_HEALTH_ENVELOPE_V107_PARENT_FREEZE_SHA256 = 'fbd0c97923cf56ef6ac052fe4b230cfc3ec52c318540e25ba0de1508ba430c5b';
export const POST_SALE_HEALTH_ENVELOPE_V107_PARENT_ATTESTATION_SHA256 = '10ae9a9d867ef53eaf7cc7c085c62f82f080b54c6fbef4239aebabc4c3561bb6';
export const POST_SALE_HEALTH_ENVELOPE_V107_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const POST_SALE_HEALTH_ENVELOPE_V107_ANCESTOR_OVERRIDES = Object.freeze([
    'ops/post-sale-v105',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'scripts/lib/post-sale-transactional-control-plane-v105.mjs',
    'src/services/postSalePublicationMetadataV106Service.js',
    'tests/post-sale-publication-metadata-v106.test.mjs',
    'tests/post-sale-transactional-control-plane-v105.test.mjs'
]);

export const POST_SALE_HEALTH_ENVELOPE_V107_NEW_PROTECTED_FILES = Object.freeze([
    'docs/POST_SALE_HEALTH_ENVELOPE_FREEZE_V107_20260903.md',
    'docs/evidence/post-sale-health-envelope-v107-attestation-20260903.json',
    'scripts/guard-post-sale-health-envelope-v107.mjs',
    'src/services/postSaleHealthEnvelopeFreezeRuntimeGuardV107.js',
    'src/services/postSaleHealthEnvelopeV107Service.js',
    'tests/post-sale-health-envelope-v107.test.mjs'
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[POST-SALE-HEALTH-V107] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[POST-SALE-HEALTH-V107] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) throw new Error(`[POST-SALE-HEALTH-V107] ${label}_not_canonical`);
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[POST-SALE-HEALTH-V107] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV106 = () => {
    const identities = new Map([
        ['docs/freeze/post-sale-publication-metadata-v106-20260903.json', POST_SALE_HEALTH_ENVELOPE_V107_PARENT_MANIFEST_SHA256],
        ['docs/POST_SALE_PUBLICATION_METADATA_FREEZE_V106_20260903.md', POST_SALE_HEALTH_ENVELOPE_V107_PARENT_FREEZE_SHA256],
        ['docs/evidence/post-sale-publication-metadata-v106-attestation-20260903.json', POST_SALE_HEALTH_ENVELOPE_V107_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (fileSha256(relativePath) !== expectedHash) throw new Error(`[POST-SALE-HEALTH-V107] parent_identity_invalid:${relativePath}`);
    }
    const parent = canonicalJson('docs/freeze/post-sale-publication-metadata-v106-20260903.json', 'parent_manifest');
    if (parent.version !== 106 || parent.freezeId !== 'post-sale-publication-metadata-v106'
        || parent.policy?.publicationEnvelopeRequired !== true || parent.policy?.postSaleProfileChanged !== false
        || parent.policy?.externalEffectsAllowed !== false) {
        throw new Error('[POST-SALE-HEALTH-V107] parent_policy_invalid');
    }
    const modified = new Set([
        ...POST_SALE_HEALTH_ENVELOPE_V107_ANCESTOR_OVERRIDES,
        ...(globalThis[POST_SALE_HEALTH_ENVELOPE_V107_OVERRIDE_KEY] || [])
    ]);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[POST-SALE-HEALTH-V107] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertPostSaleHealthEnvelopeV107Manifest = () => {
    assertParentV106();
    const manifest = canonicalJson(POST_SALE_HEALTH_ENVELOPE_V107_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'post-sale-health-envelope-v107'
        || manifest.version !== POST_SALE_HEALTH_ENVELOPE_V107_VERSION
        || manifest.parentVersion !== 'V106'
        || manifest.parentCommit !== POST_SALE_HEALTH_ENVELOPE_V107_PARENT_COMMIT
        || manifest.parentTree !== POST_SALE_HEALTH_ENVELOPE_V107_PARENT_TREE
        || manifest.parentManifestSha256 !== POST_SALE_HEALTH_ENVELOPE_V107_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'ACCEPT_VALID_JSON_HEALTH_AND_ABORT_FAILED_POST_SALE_AUTHORIZATION'
        || JSON.stringify(overrides) !== JSON.stringify(POST_SALE_HEALTH_ENVELOPE_V107_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(POST_SALE_HEALTH_ENVELOPE_V107_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.healthAcceptsValidJsonRegardlessFormatting !== true
        || manifest.policy?.healthSemanticValidationPreserved !== true
        || manifest.policy?.failedAuthorizationAbortRequiresBotCoreSafe !== true
        || manifest.policy?.postSaleProfileChanged !== false
        || manifest.policy?.externalEffectsAllowed !== false) {
        throw new Error('[POST-SALE-HEALTH-V107] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[POST_SALE_HEALTH_ENVELOPE_V107_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[POST-SALE-HEALTH-V107] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) throw new Error('[POST-SALE-HEALTH-V107] logical_bundle_invalid');
    return Object.freeze({ ready: true, failures: [], manifest, overrides, manifestSha256: fileSha256(POST_SALE_HEALTH_ENVELOPE_V107_MANIFEST_PATH) });
};
