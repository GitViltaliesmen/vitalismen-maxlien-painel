import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/ec-multiproduct-core-v48-20260822.json';
const parentManifestPath = 'docs/freeze/ec-repurchase-sqlite-serialization-v47-20260822.json';
const parentManifestSha256 = '41fb725a5a43393f7c9e52427be6635830d458c3e87a314d7e5a457f2791a88b';
const absolute = (relativePath) => path.join(root, relativePath);
const sha256 = (relativePath) => crypto.createHash('sha256').update(fs.readFileSync(absolute(relativePath))).digest('hex');
const manifest = JSON.parse(fs.readFileSync(absolute(manifestPath), 'utf8'));
const declaredAncestorOverrides = [
    'package.json',
    'public/qr.html',
    'scripts/assert-official-root.mjs',
    'scripts/deploy-vps-ready.mjs',
    'scripts/repair-ec-panel-customer-drafts.mjs',
    'scripts/senior-guard.mjs',
    'src/models/ContactState.js',
    'src/routes/whatsapp.js',
    'src/routes/zapi.js',
    'src/services/adminPanelLeadReconciliationService.js',
    'src/services/agentProfiles.js',
    'src/services/agentRouter.js',
    'src/services/agents/vitPowerAgent.js',
    'src/services/conversationEngine.js',
    'src/services/ecDirectProductInquiryService.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/ecRepurchaseSqliteSerializationFreezeRuntimeGuardV47.js',
    'src/services/ecuadorProductService.js',
    'src/services/memoryStore.js',
    'src/services/nitrixFastStateService.js',
    'src/services/reengagementService.js',
    'src/services/texUltraFunnelService.js',
    'src/services/texUltraInitialLayerService.js',
    'src/services/vslProductAssignmentService.js',
    'src/whatsapp/sessionRouter.js',
    'tests/ec-direct-product-name-v39.test.mjs',
    'tests/meta-attribution-bridge.test.mjs',
    'tests/whatsapp-chats-readonly.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_EC_MULTIPRODUCT_CORE_V48_20260822.txt',
    'docs/EC_MULTIPRODUCT_CORE_FREEZE_V48_20260822.md',
    'scripts/assert-ec-multiproduct-core-activation-approved-v48.mjs',
    'scripts/audit-repair-ec-multiproduct-v48.mjs',
    'scripts/guard-ec-multiproduct-core-v48.mjs',
    'src/services/customerNameResolutionService.js',
    'src/services/ecMultiproductCoreFreezeRuntimeGuardV48.js',
    'src/services/panelAuditIdempotencyService.js',
    'tests/ec-multiproduct-core-v48.test.mjs'
];
const expectedProtectedFiles = [...declaredAncestorOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();

if (
    sha256(parentManifestPath) !== parentManifestSha256
    || manifest.freezeId !== 'ec-multiproduct-core-v48-20260822'
    || manifest.parentFreezeId !== 'ec-repurchase-sqlite-serialization-v47-20260822'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'implementation_test_and_transactional_activation_approved'
    || manifest.policy?.productInAssignedAgentAllowed !== false
    || manifest.policy?.unknownProductDefaultsToVitPower !== false
    || manifest.policy?.vslOriginImmutable !== true
    || manifest.policy?.manualProductOverridePreserved !== true
    || manifest.policy?.auditWriteOnReadAllowed !== false
    || manifest.policy?.realCanaryAuthorized !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[EC-MULTIPRODUCT-V48] manifesto ou política inválida; startup bloqueado.');
}

globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = manifest.declaredAncestorOverrides || [];
try {
    await import('./ecRepurchaseSqliteSerializationFreezeRuntimeGuardV47.js');
} finally {
    delete globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES;
}

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[EC-MULTIPRODUCT-V48] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[EC-MULTIPRODUCT-V48] separação produto/agente, nomes e auditoria idempotente validadas.');
