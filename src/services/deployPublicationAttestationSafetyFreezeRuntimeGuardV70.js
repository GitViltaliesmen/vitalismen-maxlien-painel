import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/deploy-publication-attestation-safety-v70-20260827.json';
const parentManifestPath = 'docs/freeze/deploy-stage-source-ref-safety-v69-20260827.json';
const parentManifestSha256 = '92d9f0d973cb7488fa736e054c3159544fe49a95cafe1659a2b85ec9ee74b88b';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'ops/vitalismen-stage',
    'package.json',
    'scripts/deploy-vps-ready.mjs',
    'scripts/guard-vitalismen-stage-v66.mjs',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js'
];
const newProtectedFiles = [
    'docs/DEPLOY_PUBLICATION_ATTESTATION_SAFETY_FREEZE_V70_20260827.md',
    'scripts/guard-deploy-publication-attestation-safety-v70.mjs',
    'scripts/lib/deploy-publication-attestation-contract-v70.mjs',
    'src/services/deployPublicationAttestationSafetyFreezeRuntimeGuardV70.js',
    'tests/deploy-publication-attestation-safety-v70.test.mjs'
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
    || manifest.freezeId !== 'deploy-publication-attestation-safety-v70-20260827'
    || manifest.parentFreezeId !== 'deploy-stage-source-ref-safety-v69-20260827'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_push_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/deployPublicationAttestationSafetyFreezeRuntimeGuardV70.js'
    || manifest.policy?.guardChainVersion !== 70
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.publicationStateMachine !== 'CLOSED_TWO_STATE'
    || JSON.stringify(manifest.policy?.allowedPublicationStatuses) !== JSON.stringify(['staged_candidate', 'production_published'])
    || manifest.policy?.sourceMetadataImmutableAfterStaging !== true
    || manifest.policy?.publicationMetadataSeparateAndImmutable !== true
    || manifest.policy?.remoteProductionTagRequiredForPublication !== true
    || manifest.policy?.remoteTagMustResolveToFunctionalCommit !== true
    || manifest.policy?.productionBranchMustRemainUnchanged !== true
    || manifest.policy?.baseEnvBoundToStagingAndPublication !== true
    || manifest.policy?.nodeModulesBoundToStagingAndPublication !== true
    || manifest.policy?.stagedPreflightInvalidAfterPublication !== true
    || manifest.policy?.freshPublishedPreflightRequiredForActivation !== true
    || manifest.policy?.activationPermitRequired !== true
    || manifest.policy?.runProtectedDefinitions !== 1
    || manifest.policy?.runProtectedCalls !== 18
    || manifest.policy?.v69PreservedAsImmutableParent !== true
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || manifest.policy?.pm2ActionsDuringPublication !== 0
    || manifest.policy?.providerCallsDuringPublication !== 0
    || manifest.policy?.dropiCallsDuringPublication !== 0
    || manifest.policy?.helperInstallAuthorized !== false
    || manifest.policy?.stagingAuthorized !== false
    || manifest.policy?.realPublicationAuthorized !== false
    || manifest.policy?.activationAuthorized !== false
    || manifest.policy?.productionMutationExecuted !== false
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[DEPLOY-PUBLICATION-ATTESTATION-SAFETY-V70] manifesto, ancestralidade ou política inválida; execução bloqueada.');

const inheritedSuccessorOverrides = getSuccessorOverrideFiles();
const successorOverrides = new Set(inheritedSuccessorOverrides);

await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./deployStageSourceRefSafetyFreezeRuntimeGuardV69.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[DEPLOY-PUBLICATION-ATTESTATION-SAFETY-V70] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[DEPLOY-PUBLICATION-ATTESTATION-SAFETY-V70] publicação fechada, attestation imutável e ativação vinculada; nenhum efeito operacional autorizado.');
