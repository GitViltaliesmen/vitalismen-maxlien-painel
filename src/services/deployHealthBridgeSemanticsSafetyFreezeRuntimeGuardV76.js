import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    assertDeployHealthBridgeSemanticsV76,
    assertDeployHealthRuntimeContainmentV76,
    assertDeployHelperBridgeSemanticsSourceV76,
    DEPLOY_HEALTH_V76_EXPECTED_RUNTIME_ENV,
    DEPLOY_HEALTH_V76_EXPECTED_SAFETY
} from '../../scripts/lib/deploy-health-bridge-semantics-contract-v76.mjs';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/deploy-health-bridge-semantics-v76-20260828.json';
const parentManifestPath = 'docs/freeze/canary-isolation-safety-v75-20260828.json';
const parentManifestSha256 = '56551c343f24591f6b76dd7a01fe89736d2f43b59d0b51e7701887bc8d377ffb';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'ops/vitalismen-stage',
    'package.json',
    'scripts/guard-canary-isolation-v75.mjs',
    'scripts/guard-deploy-helper-v71-chain-alignment-safety-v72.mjs',
    'scripts/guard-meta-partner-destination-registry-v73.mjs',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js'
];
const newProtectedFiles = [
    'docs/DEPLOY_HEALTH_BRIDGE_SEMANTICS_FREEZE_V76_20260828.md',
    'scripts/guard-deploy-health-bridge-semantics-v76.mjs',
    'scripts/lib/deploy-health-bridge-semantics-contract-v76.mjs',
    'src/services/deployHealthBridgeSemanticsSafetyFreezeRuntimeGuardV76.js',
    'tests/deploy-health-bridge-semantics-v76.test.mjs'
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
    || manifest.freezeId !== 'deploy-health-bridge-semantics-v76'
    || manifest.parentFreezeId !== 'canary-isolation-safety-v75'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.parentV75Commit !== '0950a303c24782cf9a3f47eda93890e69e6d3a85'
    || manifest.parentV75Tree !== '68bf52575c6e3f5bc3f972af62b0333fb0fef754'
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_push_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/deployHealthBridgeSemanticsSafetyFreezeRuntimeGuardV76.js'
    || manifest.policy?.contractVersion !== 76
    || manifest.policy?.runtimeGuardChainVersion !== 71
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.persistentBridgeCompleteRequired !== true
    || manifest.policy?.operationalBridgeReady !== false
    || manifest.policy?.mutationsEnabled !== false
    || manifest.policy?.mutatingSchedulers !== 0
    || manifest.policy?.dropiMode !== 'REPORT_ONLY'
    || manifest.policy?.dropiApplyAllowed !== false
    || manifest.policy?.providerAllowed !== false
    || manifest.policy?.metaAllowed !== false
    || manifest.policy?.productionMutationExecuted !== false
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[DEPLOY-HEALTH-BRIDGE-SEMANTICS-V76] manifesto, ancestralidade ou política inválida; execução bloqueada.');

const successorOverrides = new Set(getSuccessorOverrideFiles());
await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./canaryIsolationSafetyFreezeRuntimeGuardV75.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[DEPLOY-HEALTH-BRIDGE-SEMANTICS-V76] alteração não autorizada em ${relativePath}.`);
    }
}

assertDeployHelperBridgeSemanticsSourceV76(fs.readFileSync(absolute('ops/vitalismen-stage'), 'utf8'));
assertDeployHealthBridgeSemanticsV76({
    status: 'online',
    degradedReasons: [],
    automationSafety: {
        ...DEPLOY_HEALTH_V76_EXPECTED_SAFETY,
        allowedWriteClasses: []
    }
});
assertDeployHealthRuntimeContainmentV76({ ...DEPLOY_HEALTH_V76_EXPECTED_RUNTIME_ENV });

console.log('[DEPLOY-HEALTH-BRIDGE-SEMANTICS-V76] V76 → V75 → V74 → V73 → V72 → V71 íntegra; migração persistente V66 concluída não habilita bridge operacional, writes, schedulers, provider, Dropi ou Meta.');
