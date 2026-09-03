import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/deploy-stage-source-ref-safety-v69-20260827.json';
const parentManifestPath = 'docs/freeze/deploy-helper-runtime-safety-v68-20260827.json';
const parentManifestSha256 = '90c1c19433d5f5a2f358be4c0b7aead6f3d8e81615df8005ea62f9348a0dad1e';
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
    'docs/DEPLOY_STAGE_SOURCE_REF_SAFETY_FREEZE_V69_20260827.md',
    'scripts/guard-deploy-stage-source-ref-safety-v69.mjs',
    'scripts/lib/deploy-stage-source-ref-contract-v69.mjs',
    'src/services/deployStageSourceRefSafetyFreezeRuntimeGuardV69.js',
    'tests/deploy-stage-source-ref-safety-v69.test.mjs'
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
    || manifest.freezeId !== 'deploy-stage-source-ref-safety-v69-20260827'
    || manifest.parentFreezeId !== 'deploy-helper-runtime-safety-v68-20260827'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_push_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/deployStageSourceRefSafetyFreezeRuntimeGuardV69.js'
    || manifest.policy?.runProtectedDefinitions !== 1
    || manifest.policy?.runProtectedCalls !== 18
    || manifest.policy?.authorizedSourceRefPolicy !== 'EXACT_FULL_REF'
    || manifest.policy?.authorizedSourceNamespace !== 'refs/heads/codex/'
    || manifest.policy?.expectedCommitRequired !== true
    || manifest.policy?.expectedTreeRequired !== true
    || manifest.policy?.detachedCheckoutRequired !== true
    || manifest.policy?.productionBranchRequirementForStaging !== false
    || manifest.policy?.productionTagRequirementForStaging !== false
    || manifest.policy?.productionBranchMustRemainUnchanged !== true
    || manifest.policy?.v68PreservedAsImmutableParent !== true
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.minimumRuntimeVersionAfterBridge !== 66
    || manifest.policy?.pm2StartAuthorized !== false
    || manifest.policy?.helperInstallAuthorized !== false
    || manifest.policy?.stagingAuthorized !== false
    || manifest.policy?.productionMutationExecuted !== false
    || manifest.policy?.whatsappSendAuthorized !== false
    || manifest.policy?.dropiApplyAuthorized !== false
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[DEPLOY-STAGE-SOURCE-REF-SAFETY-V69] manifesto, ancestralidade ou política inválida; execução bloqueada.');

const inheritedSuccessorOverrides = getSuccessorOverrideFiles();
const successorOverrides = new Set(inheritedSuccessorOverrides);

await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./deployHelperRuntimeSafetyFreezeRuntimeGuardV68.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[DEPLOY-STAGE-SOURCE-REF-SAFETY-V69] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[DEPLOY-STAGE-SOURCE-REF-SAFETY-V69] ref exata, commit/tree detached e production imutável; publicação não autorizada.');
