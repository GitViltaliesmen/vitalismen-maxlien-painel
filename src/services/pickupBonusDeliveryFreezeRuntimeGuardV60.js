import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/pickup-bonus-delivery-v60-20260824.json';
const parentManifestPath = 'docs/freeze/baileys-libsignal-security-v59-20260824.json';
const parentManifestSha256 = 'ce9040f9f817c9554161e5375654743c43293b00c3151bb034ea00da7214ec43';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'scripts/guard-baileys-libsignal-security-v59.mjs',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/shipmentMessageService.js',
    'tests/shipment-pickup-notification.test.mjs',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_PICKUP_BONUS_DELIVERY_V60_20260824.txt',
    'docs/PICKUP_BONUS_DELIVERY_FREEZE_V60_20260824.md',
    'scripts/assert-pickup-bonus-delivery-activation-approved-v60.mjs',
    'scripts/guard-pickup-bonus-delivery-v60.mjs',
    'src/services/pickupBonusDeliveryFreezeRuntimeGuardV60.js',
    'tests/pickup-bonus-delivery-v60.test.mjs'
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
    || manifest.freezeId !== 'pickup-bonus-delivery-v60-20260824'
    || manifest.parentFreezeId !== 'baileys-libsignal-security-v59-20260824'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'pickup_bonus_promise_repair_freeze_and_activation_approved'
    || manifest.policy?.dedicatedPickupBonusSemanticKey !== true
    || manifest.policy?.sameOrderRetryRemainsDeduped !== true
    || manifest.policy?.thankYouAudioReplayAllowed !== false
    || manifest.policy?.howToUseAudioReplayAllowed !== false
    || manifest.policy?.exactPendingBonusCompletionAuthorized !== true
    || manifest.policy?.massHistoricalReplayAllowed !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.metaPurchaseResendAllowed !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.commercialFunnelChanged !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[PICKUP-BONUS-DELIVERY-V60] manifesto ou política inválida; startup bloqueado.');

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...(manifest.declaredAncestorOverrides || [])
];
try {
    await import('./baileysLibsignalSecurityFreezeRuntimeGuardV59.js');
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
        throw new Error(`[PICKUP-BONUS-DELIVERY-V60] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[PICKUP-BONUS-DELIVERY-V60] bônus por pedido e antirrepetição validados.');
