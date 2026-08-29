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
    parsePm2JlistV77H,
    verifyCandidatePm2CanaryV77H
} from '../../scripts/lib/canary-controller-pm2-stdin-hotfix-v77h-contract.mjs';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/canary-controller-pm2-stdin-hotfix-v77h-20260829.json';
const parentManifestPath = 'docs/freeze/canary-controller-safety-v77-20260828.json';
const parentManifestSha256 = 'd127adb1220afa00ced0c91e0a295304682ae1142901b97d025823688bde85d1';
const parentCommit = '5bedd9154c4ba0b69f0477e059473dcf7012d38a';
const parentTree = '681b6fd3249065e6b745eb346cbc5ff093185d1e';

const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'ops/vitalismen-stage',
    'package.json',
    'scripts/guard-canary-controller-v77.mjs',
    'scripts/guard-canary-isolation-v75.mjs',
    'scripts/guard-deploy-health-bridge-semantics-v76.mjs',
    'scripts/guard-deploy-helper-v71-chain-alignment-safety-v72.mjs',
    'scripts/guard-meta-partner-destination-registry-v73.mjs',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js'
];
const newProtectedFiles = [
    'docs/CANARY_CONTROLLER_PM2_STDIN_HOTFIX_FREEZE_V77H_20260829.md',
    'scripts/guard-canary-controller-pm2-stdin-hotfix-v77h.mjs',
    'scripts/lib/canary-controller-pm2-stdin-hotfix-v77h-contract.mjs',
    'src/services/canaryControllerPm2StdinHotfixSafetyFreezeRuntimeGuardV77H.js',
    'tests/canary-controller-pm2-stdin-hotfix-v77h.test.mjs'
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
    || manifest.freezeId !== 'canary-controller-pm2-stdin-hotfix-v77h'
    || manifest.parentFreezeId !== 'canary-controller-safety-v77'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.parentV77Commit !== parentCommit
    || manifest.parentV77Tree !== parentTree
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_commit_no_push_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/canaryControllerPm2StdinHotfixSafetyFreezeRuntimeGuardV77H.js'
    || manifest.policy?.hotfixVersion !== '77H'
    || manifest.policy?.runtimeGuardChainVersion !== 71
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.qaPhone !== '5515998038637'
    || manifest.policy?.recipientAllowlistCount !== 5
    || manifest.policy?.pm2StdinExclusiveJson !== true
    || manifest.policy?.javascriptFromVersionedFile !== true
    || manifest.policy?.readStdinUntilEof !== true
    || manifest.policy?.externalPm2FingerprintRequired !== true
    || manifest.policy?.canarySemanticsChanged !== false
    || manifest.policy?.productionMutationExecuted !== false
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || manifest.logicalBundle?.algorithm !== 'SHA-256'
    || manifest.logicalBundle?.format !== 'sorted-relative-path-NUL-file-sha256-LF'
    || manifest.logicalBundle?.sha256 !== logicalBundleSha256
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[CANARY-CONTROLLER-PM2-STDIN-HOTFIX-V77H] manifesto, ancestralidade ou política inválida; execução bloqueada.');
}

const successorOverrides = new Set(getSuccessorOverrideFiles());
await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./canaryControllerSafetyFreezeRuntimeGuardV77.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[CANARY-CONTROLLER-PM2-STDIN-HOTFIX-V77H] alteração não autorizada em ${relativePath}.`);
    }
}

const helper = fs.readFileSync(absolute('ops/vitalismen-stage'), 'utf8');
if (
    /"\$pm2_cmd" jlist \| "\$node_cmd" - "\$process_name" "\$canary_v77_overlay" <<'NODE'/.test(helper)
    || !/canary-controller-pm2-stdin-hotfix-v77h-contract\.mjs/.test(helper)
    || !/fingerprint_external_pm2_canary_v77/.test(helper)
) {
    throw new Error('[CANARY-CONTROLLER-PM2-STDIN-HOTFIX-V77H] helper não usa canais PM2/Node isolados.');
}

const now = Date.now();
const fixedHash = 'a'.repeat(64);
const identity = {
    release: '20260829T010000Z_production-20260829-7777777',
    commit: '7777777777777777777777777777777777777777',
    tree: '6666666666666666666666666666666666666666',
    tag: 'production-20260829-7777777'
};
const bundle = buildCanaryControllerV77Bundle({
    ...identity,
    permitId: 'v77h-runtime-guard',
    createdAt: new Date(now).toISOString(),
    permitExpiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
    windowExpiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
    manifestSha256: fixedHash,
    releaseMetadataSha256: fixedHash,
    stagingCompleteSha256: fixedHash,
    publicationMetadataSha256: fixedHash,
    publicationCompleteSha256: fixedHash
});
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
const entries = parsePm2JlistV77H(JSON.stringify([...external, target]));
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
    throw new Error('[CANARY-CONTROLLER-PM2-STDIN-HOTFIX-V77H] verificação sintética PM2 falhou.');
}

console.log('[CANARY-CONTROLLER-PM2-STDIN-HOTFIX-V77H] V77H → V77 → V76 → V75 → V74 → V73 → V72 → V71 íntegra; stdin PM2 exclusivo, leitura até EOF e fingerprint externo fail-closed; nenhuma mutação de produção autorizada.');
