import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
    buildCanaryControllerV77Bundle
} from '../../scripts/lib/canary-controller-contract-v77.mjs';
import {
    CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_CWD,
    CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_EXEC,
    calculatePm2ExternalFingerprintV77H,
    verifyCandidatePm2CanaryV77H
} from '../../scripts/lib/canary-controller-pm2-stdin-hotfix-v77h-contract.mjs';
import {
    resolveCanaryV75Configuration
} from './canaryIsolationV75Service.js';
import {
    resolvePostSaleOperationalMutationGate
} from './postSaleSafetyV66Service.js';
import {
    resolveStrictReadOnlyObservation
} from './strictReadOnlyObservationService.js';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/canary-controller-health-policy-reset-v77h2-20260829.json';
const parentManifestPath = 'docs/freeze/canary-controller-pm2-stdin-hotfix-v77h-20260829.json';
const parentManifestSha256 = '9c5becbc3db759d7d01b56333e5dea99df615d3ad31c8bcd5b75533f2bdb54c0';
const parentCommit = '23c81c762d58108307860d53770805acbd0e0ba8';
const parentTree = '2c40ec813cf70bb200f7d12d6ebc31443b664f6d';
const preservedHelperSha256 = 'ff3d9c5ac129a98902b12ecda443cf97876b32142561ad46c70f3540c87c5853';

const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'scripts/guard-canary-controller-pm2-stdin-hotfix-v77h.mjs',
    'scripts/guard-canary-controller-v77.mjs',
    'scripts/guard-canary-isolation-v75.mjs',
    'scripts/guard-deploy-health-bridge-semantics-v76.mjs',
    'scripts/guard-deploy-helper-v71-chain-alignment-safety-v72.mjs',
    'scripts/guard-meta-partner-destination-registry-v73.mjs',
    'scripts/lib/canary-controller-contract-v77.mjs',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js'
];
const newProtectedFiles = [
    'docs/CANARY_CONTROLLER_HEALTH_POLICY_RESET_FREEZE_V77H2_20260829.md',
    'scripts/guard-canary-controller-health-policy-reset-v77h2.mjs',
    'src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js',
    'tests/canary-controller-health-policy-reset-v77h2.test.mjs'
];

const absolute = (relativePath) => path.join(root, relativePath);
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(absolute(relativePath)))
    .digest('hex');
const manifest = JSON.parse(fs.readFileSync(absolute(manifestPath), 'utf8'));
const expectedProtectedFiles = [...declaredAncestorOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
const logicalBundleSha256 = crypto.createHash('sha256').update(
    Object.entries(manifest.protectedFiles || {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, fileSha256]) => `${relativePath}\0${fileSha256}\n`)
        .join('')
).digest('hex');

if (
    sha256(parentManifestPath) !== parentManifestSha256
    || manifest.freezeId !== 'canary-controller-health-policy-reset-v77h2'
    || manifest.parentFreezeId !== 'canary-controller-pm2-stdin-hotfix-v77h'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.parentV77HCommit !== parentCommit
    || manifest.parentV77HTree !== parentTree
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_commit_no_push_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js'
    || manifest.policy?.hotfixVersion !== '77H2'
    || manifest.policy?.runtimeGuardChainVersion !== 71
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.qaPhone !== '5515998038637'
    || manifest.policy?.recipientAllowlistCount !== 5
    || manifest.policy?.safeObservationPolicyMaterialized !== true
    || manifest.policy?.safeObservationPolicyValue !== ''
    || manifest.policy?.pm2InheritedStrictOverwritten !== true
    || manifest.policy?.pm2StdinV77HPreserved !== true
    || manifest.policy?.preservedHelperSha256 !== preservedHelperSha256
    || manifest.policy?.helperChanged !== false
    || manifest.policy?.productionMutationExecuted !== false
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || manifest.logicalBundle?.algorithm !== 'SHA-256'
    || manifest.logicalBundle?.format !== 'sorted-relative-path-NUL-file-sha256-LF'
    || manifest.logicalBundle?.sha256 !== logicalBundleSha256
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[CANARY-CONTROLLER-HEALTH-POLICY-RESET-V77H2] manifesto, ancestralidade ou política inválida; execução bloqueada.');
}

const successorOverrides = new Set(getSuccessorOverrideFiles());
await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./canaryControllerPm2StdinHotfixSafetyFreezeRuntimeGuardV77H.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[CANARY-CONTROLLER-HEALTH-POLICY-RESET-V77H2] alteração não autorizada em ${relativePath}.`);
    }
}
if (!successorOverrides.has('ops/vitalismen-stage') && sha256('ops/vitalismen-stage') !== preservedHelperSha256) {
    throw new Error('[CANARY-CONTROLLER-HEALTH-POLICY-RESET-V77H2] helper V77H preservado divergiu.');
}

const now = Date.now();
const fixedHash = 'a'.repeat(64);
const identity = {
    release: '20260829T023000Z_production-20260829-8888888',
    commit: '8888888888888888888888888888888888888888',
    tree: '9999999999999999999999999999999999999999',
    tag: 'production-20260829-8888888'
};
const bundle = buildCanaryControllerV77Bundle({
    ...identity,
    permitId: 'v77h2-runtime-guard',
    createdAt: new Date(now).toISOString(),
    permitExpiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
    windowExpiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
    manifestSha256: fixedHash,
    releaseMetadataSha256: fixedHash,
    stagingCompleteSha256: fixedHash,
    publicationMetadataSha256: fixedHash,
    publicationCompleteSha256: fixedHash
});
const effectiveEnv = { SAFE_OBSERVATION_POLICY: 'STRICT_READ_ONLY', ...bundle.env };
const strict = resolveStrictReadOnlyObservation(effectiveEnv);
const canary = resolveCanaryV75Configuration(effectiveEnv);
const mutations = resolvePostSaleOperationalMutationGate(effectiveEnv, {
    compatibilityState: { bridgeComplete: true, dataCompatibilityVersion: 66, minRuntimeVersion: 66 }
});
if (
    !Object.hasOwn(bundle.env, 'SAFE_OBSERVATION_POLICY')
    || bundle.env.SAFE_OBSERVATION_POLICY !== ''
    || !/^SAFE_OBSERVATION_POLICY=$/m.test(bundle.overlay)
    || effectiveEnv.SAFE_OBSERVATION_POLICY !== ''
    || strict.strictReadOnly !== false
    || !canary.ready
    || !mutations.allowed
) {
    throw new Error('[CANARY-CONTROLLER-HEALTH-POLICY-RESET-V77H2] perfil QA sintético não sobrescreveu a política herdada.');
}

const external = [
    { name: 'external-a', pid: 1, pm2_env: { status: 'online', pm_cwd: '/opt/a', pm_exec_path: '/opt/a/index.js' } },
    { name: 'external-b', pid: 2, pm2_env: { status: 'online', pm_cwd: '/opt/b', pm_exec_path: '/opt/b/index.js' } }
];
const target = {
    name: 'vitalismen-automation',
    pid: 3,
    pm2_env: {
        ...bundle.env,
        status: 'online',
        pm_cwd: CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_CWD,
        pm_exec_path: CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_EXEC
    }
};
const entries = [...external, target];
const externalFingerprint = calculatePm2ExternalFingerprintV77H(entries);
const verified = verifyCandidatePm2CanaryV77H({
    entries,
    overlay: bundle.overlay,
    candidateDir: `/opt/vitalismen-automacao/releases/${identity.release}`,
    procCwd: `/opt/vitalismen-automacao/releases/${identity.release}`,
    expectedExternalFingerprint: externalFingerprint,
    nowMs: now
});
if (!verified.ok || verified.allowlistCount !== 5 || verified.externalFingerprint !== externalFingerprint) {
    throw new Error('[CANARY-CONTROLLER-HEALTH-POLICY-RESET-V77H2] verificador PM2 V77H não foi preservado.');
}

console.log('[CANARY-CONTROLLER-HEALTH-POLICY-RESET-V77H2] V77H2 → V77H → V77 → V76 → V75 → V74 → V73 → V72 → V71 íntegra; política strict herdada sobrescrita por valor vazio somente no perfil QA; helper V77H preservado; nenhuma mutação de produção autorizada.');
