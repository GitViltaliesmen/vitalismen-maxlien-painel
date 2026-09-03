import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const POST_SALE_CONTAINMENT_HEALTH_V109_VERSION = 109;
export const POST_SALE_CONTAINMENT_HEALTH_V109_MANIFEST_PATH = 'docs/freeze/post-sale-containment-health-v109-20260903.json';
export const POST_SALE_CONTAINMENT_HEALTH_V109_PARENT_COMMIT = 'e08a1c5de522fd471a2131a8de4ebf648f487bc5';
export const POST_SALE_CONTAINMENT_HEALTH_V109_PARENT_TREE = 'd308dbab260f77461cd19d357217f728000cd717';
export const POST_SALE_CONTAINMENT_HEALTH_V109_PARENT_MANIFEST_SHA256 = 'c88f6a5dd253028fa2c80c69d02b666a90aaadcfe77e61a915606c4d70e6815a';
export const POST_SALE_CONTAINMENT_HEALTH_V109_PARENT_FREEZE_SHA256 = '8127eae24e5a8e285d0d57fc7949cb0dca374f6e3218da6a36868345642715a6';
export const POST_SALE_CONTAINMENT_HEALTH_V109_PARENT_ATTESTATION_SHA256 = 'd48c060d82a7f93b5492d3ed3d655aa9b75a9dc74567d92e6227b96d87a40e8a';
export const POST_SALE_CONTAINMENT_HEALTH_V109_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
const BOT_QA_RECOVERY_V110_OVERRIDE_KEY = '__VITALISMEN_BOT_QA_RECOVERY_V110_OVERRIDE_FILES';

export const POST_SALE_CONTAINMENT_HEALTH_V109_ANCESTOR_OVERRIDES = Object.freeze([
    'ops/post-sale-v105',
    'scripts/lib/ec-runtime-successor-v97-context.mjs'
]);

export const POST_SALE_CONTAINMENT_HEALTH_V109_NEW_PROTECTED_FILES = Object.freeze([
    'docs/POST_SALE_CONTAINMENT_HEALTH_FREEZE_V109_20260903.md',
    'docs/evidence/post-sale-containment-health-v109-attestation-20260903.json',
    'scripts/guard-post-sale-containment-health-v109.mjs',
    'src/services/postSaleContainmentHealthFreezeRuntimeGuardV109.js',
    'src/services/postSaleContainmentHealthV109Service.js',
    'tests/post-sale-containment-health-v109.test.mjs'
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) throw new Error('[POST-SALE-CONTAINMENT-V109] protected_path_invalid');
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) throw new Error('[POST-SALE-CONTAINMENT-V109] protected_path_outside_root');
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) throw new Error(`[POST-SALE-CONTAINMENT-V109] ${label}_not_canonical`);
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[POST-SALE-CONTAINMENT-V109] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV108 = () => {
    const identities = new Map([
        ['docs/freeze/post-sale-eligible-batch-v108-20260903.json', POST_SALE_CONTAINMENT_HEALTH_V109_PARENT_MANIFEST_SHA256],
        ['docs/POST_SALE_ELIGIBLE_BATCH_FREEZE_V108_20260903.md', POST_SALE_CONTAINMENT_HEALTH_V109_PARENT_FREEZE_SHA256],
        ['docs/evidence/post-sale-eligible-batch-v108-attestation-20260903.json', POST_SALE_CONTAINMENT_HEALTH_V109_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (fileSha256(relativePath) !== expectedHash) throw new Error(`[POST-SALE-CONTAINMENT-V109] parent_identity_invalid:${relativePath}`);
    }
    const parent = canonicalJson('docs/freeze/post-sale-eligible-batch-v108-20260903.json', 'parent_manifest');
    if (parent.version !== 108 || parent.freezeId !== 'post-sale-eligible-batch-v108'
        || parent.policy?.providerAttemptsMaxPerCycle !== 1
        || parent.policy?.messageSendsMaxPerCycle !== 1 || parent.policy?.externalEffectsAllowed !== false) {
        throw new Error('[POST-SALE-CONTAINMENT-V109] parent_policy_invalid');
    }
    const modified = new Set([
        ...POST_SALE_CONTAINMENT_HEALTH_V109_ANCESTOR_OVERRIDES,
        ...(globalThis[BOT_QA_RECOVERY_V110_OVERRIDE_KEY] || [])
    ]);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) throw new Error(`[POST-SALE-CONTAINMENT-V109] parent_protected_file_invalid:${relativePath}`);
    }
};

export const assertPostSaleContainmentHealthV109Manifest = () => {
    assertParentV108();
    const manifest = canonicalJson(POST_SALE_CONTAINMENT_HEALTH_V109_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'post-sale-containment-health-v109'
        || manifest.version !== POST_SALE_CONTAINMENT_HEALTH_V109_VERSION
        || manifest.parentVersion !== 'V108'
        || manifest.parentCommit !== POST_SALE_CONTAINMENT_HEALTH_V109_PARENT_COMMIT
        || manifest.parentTree !== POST_SALE_CONTAINMENT_HEALTH_V109_PARENT_TREE
        || manifest.parentManifestSha256 !== POST_SALE_CONTAINMENT_HEALTH_V109_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'WAIT_FOR_VERIFIED_BOT_CORE_BEFORE_ARCHIVING_POST_SALE_AUTHORIZATION'
        || JSON.stringify(overrides) !== JSON.stringify(POST_SALE_CONTAINMENT_HEALTH_V109_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(POST_SALE_CONTAINMENT_HEALTH_V109_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.healthRetries !== 30 || manifest.policy?.retryDelaySeconds !== 2
        || manifest.policy?.archiveOnlyAfterV78Status !== true
        || manifest.policy?.batchOnceMarkerPreserved !== true
        || manifest.policy?.postSaleProfileChanged !== false
        || manifest.policy?.externalEffectsAllowed !== false) {
        throw new Error('[POST-SALE-CONTAINMENT-V109] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[POST_SALE_CONTAINMENT_HEALTH_V109_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[POST-SALE-CONTAINMENT-V109] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) throw new Error('[POST-SALE-CONTAINMENT-V109] logical_bundle_invalid');
    return Object.freeze({ ready: true, failures: [], manifest, overrides, manifestSha256: fileSha256(POST_SALE_CONTAINMENT_HEALTH_V109_MANIFEST_PATH) });
};
