import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/panelManualEditPersistenceFreezeRuntimeGuardV50.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const panel = read('public/qr.html');
const helper = read('public/panel-intelligence/customer-edit-guard-v50.js');
const testFile = read('tests/panel-manual-edit-persistence-v50.test.mjs');
const entryGuard = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const previousGuard = read('scripts/guard-whatsapp-outage-recovery-v49.mjs');
const manifest = JSON.parse(read('docs/freeze/panel-manual-edit-persistence-v50-20260823.json'));

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.manualOperatorEditsAuthoritative, true);
assert.equal(manifest.policy.staleAsyncResponseCanOverwrite, false);
assert.equal(manifest.policy.savesSerialized, true);
assert.equal(manifest.policy.contactTargetCaptured, true);
assert.equal(manifest.policy.realClientMutationForValidation, false);
assert.equal(manifest.policy.realClientSendAuthorized, false);
assert.equal(manifest.policy.automaticDropiAuthorization, false);
assert.equal(manifest.policy.productOrPriceChanged, false);
assert.match(entryGuard, /panelManualEditPersistenceFreezeRuntimeGuardV50\.js/);
assert.match(previousGuard, /panelManualEditPersistenceFreezeRuntimeGuardV50/);
assert.match(panel, /customer-edit-guard-v50\.js/);
assert.match(panel, /if \(!keepManualEdit\) state\.customerCorrectedFields\.clear\(\)/);
assert.match(panel, /encodeURIComponent\(saveSnapshot\.contactStateKey\).*resolve-customer-data/);
assert.match(panel, /correctedByHumanFields:\s*saveSnapshot\.correctedFields/g);
assert.match(panel, /customerDataSaveQueue/);
assert.match(panel, /persistSelectedCustomerDataNow/);
assert.match(panel, /preservedNewerEdits/);
assert.match(helper, /isSaveSnapshotCurrent/);
assert.match(helper, /shouldPreserveManualEdit/);
assert.match(helper, /queueSave/);
assert.doesNotMatch(helper, /fetch\(|XMLHttpRequest|sendZapi|Dropi|Meta|setInterval/);
assert.match(testFile, /Nome Final Operador|correção humana|serializa salvamentos/);
assert.match(packageJson.scripts.test, /guard:panel-manual-edit-v50/);
assert.match(packageJson.scripts['guard:panel-manual-edit-v50'], /guard-panel-manual-edit-persistence-v50\.mjs/);
assert.match(packageJson.scripts['deploy:v50'], /assert-panel-manual-edit-persistence-activation-approved-v50\.mjs/);
assert.match(packageJson.scripts['deploy:v50'], /deploy:vps/);

console.log('PANEL_MANUAL_EDIT_PERSISTENCE_V50_GUARD=OK');
