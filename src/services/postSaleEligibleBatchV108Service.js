import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const POST_SALE_ELIGIBLE_BATCH_V108_VERSION = 108;
export const POST_SALE_ELIGIBLE_BATCH_V108_MANIFEST_PATH = 'docs/freeze/post-sale-eligible-batch-v108-20260903.json';
export const POST_SALE_ELIGIBLE_BATCH_V108_PARENT_COMMIT = 'eba93a25089789b7d1be8ad9317c201769d473e3';
export const POST_SALE_ELIGIBLE_BATCH_V108_PARENT_TREE = '032e4fd6b2510b48621878dc8cc50eb852ad6ba3';
export const POST_SALE_ELIGIBLE_BATCH_V108_PARENT_MANIFEST_SHA256 = '8b8adca0c09c40d8defacf2da24fb9a85191c6cff56e08e5a5d735c6f529bc0c';
export const POST_SALE_ELIGIBLE_BATCH_V108_PARENT_FREEZE_SHA256 = '4226514babf3ced5ab2dbdb6f08b5446948bd93d05572503e37489ff8ce7381d';
export const POST_SALE_ELIGIBLE_BATCH_V108_PARENT_ATTESTATION_SHA256 = 'dd15c2ada6623ba1e764891b67e36556521b69ac5cbdf4f6cc692cc51d5084b1';
export const POST_SALE_ELIGIBLE_BATCH_V108_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const POST_SALE_ELIGIBLE_BATCH_V108_ANCESTOR_OVERRIDES = Object.freeze([
    'ops/post-sale-v105',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'scripts/post-sale-transactional-batch-v105.mjs',
    'src/services/postSaleHealthEnvelopeV107Service.js',
    'src/services/shipmentStatusDispatcherService.js',
    'tests/post-sale-health-envelope-v107.test.mjs',
    'tests/post-sale-publication-metadata-v106.test.mjs',
    'tests/post-sale-transactional-control-plane-v105.test.mjs'
]);

export const POST_SALE_ELIGIBLE_BATCH_V108_NEW_PROTECTED_FILES = Object.freeze([
    'docs/POST_SALE_ELIGIBLE_BATCH_FREEZE_V108_20260903.md',
    'docs/evidence/post-sale-eligible-batch-v108-attestation-20260903.json',
    'scripts/guard-post-sale-eligible-batch-v108.mjs',
    'src/services/postSaleEligibleBatchFreezeRuntimeGuardV108.js',
    'src/services/postSaleEligibleBatchV108Service.js',
    'tests/post-sale-eligible-batch-v108.test.mjs'
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) throw new Error('[POST-SALE-BATCH-V108] protected_path_invalid');
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) throw new Error('[POST-SALE-BATCH-V108] protected_path_outside_root');
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) throw new Error(`[POST-SALE-BATCH-V108] ${label}_not_canonical`);
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[POST-SALE-BATCH-V108] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV107 = () => {
    const identities = new Map([
        ['docs/freeze/post-sale-health-envelope-v107-20260903.json', POST_SALE_ELIGIBLE_BATCH_V108_PARENT_MANIFEST_SHA256],
        ['docs/POST_SALE_HEALTH_ENVELOPE_FREEZE_V107_20260903.md', POST_SALE_ELIGIBLE_BATCH_V108_PARENT_FREEZE_SHA256],
        ['docs/evidence/post-sale-health-envelope-v107-attestation-20260903.json', POST_SALE_ELIGIBLE_BATCH_V108_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (fileSha256(relativePath) !== expectedHash) throw new Error(`[POST-SALE-BATCH-V108] parent_identity_invalid:${relativePath}`);
    }
    const parent = canonicalJson('docs/freeze/post-sale-health-envelope-v107-20260903.json', 'parent_manifest');
    if (parent.version !== 107 || parent.freezeId !== 'post-sale-health-envelope-v107'
        || parent.policy?.healthSemanticValidationPreserved !== true
        || parent.policy?.postSaleProfileChanged !== false || parent.policy?.externalEffectsAllowed !== false) {
        throw new Error('[POST-SALE-BATCH-V108] parent_policy_invalid');
    }
    const modified = new Set(POST_SALE_ELIGIBLE_BATCH_V108_ANCESTOR_OVERRIDES);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) throw new Error(`[POST-SALE-BATCH-V108] parent_protected_file_invalid:${relativePath}`);
    }
};

export const assertPostSaleEligibleBatchV108Manifest = () => {
    assertParentV107();
    const manifest = canonicalJson(POST_SALE_ELIGIBLE_BATCH_V108_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'post-sale-eligible-batch-v108'
        || manifest.version !== POST_SALE_ELIGIBLE_BATCH_V108_VERSION
        || manifest.parentVersion !== 'V107'
        || manifest.parentCommit !== POST_SALE_ELIGIBLE_BATCH_V108_PARENT_COMMIT
        || manifest.parentTree !== POST_SALE_ELIGIBLE_BATCH_V108_PARENT_TREE
        || manifest.parentManifestSha256 !== POST_SALE_ELIGIBLE_BATCH_V108_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'SELECT_FIRST_ELIGIBLE_POST_SALE_EVENT_WITH_SINGLE_PROVIDER_ATTEMPT'
        || JSON.stringify(overrides) !== JSON.stringify(POST_SALE_ELIGIBLE_BATCH_V108_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(POST_SALE_ELIGIBLE_BATCH_V108_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.eligibilityPreflightBeforeProvider !== true
        || manifest.policy?.providerAttemptsMaxPerCycle !== 1
        || manifest.policy?.messageSendsMaxPerCycle !== 1
        || manifest.policy?.chronologyGuardRequired !== true
        || manifest.policy?.postSaleProfileChanged !== false
        || manifest.policy?.externalEffectsAllowed !== false) {
        throw new Error('[POST-SALE-BATCH-V108] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[POST_SALE_ELIGIBLE_BATCH_V108_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[POST-SALE-BATCH-V108] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) throw new Error('[POST-SALE-BATCH-V108] logical_bundle_invalid');
    return Object.freeze({ ready: true, failures: [], manifest, overrides, manifestSha256: fileSha256(POST_SALE_ELIGIBLE_BATCH_V108_MANIFEST_PATH) });
};
