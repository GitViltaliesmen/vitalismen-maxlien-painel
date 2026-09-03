import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/panelCustomerAliasRepairFreezeRuntimeGuardV57.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const entryGuard = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const repair = read('scripts/repair-panel-customer-alias-v57.mjs');
const manifest = JSON.parse(read('docs/freeze/panel-customer-alias-repair-v57-20260824.json'));

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.exactLocalAliasRepairWithBackup, true);
assert.equal(manifest.policy.canonicalCustomerStateCopied, true);
assert.equal(manifest.policy.orderOrMessageMutation, false);
assert.equal(manifest.policy.realClientCanaryAuthorized, false);
assert.equal(manifest.policy.whatsappSendAuthorized, false);
assert.equal(manifest.policy.metaPurchaseResendAllowed, false);
assert.equal(manifest.policy.automaticDropiAuthorization, false);
assert.match(entryGuard, /runtimeGuardChainFreezeRuntimeGuardV67\.js/);
assert.match(repair, /6a7de6a3f24ae26732b457a8/);
assert.match(repair, /6a7de6b3f24ae26732b45816/);
assert.match(repair, /PANEL_CUSTOMER_ALIAS_V57_CONTROLLED_REPAIR/);
assert.match(repair, /noWhatsappSend: true/);
assert.match(repair, /noMessageMutation: true/);
assert.match(repair, /noOrderMutation: true/);
assert.doesNotMatch(repair, /from ['"].*models\/(?:Message|Order|Shipment)|sendPurchaseEventForOrder|sendText\(|sendAudio\(|sendImage\(|sendZapi|submit.*Dropi/i);
assert.match(packageJson.scripts.test, /guard:panel-customer-alias-v57/);
assert.match(packageJson.scripts['senior:check'], /panel-customer-alias-repair-v57\.test\.mjs/);
assert.match(packageJson.scripts['deploy:v57'], /assert-panel-customer-alias-repair-activation-approved-v57\.mjs/);

console.log('PANEL_CUSTOMER_ALIAS_REPAIR_V57_GUARD=OK');
