import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/panelCustomerFormPersistenceFreezeRuntimeGuardV55.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const entryGuard = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const panel = read('public/qr.html');
const route = read('src/routes/whatsapp.js');
const helper = read('public/panel-intelligence/customer-form-persistence-guard-v55.js');
const service = read('src/services/panelCustomerFormPersistenceService.js');
const repair = read('scripts/repair-panel-customer-form-v55.mjs');
const manifest = JSON.parse(read('docs/freeze/panel-customer-form-persistence-v55-20260824.json'));

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.canonicalAgencyAddressInPanel, true);
assert.equal(manifest.policy.stableConversationPhoneIdentity, true);
assert.equal(manifest.policy.backendPhoneIdentityMismatchRejected, true);
assert.equal(manifest.policy.exactAffectedRecordsRepairWithBackup, true);
assert.equal(manifest.policy.historicalDeliveredOrderMutation, false);
assert.equal(manifest.policy.realClientCanaryAuthorized, false);
assert.equal(manifest.policy.whatsappSendAuthorized, false);
assert.equal(manifest.policy.metaPurchaseResendAllowed, false);
assert.equal(manifest.policy.automaticDropiAuthorization, false);
assert.match(entryGuard, /runtimeGuardChainFreezeRuntimeGuardV67\.js/);
assert.match(panel, /customer-form-persistence-guard-v55\.js/);
assert.match(panel, /protectFormPhone/);
assert.match(route, /materializePanelAgencyAddress/);
assert.match(route, /protectPanelCustomerPhone/);
assert.match(route, /customer_phone_identity_mismatch/);
assert.match(service, /authorizedAgencyOrderAddress/);
assert.match(service, /panelConversationPhone/);
assert.doesNotMatch(helper, /fetch\(|XMLHttpRequest|setInterval/);
assert.match(repair, /EC-MT6GO9YX-4QS9/);
assert.match(repair, /EC-MT6GWGA2-9ZUZ/);
assert.match(repair, /6a7de6a3f24ae26732b457a8/);
assert.match(repair, /PANEL_CUSTOMER_FORM_V55_CONTROLLED_REPAIR/);
assert.match(repair, /noWhatsappSend: true/);
assert.match(repair, /noMetaResend: true/);
assert.match(repair, /noDropiSubmit: true/);
assert.doesNotMatch(repair, /sendPurchaseEventForOrder|sendText\(|sendAudio\(|sendImage\(|sendZapi/i);
assert.match(packageJson.scripts.test, /guard:panel-customer-form-v55/);
assert.match(packageJson.scripts['senior:check'], /panel-customer-form-persistence-v55\.test\.mjs/);
assert.match(packageJson.scripts['deploy:v55'], /assert-panel-customer-form-persistence-activation-approved-v55\.mjs/);

console.log('PANEL_CUSTOMER_FORM_PERSISTENCE_V55_GUARD=OK');
