import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/deploy-helper-v71-chain-alignment-safety-v72-20260827.json';
const parentManifestPath = 'docs/freeze/strict-read-only-observation-safety-v71-20260827.json';
const parentManifestSha256 = '9321d038b53eaa5148c37fc6662d184a95e6b7fd8e623488b8f54a011df8de86';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'ops/vitalismen-stage',
    'package.json',
    'scripts/deploy-vps-ready.mjs',
    'scripts/guard-vitalismen-stage-v66.mjs',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'tests/deploy-publication-attestation-safety-v70.test.mjs'
];
const newProtectedFiles = [
    'docs/DEPLOY_HELPER_V71_CHAIN_ALIGNMENT_SAFETY_FREEZE_V72_20260827.md',
    'scripts/guard-deploy-helper-v71-chain-alignment-safety-v72.mjs',
    'scripts/lib/deploy-helper-v71-chain-alignment-contract-v72.mjs',
    'src/services/deployHelperV71ChainAlignmentSafetyFreezeGuardV72.js',
    'tests/deploy-helper-v71-chain-alignment-v72.test.mjs'
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
    || manifest.freezeId !== 'deploy-helper-v71-chain-alignment-safety-v72'
    || manifest.parentFreezeId !== 'strict-read-only-observation-safety-v71'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_push_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/deployHelperV71ChainAlignmentSafetyFreezeGuardV72.js'
    || manifest.policy?.freezeVersion !== 72
    || manifest.policy?.deployHelperContractVersion !== 72
    || manifest.policy?.runtimeGuardChainVersion !== 71
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.stageRuntimeGuardCommand !== 'npm run guard:runtime-chain-v71'
    || manifest.policy?.stagePredeployCommand !== 'npm run guard:predeploy-v71'
    || manifest.policy?.predeployValidated !== 'v71'
    || manifest.policy?.safeObservationPolicy !== 'STRICT_READ_ONLY'
    || JSON.stringify(manifest.policy?.allowedWriteClasses) !== '[]'
    || manifest.policy?.v70PreservedAsImmutableAncestor !== true
    || manifest.policy?.v71PreservedAsImmutableParent !== true
    || manifest.policy?.v71Commit !== '35b9f704aa8186b79cfffb3e54fbbf73ad63336c'
    || manifest.policy?.v71Tree !== '6e29ee3d5736a3bb3cbf8fc1b8b5699c115416a4'
    || manifest.policy?.v71HelperSha256 !== 'dbbdc1283617b36fc51f305d75d0bc41fb1e2431179451a50d8e953265b80571'
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || manifest.policy?.helperInstallAuthorized !== false
    || manifest.policy?.stagingAuthorized !== false
    || manifest.policy?.publicationAuthorized !== false
    || manifest.policy?.activationAuthorized !== false
    || manifest.policy?.productionMutationExecuted !== false
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[DEPLOY-HELPER-V71-CHAIN-ALIGNMENT-SAFETY-V72] manifesto, ancestralidade ou política inválida; execução bloqueada.');

const successorOverrides = new Set(getSuccessorOverrideFiles());
await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./strictReadOnlyObservationSafetyFreezeRuntimeGuardV71.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[DEPLOY-HELPER-V71-CHAIN-ALIGNMENT-SAFETY-V72] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[DEPLOY-HELPER-V71-CHAIN-ALIGNMENT-SAFETY-V72] helper/freeze V72 materializa runtime V71 e dados V66; STRICT_READ_ONLY preservado; nenhum efeito operacional autorizado.');
