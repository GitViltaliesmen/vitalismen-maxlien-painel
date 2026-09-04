import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_VERSION = 126;
export const VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_MANIFEST_PATH = 'docs/freeze/vitalismen-ec-qa-read-postsale-recovery-v126-20260904.json';
export const VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_PARENT_COMMIT = '475ab887656bbb8865f3c16e42bec0d63e9421a6';
export const VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_PARENT_TREE = '9cc5f631db2d2cf1925d82703478cdda18921386';
export const VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_PARENT_MANIFEST_SHA256 = 'b62f84f9940f0e4fa9e911f79254bdfe40f8a9f3a346002d46add2910a33f2d7';
export const VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_FREEZE_SHA256 = '2f49063eb2667dd1d4da8b31221aa24f7c9e3b8ba14e8f8e160827a27ab2d4ae';
export const VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_SNAPSHOT_SHA256 = '439e02531ea7d185f3c0fe2b481ce256c6b8eb06d34a6f055de4d6e9a6588ea5';
export const VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_AFTER_STATE_SHA256 = 'fdc3ecb7c905665c9398cfc3f672c347015be7ff3f369d59753c493f9c8fad0f';
export const VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_ATTESTATION_SHA256 = '2d6ec84413e7c7bc9f9414885b20c1c05368591a50ac69ca1b0ef077b73b0bf5';
export const VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_ANCESTOR_OVERRIDES = Object.freeze([
    'ops/post-sale-v116',
    'package.json',
    'public/qr.html',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'scripts/post-sale-transactional-batch-v116.mjs',
    'src/routes/orders.js',
    'src/routes/whatsapp.js',
    'src/routes/zapi.js',
    'src/services/agentRouter.js',
    'src/services/ecBotCoreRuntimeIntegrationV78Service.js',
    'src/services/panelReadStateService.js',
    'src/services/panelWarmupIsolationV118ManifestService.js',
    'src/services/shipmentMessageService.js',
    'src/services/shipmentStatusDispatcherService.js'
]);

export const VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_NEW_PROTECTED_FILES = Object.freeze([
    'docs/VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_FREEZE_V126_20260904.md',
    'docs/evidence/vitalismen-ec-v126-after-diff-state-20260904.json',
    'docs/evidence/vitalismen-ec-qa-read-postsale-recovery-v126-attestation-20260904.json',
    'docs/evidence/vitalismen-ec-v126-pre-mission-snapshot-20260904.json',
    'scripts/guard-vitalismen-ec-qa-read-postsale-recovery-v126.mjs',
    'scripts/reset-ec-qa-8637-v126.mjs',
    'src/services/ecQaPermanentTestV126Service.js',
    'src/services/postSaleLifecycleRecoveryV126Service.js',
    'src/services/vitalismenEcQaReadPostSaleRecoveryFreezeRuntimeGuardV126.js',
    'src/services/vitalismenEcQaReadPostSaleRecoveryV126Service.js',
    'tests/ec-qa-permanent-test-v126.test.mjs',
    'tests/panel-handled-state-v126.test.mjs',
    'tests/post-sale-lifecycle-recovery-v126.test.mjs',
    'tests/vitalismen-ec-qa-read-postsale-recovery-v126.test.mjs'
]);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[VITALISMEN-EC-V126] protected_path_invalid');
    }
    const candidate = path.resolve(projectRoot, relativePath);
    if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
        throw new Error('[VITALISMEN-EC-V126] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[VITALISMEN-EC-V126] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[VITALISMEN-EC-V126] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV125 = (overrides) => {
    if (fileSha256('docs/freeze/ec-panel-status-state-layer-v125-20260904.json')
        !== VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_PARENT_MANIFEST_SHA256) {
        throw new Error('[VITALISMEN-EC-V126] parent_manifest_identity_invalid');
    }
    const parent = canonicalJson('docs/freeze/ec-panel-status-state-layer-v125-20260904.json', 'parent_manifest');
    if (parent.version !== 125 || parent.freezeId !== 'ec-panel-status-state-layer-v125'
        || parent.policy?.operatorStatusAlwaysPersists !== true
        || parent.policy?.incompleteOrderRemainsBlocked !== true
        || parent.policy?.genericOrderRoutesAllowed !== false
        || parent.policy?.dropiChanged !== false
        || parent.policy?.metaChanged !== false) {
        throw new Error('[VITALISMEN-EC-V126] parent_policy_invalid');
    }
    const modified = new Set(overrides);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[VITALISMEN-EC-V126] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertVitalismenEcQaReadPostSaleRecoveryV126Manifest = () => {
    const manifest = canonicalJson(VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    assertParentV125(overrides);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'vitalismen-ec-qa-read-postsale-recovery-v126'
        || manifest.version !== VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_VERSION
        || manifest.parentVersion !== 'V125_PRODUCTION_BASELINE'
        || manifest.parentCommit !== VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_PARENT_COMMIT
        || manifest.parentTree !== VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_PARENT_TREE
        || manifest.parentManifestSha256 !== VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'RESTORE_EXACT_QA_TEST_HANDLED_STATE_AND_NEW_EVENT_POSTSALE_LIFECYCLES'
        || JSON.stringify(overrides) !== JSON.stringify(VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.qaPermanentBotTest !== true
        || manifest.policy?.qaCommercialEffectsBlocked !== true
        || manifest.policy?.qaHistoryPreserved !== true
        || manifest.policy?.panelHandledStatePersistent !== true
        || manifest.policy?.newInboundReopens !== true
        || manifest.policy?.pickupReminderLifecycleRecovered !== true
        || manifest.policy?.treatmentRefillLifecycleRecovered !== true
        || manifest.policy?.v114Changed !== false
        || manifest.policy?.v116SameExecutor !== true
        || manifest.policy?.newSchedulerCreated !== false
        || manifest.policy?.lifecycleActivationCursorRequired !== true
        || manifest.policy?.historicalBackfillAllowed !== false
        || manifest.policy?.marketingBlastEnabled !== false
        || manifest.policy?.metaRetroactiveAllowed !== false
        || manifest.policy?.dropiChanged !== false
        || manifest.policy?.metaChanged !== false
        || manifest.policy?.productionChanged !== false
        || manifest.preMissionSnapshot?.sha256 !== VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_SNAPSHOT_SHA256
        || fileSha256(manifest.preMissionSnapshot.path) !== manifest.preMissionSnapshot.sha256
        || manifest.afterState?.sha256 !== VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_AFTER_STATE_SHA256
        || fileSha256(manifest.afterState.path) !== manifest.afterState.sha256
        || manifest.evidence?.sha256 !== VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_FREEZE_V126_20260904.md')
            !== VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_FREEZE_SHA256) {
        throw new Error('[VITALISMEN-EC-V126] manifest_identity_or_policy_invalid');
    }
    for (const relativePath of expectedPaths) {
        if (fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[VITALISMEN-EC-V126] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[VITALISMEN-EC-V126] logical_bundle_invalid');
    }
    return Object.freeze({ ready: true, failures: [], manifest, overrides, manifestSha256: fileSha256(VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_MANIFEST_PATH) });
};
