import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/post-sale-gargalos-v65-20260826.json';
const parentManifestPath = 'docs/freeze/dropi-customer-full-name-v64-20260826.json';
const parentManifestSha256 = '2e0de5487bff72cc36d225a1618ffce2baa62f98ea320ad1c9ad46ea7ebad986';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'docs/AUDITORIA_GARGALOS_POS_VENDA_EC_20260826.md',
    'package.json',
    'public/qr.html',
    'scripts/guard-baileys-libsignal-security-v59.mjs',
    'scripts/guard-dropi-customer-full-name-v64.mjs',
    'scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs',
    'scripts/guard-pickup-bonus-delivery-v60.mjs',
    'scripts/guard-protocolo-g-ad-metrics-v63.mjs',
    'scripts/guard-protocolo-g-conversion-v62.mjs',
    'scripts/senior-guard.mjs',
    'src/index.js',
    'src/models/ContactState.js',
    'src/models/Message.js',
    'src/models/Order.js',
    'src/models/Shipment.js',
    'src/routes/shipments.js',
    'src/routes/whatsapp.js',
    'src/services/conversationEngine.js',
    'src/services/droppiEcuadorBrowserService.js',
    'src/services/droppiEcuadorService.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/shipmentMessageService.js',
    'tests/ec-direct-product-name-v39.test.mjs',
    'tests/panel-sensitive-routes-auth.test.mjs',
    'tests/whatsapp-chats-readonly.test.mjs',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'docs/POST_SALE_GARGALOS_FREEZE_V65_20260826.md',
    'public/panel-intelligence/remote-chat-search-v65.js',
    'scripts/guard-post-sale-gargalos-v65.mjs',
    'scripts/reconcile-post-sale-historical-v65.mjs',
    'src/models/DropiSyncCycle.js',
    'src/services/dropiRejectedReviewResolutionService.js',
    'src/services/dropiShipmentReconciliationService.js',
    'src/services/dropiSyncObservabilityService.js',
    'src/services/panelCustomerReadModelService.js',
    'src/services/panelGlobalCustomerSearchService.js',
    'src/services/postSaleGargalosFreezeRuntimeGuardV65.js',
    'src/services/postSaleNotificationDecisionService.js',
    'tests/fixtures/post-sale-gargalos-v65.json',
    'tests/post-sale-gargalos-v65.test.mjs'
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
    || manifest.freezeId !== 'post-sale-gargalos-v65-20260826'
    || manifest.parentFreezeId !== 'dropi-customer-full-name-v64-20260826'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'release_candidate_local_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.globalSearchReadOnly !== true
    || manifest.policy?.canonicalReadModel !== 'Shipment>Order>customerDraft'
    || manifest.policy?.staleDropiRejectedExactOnly !== true
    || manifest.policy?.historicalReplayAllowed !== false
    || manifest.policy?.ambiguousMatchAllowed !== false
    || manifest.policy?.historicalApplyExecuted !== false
    || manifest.policy?.whatsappSendAuthorized !== false
    || manifest.policy?.dropiSubmitAuthorizedByThisFreeze !== false
    || manifest.policy?.deployAuthorized !== false
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[POST-SALE-GARGALOS-V65] manifesto ou política inválida; startup bloqueado.');

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...declaredAncestorOverrides
];
try {
    await import('./dropiCustomerFullNameFreezeRuntimeGuardV64.js');
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
        throw new Error(`[POST-SALE-GARGALOS-V65] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[POST-SALE-GARGALOS-V65] busca, projeção, anti-spam e reconciliação íntegras; deploy continua não autorizado.');
