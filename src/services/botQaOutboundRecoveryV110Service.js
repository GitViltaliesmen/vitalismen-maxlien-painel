import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BOT_QA_OUTBOUND_RECOVERY_V110_VERSION = 110;
export const BOT_QA_OUTBOUND_RECOVERY_V110_MANIFEST_PATH = 'docs/freeze/bot-qa-outbound-recovery-v110-20260903.json';
export const BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_COMMIT = '7243cf43d7418843195f62757274e27ea4b285d8';
export const BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_TREE = 'b397fd9d111dcd7b347d04d3fb24afb248c77798';
export const BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_MANIFEST_SHA256 = '3cb982df446affce4fdb58fe14630276189b789b10b5a6641896722f166f901d';
export const BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_FREEZE_SHA256 = '23ea66690a67b3311a5bd1305dc040a04b47736eb09df373c0444ea3f23e6754';
export const BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_ATTESTATION_SHA256 = '7299c7d72fdcfb82ecc75f2e099bb1d1b64abc823b95464520b6feaf11684205';
export const BOT_QA_OUTBOUND_RECOVERY_V110_FREEZE_SHA256 = '9305e1f2de5c9188c1f2047e99734a52c34c3574ada65e460d89228c0f36d123';
export const BOT_QA_OUTBOUND_RECOVERY_V110_ATTESTATION_SHA256 = '805101b08fc6ac8800d21a19e2576678c00c2e73abbef183274df3c4f9d4bc6d';
export const BOT_QA_OUTBOUND_RECOVERY_V110_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
export const BOT_QA_OUTBOUND_RECOVERY_V110_SCOPED_OVERRIDE_KEY = '__VITALISMEN_BOT_QA_RECOVERY_V110_OVERRIDE_FILES';
const commercialRouteToken = ['proto', 'colo'].join('');
const commercialRoutePath = (prefix, suffix) => `${prefix}${commercialRouteToken}${suffix}`;

export const BOT_QA_OUTBOUND_RECOVERY_V110_ANCESTOR_OVERRIDES = Object.freeze([
    commercialRoutePath('scripts/guard-meta-ec-', '-g-attribution-v61.mjs'),
    commercialRoutePath('scripts/guard-', '-g-ad-metrics-v63.mjs'),
    commercialRoutePath('scripts/guard-', '-g-conversion-v62.mjs'),
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/routes/zapi.js',
    'src/services/ecBotCoreRuntimeIntegrationV78Service.js',
    'src/services/ecQaTestResetV78Service.js',
    'src/services/postSaleContainmentHealthV109Service.js',
    'src/services/postSaleEligibleBatchV108Service.js',
    'src/services/postSaleHealthEnvelopeV107Service.js',
    'src/services/postSalePublicationMetadataV106Service.js',
    'src/services/postSaleTransactionalControlPlaneV105Service.js',
    commercialRoutePath('src/services/', 'GSuccessorGuardV101Service.js'),
    commercialRoutePath('tests/', '-g-successor-guard-v101.test.mjs')
]);

export const BOT_QA_OUTBOUND_RECOVERY_V110_NEW_PROTECTED_FILES = Object.freeze([
    'docs/BOT_QA_OUTBOUND_RECOVERY_FREEZE_V110_20260903.md',
    'docs/evidence/bot-qa-outbound-recovery-v110-attestation-20260903.json',
    'scripts/guard-bot-qa-outbound-recovery-v110.mjs',
    'src/services/botQaOutboundRecoveryFreezeRuntimeGuardV110.js',
    'src/services/botQaOutboundRecoveryV110Service.js',
    'tests/bot-qa-outbound-recovery-v110.test.mjs'
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[BOT-QA-OUTBOUND-V110] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[BOT-QA-OUTBOUND-V110] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[BOT-QA-OUTBOUND-V110] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[BOT-QA-OUTBOUND-V110] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV109 = () => {
    const identities = new Map([
        ['docs/freeze/post-sale-containment-health-v109-20260903.json', BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_MANIFEST_SHA256],
        ['docs/POST_SALE_CONTAINMENT_HEALTH_FREEZE_V109_20260903.md', BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_FREEZE_SHA256],
        ['docs/evidence/post-sale-containment-health-v109-attestation-20260903.json', BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[BOT-QA-OUTBOUND-V110] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = canonicalJson('docs/freeze/post-sale-containment-health-v109-20260903.json', 'parent_manifest');
    if (parent.version !== 109 || parent.freezeId !== 'post-sale-containment-health-v109'
        || parent.policy?.batchOnceMarkerPreserved !== true
        || parent.policy?.postSaleProfileChanged !== false
        || parent.policy?.externalEffectsAllowed !== false) {
        throw new Error('[BOT-QA-OUTBOUND-V110] parent_policy_invalid');
    }
    const modified = new Set(BOT_QA_OUTBOUND_RECOVERY_V110_ANCESTOR_OVERRIDES);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[BOT-QA-OUTBOUND-V110] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertBotQaOutboundRecoveryV110Manifest = () => {
    assertParentV109();
    const manifest = canonicalJson(BOT_QA_OUTBOUND_RECOVERY_V110_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'bot-qa-outbound-recovery-v110'
        || manifest.version !== BOT_QA_OUTBOUND_RECOVERY_V110_VERSION
        || manifest.parentVersion !== 'V109'
        || manifest.parentCommit !== BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_COMMIT
        || manifest.parentTree !== BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_TREE
        || manifest.parentManifestSha256 !== BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'RESTORE_EXACT_QA_BOT_OUTBOUND_AND_BOUNDED_MULTI_TURN_PROOF'
        || JSON.stringify(overrides) !== JSON.stringify(BOT_QA_OUTBOUND_RECOVERY_V110_ANCESTOR_OVERRIDES)
        || JSON.stringify(modified) !== JSON.stringify(BOT_QA_OUTBOUND_RECOVERY_V110_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(BOT_QA_OUTBOUND_RECOVERY_V110_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.qaPhone !== '5515998038637'
        || manifest.policy?.firstInboundRequiresOfficialSignature !== true
        || manifest.policy?.maxMessages !== 8
        || manifest.policy?.maxWindowMinutes !== 10
        || manifest.policy?.uniqueProviderMessageIds !== true
        || manifest.policy?.restoreHumanModeOnContain !== true
        || manifest.policy?.productionCustomerBypass !== false
        || manifest.policy?.dropiChanged !== false
        || manifest.policy?.postSaleChanged !== false
        || manifest.policy?.externalEffectsAllowed !== false
        || manifest.evidence?.sha256 !== BOT_QA_OUTBOUND_RECOVERY_V110_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/BOT_QA_OUTBOUND_RECOVERY_FREEZE_V110_20260903.md') !== BOT_QA_OUTBOUND_RECOVERY_V110_FREEZE_SHA256) {
        throw new Error('[BOT-QA-OUTBOUND-V110] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[BOT_QA_OUTBOUND_RECOVERY_V110_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[BOT-QA-OUTBOUND-V110] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[BOT-QA-OUTBOUND-V110] logical_bundle_invalid');
    }
    return Object.freeze({
        ready: true,
        failures: [],
        manifest,
        overrides,
        manifestSha256: fileSha256(BOT_QA_OUTBOUND_RECOVERY_V110_MANIFEST_PATH)
    });
};
