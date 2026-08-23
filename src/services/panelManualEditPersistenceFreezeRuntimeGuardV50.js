import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/panel-manual-edit-persistence-v50-20260823.json';
const parentManifestPath = 'docs/freeze/whatsapp-outage-recovery-v49-20260823.json';
const parentManifestSha256 = '21d3268f2fc0e576c36c2fbe5ff5064999985855b8e830b145eec700e94e20dd';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'public/qr.html',
    'scripts/guard-whatsapp-outage-recovery-v49.mjs',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_PANEL_MANUAL_EDIT_PERSISTENCE_V50_20260823.txt',
    'docs/PANEL_MANUAL_EDIT_PERSISTENCE_FREEZE_V50_20260823.md',
    'public/panel-intelligence/customer-edit-guard-v50.js',
    'scripts/assert-panel-manual-edit-persistence-activation-approved-v50.mjs',
    'scripts/guard-panel-manual-edit-persistence-v50.mjs',
    'src/services/panelManualEditPersistenceFreezeRuntimeGuardV50.js',
    'tests/panel-manual-edit-persistence-v50.test.mjs'
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
    || manifest.freezeId !== 'panel-manual-edit-persistence-v50-20260823'
    || manifest.parentFreezeId !== 'whatsapp-outage-recovery-v49-20260823'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'urgent_implementation_test_and_activation_approved'
    || manifest.policy?.manualOperatorEditsAuthoritative !== true
    || manifest.policy?.staleAsyncResponseCanOverwrite !== false
    || manifest.policy?.savesSerialized !== true
    || manifest.policy?.contactTargetCaptured !== true
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
    throw new Error('[PANEL-MANUAL-EDIT-V50] manifesto ou política inválida; startup bloqueado.');
}

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...(manifest.declaredAncestorOverrides || [])
];
try {
    await import('./whatsappOutageRecoveryFreezeRuntimeGuardV49.js');
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
        throw new Error(`[PANEL-MANUAL-EDIT-V50] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[PANEL-MANUAL-EDIT-V50] edição humana, serialização e destino fixo validados.');
