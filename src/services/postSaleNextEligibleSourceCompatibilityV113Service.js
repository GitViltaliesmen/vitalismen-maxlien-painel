import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertPostSaleNextEligibleMonitorV112Manifest } from './postSaleNextEligibleMonitorV112Service.js';

export const POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_VERSION = 113;
export const POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_MANIFEST_PATH = 'docs/freeze/post-sale-next-eligible-source-compatibility-v113-20260903.json';
export const POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_PARENT_COMMIT = '86e4b14052b5e41360dab84be25c09df450733c8';
export const POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_PARENT_TREE = '1c6639ced97dfce384c765a0d80432da84822367';
export const POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_PARENT_MANIFEST_SHA256 = 'f69dee9a7bd4f4849d0dd93c6f8cc5a367582ab8686f4e2260e56d462eab32f3';
export const POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_FREEZE_SHA256 = 'bfba6baa60a2b1309903e4805db1ad4eb2e510e09337388fd2383c7ac7da2bc0';
export const POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_ATTESTATION_SHA256 = '1e660b0bda3871dca0ff5d7a7e64f68809a8191469280fd185bb2a5815a51521';

export const POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_NEW_PROTECTED_FILES = Object.freeze([
    'docs/POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPATIBILITY_FREEZE_V113_20260903.md',
    'docs/evidence/post-sale-next-eligible-source-compatibility-v113-attestation-20260903.json',
    'ops/post-sale-next-eligible-v113',
    'ops/systemd/vitalismen-postsale-next-eligible-v113.service',
    'ops/systemd/vitalismen-postsale-next-eligible-v113.timer',
    'scripts/guard-post-sale-next-eligible-source-compat-v113.mjs',
    'scripts/lib/post-sale-next-eligible-source-compat-v113.mjs',
    'src/services/postSaleNextEligibleSourceCompatibilityFreezeRuntimeGuardV113.js',
    'src/services/postSaleNextEligibleSourceCompatibilityV113Service.js',
    'tests/post-sale-next-eligible-source-compat-v113.test.mjs'
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[POST-SALE-SOURCE-COMPAT-V113] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[POST-SALE-SOURCE-COMPAT-V113] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[POST-SALE-SOURCE-COMPAT-V113] ${label}_not_canonical`);
    }
    return value;
};

export const normalizeModernReleaseSourceV113 = (source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return source;
    if (Object.hasOwn(source, 'tree')) return source;
    if (!/^[0-9a-f]{40}$/.test(String(source.functionalTree || ''))) return source;
    return Object.freeze({ ...source, tree: source.functionalTree });
};

export const assertPostSaleNextEligibleSourceCompatibilityV113Manifest = () => {
    assertPostSaleNextEligibleMonitorV112Manifest();
    if (fileSha256('docs/freeze/post-sale-next-eligible-monitor-v112-20260903.json')
        !== POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_PARENT_MANIFEST_SHA256) {
        throw new Error('[POST-SALE-SOURCE-COMPAT-V113] parent_manifest_invalid');
    }
    const manifest = canonicalJson(POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_MANIFEST_PATH, 'manifest');
    const expectedPaths = [...POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_NEW_PROTECTED_FILES].sort();
    if (manifest.freezeId !== 'post-sale-next-eligible-source-compatibility-v113'
        || manifest.version !== POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_VERSION
        || manifest.parentVersion !== 'V112'
        || manifest.parentCommit !== POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_PARENT_COMMIT
        || manifest.parentTree !== POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_PARENT_TREE
        || manifest.parentManifestSha256 !== POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'READ_ONLY_ALIAS_FUNCTIONAL_TREE_FOR_FROZEN_V112_SOURCE_IDENTITY'
        || JSON.stringify(manifest.declaredAncestorOverrides) !== JSON.stringify([])
        || JSON.stringify(manifest.modifiedAncestorProtectedFiles) !== JSON.stringify([])
        || JSON.stringify(manifest.newProtectedFiles) !== JSON.stringify(POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.metadataWrites !== 0
        || manifest.policy?.providerCallsAdded !== 0
        || manifest.policy?.mongoMutationsAdded !== 0
        || manifest.policy?.treeAliasSource !== 'functionalTree'
        || manifest.policy?.treeAliasOnlyWhenMissing !== true
        || manifest.policy?.frozenV112Delegation !== true
        || manifest.policy?.batchMax !== 1
        || manifest.policy?.dailyLimit !== 1
        || manifest.policy?.promoteBeyondOne !== false
        || manifest.evidence?.sha256 !== POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPATIBILITY_FREEZE_V113_20260903.md')
            !== POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_FREEZE_SHA256) {
        throw new Error('[POST-SALE-SOURCE-COMPAT-V113] manifest_identity_or_policy_invalid');
    }
    for (const relativePath of expectedPaths) {
        if (fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[POST-SALE-SOURCE-COMPAT-V113] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => `${relativePath}\0${fileSha256(relativePath)}\n`).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[POST-SALE-SOURCE-COMPAT-V113] logical_bundle_invalid');
    }
    return Object.freeze({ ready: true, manifest, manifestSha256: fileSha256(POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113_MANIFEST_PATH) });
};
