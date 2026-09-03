import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const POST_SALE_TRANSACTIONAL_SAFETY_V116_MANIFEST_VERSION = 116;
export const POST_SALE_TRANSACTIONAL_SAFETY_V116_MANIFEST_PATH = 'docs/freeze/post-sale-transactional-safety-v116-20260903.json';
export const POST_SALE_TRANSACTIONAL_SAFETY_V116_PARENT_COMMIT = '78f38e00a973cad0a461a75f846a35328cf2a7a1';
export const POST_SALE_TRANSACTIONAL_SAFETY_V116_PARENT_TREE = '983a82471f0c63af0057e23ed7ab34d5d9883e84';
export const POST_SALE_TRANSACTIONAL_SAFETY_V116_PARENT_MANIFEST_SHA256 = 'ddca5545508a7b782d9e0709f272725175dc899ebc06b7a1591d51e02f6d9ff9';
export const POST_SALE_TRANSACTIONAL_SAFETY_V116_FREEZE_SHA256 = 'c1feaa600133878b4b7f61b2cce3e4378cf24c6db4df5a07b64e1dfa5662224d';
export const POST_SALE_TRANSACTIONAL_SAFETY_V116_ATTESTATION_SHA256 = 'a7f5d6a86a891f8cf504f0bcd166444a4d7e586f43e28dc7440cdeea9f80cac5';
export const POST_SALE_TRANSACTIONAL_SAFETY_V116_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const POST_SALE_TRANSACTIONAL_SAFETY_V116_ANCESTOR_OVERRIDES = Object.freeze([
    'ops/ec-bot-core-v78',
    'scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs',
    'scripts/guard-protocolo-g-ad-metrics-v63.mjs',
    'scripts/guard-protocolo-g-conversion-v62.mjs',
    'scripts/senior-guard.mjs',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'scripts/lib/post-sale-next-eligible-source-compat-v113.mjs',
    'src/models/OutboundDedupe.js',
    'src/services/ecPanelRuntimeRecoveryV115Service.js',
    'src/services/outboundDedupeService.js',
    'src/services/postSaleNotificationDecisionService.js',
    'src/services/postSaleNextEligibleMonitorV112Service.js',
    'src/services/postSaleNextEligibleSourceCompatibilityV113Service.js',
    'src/services/postSaleSafetyV66Service.js',
    'src/services/shipmentMessageService.js',
    'src/services/shipmentStatusDispatcherService.js',
    'src/whatsapp/sendAudio.js',
    'src/whatsapp/sendDocument.js',
    'src/whatsapp/sendImage.js',
    'src/whatsapp/sendText.js',
    'tests/post-sale-next-eligible-source-compat-v113.test.mjs',
    'tests/post-sale-publication-metadata-v106.test.mjs',
    'tests/post-sale-transactional-control-plane-v105.test.mjs'
]);

export const POST_SALE_TRANSACTIONAL_SAFETY_V116_NEW_PROTECTED_FILES = Object.freeze([
    'docs/POST_SALE_TRANSACTIONAL_SAFETY_FREEZE_V116_20260903.md',
    'docs/evidence/post-sale-transactional-safety-v116-attestation-20260903.json',
    'ops/post-sale-v116',
    'ops/systemd/vitalismen-postsale-transactional-v116.service',
    'ops/systemd/vitalismen-postsale-transactional-v116.timer',
    'scripts/create-post-sale-v116-overlay.mjs',
    'scripts/guard-post-sale-transactional-safety-v116.mjs',
    'scripts/post-sale-transactional-batch-v116.mjs',
    'src/models/PostSaleDispatchQuota.js',
    'src/services/postSaleTransactionalSafetyFreezeRuntimeGuardV116.js',
    'src/services/postSaleTransactionalSafetyV116ManifestService.js',
    'src/services/postSaleTransactionalSafetyV116Service.js',
    'tests/post-sale-transactional-safety-v116.test.mjs'
]);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[POST-SALE-TRANSACTIONAL-V116] protected_path_invalid');
    }
    const candidate = path.resolve(projectRoot, relativePath);
    if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
        throw new Error('[POST-SALE-TRANSACTIONAL-V116] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[POST-SALE-TRANSACTIONAL-V116] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[POST-SALE-TRANSACTIONAL-V116] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV115 = () => {
    if (fileSha256('docs/freeze/ec-panel-runtime-recovery-v115-20260903.json')
        !== POST_SALE_TRANSACTIONAL_SAFETY_V116_PARENT_MANIFEST_SHA256) {
        throw new Error('[POST-SALE-TRANSACTIONAL-V116] parent_manifest_identity_invalid');
    }
    const parent = canonicalJson('docs/freeze/ec-panel-runtime-recovery-v115-20260903.json', 'parent_manifest');
    if (parent.version !== 115 || parent.freezeId !== 'ec-panel-runtime-recovery-v115'
        || parent.policy?.panelAuthRequired !== true
        || parent.policy?.providerIdRequired !== true
        || parent.policy?.postSaleChanged !== false) {
        throw new Error('[POST-SALE-TRANSACTIONAL-V116] parent_policy_invalid');
    }
    const modified = new Set(POST_SALE_TRANSACTIONAL_SAFETY_V116_ANCESTOR_OVERRIDES);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[POST-SALE-TRANSACTIONAL-V116] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertPostSaleTransactionalSafetyV116Manifest = () => {
    assertParentV115();
    const manifest = canonicalJson(POST_SALE_TRANSACTIONAL_SAFETY_V116_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'post-sale-transactional-safety-v116'
        || manifest.version !== POST_SALE_TRANSACTIONAL_SAFETY_V116_MANIFEST_VERSION
        || manifest.parentVersion !== 'V115_WITH_V114_OBSERVER'
        || manifest.parentCommit !== POST_SALE_TRANSACTIONAL_SAFETY_V116_PARENT_COMMIT
        || manifest.parentTree !== POST_SALE_TRANSACTIONAL_SAFETY_V116_PARENT_TREE
        || manifest.parentManifestSha256 !== POST_SALE_TRANSACTIONAL_SAFETY_V116_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'AT_MOST_ONCE_POST_SALE_WITH_ATOMIC_QUOTA_AND_ISOLATED_EXECUTOR'
        || JSON.stringify(overrides) !== JSON.stringify(POST_SALE_TRANSACTIONAL_SAFETY_V116_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(POST_SALE_TRANSACTIONAL_SAFETY_V116_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.observerStrictReadOnly !== true
        || manifest.policy?.executorSeparatedFromPm2Bot !== true
        || manifest.policy?.persistentAtomicDailyQuota !== true
        || manifest.policy?.batchMax !== 1
        || manifest.policy?.dailyLimit !== 1
        || manifest.policy?.ambiguousFailureTerminal !== true
        || manifest.policy?.automaticRetryAllowed !== false
        || manifest.policy?.providerIdRequiredForSent !== true
        || manifest.policy?.historicalBacklogEnabled !== false
        || manifest.policy?.marketingBlastEnabled !== false
        || manifest.policy?.metaRetroactiveAllowed !== false
        || manifest.evidence?.sha256 !== POST_SALE_TRANSACTIONAL_SAFETY_V116_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/POST_SALE_TRANSACTIONAL_SAFETY_FREEZE_V116_20260903.md') !== POST_SALE_TRANSACTIONAL_SAFETY_V116_FREEZE_SHA256) {
        throw new Error('[POST-SALE-TRANSACTIONAL-V116] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[POST_SALE_TRANSACTIONAL_SAFETY_V116_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[POST-SALE-TRANSACTIONAL-V116] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[POST-SALE-TRANSACTIONAL-V116] logical_bundle_invalid');
    }
    return Object.freeze({ ready: true, failures: [], manifest, overrides, manifestSha256: fileSha256(POST_SALE_TRANSACTIONAL_SAFETY_V116_MANIFEST_PATH) });
};
