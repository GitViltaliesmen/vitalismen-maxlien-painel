import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BOT_QA_MULTITURN_RECOVERY_V111_VERSION = 111;
export const BOT_QA_MULTITURN_RECOVERY_V111_MANIFEST_PATH = 'docs/freeze/bot-qa-multiturn-recovery-v111-20260903.json';
export const BOT_QA_MULTITURN_RECOVERY_V111_PARENT_COMMIT = '370f398ec64a0e27d76d6bca4d47c348661a4596';
export const BOT_QA_MULTITURN_RECOVERY_V111_PARENT_TREE = '8bdea6f476a0010fd944306638f50301e754dabe';
export const BOT_QA_MULTITURN_RECOVERY_V111_PARENT_MANIFEST_SHA256 = 'bab6684c4ce75baeaae49841cc532eeb1df646978c3654e276c62fc71affa6a8';
export const BOT_QA_MULTITURN_RECOVERY_V111_PARENT_FREEZE_SHA256 = '9305e1f2de5c9188c1f2047e99734a52c34c3574ada65e460d89228c0f36d123';
export const BOT_QA_MULTITURN_RECOVERY_V111_PARENT_ATTESTATION_SHA256 = '805101b08fc6ac8800d21a19e2576678c00c2e73abbef183274df3c4f9d4bc6d';
export const BOT_QA_MULTITURN_RECOVERY_V111_FREEZE_SHA256 = 'bdba0445bdb341f57f5f7b570fce23883fbde934a32a67cdd98986d82c731e86';
export const BOT_QA_MULTITURN_RECOVERY_V111_ATTESTATION_SHA256 = 'd8cdf157e6f1ec5504faaec45c5417e6dfd3302dd4f6a0f672ab83510802f8d8';
export const BOT_QA_MULTITURN_RECOVERY_V111_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
const HISTORICAL_ATTRIBUTION_LABEL = ['proto', 'colo'].join('');

export const BOT_QA_MULTITURN_RECOVERY_V111_ANCESTOR_OVERRIDES = Object.freeze([
    `scripts/guard-meta-ec-${HISTORICAL_ATTRIBUTION_LABEL}-g-attribution-v61.mjs`,
    `scripts/guard-${HISTORICAL_ATTRIBUTION_LABEL}-g-ad-metrics-v63.mjs`,
    `scripts/guard-${HISTORICAL_ATTRIBUTION_LABEL}-g-conversion-v62.mjs`,
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/routes/zapi.js',
    'src/services/ecBotCoreRuntimeIntegrationV78Service.js',
    `tests/${HISTORICAL_ATTRIBUTION_LABEL}-g-successor-guard-v101.test.mjs`
]);

export const BOT_QA_MULTITURN_RECOVERY_V111_NEW_PROTECTED_FILES = Object.freeze([
    'docs/BOT_QA_MULTITURN_RECOVERY_FREEZE_V111_20260903.md',
    'docs/evidence/bot-qa-multiturn-recovery-v111-attestation-20260903.json',
    'scripts/guard-bot-qa-multiturn-recovery-v111.mjs',
    'src/services/botQaMultiturnRecoveryFreezeRuntimeGuardV111.js',
    'src/services/botQaMultiturnRecoveryV111Service.js',
    'tests/bot-qa-multiturn-recovery-v111.test.mjs'
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[BOT-QA-MULTITURN-V111] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[BOT-QA-MULTITURN-V111] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[BOT-QA-MULTITURN-V111] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[BOT-QA-MULTITURN-V111] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV110 = () => {
    const identities = new Map([
        ['docs/freeze/bot-qa-outbound-recovery-v110-20260903.json', BOT_QA_MULTITURN_RECOVERY_V111_PARENT_MANIFEST_SHA256],
        ['docs/BOT_QA_OUTBOUND_RECOVERY_FREEZE_V110_20260903.md', BOT_QA_MULTITURN_RECOVERY_V111_PARENT_FREEZE_SHA256],
        ['docs/evidence/bot-qa-outbound-recovery-v110-attestation-20260903.json', BOT_QA_MULTITURN_RECOVERY_V111_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[BOT-QA-MULTITURN-V111] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = canonicalJson('docs/freeze/bot-qa-outbound-recovery-v110-20260903.json', 'parent_manifest');
    if (parent.version !== 110 || parent.freezeId !== 'bot-qa-outbound-recovery-v110'
        || parent.policy?.qaPhone !== '5515998038637'
        || parent.policy?.maxMessages !== 8
        || parent.policy?.productionCustomerBypass !== false
        || parent.policy?.dropiChanged !== false
        || parent.policy?.postSaleChanged !== false
        || parent.policy?.externalEffectsAllowed !== false) {
        throw new Error('[BOT-QA-MULTITURN-V111] parent_policy_invalid');
    }
    const modified = new Set(BOT_QA_MULTITURN_RECOVERY_V111_ANCESTOR_OVERRIDES);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[BOT-QA-MULTITURN-V111] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertBotQaMultiturnRecoveryV111Manifest = () => {
    assertParentV110();
    const manifest = canonicalJson(BOT_QA_MULTITURN_RECOVERY_V111_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'bot-qa-multiturn-recovery-v111'
        || manifest.version !== BOT_QA_MULTITURN_RECOVERY_V111_VERSION
        || manifest.parentVersion !== 'V110'
        || manifest.parentCommit !== BOT_QA_MULTITURN_RECOVERY_V111_PARENT_COMMIT
        || manifest.parentTree !== BOT_QA_MULTITURN_RECOVERY_V111_PARENT_TREE
        || manifest.parentManifestSha256 !== BOT_QA_MULTITURN_RECOVERY_V111_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'RESTORE_FRESH_VSL_CONTEXT_AND_EXCLUDE_DELIVERY_CALLBACKS_FROM_QA_LEDGER'
        || JSON.stringify(overrides) !== JSON.stringify(BOT_QA_MULTITURN_RECOVERY_V111_ANCESTOR_OVERRIDES)
        || JSON.stringify(modified) !== JSON.stringify(BOT_QA_MULTITURN_RECOVERY_V111_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(BOT_QA_MULTITURN_RECOVERY_V111_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.qaPhone !== '5515998038637'
        || manifest.policy?.freshVslAttributionRefreshesTimestamp !== true
        || manifest.policy?.deliveryCallbacksConsumeQaLedger !== false
        || manifest.policy?.firstInboundRequiresOfficialSignature !== true
        || manifest.policy?.maxMessages !== 8
        || manifest.policy?.maxWindowMinutes !== 10
        || manifest.policy?.productionCustomerBypass !== false
        || manifest.policy?.dropiChanged !== false
        || manifest.policy?.postSaleChanged !== false
        || manifest.policy?.externalEffectsAllowed !== false
        || manifest.evidence?.sha256 !== BOT_QA_MULTITURN_RECOVERY_V111_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/BOT_QA_MULTITURN_RECOVERY_FREEZE_V111_20260903.md') !== BOT_QA_MULTITURN_RECOVERY_V111_FREEZE_SHA256) {
        throw new Error('[BOT-QA-MULTITURN-V111] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[BOT_QA_MULTITURN_RECOVERY_V111_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[BOT-QA-MULTITURN-V111] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[BOT-QA-MULTITURN-V111] logical_bundle_invalid');
    }
    return Object.freeze({
        ready: true,
        failures: [],
        manifest,
        overrides,
        manifestSha256: fileSha256(BOT_QA_MULTITURN_RECOVERY_V111_MANIFEST_PATH)
    });
};
