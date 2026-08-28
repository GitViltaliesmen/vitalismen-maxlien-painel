import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    assertCanaryControllerV77Health,
    CANARY_CONTROLLER_V77_BASE_COMMIT,
    CANARY_CONTROLLER_V77_BASE_RELEASE,
    CANARY_CONTROLLER_V77_BASE_TAG,
    CANARY_CONTROLLER_V77_BASE_TREE,
    CANARY_CONTROLLER_V77_MAX_PERMIT_MS,
    CANARY_CONTROLLER_V77_MAX_WINDOW_MS,
    CANARY_CONTROLLER_V77_QA_PHONE,
    resolveCanaryControllerV77Runtime
} from './canaryControllerV77Service.js';
import {
    buildCanaryControllerV77Bundle,
    validateCanaryControllerV77Bundle
} from '../../scripts/lib/canary-controller-contract-v77.mjs';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/canary-controller-safety-v77-20260828.json';
const parentManifestPath = 'docs/freeze/deploy-health-bridge-semantics-v76-20260828.json';
const parentManifestSha256 = 'fa2646f0972b877e54065207a2415a166a4c1a8382545602dcd9c31d399db73b';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'ops/vitalismen-stage',
    'package.json',
    'scripts/guard-canary-isolation-v75.mjs',
    'scripts/guard-deploy-health-bridge-semantics-v76.mjs',
    'scripts/guard-deploy-helper-v71-chain-alignment-safety-v72.mjs',
    'scripts/guard-meta-partner-destination-registry-v73.mjs',
    'src/index.js',
    'src/services/canaryIsolationSafetyFreezeRuntimeGuardV75.js',
    'src/services/canaryIsolationV75Service.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'tests/canary-isolation-v75.test.mjs',
    'tests/deploy-health-bridge-semantics-v76.test.mjs'
];
const newProtectedFiles = [
    'docs/CANARY_CONTROLLER_SAFETY_FREEZE_V77_20260828.md',
    'scripts/guard-canary-controller-v77.mjs',
    'scripts/lib/canary-controller-contract-v77.mjs',
    'src/services/canaryControllerSafetyFreezeRuntimeGuardV77.js',
    'src/services/canaryControllerV77Service.js',
    'tests/canary-controller-v77.test.mjs'
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
    || manifest.freezeId !== 'canary-controller-safety-v77'
    || manifest.parentFreezeId !== 'deploy-health-bridge-semantics-v76'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.parentV76Commit !== CANARY_CONTROLLER_V77_BASE_COMMIT
    || manifest.parentV76Tree !== CANARY_CONTROLLER_V77_BASE_TREE
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_push_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/canaryControllerSafetyFreezeRuntimeGuardV77.js'
    || manifest.policy?.contractVersion !== 77
    || manifest.policy?.runtimeGuardChainVersion !== 71
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.qaPhone !== CANARY_CONTROLLER_V77_QA_PHONE
    || manifest.policy?.recipientAllowlistCount !== 5
    || manifest.policy?.permitMaxMinutes !== 10
    || manifest.policy?.windowMaxMinutes !== 60
    || manifest.policy?.expiryFailClosed !== true
    || manifest.policy?.explicitContainmentRequired !== true
    || manifest.policy?.baselineRelease !== CANARY_CONTROLLER_V77_BASE_RELEASE
    || manifest.policy?.baselineTag !== CANARY_CONTROLLER_V77_BASE_TAG
    || manifest.policy?.providerAllowed !== false
    || manifest.policy?.dropiAllowed !== false
    || manifest.policy?.metaAllowed !== false
    || manifest.policy?.productionMutationExecuted !== false
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || CANARY_CONTROLLER_V77_MAX_PERMIT_MS !== 10 * 60 * 1000
    || CANARY_CONTROLLER_V77_MAX_WINDOW_MS !== 60 * 60 * 1000
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[CANARY-CONTROLLER-SAFETY-V77] manifesto, ancestralidade ou política inválida; execução bloqueada.');

const successorOverrides = new Set(getSuccessorOverrideFiles());
await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./deployHealthBridgeSemanticsSafetyFreezeRuntimeGuardV76.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[CANARY-CONTROLLER-SAFETY-V77] alteração não autorizada em ${relativePath}.`);
    }
}

const now = Date.now();
const fixedHash = 'a'.repeat(64);
const bundle = buildCanaryControllerV77Bundle({
    release: '20260828T220000Z_production-20260828-7777777',
    commit: '7777777777777777777777777777777777777777',
    tree: '6666666666666666666666666666666666666666',
    tag: 'production-20260828-7777777',
    permitId: 'v77-runtime-guard',
    createdAt: new Date(now).toISOString(),
    permitExpiresAt: new Date(now + CANARY_CONTROLLER_V77_MAX_PERMIT_MS).toISOString(),
    windowExpiresAt: new Date(now + CANARY_CONTROLLER_V77_MAX_WINDOW_MS).toISOString(),
    manifestSha256: fixedHash,
    releaseMetadataSha256: fixedHash,
    stagingCompleteSha256: fixedHash,
    publicationMetadataSha256: fixedHash,
    publicationCompleteSha256: fixedHash
});
validateCanaryControllerV77Bundle({
    overlay: bundle.overlay,
    attestation: bundle.attestation,
    permit: bundle.permit,
    nowMs: now
});
const controller = resolveCanaryControllerV77Runtime(bundle.env, { nowMs: now });
if (!controller.ready || controller.qaPhone !== CANARY_CONTROLLER_V77_QA_PHONE) {
    throw new Error('[CANARY-CONTROLLER-SAFETY-V77] perfil sintético V77 inválido.');
}
assertCanaryControllerV77Health({
    status: 'online',
    degradedReasons: [],
    automationSafety: {
        strictReadOnly: false,
        operationalMutationsEnabled: true,
        compatibilityBridgeComplete: true,
        dataCompatibilityVersion: 66,
        minimumRuntimeVersion: 66,
        dropiSyncMode: 'REPORT_ONLY',
        dropiApplyAllowed: false
    }
});

console.log('[CANARY-CONTROLLER-SAFETY-V77] V77 → V76 → V75 → V74 → V73 → V72 → V71 íntegra; permit único, janela temporizada, QA integral e expiração fail-closed; nenhuma mutação de produção autorizada.');
