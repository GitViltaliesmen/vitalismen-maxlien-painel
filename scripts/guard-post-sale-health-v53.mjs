import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/postSaleHealthRecoveryFreezeRuntimeGuardV53.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const entryGuard = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const shipmentModel = read('src/models/Shipment.js');
const shipment = read('src/services/shipmentMessageService.js');
const historyPolicy = read('src/services/postSalePickupReconciliationPolicy.js');
const scheduler = read('src/services/schedulerService.js');
const texPostSale = read('src/services/texUltraConfirmedPostSaleLayerService.js');
const reengagement = read('src/services/reengagementService.js');
const conversation = read('src/services/conversationEngine.js');
const v39Guard = read('scripts/guard-ec-direct-product-name-postsale-v39.mjs');
const manifest = JSON.parse(read('docs/freeze/post-sale-health-recovery-v53-20260824.json'));

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.pickupReminderStageSpecificDedupe, true);
assert.equal(manifest.policy.pickupReminderPersistentLock, true);
assert.equal(manifest.policy.repurchasePersistentLock, true);
assert.equal(manifest.policy.manualOnlyAutomaticOutboundAllowed, false);
assert.equal(manifest.policy.blockedCandidateCanStarveQueue, false);
assert.equal(manifest.policy.massBacklogReplayAllowed, false);
assert.equal(manifest.policy.repurchaseProductIsolation, true);
assert.match(entryGuard, /postSaleHealthRecoveryFreezeRuntimeGuardV53\.js/);
assert.match(historyPolicy, /logistics_pickup_reminder:\$\{pickupReminderStage\}/);
assert.match(shipment, /'review\.manualOnly': \{ \$ne: true \}/);
assert.match(shipment, /for \(const item of allDueItems\)/);
assert.match(shipment, /repurchaseProductPolicyForShipment/);
assert.match(shipment, /pickupReminderDispatchLockedUntil/);
assert.match(shipmentModel, /pickupReminderDispatchLockedUntil/);
assert.match(shipmentModel, /refillReminderDispatchLockedUntil/);
assert.match(scheduler, /checkTexUltraConfirmedPostSale\(\), 45000/);
assert.match(texPostSale, /QUEUE_MAX_AGE_HOURS \|\| '72'/);
assert.match(texPostSale, /stale_missing_not_replayed/);
assert.match(texPostSale, /limit\(queuePolicy\.scanLimit\)/);
assert.match(reengagement, /state && product\.allowSharedProof/);
assert.match(conversation, /refill_reminder_inbound_greeting_audio_\$\{product\.productKey\}/);
assert.match(v39Guard, /resolveCustomerDisplayName/);
assert.match(packageJson.scripts.test, /guard:post-sale-health-v53/);
assert.match(packageJson.scripts['senior:check'], /post-sale-health-v53\.test\.mjs/);
assert.match(packageJson.scripts['deploy:v53'], /assert-post-sale-health-activation-approved-v53\.mjs/);
assert.match(packageJson.scripts['deploy:v53'], /deploy:vps/);

console.log('POST_SALE_HEALTH_RECOVERY_V53_GUARD=OK');
