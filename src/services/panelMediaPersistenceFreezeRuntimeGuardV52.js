import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/panel-media-persistence-v52-20260824.json';
const parentManifestPath = 'docs/freeze/panel-customer-selection-isolation-v51-20260824.json';
const parentManifestSha256 = '3c8177b57966f64a1237f10f2ac55979786073f7cdfa23ae7311d5f960ab6246';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'public/qr.html',
    'src/routes/whatsapp.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/logisticsCommunicationV29.js',
    'tests/logistics-clean-chat-v29.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_PANEL_MEDIA_PERSISTENCE_V52_20260824.txt',
    'docs/PANEL_MEDIA_PERSISTENCE_FREEZE_V52_20260824.md',
    'scripts/assert-panel-media-persistence-activation-approved-v52.mjs',
    'scripts/guard-panel-media-persistence-v52.mjs',
    'src/services/panelMediaPersistenceFreezeRuntimeGuardV52.js',
    'tests/panel-funnel-media-confirmation-v52.test.mjs'
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
    || manifest.freezeId !== 'panel-media-persistence-v52-20260824'
    || manifest.parentFreezeId !== 'panel-customer-selection-isolation-v51-20260824'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'urgent_implementation_test_and_activation_approved'
    || manifest.policy?.commercialAgencyAudioIsPickupStage !== false
    || manifest.policy?.pickupStageAudioRequiresVerifiedReady !== true
    || manifest.policy?.manualMediaUsesClientGeneratedId !== true
    || manifest.policy?.failedManualMediaDisappearsImmediately !== false
    || manifest.policy?.automaticOutboundChanged !== false
    || manifest.policy?.realClientSendForValidation !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[PANEL-MEDIA-V52] manifesto ou política inválida; startup bloqueado.');
}

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...(manifest.declaredAncestorOverrides || [])
];
try {
    await import('./panelCustomerSelectionIsolationFreezeRuntimeGuardV51.js');
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
        throw new Error(`[PANEL-MEDIA-V52] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[PANEL-MEDIA-V52] classificação de retirada e persistência manual validadas.');
