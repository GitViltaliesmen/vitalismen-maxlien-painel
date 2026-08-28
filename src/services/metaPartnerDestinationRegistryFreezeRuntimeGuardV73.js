import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/meta-partner-destination-registry-v73-20260828.json';
const parentManifestPath = 'docs/freeze/deploy-helper-v71-chain-alignment-safety-v72-20260827.json';
const parentManifestSha256 = 'd6f2ea30ebec4365f3df9e99de655e6a4b5dae45dcfa25a085451ad45fd13ffd';
const declaredAncestorOverrides = [
    '.env.example',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'public/n/index.html',
    'scripts/guard-deploy-helper-v71-chain-alignment-safety-v72.mjs',
    'scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs',
    'scripts/senior-guard.mjs',
    'src/routes/health.js',
    'src/routes/leads.js',
    'src/routes/whatsapp.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/metaConversionsService.js'
];
const newProtectedFiles = [
    'docs/INCIDENTE_502_RECOVERY_V72_20260828.md',
    'docs/META_PARTNER_ACCOUNT_RUNBOOK_20260828.md',
    'docs/META_PARTNER_DESTINATION_REGISTRY_FREEZE_V73_20260828.md',
    'scripts/guard-meta-partner-destination-registry-v73.mjs',
    'scripts/manage-meta-destinations-v73.mjs',
    'src/services/metaDestinationRegistryService.js',
    'src/services/metaPartnerDestinationRegistryFreezeRuntimeGuardV73.js',
    'tests/meta-partner-destination-registry-v73.test.mjs'
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
    || manifest.freezeId !== 'meta-partner-destination-registry-v73'
    || manifest.parentFreezeId !== 'deploy-helper-v71-chain-alignment-safety-v72'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_implicit_meta_change'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/metaPartnerDestinationRegistryFreezeRuntimeGuardV73.js'
    || manifest.policy?.featureContractVersion !== 73
    || manifest.policy?.deployHelperFreezeVersion !== 72
    || manifest.policy?.deployHelperContractVersion !== 72
    || manifest.policy?.runtimeGuardChainVersion !== 71
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.registrySchemaVersion !== 1
    || manifest.policy?.safeObservationPolicy !== 'STRICT_READ_ONLY'
    || JSON.stringify(manifest.policy?.allowedWriteClasses) !== '[]'
    || manifest.policy?.browserServerDatasetMustMatch !== true
    || manifest.policy?.activeProfileImmutable !== true
    || manifest.policy?.partnerPlanUsesActiveProfile !== true
    || manifest.policy?.partnerShareRequiresRuntimeChange !== false
    || manifest.policy?.staleActivationBlocked !== true
    || manifest.policy?.concurrentMutationLock !== true
    || manifest.policy?.registryAndSecretsRoot0600 !== true
    || manifest.policy?.publicRegistryUnknownFieldsBlocked !== true
    || manifest.policy?.malformedBindingFailsClosed !== true
    || manifest.policy?.vslEntryBindingPropagation !== true
    || manifest.policy?.publicEndpointUsesExistingNginxProxy !== true
    || manifest.policy?.seniorGuardProtocolExceptionScoped !== true
    || manifest.policy?.metaServerTokenFrontendExposureAllowed !== false
    || manifest.policy?.metaEventValidationAllowed !== false
    || manifest.policy?.protocoloGDatasetLocked !== '2048099902484149'
    || manifest.policy?.legacyEcDatasetPreserved !== '1468946114265008'
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || manifest.policy?.productionMutationExecuted !== false
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[META-PARTNER-DESTINATION-REGISTRY-V73] manifesto, ancestralidade ou política inválida; execução bloqueada.');

const successorOverrides = new Set(getSuccessorOverrideFiles());
await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./deployHelperV71ChainAlignmentSafetyFreezeGuardV72.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[META-PARTNER-DESTINATION-REGISTRY-V73] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[META-PARTNER-DESTINATION-REGISTRY-V73] Browser/CAPI atômicos; parceiro compartilha Dataset existente; V72/V71/V66 preservados; nenhum evento Meta autorizado.');
