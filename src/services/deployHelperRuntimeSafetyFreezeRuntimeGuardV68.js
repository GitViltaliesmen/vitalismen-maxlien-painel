import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/deploy-helper-runtime-safety-v68-20260827.json';
const parentManifestPath = 'docs/freeze/runtime-guard-chain-v67-20260826.json';
const parentManifestSha256 = 'b945b6a4174bac311b95f0c653b2e5c2ec14e310a22826b0e5f3c89f6f905b7c';
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
    'docs/DEPLOY_HELPER_RUNTIME_SAFETY_FREEZE_V68_20260827.md',
    'scripts/guard-deploy-helper-runtime-safety-v68.mjs',
    'scripts/lib/deploy-helper-contract-v68.mjs',
    'src/services/deployHelperRuntimeSafetyFreezeRuntimeGuardV68.js',
    'tests/deploy-helper-runtime-safety-v68.test.mjs'
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
    || manifest.freezeId !== 'deploy-helper-runtime-safety-v68-20260827'
    || manifest.parentFreezeId !== 'runtime-guard-chain-v67-20260826'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_push_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/deployHelperRuntimeSafetyFreezeRuntimeGuardV68.js'
    || manifest.policy?.runProtectedDefinitions !== 1
    || manifest.policy?.runProtectedCalls !== 17
    || manifest.policy?.definitionBeforeFirstCall !== true
    || manifest.policy?.argumentsPreservedWithoutShellReparse !== true
    || manifest.policy?.stageSyntheticRuntimeTest !== true
    || manifest.policy?.allProtectedCallSitesExercised !== true
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || manifest.policy?.v67PreservedAsImmutableParent !== true
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
) throw new Error('[DEPLOY-HELPER-RUNTIME-SAFETY-V68] manifesto, ancestralidade ou política inválida; execução bloqueada.');

const inheritedSuccessorOverrides = getSuccessorOverrideFiles();
const successorOverrides = new Set(inheritedSuccessorOverrides);

await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./runtimeGuardChainFreezeRuntimeGuardV67.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[DEPLOY-HELPER-RUNTIME-SAFETY-V68] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[DEPLOY-HELPER-RUNTIME-SAFETY-V68] helper executável, stage sintético e cadeia V67→V66 íntegros; produção não autorizada.');
