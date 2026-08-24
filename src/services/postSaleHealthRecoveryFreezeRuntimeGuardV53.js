import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/post-sale-health-recovery-v53-20260824.json';
const parentManifestPath = 'docs/freeze/panel-media-persistence-v52-20260824.json';
const parentManifestSha256 = 'ce933b157d102f6aa57e0c458c7369793659f4d72056172db32bcb0a6cb6752c';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'scripts/guard-ec-direct-product-name-postsale-v39.mjs',
    'src/models/Shipment.js',
    'src/services/conversationEngine.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/postSalePickupReconciliationPolicy.js',
    'src/services/reengagementService.js',
    'src/services/schedulerService.js',
    'src/services/shipmentMessageService.js',
    'src/services/texUltraConfirmedPostSaleLayerService.js',
    'tests/shipment-pickup-notification.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_POST_SALE_HEALTH_RECOVERY_V53_20260824.txt',
    'docs/POST_SALE_HEALTH_RECOVERY_FREEZE_V53_20260824.md',
    'scripts/assert-post-sale-health-activation-approved-v53.mjs',
    'scripts/guard-post-sale-health-v53.mjs',
    'src/services/postSaleHealthRecoveryFreezeRuntimeGuardV53.js',
    'tests/post-sale-health-v53.test.mjs'
];
const absolute = (relativePath) => path.join(root, relativePath);
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(absolute(relativePath)))
    .digest('hex');
const manifest = JSON.parse(fs.readFileSync(absolute(manifestPath), 'utf8'));
const expectedProtectedFiles = [...declaredAncestorOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();

if (
    sha256(parentManifestPath) !== parentManifestSha256
    || manifest.freezeId !== 'post-sale-health-recovery-v53-20260824'
    || manifest.parentFreezeId !== 'panel-media-persistence-v52-20260824'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'urgent_full_resolution_and_activation_approved'
    || manifest.policy?.pickupReminderStageSpecificDedupe !== true
    || manifest.policy?.pickupReminderPersistentLock !== true
    || manifest.policy?.repurchasePersistentLock !== true
    || manifest.policy?.manualOnlyAutomaticOutboundAllowed !== false
    || manifest.policy?.blockedCandidateCanStarveQueue !== false
    || manifest.policy?.texUltraRecentAutomaticMaxAgeHours !== 72
    || manifest.policy?.massBacklogReplayAllowed !== false
    || manifest.policy?.repurchaseProductIsolation !== true
    || manifest.policy?.realClientCanaryAuthorized !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[POST-SALE-HEALTH-V53] manifesto ou politica invalida; startup bloqueado.');
}

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...(manifest.declaredAncestorOverrides || [])
];
try {
    await import('./panelMediaPersistenceFreezeRuntimeGuardV52.js');
} finally {
    if (inheritedSuccessorOverrides.length > 0) {
        globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = inheritedSuccessorOverrides;
    } else {
        delete globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES;
    }
}

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[POST-SALE-HEALTH-V53] alteracao nao autorizada em ${relativePath}.`);
    }
}

console.log('[POST-SALE-HEALTH-V53] filas, antispam e isolamento multiproduto validados.');
