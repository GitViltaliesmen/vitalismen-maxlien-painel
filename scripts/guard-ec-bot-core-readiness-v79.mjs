import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('../src/services/ecBotCoreReadinessFreezeRuntimeGuardV79.js');

import {
    assertEcBotCoreReadinessV79,
    buildEcBotCoreReadinessSnapshotV79
} from '../src/services/ecBotCoreReadinessV79Service.js';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestPath = 'docs/freeze/ec-bot-core-readiness-v79-20260829.json';
const evidencePath = 'docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json';
const attestationPath = 'docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json';
const manifest = json(manifestPath);
const evidence = json(evidencePath);
const attestation = json(attestationPath);
const freeze = read('docs/EC_BOT_CORE_READINESS_FREEZE_V79_20260829.md');
const service = read('src/services/ecBotCoreReadinessV79Service.js');
const successorContext = read('scripts/lib/ec-bot-core-readiness-v79-successor-context.mjs');
const tests = read('tests/ec-bot-core-readiness-v79.test.mjs');

assert.equal(sha256('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json'), '46a9363f203c9e2f4d574e286d2c361b4bd3bb915ee2f0b2398b04af624e12e1');
assert.equal(sha256('docs/EC_BOT_CORE_STRUCTURAL_SAFETY_FREEZE_V78_20260829.md'), 'b4fd1275fc7316cf63df103cade6c00ff322ef2b092f5083f79aed3e349039c3');
assert.equal(manifest.parentCommit, '9a17abbe6546819f25885541a86f0cca7be1bc7b');
assert.equal(manifest.parentTree, 'a2d39450f790a3516ddfaed3babc1250927bb77b');
assert.equal(manifest.parentVersion, 'V78');
assert.equal(manifest.deployment.ready, true);
assert.deepEqual(manifest.deployment.blockers, []);
assert.equal(manifest.deployment.requiresExplicitAuthorization, true);
assert.equal(manifest.policy.datasetId, '1468946114265008');
assert.equal(manifest.policy.mutatingSchedulersAllowed, false);
assert.equal(manifest.policy.dropiApplyAllowed, false);
assert.equal(manifest.policy.metaPurchaseAllowed, false);
assert.equal(manifest.policy.realCustomerTrafficAuthorized, false);
assert.equal(manifest.policy.botProductionDeployed, false);
assert.equal(manifest.policy.botActivated, false);
assert.equal(manifest.policy.qaCanaryExecuted, false);
assert.equal(manifest.policy.metaEventsSent, 0);
assert.equal(manifest.resolution.ctaOriginBlocker, 'RESOLVED');
assert.equal(manifest.resolution.datasetBlocker, 'RESOLVED');

assert.equal(evidence.canonicalDataset.datasetId, '1468946114265008');
assert.equal(evidence.canonicalDataset.status, 'PROVEN');
assert.equal(evidence.classification.mismatchClass, 'VSL_BROWSER_STALE');
assert.equal(evidence.before.vslBrowserDatasetId, '1449537519948374');
assert.equal(evidence.before.ecCapiDatasetId, '1468946114265008');
assert.equal(evidence.before.ecActiveDestinationDatasetId, '1468946114265008');
assert.equal(evidence.before.physicalSharedRegistryPresent, false);
assert.equal(evidence.before.legacyFallbackExplicitlyPreservedByV73, true);
assert.equal(evidence.correction.changedLineCount, 1);
assert.deepEqual(evidence.correction.changedKeys, ['META_PIXEL_ID_PROTOCOLO']);
assert.equal(evidence.correction.secretOrTokenChanged, false);
assert.equal(evidence.correction.secretOrTokenPrinted, false);
assert.equal(evidence.final.browserDatasetId, '1468946114265008');
assert.equal(evidence.final.capiDatasetId, '1468946114265008');
assert.equal(evidence.final.activeDestinationDatasetId, '1468946114265008');
assert.equal(evidence.final.browserServerSynchronized, true);
assert.equal(evidence.final.vslPublicResolverPixelCount, 1);
assert.equal(evidence.staticMetaPaths.capiPurchaseDefinitionCount, 1);
assert.equal(evidence.staticMetaPaths.browserPurchasePathCount, 0);
assert.equal(evidence.staticMetaPaths.leadLogicalFlowCount, 1);
assert.equal(evidence.staticMetaPaths.leadDeduplicatedByEventId, true);
assert.equal(evidence.staticMetaPaths.browserTokenExposed, false);
assert.equal(evidence.staticMetaPaths.metaEventsSent, 0);
assert.equal(evidence.publicCta.httpStatus, 200);
assert.equal(evidence.publicCta.xCloaker, 'allowed');
assert.equal(evidence.publicCta.destinationPhone, '5515991418416');
assert.equal(evidence.publicCta.marker, 'EC-TEX-ULTRA-PROTOCOLO');
assert.equal(evidence.publicCta.changedDuringV79, false);
assert.equal(evidence.futureQa.phone, '5515998038637');
assert.equal(evidence.futureQa.context, 'EC_V78_OFFICIAL_VSL_QA');
assert.equal(evidence.futureQa.permitCreated, false);
assert.equal(evidence.futureQa.canaryExecuted, false);
assert.equal(evidence.isolation.colombiaOperationalInfrastructureTouched, false);
assert.equal(evidence.isolation.hostingerEcMutationExecuted, false);

assert.equal(attestation.evidence.sha256, sha256(evidencePath));
assert.equal(attestation.parent.manifestSha256, '46a9363f203c9e2f4d574e286d2c361b4bd3bb915ee2f0b2398b04af624e12e1');
assert.equal(attestation.parent.freezeSha256, 'b4fd1275fc7316cf63df103cade6c00ff322ef2b092f5083f79aed3e349039c3');
assert.equal(attestation.profile.state, 'READY');
assert.equal(attestation.profile.mutatingSchedulersDefault, 'BLOCKED');
assert.equal(attestation.profile.dropiApplyDefault, 'BLOCKED');
assert.equal(attestation.profile.metaPurchaseDefault, 'BLOCKED');

const logicalBundleSha256 = crypto.createHash('sha256').update(
    Object.entries(manifest.protectedFiles)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, fileSha256]) => `${relativePath}\0${fileSha256}\n`)
        .join('')
).digest('hex');
assert.equal(manifest.logicalBundle.sha256, logicalBundleSha256);
assert.equal(Object.keys(manifest.protectedFiles).length, 8);
assert.match(successorContext, /__VITALISMEN_SUCCESSOR_OVERRIDE_FILES/);
assert.match(successorContext, /v78\.declaredAncestorOverrides/);
assert.match(successorContext, /v79\.declaredAncestorOverrides/);
assert.doesNotMatch(successorContext, /child_process|spawn|execFile|execSync/);

const snapshot = buildEcBotCoreReadinessSnapshotV79({ manifest, evidence });
assert.equal(assertEcBotCoreReadinessV79(snapshot).ok, true);

for (const proof of [
    'CTA voltar para outro número',
    'marcador oficial da CTA desaparecer',
    'Browser Dataset mudar',
    'CAPI Dataset mudar',
    'registry divergir',
    'browserServerSynchronized for falso',
    'segundo Pixel for introduzido',
    'token aparecer no Browser',
    'deployment.ready coexistir com blocker',
    'Dropi Apply for ligado',
    'scheduler mutante for ligado',
    'Meta Purchase for liberado',
    'infraestrutura operacional colombiana for referenciada'
]) assert.match(tests, new RegExp(proof, 'i'));

for (const document of [freeze, service]) {
    assert.match(document, /1468946114265008/);
    assert.match(document, /5515998038637/);
}
for (const document of [read(evidencePath), read(attestationPath)]) {
    assert.doesNotMatch(document, /"(?:accessToken|access_token|appSecret|app_secret|bearer|hmacSecret|hmac_secret)"\s*:/i);
}

console.log('CANONICAL_SHARED_DATASET=1468946114265008');
console.log('DATASET_MISMATCH_CLASS=VSL_BROWSER_STALE');
console.log('DATASET_RECONCILIATION=PASS');
console.log('BROWSER_CAPI_EQUALITY=PASS');
console.log('VSL_PUBLIC_ORIGIN_CONFORMANCE=PASS');
console.log('V78_BYTE_INTACT=YES');
console.log('V79_ATTESTATION=PASS');
console.log('V79_DEPLOYMENT_READY=YES');
console.log('BOT_CORE_ATOMIC_PROFILE=READY');
console.log('MUTATING_SCHEDULERS_DEFAULT=BLOCKED');
console.log('DROPI_APPLY_DEFAULT=BLOCKED');
console.log('META_PURCHASE_DEFAULT=BLOCKED');
console.log('META_EVENTS_SENT=0');
console.log('PRODUCTION_DEPLOYED=NO');
console.log('BOT_ACTIVATED=NO');
console.log('QA_CANARY_EXECUTED=NO');
