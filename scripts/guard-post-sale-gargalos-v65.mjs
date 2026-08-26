import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('docs/freeze/post-sale-gargalos-v65-20260826.json'));
const entry = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const runtime = read('src/services/postSaleGargalosFreezeRuntimeGuardV65.js');
const search = read('src/services/panelGlobalCustomerSearchService.js');
const panel = read('public/qr.html');
const readModel = read('src/services/panelCustomerReadModelService.js');
const resolution = read('src/services/dropiRejectedReviewResolutionService.js');
const antiSpam = read('src/services/postSaleNotificationDecisionService.js');
const reconciliation = read('src/services/dropiShipmentReconciliationService.js');
const sync = read('src/services/droppiEcuadorBrowserService.js');
const historical = read('scripts/reconcile-post-sale-historical-v65.mjs');
const tests = read('tests/post-sale-gargalos-v65.test.mjs');

assert.equal(manifest.freezeId, 'post-sale-gargalos-v65-20260826');
assert.equal(manifest.parentFreezeId, 'dropi-customer-full-name-v64-20260826');
assert.equal(manifest.status, 'implementation_validated');
assert.equal(manifest.publicationStatus, 'release_candidate_local_no_deploy');
assert.equal(manifest.policy.globalSearchReadOnly, true);
assert.equal(manifest.policy.canonicalReadModel, 'Shipment>Order>customerDraft');
assert.equal(manifest.policy.staleDropiRejectedExactOnly, true);
assert.equal(manifest.policy.historicalReplayAllowed, false);
assert.equal(manifest.policy.ambiguousMatchAllowed, false);
assert.equal(manifest.policy.historicalApplyExecuted, false);
assert.equal(manifest.policy.whatsappSendAuthorized, false);
assert.equal(manifest.policy.dropiSubmitAuthorizedByThisFreeze, false);
assert.equal(manifest.policy.deployAuthorized, false);
assert.match(entry, /runtimeGuardChainFreezeRuntimeGuardV67\.js/);
assert.match(runtime, /dropiCustomerFullNameFreezeRuntimeGuardV64\.js/);
assert.match(search, /searchPanelCustomersGlobally/);
assert.match(search, /readOnly:\s*true/);
assert.match(panel, /scheduleRemoteChatSearch/);
assert.match(readModel, /selectAuthoritativePanelOrder/);
assert.match(readModel, /officialOrderName/);
assert.match(resolution, /canResolveStaleDropiRejectedReview/);
assert.match(resolution, /review\.reviewReason': 'dropi_rejected'/);
for (const decision of [
    'SHOULD_SEND', 'ALREADY_NOTIFIED_STRUCTURED', 'ALREADY_NOTIFIED_MANUALLY',
    'HISTORICAL_EVENT_SUPPRESSED', 'MANUAL_REVIEW_REQUIRED', 'NOT_ELIGIBLE'
]) assert.match(antiSpam, new RegExp(decision));
assert.match(reconciliation, /AMBIGUOUS_MATCH/);
assert.match(reconciliation, /PRODUCT_CONFLICT/);
assert.doesNotMatch(sync, /existing\?\.orderId \|\| `EC-DROPI-/);
assert.match(sync, /fetchOrdersApiRows\(page, '', \{ maxRows: safeMaxRows \}\)/);
assert.match(sync, /startDropiSyncCycle/);
assert.match(historical, /mode: apply \? 'APPLY_WITHOUT_REPLAY' : 'DRY_RUN'/);
assert.match(tests, /990287146|7146/);
assert.match(tests, /189411028/);
assert.match(tests, /4818/);
assert.match(packageJson.scripts.test, /guard:post-sale-gargalos-v65/);
assert.match(packageJson.scripts['senior:check'], /post-sale-gargalos-v65\.test\.mjs/);

console.log('POST_SALE_GARGALOS_V65_GUARD=OK');
