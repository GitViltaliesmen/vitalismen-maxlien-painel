import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const entryGuard = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const parentGuard = read('src/services/ecMultiproductCoreFreezeRuntimeGuardV48.js');
const bucket = read('src/services/ecConversationBucketService.js');
const health = read('src/routes/health.js');
const manifest = JSON.parse(read('docs/freeze/whatsapp-outage-recovery-v49-20260823.json'));

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.providerSubscriptionChangedByCode, false);
assert.equal(manifest.policy.healthReadOnly, true);
assert.equal(manifest.policy.activeFunnelReplyRouted, true);
assert.equal(manifest.policy.automaticHistoricalReplay, false);
assert.equal(manifest.policy.automaticDropiAuthorization, false);
assert.match(entryGuard, /(?:whatsappOutageRecoveryFreezeRuntimeGuardV49|panelManualEditPersistenceFreezeRuntimeGuardV50)\.js/);
assert.match(parentGuard, /inheritedSuccessorOverrides/);
assert.match(parentGuard, /successorOverrides\.has\(relativePath\)/);
assert.match(bucket, /activeEcCommercialFunnelStage/);
assert.match(bucket, /active_funnel_reply/);
assert.match(health, /zapiSubscriptionBlockedFromMessages/);
assert.match(health, /zapi_subscription_inactive/);
assert.doesNotMatch(health, /sendZapi(?:Text|Audio|Image|Video|Document)/);
assert.match(packageJson.scripts.test, /guard:(?:whatsapp-outage-recovery-v49|panel-manual-edit-v50)/);
assert.match(packageJson.scripts['guard:whatsapp-outage-recovery-v49'], /guard-whatsapp-outage-recovery-v49\.mjs/);
assert.match(packageJson.scripts['deploy:v49'], /assert-whatsapp-outage-recovery-activation-approved-v49\.mjs/);
assert.match(packageJson.scripts['deploy:v49'], /deploy:vps/);

console.log('WHATSAPP_OUTAGE_RECOVERY_V49_GUARD=OK');
