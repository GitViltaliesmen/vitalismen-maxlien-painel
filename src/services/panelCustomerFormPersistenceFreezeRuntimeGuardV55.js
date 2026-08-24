import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/panel-customer-form-persistence-v55-20260824.json';
const parentManifestPath = 'docs/freeze/tex-ultra-delivery-closure-v54-20260824.json';
const parentManifestSha256 = '7c4587234a36e61bcee7c6f8d3bcbcacfcca6746b037f747886fb7ea82bca2db';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'public/qr.html',
    'src/routes/whatsapp.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_PANEL_CUSTOMER_FORM_PERSISTENCE_V55_20260824.txt',
    'docs/PANEL_CUSTOMER_FORM_PERSISTENCE_FREEZE_V55_20260824.md',
    'public/panel-intelligence/customer-form-persistence-guard-v55.js',
    'scripts/assert-panel-customer-form-persistence-activation-approved-v55.mjs',
    'scripts/guard-panel-customer-form-persistence-v55.mjs',
    'scripts/repair-panel-customer-form-v55.mjs',
    'src/services/panelCustomerFormPersistenceFreezeRuntimeGuardV55.js',
    'src/services/panelCustomerFormPersistenceService.js',
    'tests/panel-customer-form-persistence-v55.test.mjs'
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
    || manifest.freezeId !== 'panel-customer-form-persistence-v55-20260824'
    || manifest.parentFreezeId !== 'tex-ultra-delivery-closure-v54-20260824'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'urgent_implementation_repair_and_activation_approved'
    || manifest.policy?.canonicalAgencyAddressInPanel !== true
    || manifest.policy?.stableConversationPhoneIdentity !== true
    || manifest.policy?.backendPhoneIdentityMismatchRejected !== true
    || manifest.policy?.exactAffectedRecordsRepairWithBackup !== true
    || manifest.policy?.historicalDeliveredOrderMutation !== false
    || manifest.policy?.realClientCanaryAuthorized !== false
    || manifest.policy?.whatsappSendAuthorized !== false
    || manifest.policy?.metaPurchaseResendAllowed !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[PANEL-CUSTOMER-FORM-V55] manifesto ou política inválida; startup bloqueado.');
}

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...(manifest.declaredAncestorOverrides || [])
];
try {
    await import('./texUltraDeliveryClosureFreezeRuntimeGuardV54.js');
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
        throw new Error(`[PANEL-CUSTOMER-FORM-V55] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[PANEL-CUSTOMER-FORM-V55] endereço canônico, identidade da conversa e reparo exato validados.');
