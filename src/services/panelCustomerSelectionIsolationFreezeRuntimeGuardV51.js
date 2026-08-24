import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/panel-customer-selection-isolation-v51-20260824.json';
const parentManifestPath = 'docs/freeze/panel-manual-edit-persistence-v50-20260823.json';
const parentManifestSha256 = 'dad3edb214e95c6e508dae977bb691d5523fa06593d2fe6f47d1b369e97e0f7e';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'public/qr.html',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'tests/panel-manual-edit-persistence-v50.test.mjs',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_PANEL_CUSTOMER_SELECTION_ISOLATION_V51_20260824.txt',
    'docs/PANEL_CUSTOMER_SELECTION_ISOLATION_FREEZE_V51_20260824.md',
    'public/panel-intelligence/customer-selection-guard-v51.js',
    'scripts/assert-panel-customer-selection-isolation-activation-approved-v51.mjs',
    'scripts/guard-panel-customer-selection-isolation-v51.mjs',
    'scripts/test-panel-customer-selection-browser-v51.mjs',
    'src/services/panelCustomerSelectionIsolationFreezeRuntimeGuardV51.js',
    'tests/panel-customer-selection-isolation-v51.test.mjs'
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
    || manifest.freezeId !== 'panel-customer-selection-isolation-v51-20260824'
    || manifest.parentFreezeId !== 'panel-manual-edit-persistence-v50-20260823'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'urgent_implementation_test_and_activation_approved'
    || manifest.policy?.selectionScopedByEpoch !== true
    || manifest.policy?.staleSelectionWorkCanWrite !== false
    || manifest.policy?.selectionTimersInvalidated !== true
    || manifest.policy?.agencyAutosaveIdempotent !== true
    || manifest.policy?.automaticOutboundChanged !== false
    || manifest.policy?.realClientMutationForValidation !== false
    || manifest.policy?.realClientSendAuthorized !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[PANEL-CUSTOMER-SELECTION-V51] manifesto ou política inválida; startup bloqueado.');
}

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...(manifest.declaredAncestorOverrides || [])
];
try {
    await import('./panelManualEditPersistenceFreezeRuntimeGuardV50.js');
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
        throw new Error(`[PANEL-CUSTOMER-SELECTION-V51] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[PANEL-CUSTOMER-SELECTION-V51] geração da seleção, timers e agência idempotente validados.');
