import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/runtime-guard-chain-v67-20260826.json';
const parentManifestPath = 'docs/freeze/post-sale-safety-v66-20260826.json';
const parentManifestSha256 = 'f00afd694d897bfc5d92da69c173bd834612319250b32909b578765b608d2cb9';
const v63LegacyGuardPath = ['scripts/guard-proto', 'colo-g-ad-metrics-v63.mjs'].join('');
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'scripts/deploy-vps-ready.mjs',
    'scripts/guard-baileys-libsignal-security-v59.mjs',
    'scripts/guard-dropi-customer-full-name-v64.mjs',
    'scripts/guard-panel-customer-alias-repair-v57.mjs',
    'scripts/guard-panel-customer-form-persistence-v55.mjs',
    'scripts/guard-panel-customer-residual-repair-v56.mjs',
    'scripts/guard-panel-customer-selection-isolation-v51.mjs',
    'scripts/guard-panel-manual-edit-persistence-v50.mjs',
    'scripts/guard-panel-media-persistence-v52.mjs',
    'scripts/guard-panel-tex-ultra-bottle-block-v58.mjs',
    'scripts/guard-pickup-bonus-delivery-v60.mjs',
    'scripts/guard-post-sale-gargalos-v65.mjs',
    'scripts/guard-post-sale-health-v53.mjs',
    v63LegacyGuardPath,
    'scripts/guard-tex-ultra-delivery-closure-v54.mjs',
    'scripts/guard-whatsapp-outage-recovery-v49.mjs',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'docs/GUARD_CHAIN_SEMANTICS_FREEZE_V67_20260826.md',
    'ops/vitalismen-stage',
    'scripts/guard-runtime-chain-v67.mjs',
    'scripts/guard-vitalismen-stage-v66.mjs',
    'src/services/runtimeGuardChainFreezeRuntimeGuardV67.js',
    'src/services/successorGuardContextService.js',
    'tests/runtime-guard-chain-v67.test.mjs',
    'tests/vitalismen-stage-v66.test.mjs'
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
    || manifest.freezeId !== 'runtime-guard-chain-v67-20260826'
    || manifest.parentFreezeId !== 'post-sale-safety-v66-20260826'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/runtimeGuardChainFreezeRuntimeGuardV67.js'
    || manifest.policy?.rawAncestorGuardOnSuccessorTreeValid !== false
    || manifest.policy?.ancestorIntegrityValidatedInSuccessorContext !== true
    || manifest.policy?.successorContextReconstructedPerProcess !== true
    || manifest.policy?.childProcessInheritsContext !== false
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || manifest.policy?.v66SafetyPreserved !== true
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.pm2StartAuthorized !== false
    || manifest.policy?.productionMutationExecuted !== false
    || manifest.policy?.whatsappSendAuthorized !== false
    || manifest.policy?.dropiApplyAuthorized !== false
    || manifest.policy?.helperInstallAuthorized !== false
    || manifest.policy?.stagingAuthorized !== false
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[RUNTIME-GUARD-CHAIN-V67] manifesto, ancestralidade ou política inválida; execução bloqueada.');

const inheritedSuccessorOverrides = getSuccessorOverrideFiles();
const successorOverrides = new Set(inheritedSuccessorOverrides);

await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./postSaleSafetyFreezeRuntimeGuardV66.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[RUNTIME-GUARD-CHAIN-V67] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[RUNTIME-GUARD-CHAIN-V67] contexto sucessor reconstruído, V47–V66 íntegros e falhas ancestrais fail-closed; produção não autorizada.');
