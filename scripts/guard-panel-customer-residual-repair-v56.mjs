import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/panelCustomerResidualRepairFreezeRuntimeGuardV56.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const entryGuard = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const repair = read('scripts/repair-panel-customer-residual-v56.mjs');
const manifest = JSON.parse(read('docs/freeze/panel-customer-residual-repair-v56-20260824.json'));

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.residualAgencyOrdersExactRepairWithBackup, true);
assert.equal(manifest.policy.crossedConversationStatesIsolated, true);
assert.equal(manifest.policy.historicalShippedOrderMutation, false);
assert.equal(manifest.policy.realClientCanaryAuthorized, false);
assert.equal(manifest.policy.whatsappSendAuthorized, false);
assert.equal(manifest.policy.metaPurchaseResendAllowed, false);
assert.equal(manifest.policy.automaticDropiAuthorization, false);
assert.equal(manifest.policy.productOrPriceChanged, false);
assert.match(entryGuard, /panelCustomerResidualRepairFreezeRuntimeGuardV56\.js/);
for (const id of ['EC-MT6FF9N1-AFWE', 'EC-MT6FJHIS-YRQQ', 'EC-MT6H0NR2-SBM5', 'EC-MT6KIOUM-EGZK']) {
    assert.match(repair, new RegExp(id));
}
for (const id of ['6a828e50ba6ae6336992a83b', '6a8291c5ba6ae6336992d830', 'EC-MSWR401B-KNHS']) {
    assert.match(repair, new RegExp(id));
}
assert.match(repair, /PANEL_CUSTOMER_RESIDUAL_V56_CONTROLLED_REPAIR/);
assert.match(repair, /noWhatsappSend: true/);
assert.match(repair, /noMessageMutation: true/);
assert.match(repair, /noMetaResend: true/);
assert.match(repair, /noDropiSubmit: true/);
assert.match(repair, /historicalShippedOrderChanged: false/);
assert.doesNotMatch(repair, /sendPurchaseEventForOrder|sendText\(|sendAudio\(|sendImage\(|sendZapi|submit.*Dropi/i);
assert.match(packageJson.scripts.test, /guard:panel-customer-residual-v56/);
assert.match(packageJson.scripts['senior:check'], /panel-customer-residual-repair-v56\.test\.mjs/);
assert.match(packageJson.scripts['deploy:v56'], /assert-panel-customer-residual-repair-activation-approved-v56\.mjs/);

console.log('PANEL_CUSTOMER_RESIDUAL_REPAIR_V56_GUARD=OK');
