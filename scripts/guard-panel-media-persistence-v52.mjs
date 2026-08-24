import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/panelMediaPersistenceFreezeRuntimeGuardV52.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const panel = read('public/qr.html');
const whatsapp = read('src/routes/whatsapp.js');
const logistics = read('src/services/logisticsCommunicationV29.js');
const testFile = read('tests/panel-funnel-media-confirmation-v52.test.mjs');
const logisticsTest = read('tests/logistics-clean-chat-v29.test.mjs');
const entryGuard = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const manifest = JSON.parse(read('docs/freeze/panel-media-persistence-v52-20260824.json'));

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.commercialAgencyAudioIsPickupStage, false);
assert.equal(manifest.policy.pickupStageAudioRequiresVerifiedReady, true);
assert.equal(manifest.policy.manualMediaUsesClientGeneratedId, true);
assert.equal(manifest.policy.failedManualMediaDisappearsImmediately, false);
assert.equal(manifest.policy.realClientSendForValidation, false);
assert.equal(manifest.policy.automaticOutboundChanged, false);
assert.match(entryGuard, /panelMediaPersistenceFreezeRuntimeGuardV52\.js/);
assert.match(whatsapp, /isPickupStageAudioCandidate\(\{/);
assert.doesNotMatch(whatsapp, /chegou\|pickup\|retir\|agencia\|ready/);
assert.match(logistics, /PICKUP_STAGE_AUDIO_TOKEN/);
assert.match(panel, /clientGeneratedId:\s*pendingMessage\?\.clientGeneratedId/);
assert.match(panel, /confirmPendingLocalMessage\(pendingMessage\?\._id, result\)/);
assert.match(panel, /markPendingLocalMessageStatus\(pendingMessage\?\._id, 'unconfirmed'/);
assert.match(testFile, /não some quando a API falha/);
assert.match(logisticsTest, /Agradecimento_Agencia_01/);
assert.match(packageJson.scripts.test, /guard:panel-media-v52/);
assert.match(packageJson.scripts['guard:panel-media-v52'], /guard-panel-media-persistence-v52\.mjs/);
assert.match(packageJson.scripts['deploy:v52'], /assert-panel-media-persistence-activation-approved-v52\.mjs/);
assert.match(packageJson.scripts['deploy:v52'], /deploy:vps/);

console.log('PANEL_MEDIA_PERSISTENCE_V52_GUARD=OK');
