import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const POST_SALE_PUBLICATION_METADATA_V106_VERSION = 106;
export const POST_SALE_PUBLICATION_METADATA_V106_MANIFEST_PATH = 'docs/freeze/post-sale-publication-metadata-v106-20260903.json';
export const POST_SALE_PUBLICATION_METADATA_V106_PARENT_COMMIT = '275f1e35296bcace64e0c87b5b7bcc22718007d9';
export const POST_SALE_PUBLICATION_METADATA_V106_PARENT_TREE = 'b34d15f26053a2b61547ac9183abca8b8cab1e06';
export const POST_SALE_PUBLICATION_METADATA_V106_PARENT_MANIFEST_SHA256 = 'fd9ef0f796f72b3ab06fdb60e9e1f2413ca5baa237c0233685cb584ee586547a';
export const POST_SALE_PUBLICATION_METADATA_V106_PARENT_FREEZE_SHA256 = '3442f98c151fa4bc59b98f93c3d20d0df58b70f434271be482cef2ae96a8de72';
export const POST_SALE_PUBLICATION_METADATA_V106_PARENT_ATTESTATION_SHA256 = '0d3e3f57066106ae28cad843b0ec374c7a4a50086bb5f9fce87ed1a039e44260';

export const POST_SALE_PUBLICATION_METADATA_V106_ANCESTOR_OVERRIDES = Object.freeze([
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'scripts/lib/post-sale-transactional-control-plane-v105.mjs',
    'src/services/postSaleTransactionalControlPlaneV105Service.js',
    'tests/post-sale-transactional-control-plane-v105.test.mjs'
]);

export const POST_SALE_PUBLICATION_METADATA_V106_NEW_PROTECTED_FILES = Object.freeze([
    'docs/POST_SALE_PUBLICATION_METADATA_FREEZE_V106_20260903.md',
    'docs/evidence/post-sale-publication-metadata-v106-attestation-20260903.json',
    'scripts/guard-post-sale-publication-metadata-v106.mjs',
    'src/services/postSalePublicationMetadataFreezeRuntimeGuardV106.js',
    'src/services/postSalePublicationMetadataV106Service.js',
    'tests/post-sale-publication-metadata-v106.test.mjs'
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[POST-SALE-PUBLICATION-V106] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[POST-SALE-PUBLICATION-V106] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) throw new Error(`[POST-SALE-PUBLICATION-V106] ${label}_not_canonical`);
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[POST-SALE-PUBLICATION-V106] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV105 = () => {
    const identities = new Map([
        ['docs/freeze/post-sale-transactional-control-plane-v105-20260903.json', POST_SALE_PUBLICATION_METADATA_V106_PARENT_MANIFEST_SHA256],
        ['docs/POST_SALE_TRANSACTIONAL_CONTROL_PLANE_FREEZE_V105_20260903.md', POST_SALE_PUBLICATION_METADATA_V106_PARENT_FREEZE_SHA256],
        ['docs/evidence/post-sale-transactional-control-plane-v105-attestation-20260903.json', POST_SALE_PUBLICATION_METADATA_V106_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (fileSha256(relativePath) !== expectedHash) throw new Error(`[POST-SALE-PUBLICATION-V106] parent_identity_invalid:${relativePath}`);
    }
    const parent = canonicalJson('docs/freeze/post-sale-transactional-control-plane-v105-20260903.json', 'parent_manifest');
    if (parent.version !== 105 || parent.freezeId !== 'post-sale-transactional-control-plane-v105'
        || parent.policy?.batchMax !== 1 || parent.policy?.historicalBacklogEnabled !== false
        || parent.policy?.dropiApplyAllowed !== false || parent.policy?.metaRetroactiveAllowed !== false) {
        throw new Error('[POST-SALE-PUBLICATION-V106] parent_policy_invalid');
    }
    const modified = new Set(POST_SALE_PUBLICATION_METADATA_V106_ANCESTOR_OVERRIDES);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[POST-SALE-PUBLICATION-V106] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertPostSalePublicationMetadataV106Manifest = () => {
    assertParentV105();
    const manifest = canonicalJson(POST_SALE_PUBLICATION_METADATA_V106_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'post-sale-publication-metadata-v106'
        || manifest.version !== POST_SALE_PUBLICATION_METADATA_V106_VERSION
        || manifest.parentVersion !== 'V105'
        || manifest.parentCommit !== POST_SALE_PUBLICATION_METADATA_V106_PARENT_COMMIT
        || manifest.parentTree !== POST_SALE_PUBLICATION_METADATA_V106_PARENT_TREE
        || manifest.parentManifestSha256 !== POST_SALE_PUBLICATION_METADATA_V106_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'BIND_POST_SALE_PERMITS_TO_V70_PUBLICATION_ENVELOPE'
        || JSON.stringify(overrides) !== JSON.stringify(POST_SALE_PUBLICATION_METADATA_V106_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(POST_SALE_PUBLICATION_METADATA_V106_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.releaseSourceRemainsStagedCandidate !== true
        || manifest.policy?.publicationEnvelopeRequired !== true
        || manifest.policy?.publicationCompleteRequired !== true
        || manifest.policy?.postSaleProfileChanged !== false
        || manifest.policy?.externalEffectsAllowed !== false) {
        throw new Error('[POST-SALE-PUBLICATION-V106] manifest_identity_or_policy_invalid');
    }
    for (const relativePath of expectedPaths) {
        if (fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[POST-SALE-PUBLICATION-V106] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => `${relativePath}\0${fileSha256(relativePath)}\n`).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) throw new Error('[POST-SALE-PUBLICATION-V106] logical_bundle_invalid');
    return Object.freeze({
        ready: true,
        failures: [],
        manifest,
        overrides,
        manifestSha256: fileSha256(POST_SALE_PUBLICATION_METADATA_V106_MANIFEST_PATH)
    });
};
