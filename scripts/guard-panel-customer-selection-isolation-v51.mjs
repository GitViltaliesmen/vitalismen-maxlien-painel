import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/panelCustomerSelectionIsolationFreezeRuntimeGuardV51.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const panel = read('public/qr.html');
const helper = read('public/panel-intelligence/customer-selection-guard-v51.js');
const testFile = read('tests/panel-customer-selection-isolation-v51.test.mjs');
const browserTest = read('scripts/test-panel-customer-selection-browser-v51.mjs');
const entryGuard = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const manifest = JSON.parse(read('docs/freeze/panel-customer-selection-isolation-v51-20260824.json'));

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.selectionScopedByEpoch, true);
assert.equal(manifest.policy.staleSelectionWorkCanWrite, false);
assert.equal(manifest.policy.selectionTimersInvalidated, true);
assert.equal(manifest.policy.agencyAutosaveIdempotent, true);
assert.equal(manifest.policy.realClientMutationForValidation, false);
assert.equal(manifest.policy.realClientSendAuthorized, false);
assert.equal(manifest.policy.automaticDropiAuthorization, false);
assert.equal(manifest.policy.productOrPriceChanged, false);
assert.match(entryGuard, /runtimeGuardChainFreezeRuntimeGuardV67\.js/);
assert.match(panel, /customer-selection-guard-v51\.js\?v=20260824/);
assert.match(panel, /selectedChatEpoch/);
assert.match(panel, /invalidateCustomerSelectionWork/);
assert.match(panel, /blankCustomerFormForSelection/);
assert.match(panel, /isCustomerSelectionScopeCurrent/);
assert.match(panel, /agencySuggestionChangesForm/);
assert.match(panel, /customer_selection_or_form_changed/);
assert.match(helper, /captureSelectionScope/);
assert.match(helper, /isSelectionScopeCurrent/);
assert.match(helper, /agencySuggestionChangesForm/);
assert.match(testFile, /2490/);
assert.match(testFile, /1150/);
assert.match(browserTest, /PANEL_CUSTOMER_SELECTION_BROWSER_V51=OK/);
assert.doesNotMatch(helper, /fetch\(|XMLHttpRequest|sendZapi|Dropi|Meta|setInterval/);
assert.match(packageJson.scripts.test, /guard:panel-customer-selection-v51/);
assert.match(packageJson.scripts['guard:panel-customer-selection-v51'], /guard-panel-customer-selection-isolation-v51\.mjs/);
assert.match(packageJson.scripts['deploy:v51'], /assert-panel-customer-selection-isolation-activation-approved-v51\.mjs/);
assert.match(packageJson.scripts['deploy:v51'], /deploy:vps/);

console.log('PANEL_CUSTOMER_SELECTION_ISOLATION_V51_GUARD=OK');
