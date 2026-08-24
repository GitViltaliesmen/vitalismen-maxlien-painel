import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/pickupBonusDeliveryFreezeRuntimeGuardV60.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const manifest = JSON.parse(read('docs/freeze/pickup-bonus-delivery-v60-20260824.json'));
const packageJson = JSON.parse(read('package.json'));
const shipment = read('src/services/shipmentMessageService.js');
const dispatcher = read('src/services/shipmentStatusDispatcherService.js');
const entryGuard = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.dedicatedPickupBonusSemanticKey, true);
assert.equal(manifest.policy.sameOrderRetryRemainsDeduped, true);
assert.equal(manifest.policy.thankYouAudioReplayAllowed, false);
assert.equal(manifest.policy.howToUseAudioReplayAllowed, false);
assert.equal(manifest.policy.exactPendingBonusCompletionAuthorized, true);
assert.equal(manifest.policy.massHistoricalReplayAllowed, false);
assert.equal(manifest.policy.automaticDropiAuthorization, false);
assert.equal(manifest.policy.metaPurchaseResendAllowed, false);
assert.equal(manifest.policy.productOrPriceChanged, false);
assert.equal(manifest.policy.commercialFunnelChanged, false);
assert.match(entryGuard, /pickupBonusDeliveryFreezeRuntimeGuardV60\.js/);
assert.match(shipment, /shipment_status:pickup_bonus:\$\{shipmentIdentity\}/);
assert.match(shipment, /antiSpamKey:\s*pickupBonusAntiSpamKey\(shipment\)/);
assert.match(shipment, /dedupeValue:\s*`\$\{text\}\|\$\{bonusDedupeScope\}`/);
assert.doesNotMatch(
    shipment.slice(shipment.indexOf('export const notifyPickupBonus'), shipment.indexOf('const calculateTreatmentDates')),
    /bypassDedupe:\s*true|force:\s*true/
);
assert.match(dispatcher, /if \(status === 'ENTREGADO'\) return 'delivered_bonus'/);
assert.match(packageJson.scripts.test, /guard:pickup-bonus-v60/);
assert.match(packageJson.scripts['senior:check'], /pickup-bonus-delivery-v60\.test\.mjs/);
assert.match(packageJson.scripts['deploy:v60'], /assert-pickup-bonus-delivery-activation-approved-v60\.mjs/);
assert.match(packageJson.scripts['deploy:v60'], /deploy:vps/);

console.log('PICKUP_BONUS_DELIVERY_V60_GUARD=OK');
