import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

import {
    EC_BOT_CORE_READINESS_V79_DATASET_ID,
    EC_BOT_CORE_READINESS_V79_OFFICIAL_MARKER,
    EC_BOT_CORE_READINESS_V79_OFFICIAL_PHONE,
    assertEcBotCoreReadinessV79,
    buildEcBotCoreReadinessSnapshotV79,
    evaluateEcBotCoreReadinessV79
} from '../src/services/ecBotCoreReadinessV79Service.js';

const manifestPath = 'docs/freeze/ec-bot-core-readiness-v79-20260829.json';
const evidencePath = 'docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json';
const attestationPath = 'docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json';
const v78ManifestPath = 'docs/freeze/ec-bot-core-structural-safety-v78-20260829.json';
const v78FreezePath = 'docs/EC_BOT_CORE_STRUCTURAL_SAFETY_FREEZE_V78_20260829.md';
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = json(manifestPath);
const evidence = json(evidencePath);
const attestation = json(attestationPath);
const validSnapshot = () => buildEcBotCoreReadinessSnapshotV79({ manifest, evidence });

test('attestation V79 íntegra libera somente a próxima etapa explicitamente autorizada', () => {
    const snapshot = validSnapshot();
    const result = assertEcBotCoreReadinessV79(snapshot);
    assert.equal(result.ok, true);
    assert.equal(result.deploymentReady, true);
    assert.equal(result.datasetId, EC_BOT_CORE_READINESS_V79_DATASET_ID);
    assert.equal(result.profile, 'EC_BOT_CORE_OPERATIONAL');
    assert.deepEqual(manifest.deployment.blockers, []);
    assert.equal(manifest.deployment.requiresExplicitAuthorization, true);
    assert.equal(snapshot.policy.mutatingSchedulersAllowed, false);
    assert.equal(snapshot.policy.dropiApplyAllowed, false);
    assert.equal(snapshot.policy.metaPurchaseAllowed, false);
    assert.equal(snapshot.policy.realCustomerTrafficAuthorized, false);
});

test('V78 permanece byte-intacta e é o pai exato da V79', () => {
    assert.equal(sha256(v78ManifestPath), '46a9363f203c9e2f4d574e286d2c361b4bd3bb915ee2f0b2398b04af624e12e1');
    assert.equal(sha256(v78FreezePath), 'b4fd1275fc7316cf63df103cade6c00ff322ef2b092f5083f79aed3e349039c3');
    assert.equal(manifest.parentCommit, '9a17abbe6546819f25885541a86f0cca7be1bc7b');
    assert.equal(manifest.parentTree, 'a2d39450f790a3516ddfaed3babc1250927bb77b');
    assert.equal(manifest.parentManifestSha256, sha256(v78ManifestPath));
    assert.equal(evidence.v78.byteIntact, true);
    assert.equal(attestation.parent.byteIntact, true);
});

test('prova reconciliada registra fallback V73 sem inventar registry físico', () => {
    assert.equal(evidence.before.physicalSharedRegistryPresent, false);
    assert.equal(evidence.before.legacyFallbackExplicitlyPreservedByV73, true);
    assert.equal(evidence.final.activeDestinationSource, 'legacy_env');
    assert.equal(evidence.final.browserDatasetId, EC_BOT_CORE_READINESS_V79_DATASET_ID);
    assert.equal(evidence.final.capiDatasetId, EC_BOT_CORE_READINESS_V79_DATASET_ID);
    assert.equal(evidence.final.activeDestinationDatasetId, EC_BOT_CORE_READINESS_V79_DATASET_ID);
    assert.equal(evidence.final.browserServerSynchronized, true);
    assert.equal(evidence.staticMetaPaths.metaEventsSent, 0);
});

test('CTA pública, QA futuro e isolamento permanecem exatos', () => {
    assert.equal(evidence.publicCta.destinationPhone, EC_BOT_CORE_READINESS_V79_OFFICIAL_PHONE);
    assert.equal(evidence.publicCta.marker, EC_BOT_CORE_READINESS_V79_OFFICIAL_MARKER);
    assert.equal(evidence.publicCta.httpStatus, 200);
    assert.equal(evidence.publicCta.xCloaker, 'allowed');
    assert.equal(evidence.futureQa.phone, '5515998038637');
    assert.equal(evidence.futureQa.context, 'EC_V78_OFFICIAL_VSL_QA');
    assert.equal(evidence.futureQa.permitCreated, false);
    assert.equal(evidence.futureQa.canaryExecuted, false);
    assert.equal(evidence.isolation.hostingerEcMutationExecuted, false);
    assert.equal(evidence.isolation.colombiaOperationalInfrastructureTouched, false);
});

const negative = (name, mutate, expectedFailure) => test(name, () => {
    const snapshot = structuredClone(validSnapshot());
    mutate(snapshot);
    const result = evaluateEcBotCoreReadinessV79(snapshot);
    assert.equal(result.ok, false);
    assert.ok(result.failures.includes(expectedFailure), JSON.stringify(result.failures));
    assert.throws(() => assertEcBotCoreReadinessV79(snapshot), /ec_bot_core_readiness_v79_blocked/);
});

negative('falha fechado se CTA voltar para outro número', (snapshot) => {
    snapshot.cta.destinationPhone = '553172220518';
}, 'cta_destination_invalid');

negative('falha fechado se marcador oficial da CTA desaparecer', (snapshot) => {
    snapshot.cta.marker = '';
}, 'cta_marker_invalid');

negative('falha fechado se Browser Dataset mudar', (snapshot) => {
    snapshot.dataset.browser = '1449537519948374';
}, 'browser_dataset_mismatch');

negative('falha fechado se CAPI Dataset mudar', (snapshot) => {
    snapshot.dataset.capi = '1449537519948374';
}, 'capi_dataset_mismatch');

negative('falha fechado se destino ativo equivalente ao registry divergir', (snapshot) => {
    snapshot.dataset.activeDestination = '1449537519948374';
}, 'active_destination_dataset_mismatch');

negative('falha fechado se browserServerSynchronized for falso', (snapshot) => {
    snapshot.dataset.browserServerSynchronized = false;
}, 'browser_server_not_synchronized');

negative('falha fechado se segundo Pixel for introduzido', (snapshot) => {
    snapshot.dataset.resolvedPixelCount = 2;
    snapshot.dataset.secondParallelPixelIntroduced = true;
}, 'parallel_pixel_count_invalid');

negative('falha fechado se token aparecer no Browser', (snapshot) => {
    snapshot.dataset.browserTokenExposed = true;
}, 'browser_token_exposed');

negative('falha fechado se deployment.ready coexistir com blocker', (snapshot) => {
    snapshot.deployment.ready = true;
    snapshot.deployment.blockers.push('SYNTHETIC_BLOCKER');
}, 'deployment_ready_with_blocker');

negative('falha fechado se Dropi Apply for ligado', (snapshot) => {
    snapshot.policy.dropiApplyAllowed = true;
}, 'dropi_apply_enabled');

negative('falha fechado se scheduler mutante for ligado', (snapshot) => {
    snapshot.policy.mutatingSchedulersAllowed = true;
}, 'mutating_scheduler_enabled');

negative('falha fechado se Meta Purchase for liberado', (snapshot) => {
    snapshot.policy.metaPurchaseAllowed = true;
}, 'meta_purchase_enabled');

negative('falha fechado se infraestrutura operacional colombiana for referenciada', (snapshot) => {
    snapshot.isolation.colombiaOperationalInfrastructureReferenced = true;
}, 'colombia_operational_infrastructure_referenced');

test('evidence e attestation são canônicas e não serializam credenciais', () => {
    for (const file of [evidencePath, attestationPath]) {
        const content = fs.readFileSync(file, 'utf8');
        const parsed = JSON.parse(content);
        assert.equal(content, `${JSON.stringify(parsed, null, 2)}\n`);
        assert.doesNotMatch(content, /"(?:accessToken|access_token|appSecret|app_secret|bearer|hmacSecret|hmac_secret)"\s*:/i);
    }
    assert.equal(sha256(evidencePath), attestation.evidence.sha256);
});
