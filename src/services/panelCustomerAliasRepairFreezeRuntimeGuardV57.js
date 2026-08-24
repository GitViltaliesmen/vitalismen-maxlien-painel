import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/panel-customer-alias-repair-v57-20260824.json';
const parentManifestPath = 'docs/freeze/panel-customer-residual-repair-v56-20260824.json';
const parentManifestSha256 = 'b8d6e36a3fbfe7e98eb07e521fa953c0a89f0e1f45f27b5c16445d6659aff166';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_PANEL_CUSTOMER_ALIAS_REPAIR_V57_20260824.txt',
    'docs/PANEL_CUSTOMER_ALIAS_REPAIR_FREEZE_V57_20260824.md',
    'docs/PANEL_CUSTOMER_RESIDUAL_REPAIR_ACTIVATION_RESULT_V56_20260824.md',
    'scripts/assert-panel-customer-alias-repair-activation-approved-v57.mjs',
    'scripts/guard-panel-customer-alias-repair-v57.mjs',
    'scripts/repair-panel-customer-alias-v57.mjs',
    'src/services/panelCustomerAliasRepairFreezeRuntimeGuardV57.js',
    'tests/panel-customer-alias-repair-v57.test.mjs'
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
    || manifest.freezeId !== 'panel-customer-alias-repair-v57-20260824'
    || manifest.parentFreezeId !== 'panel-customer-residual-repair-v56-20260824'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'urgent_implementation_repair_and_activation_approved'
    || manifest.policy?.exactLocalAliasRepairWithBackup !== true
    || manifest.policy?.canonicalCustomerStateCopied !== true
    || manifest.policy?.orderOrMessageMutation !== false
    || manifest.policy?.realClientCanaryAuthorized !== false
    || manifest.policy?.whatsappSendAuthorized !== false
    || manifest.policy?.metaPurchaseResendAllowed !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[PANEL-CUSTOMER-ALIAS-V57] manifesto ou politica invalida; startup bloqueado.');

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...(manifest.declaredAncestorOverrides || [])
];
try {
    await import('./panelCustomerResidualRepairFreezeRuntimeGuardV56.js');
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
        throw new Error(`[PANEL-CUSTOMER-ALIAS-V57] alteracao nao autorizada em ${relativePath}.`);
    }
}

console.log('[PANEL-CUSTOMER-ALIAS-V57] ultimo alias local 5541 validado sem pedido ou mensagem.');
