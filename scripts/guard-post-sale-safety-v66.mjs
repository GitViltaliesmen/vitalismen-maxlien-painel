import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const manifest = json('docs/freeze/post-sale-safety-v66-20260826.json');
const v65Manifest = json('docs/freeze/post-sale-gargalos-v65-20260826.json');
const v64Manifest = json('docs/freeze/dropi-customer-full-name-v64-20260826.json');
const packageJson = json('package.json');
const safety = read('src/services/postSaleSafetyV66Service.js');
const decision = read('src/services/postSaleNotificationDecisionService.js');
const dispatcher = read('src/services/guidePrintDispatcherService.js');
const shipmentMessage = read('src/services/shipmentMessageService.js');
const scheduler = read('src/services/schedulerService.js');
const startup = read('src/index.js');
const sync = read('src/services/droppiEcuadorBrowserService.js');
const bridge = read('scripts/reconcile-post-sale-safety-v66.mjs');
const compatibility = read('scripts/assert-post-sale-data-compatibility-v66.mjs');
const deploy = read('scripts/deploy-vps-ready.mjs');
const tests = read('tests/post-sale-safety-v66.test.mjs');
const fixture = read('tests/fixtures/post-sale-safety-v66.json');

assert.equal(manifest.freezeId, 'post-sale-safety-v66-20260826');
assert.equal(manifest.parentFreezeId, 'post-sale-gargalos-v65-20260826');
assert.equal(manifest.parentManifestSha256, sha256('docs/freeze/post-sale-gargalos-v65-20260826.json'));
assert.equal(v65Manifest.parentFreezeId, v64Manifest.freezeId);
assert.equal(manifest.status, 'implementation_validated');
assert.equal(manifest.publicationStatus, 'release_candidate_local_no_deploy');
assert.equal(manifest.policy.deployAuthorized, false);
assert.equal(manifest.policy.whatsappSendAuthorized, false);
assert.equal(manifest.policy.dropiApplyAuthorized, false);
assert.equal(manifest.policy.productionMutationExecuted, false);
assert.equal(manifest.policy.startupMutationDefault, false);
assert.equal(manifest.policy.dropiDefaultMode, 'REPORT_ONLY');
assert.equal(manifest.policy.dataCompatibilityVersion, 66);
assert.equal(manifest.policy.minimumRuntimeVersionAfterBridge, 66);
assert.equal(manifest.policy.rollbackDataAllowed, false);
assert.equal(manifest.policy.legacyRuntimeAfterBridgeAllowed, false);

for (const stage of ['GUIDE', 'IN_TRANSIT', 'READY_FOR_PICKUP', 'RETURNED']) {
    assert.match(safety, new RegExp(`${stage}: '${stage}'`));
}
for (const variant of ['guide_text', 'guide_pdf', 'guide_print_image']) {
    assert.match(safety, new RegExp(variant));
}
assert.match(safety, /buildPostSaleIdempotencyKey/);
assert.match(safety, /resolvePostSaleOperationalMutationGate/);
assert.match(safety, /mutation_flag_absent_safe_default/);
assert.match(safety, /DROPI_SYNC_MODES/);
assert.match(safety, /REPORT_ONLY/);
assert.match(safety, /runtime_older_than_persistent_data_contract/);
assert.match(decision, /postSaleSafetyLedger/);
assert.match(decision, /legacyMarkerSetForStage/);
assert.match(decision, /completePostSaleNotificationStage/);
assert.match(decision, /failPostSaleNotificationStage/);
assert.match(decision, /persistent_notification_lock_or_marker/);

const centralAt = dispatcher.indexOf('decidePostSaleNotification');
const providerAt = dispatcher.indexOf('notifyGuidePrintImage(locked');
assert.ok(centralAt >= 0 && providerAt > centralAt, 'guide print deve decidir antes da borda de imagem');
assert.match(shipmentMessage, /central_decision_did_not_authorize_send/);
assert.match(shipmentMessage, /central_guide_stage_decision_required/);
assert.match(shipmentMessage, /decision\.idempotencyKey !== expectedIdempotencyKey/);
assert.match(shipmentMessage, /POST_SALE_VARIANTS\.GUIDE_PDF/);
const automaticOutboundFunctionBody = (name, nextName) => shipmentMessage
    .split(`export const ${name}`)[1]
    ?.split(`export const ${nextName}`)[0] || '';
for (const [name, nextName] of [
    ['notifyShipmentGuideGenerated', 'notifyReadyForPickup'],
    ['notifyReadyForPickup', 'notifyShipmentInTransit'],
    ['notifyShipmentInTransit', 'notifyShipmentReminder'],
    ['notifyShipmentReminder', 'notifyShipmentReturned'],
    ['notifyShipmentReturned', 'notifyPickupProofRequest'],
    ['notifyPickupProofRequest', 'notifyPickupBonus'],
    ['notifyPickupBonus', 'processPickupProofSweep'],
    ['notifyTreatmentRefillReminder', 'getPendingShipmentReminders']
]) {
    const body = automaticOutboundFunctionBody(name, nextName);
    assert.match(body, /decidePostSaleNotification/, `${name} precisa da decisão central V66`);
    assert.match(body, /shouldSendPostSaleNotification/, `${name} precisa falhar fechado sem SHOULD_SEND`);
    const decisionAt = body.indexOf('decidePostSaleNotification');
    const providerAt = body.search(/sendShipment(?:Text|Audio|AudioFile|InvoicePdf)\s*\(/);
    assert.ok(providerAt < 0 || providerAt > decisionAt, `${name} alcança provider antes da decisão central`);
}

assert.match(startup, /resolvePostSaleOperationalMutationGate/);
assert.ok(startup.indexOf('if (!mutationGate.allowed)') < startup.indexOf('startScheduler({ compatibilityState })'));
assert.match(scheduler, /nenhum scheduler mutante foi registrado/);
assert.match(scheduler, /resolveDropiSyncMode/);
assert.match(sync, /mode = DROPI_SYNC_MODES\.REPORT_ONLY/);
assert.match(sync, /effectiveMode !== DROPI_SYNC_MODES\.APPLY/);
assert.doesNotMatch(scheduler, /syncActiveDroppiEcuadorOrdersFromPanel\(\{ maxRows \}\)/);

assert.match(bridge, /REPORT_ONLY/);
assert.match(bridge, /I_UNDERSTAND_V66_BRIDGE_NO_REPLAY/);
assert.match(bridge, /realMessagesSent:\s*0/);
assert.match(bridge, /realDropiSubmissions:\s*0/);
assert.ok(
    bridge.indexOf('if (apply && !completeScan)') < bridge.indexOf('for (const shipment of shipments)'),
    'bridge parcial deve falhar antes do primeiro write'
);
assert.match(compatibility, /assertRuntimeSupportsPostSaleData/);
assert.match(compatibility, /ativação\/rollback bloqueado/);
assert.match(compatibility, /--target-metadata=/);
assert.match(compatibility, /Target sem classe postSaleCompatibility V66; ROLLBACK_BLOCKED/);
assert.match(deploy, /requiresRollbackTargetPreflight:\s*true/);
assert.match(deploy, /assert-post-sale-data-compatibility-v66\.mjs --runtime=/);

const testCount = (tests.match(/\btest\('/g) || []).length;
assert.ok(testCount >= 30, `V66 exige no mínimo 30 testes; encontrados ${testCount}`);
for (const control of ['6457', '4818', '9599', '7146', '990287146', '1264']) {
    assert.match(`${tests}\n${fixture}`, new RegExp(control));
}
assert.match(tests, /provider\.count\(\), 0/);
assert.match(tests, /rollback simulation/i);
assert.match(tests, /runtime incompatível/i);
assert.match(tests, /V64 e V65 permanecem ancestrais/);

for (const artifact of [
    'docs/POST_SALE_SAFETY_FREEZE_V66_20260826.md',
    'docs/INCIDENTE_V65_REPLAY_E_STARTUP_20260826.md',
    'docs/POST_SALE_V66_COMPATIBILITY_MATRIX.md',
    'docs/POST_SALE_V66_OUTBOUND_INVENTORY.md'
]) assert.ok(fs.existsSync(artifact), `artefato V66 ausente: ${artifact}`);

assert.match(packageJson.scripts.test, /guard:post-sale-safety-v66/);
assert.match(packageJson.scripts['senior:check'], /post-sale-safety-v66\.test\.mjs/);
assert.match(packageJson.scripts['guard:post-sale-safety-v66'], /guard-post-sale-safety-v66\.mjs/);
assert.match(packageJson.scripts['guard:post-sale-safety-v66'], /post-sale-gargalos-v65\.test\.mjs/);
assert.match(packageJson.scripts['guard:post-sale-safety-v66'], /dropi-customer-full-name-v64\.test\.mjs/);

console.log('POST_SALE_SAFETY_V66_GUARD=OK');
