import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PANEL_WARMUP_ISOLATION_V118_VERSION = 118;
export const PANEL_WARMUP_ISOLATION_V118_MANIFEST_PATH = 'docs/freeze/panel-warmup-isolation-v118-20260903.json';
export const PANEL_WARMUP_ISOLATION_V118_PARENT_COMMIT = '33fc61a1ea8e1a4289584c6cc41151bb10ad3ab6';
export const PANEL_WARMUP_ISOLATION_V118_PARENT_TREE = 'e244cf5996561b8015592c7f916dd037bcdec8c0';
export const PANEL_WARMUP_ISOLATION_V118_PARENT_MANIFEST_SHA256 = 'fd6e87bd56727ac8e55ca8961c3fb98a1c863c16b400a46c7cdeb9c0abda2b0c';
export const PANEL_WARMUP_ISOLATION_V118_FREEZE_SHA256 = 'b5909dc2d2f474eb1e1bb11ab08daf474e2846759482a1473b34061142ed083a';
export const PANEL_WARMUP_ISOLATION_V118_ATTESTATION_SHA256 = 'bbc6f7b8f446c2d2eaa9c4b2964cc0fcfed27c76005b4b79966b41d2591d0ea5';
export const PANEL_WARMUP_ISOLATION_V118_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const PANEL_WARMUP_ISOLATION_V118_ANCESTOR_OVERRIDES = Object.freeze([
    'public/leads-window.html',
    'public/qr.html',
    'scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs',
    'scripts/guard-protocolo-g-ad-metrics-v63.mjs',
    'scripts/guard-protocolo-g-conversion-v62.mjs',
    'scripts/senior-guard.mjs',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'scripts/lib/post-sale-next-eligible-source-compat-v113.mjs',
    'src/routes/shipments.js',
    'src/routes/whatsapp.js',
    'src/services/ecConversationBucketService.js',
    'src/services/postSaleTransactionalSafetyV116ManifestService.js'
]);

export const PANEL_WARMUP_ISOLATION_V118_NEW_PROTECTED_FILES = Object.freeze([
    'docs/PANEL_WARMUP_ISOLATION_FREEZE_V118_20260903.md',
    'docs/evidence/panel-warmup-isolation-v118-attestation-20260903.json',
    'public/panel-intelligence/panel-warmup-isolation-v118.js',
    'scripts/guard-panel-warmup-isolation-v118.mjs',
    'scripts/move-qa-to-engagement-v118.mjs',
    'src/services/panelWarmupIsolationFreezeRuntimeGuardV118.js',
    'src/services/panelWarmupIsolationV118ManifestService.js',
    'src/services/panelWarmupIsolationV118Service.js',
    'tests/panel-warmup-isolation-v118.test.mjs'
]);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[PANEL-WARMUP-ISOLATION-V118] protected_path_invalid');
    }
    const candidate = path.resolve(projectRoot, relativePath);
    if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
        throw new Error('[PANEL-WARMUP-ISOLATION-V118] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[PANEL-WARMUP-ISOLATION-V118] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[PANEL-WARMUP-ISOLATION-V118] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV116 = () => {
    if (fileSha256('docs/freeze/post-sale-transactional-safety-v116-20260903.json')
        !== PANEL_WARMUP_ISOLATION_V118_PARENT_MANIFEST_SHA256) {
        throw new Error('[PANEL-WARMUP-ISOLATION-V118] parent_manifest_identity_invalid');
    }
    const parent = canonicalJson('docs/freeze/post-sale-transactional-safety-v116-20260903.json', 'parent_manifest');
    if (parent.version !== 116 || parent.freezeId !== 'post-sale-transactional-safety-v116'
        || parent.policy?.ambiguousFailureTerminal !== true
        || parent.policy?.historicalBacklogEnabled !== false
        || parent.policy?.marketingBlastEnabled !== false) {
        throw new Error('[PANEL-WARMUP-ISOLATION-V118] parent_policy_invalid');
    }
    const modified = new Set(PANEL_WARMUP_ISOLATION_V118_ANCESTOR_OVERRIDES);
    const successorOverrides = new Set(globalThis[PANEL_WARMUP_ISOLATION_V118_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath) || successorOverrides.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[PANEL-WARMUP-ISOLATION-V118] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertPanelWarmupIsolationV118Manifest = () => {
    assertParentV116();
    const manifest = canonicalJson(PANEL_WARMUP_ISOLATION_V118_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'panel-warmup-isolation-v118'
        || manifest.version !== PANEL_WARMUP_ISOLATION_V118_VERSION
        || manifest.parentVersion !== 'V116_PRODUCTION_BASELINE'
        || manifest.parentCommit !== PANEL_WARMUP_ISOLATION_V118_PARENT_COMMIT
        || manifest.parentTree !== PANEL_WARMUP_ISOLATION_V118_PARENT_TREE
        || manifest.parentManifestSha256 !== PANEL_WARMUP_ISOLATION_V118_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'ISOLATE_ENGAGEMENT_FROM_COMMERCIAL_PANEL_AND_MOVE_EXACT_QA'
        || JSON.stringify(overrides) !== JSON.stringify(PANEL_WARMUP_ISOLATION_V118_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(PANEL_WARMUP_ISOLATION_V118_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.engagementVisibleOnlyInOwnBucket !== true
        || manifest.policy?.normalSearchCannotCrossIntoEngagement !== true
        || manifest.policy?.commercialMetricsExcludeEngagement !== true
        || manifest.policy?.buyerLeadListExcludesEngagement !== true
        || manifest.policy?.activeOrderProjectionPreserved !== true
        || manifest.policy?.postSaleV114ObserverCompatibilityPreserved !== true
        || manifest.policy?.qaAutomaticEngagementReplyAllowed !== false
        || manifest.policy?.whatsappOutboundAllowed !== false
        || manifest.policy?.dropiMutationAllowed !== false
        || manifest.policy?.metaMutationAllowed !== false
        || manifest.evidence?.sha256 !== PANEL_WARMUP_ISOLATION_V118_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/PANEL_WARMUP_ISOLATION_FREEZE_V118_20260903.md') !== PANEL_WARMUP_ISOLATION_V118_FREEZE_SHA256) {
        throw new Error('[PANEL-WARMUP-ISOLATION-V118] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[PANEL_WARMUP_ISOLATION_V118_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[PANEL-WARMUP-ISOLATION-V118] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[PANEL-WARMUP-ISOLATION-V118] logical_bundle_invalid');
    }
    return Object.freeze({ ready: true, failures: [], manifest, overrides });
};
