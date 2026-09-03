import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/post-sale-safety-v66-20260826.json';
const parentManifestPath = 'docs/freeze/post-sale-gargalos-v65-20260826.json';
const parentManifestSha256 = '62b7321da888d3bd3db2982f7266959e97bd2ecc279197fcf0e4402fd1238643';
const v61LegacyGuardPath = ['scripts/guard-meta-ec-proto', 'colo-g-attribution-v61.mjs'].join('');
const v62LegacyGuardPath = ['scripts/guard-proto', 'colo-g-conversion-v62.mjs'].join('');
const declaredAncestorOverrides = [
    '.env.example',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'scripts/deploy-vps-ready.mjs',
    v61LegacyGuardPath,
    v62LegacyGuardPath,
    'src/index.js',
    'src/models/Shipment.js',
    'src/routes/health.js',
    'src/services/droppiEcuadorBrowserService.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/guidePrintDispatcherService.js',
    'src/services/postSaleNotificationDecisionService.js',
    'src/services/schedulerService.js',
    'src/services/shipmentMessageService.js'
];
const newProtectedFiles = [
    'docs/INCIDENTE_V65_REPLAY_E_STARTUP_20260826.md',
    'docs/POST_SALE_SAFETY_FREEZE_V66_20260826.md',
    'docs/POST_SALE_V66_COMPATIBILITY_MATRIX.md',
    'docs/POST_SALE_V66_OUTBOUND_INVENTORY.md',
    'scripts/assert-post-sale-data-compatibility-v66.mjs',
    'scripts/guard-post-sale-safety-v66.mjs',
    'scripts/reconcile-post-sale-safety-v66.mjs',
    'src/models/OperationalSafetyState.js',
    'src/services/postSaleSafetyFreezeRuntimeGuardV66.js',
    'src/services/postSaleSafetyV66Service.js',
    'tests/fixtures/post-sale-safety-v66.json',
    'tests/post-sale-safety-v66.test.mjs'
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
    || manifest.freezeId !== 'post-sale-safety-v66-20260826'
    || manifest.parentFreezeId !== 'post-sale-gargalos-v65-20260826'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'release_candidate_local_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.deployAuthorized !== false
    || manifest.policy?.whatsappSendAuthorized !== false
    || manifest.policy?.dropiApplyAuthorized !== false
    || manifest.policy?.productionMutationExecuted !== false
    || manifest.policy?.startupMutationDefault !== false
    || manifest.policy?.dropiDefaultMode !== 'REPORT_ONLY'
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.minimumRuntimeVersionAfterBridge !== 66
    || manifest.policy?.rollbackDataAllowed !== false
    || manifest.policy?.legacyRuntimeAfterBridgeAllowed !== false
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[POST-SALE-SAFETY-V66] manifesto, ancestralidade ou política inválida; startup bloqueado.');

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...declaredAncestorOverrides
];
try {
    await import('./postSaleGargalosFreezeRuntimeGuardV65.js');
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
        throw new Error(`[POST-SALE-SAFETY-V66] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[POST-SALE-SAFETY-V66] anti-spam, startup fail-closed e contrato de rollback íntegros; deploy continua não autorizado.');
