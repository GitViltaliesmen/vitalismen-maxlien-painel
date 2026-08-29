import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    EC_BOT_CORE_READINESS_V79_OFFICIAL_VSL_URL,
    assertEcBotCoreReadinessV79,
    buildEcBotCoreReadinessSnapshotV79
} from './ecBotCoreReadinessV79Service.js';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const directEntry = Boolean(process.argv[1])
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
const manifestPath = 'docs/freeze/ec-bot-core-readiness-v79-20260829.json';
const parentManifestPath = 'docs/freeze/ec-bot-core-structural-safety-v78-20260829.json';
const evidencePath = 'docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json';
const attestationPath = 'docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json';
const parentManifestSha256 = '46a9363f203c9e2f4d574e286d2c361b4bd3bb915ee2f0b2398b04af624e12e1';
const parentFreezeSha256 = 'b4fd1275fc7316cf63df103cade6c00ff322ef2b092f5083f79aed3e349039c3';
const evidenceSha256 = '6bff2507362862bb28363f6d2d4637788f59344242d934ccd34a72a79a9bfb2f';
const attestationSha256 = 'a1682f2c975f158bb8e8b39d2fdf0660ae3be294b101fc844261d9da235f8439';
const declaredAncestorOverrides = [];
const newProtectedFiles = [
    'docs/EC_BOT_CORE_READINESS_FREEZE_V79_20260829.md',
    'docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json',
    'docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json',
    'scripts/guard-ec-bot-core-readiness-v79.mjs',
    'scripts/lib/ec-bot-core-readiness-v79-successor-context.mjs',
    'src/services/ecBotCoreReadinessFreezeRuntimeGuardV79.js',
    'src/services/ecBotCoreReadinessV79Service.js',
    'tests/ec-bot-core-readiness-v79.test.mjs'
];

const absolute = (relativePath) => path.join(root, relativePath);
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(absolute(relativePath)))
    .digest('hex');
const readCanonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(absolute(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) throw new Error(`${label}_not_canonical`);
    return value;
};

if (!fs.existsSync(absolute(manifestPath))) {
    throw new Error('[EC-BOT-CORE-READINESS-V79] manifesto V79 ausente; execução bloqueada.');
}

const manifest = readCanonicalJson(manifestPath, 'v79_manifest');
const evidence = readCanonicalJson(evidencePath, 'v79_evidence');
const attestation = readCanonicalJson(attestationPath, 'v79_attestation');
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
    || sha256('docs/EC_BOT_CORE_STRUCTURAL_SAFETY_FREEZE_V78_20260829.md') !== parentFreezeSha256
    || sha256(evidencePath) !== evidenceSha256
    || sha256(attestationPath) !== attestationSha256
    || manifest.freezeId !== 'ec-bot-core-readiness-v79'
    || manifest.version !== 79
    || manifest.parentVersion !== 'V78'
    || manifest.parentFreezeId !== 'ec-bot-core-structural-safety-v78'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.parentFreezeSha256 !== parentFreezeSha256
    || manifest.parentCommit !== '9a17abbe6546819f25885541a86f0cca7be1bc7b'
    || manifest.parentTree !== 'a2d39450f790a3516ddfaed3babc1250927bb77b'
    || manifest.status !== 'attested_ready'
    || manifest.publicationStatus !== 'local_commit_only_no_push_no_tag_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/ecBotCoreReadinessFreezeRuntimeGuardV79.js'
    || manifest.policy?.profile !== 'EC_BOT_CORE_OPERATIONAL'
    || manifest.policy?.runtimeGuardChainVersion !== 71
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.datasetId !== '1468946114265008'
    || manifest.policy?.activeDestinationSource !== 'legacy_env'
    || manifest.policy?.browserServerSynchronized !== true
    || manifest.policy?.qaPhone !== '5515998038637'
    || manifest.policy?.qaContext !== 'EC_V78_OFFICIAL_VSL_QA'
    || manifest.policy?.qaUrl !== EC_BOT_CORE_READINESS_V79_OFFICIAL_VSL_URL
    || manifest.policy?.mutatingSchedulersAllowed !== false
    || manifest.policy?.dropiApplyAllowed !== false
    || manifest.policy?.metaPurchaseAllowed !== false
    || manifest.policy?.realCustomerTrafficAuthorized !== false
    || manifest.policy?.vslMetaConfigurationMutationExecuted !== true
    || manifest.policy?.hostingerEcMutationExecuted !== false
    || manifest.policy?.botProductionDeployed !== false
    || manifest.policy?.botActivated !== false
    || manifest.policy?.qaCanaryExecuted !== false
    || manifest.policy?.metaEventsSent !== 0
    || manifest.policy?.colombiaOperationalInfrastructureTouched !== false
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || manifest.resolution?.ctaOriginBlocker !== 'RESOLVED'
    || manifest.resolution?.datasetBlocker !== 'RESOLVED'
    || manifest.resolution?.datasetReconciliation !== 'PASS'
    || manifest.resolution?.vslPublicOriginConformance !== 'PASS'
    || manifest.deployment?.ready !== true
    || (manifest.deployment?.blockers || []).length !== 0
    || manifest.deployment?.requiresExplicitAuthorization !== true
    || manifest.deployment?.authorizedNextStep !== 'CONTROLLED_PUBLICATION_DEPLOYMENT_AND_SINGLE_PHONE_QA_CANARY'
    || manifest.logicalBundle?.algorithm !== 'SHA-256'
    || manifest.logicalBundle?.format !== 'sorted-relative-path-NUL-file-sha256-LF'
    || manifest.logicalBundle?.sha256 !== logicalBundleSha256
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[EC-BOT-CORE-READINESS-V79] manifesto, ancestralidade, evidência ou política inválida; execução bloqueada.');
}

if (
    attestation.status !== 'ATTESTED_READY_FOR_EXPLICITLY_AUTHORIZED_NEXT_STEP'
    || attestation.evidence?.sha256 !== evidenceSha256
    || attestation.dataset?.canonicalSharedDatasetId !== '1468946114265008'
    || attestation.dataset?.browserServerSynchronized !== true
    || attestation.profile?.state !== 'READY'
    || attestation.profile?.mutatingSchedulersDefault !== 'BLOCKED'
    || attestation.profile?.dropiApplyDefault !== 'BLOCKED'
    || attestation.profile?.metaPurchaseDefault !== 'BLOCKED'
    || attestation.deployment?.ready !== true
    || (attestation.deployment?.blockers || []).length !== 0
    || attestation.deployment?.requiresExplicitAuthorization !== true
) {
    throw new Error('[EC-BOT-CORE-READINESS-V79] attestation inválida; execução bloqueada.');
}

const inheritedOverrides = getSuccessorOverrideFiles();
await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js');
});

const inheritedOverrideSet = new Set(inheritedOverrides);
for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (inheritedOverrideSet.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[EC-BOT-CORE-READINESS-V79] alteração não autorizada em ${relativePath}.`);
    }
}

assertEcBotCoreReadinessV79(buildEcBotCoreReadinessSnapshotV79({ manifest, evidence }));

if (directEntry) {
    console.log('[EC-BOT-CORE-READINESS-V79] V79 → V78 → V77H2 → V77H → V77 → V76 → V75 → V74 → V73 → V72 → V71 íntegra; CTA e Dataset reconciliados; publicação/deploy/canário ainda exigem autorização explícita; schedulers, Dropi APPLY e Meta Purchase bloqueados.');
}
