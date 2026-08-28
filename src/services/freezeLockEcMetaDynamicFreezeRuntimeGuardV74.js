import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    assertFreezeLockEcMetaDynamicV74,
    loadFreezeLockEcMetaDynamicV74Workspace
} from '../../scripts/lib/freeze-lock-ec-meta-dynamic-v74-contract.mjs';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/freeze-lock-ec-meta-dynamic-v74-20260828.json';
const parentManifestPath = 'docs/freeze/meta-partner-destination-registry-v73-20260828.json';
const parentManifestSha256 = 'f3892d723313493b9a3ecd88cba0635e912d8c7a3a7fc954ff3cd8cbc9cdb836';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'scripts/guard-deploy-helper-v71-chain-alignment-safety-v72.mjs',
    'scripts/guard-meta-partner-destination-registry-v73.mjs',
    'scripts/guard-protocolo-g-ad-metrics-v63.mjs',
    'scripts/guard-protocolo-g-conversion-v62.mjs',
    'scripts/senior-guard.mjs',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js'
];
const immutableLegacyFiles = [
    'FREEZE_LOCK_EC.json',
    'docs/META_PARTNER_DESTINATION_REGISTRY_FREEZE_V73_20260828.md',
    'docs/freeze/meta-partner-destination-registry-v73-20260828.json',
    'ops/vitalismen-stage'
];
const newProtectedFiles = [
    'FREEZE_LOCK_EC_V74.json',
    'docs/FREEZE_LOCK_EC_META_DYNAMIC_V74_20260828.md',
    'scripts/guard-freeze-lock-ec-meta-dynamic-v74.mjs',
    'scripts/guard-freeze-lock-ec.mjs',
    'scripts/lib/freeze-lock-ec-meta-dynamic-v74-contract.mjs',
    'src/services/freezeLockEcMetaDynamicFreezeRuntimeGuardV74.js',
    'tests/freeze-lock-ec-meta-dynamic-v74.test.mjs'
];

const absolute = (relativePath) => path.join(root, relativePath);
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(absolute(relativePath)))
    .digest('hex');
const manifest = JSON.parse(fs.readFileSync(absolute(manifestPath), 'utf8'));
const expectedProtectedFiles = [...declaredAncestorOverrides, ...immutableLegacyFiles, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();

if (
    sha256(parentManifestPath) !== parentManifestSha256
    || manifest.freezeId !== 'freeze-lock-ec-meta-dynamic-v74'
    || manifest.parentFreezeId !== 'meta-partner-destination-registry-v73'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.parentV73Commit !== '6c759973f2d4de3f49bf8157a5a449b8aba4e894'
    || manifest.parentV73Tree !== '545089287546a4c51ad58cc93690014297a29a4c'
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_push_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/freezeLockEcMetaDynamicFreezeRuntimeGuardV74.js'
    || manifest.policy?.contractVersion !== 74
    || manifest.policy?.featureContractVersion !== 73
    || manifest.policy?.deployHelperFreezeVersion !== 72
    || manifest.policy?.runtimeGuardChainVersion !== 71
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.legacyFreezePreserved !== true
    || manifest.policy?.authorizedLegacyOverrideCount !== 3
    || manifest.policy?.dynamicDestinationRequired !== true
    || manifest.policy?.browserCapiDatasetEqualityRequired !== true
    || manifest.policy?.currentEcDatasetId !== '1468946114265008'
    || manifest.policy?.lockedSecondaryDatasetId !== '2048099902484149'
    || manifest.policy?.leadOnceAndEventIdDedupRequired !== true
    || manifest.policy?.duplicatePurchasePathsAllowed !== false
    || manifest.policy?.publicEndpointRedacted !== true
    || manifest.policy?.bindingHmacMaximumLifetimeHours !== 6
    || manifest.policy?.registryAndSecretsRoot0600OutsideRelease !== true
    || manifest.policy?.metaFunctionalFilesChanged !== false
    || manifest.policy?.productionMutationExecuted !== false
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.immutableLegacyFiles || [])].sort()) !== JSON.stringify(immutableLegacyFiles)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[FREEZE-LOCK-EC-META-DYNAMIC-V74] manifesto, ancestralidade ou política inválida; execução bloqueada.');

const successorOverrides = new Set(getSuccessorOverrideFiles());
await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./metaPartnerDestinationRegistryFreezeRuntimeGuardV73.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[FREEZE-LOCK-EC-META-DYNAMIC-V74] alteração não autorizada em ${relativePath}.`);
    }
}

assertFreezeLockEcMetaDynamicV74(loadFreezeLockEcMetaDynamicV74Workspace(root));
console.log('[FREEZE-LOCK-EC-META-DYNAMIC-V74] freeze legado intacto; destino dinâmico, igualdade Browser/CAPI, Lead/eventID e Purchase preservados; nenhuma mutação operacional autorizada.');
