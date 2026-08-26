import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const service = read('src/services/droppiEcuadorService.js');
const routes = read('src/routes/shipments.js');
const test = read('tests/dropi-customer-full-name-v64.test.mjs');
const freeze = read('docs/DROPI_CUSTOMER_FULL_NAME_FREEZE_V64_20260826.md');
const entry = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const runtimeGuard = read('src/services/dropiCustomerFullNameFreezeRuntimeGuardV64.js');
const manifest = JSON.parse(read('docs/freeze/dropi-customer-full-name-v64-20260826.json'));

assert.equal(manifest.freezeId, 'dropi-customer-full-name-v64-20260826');
assert.equal(manifest.parentFreezeId, 'protocolo-g-ad-metrics-v63-20260826');
assert.equal(manifest.status, 'implementation_validated');
assert.equal(manifest.publicationStatus, 'local_only_no_deploy');
assert.equal(manifest.policy.fullNameRequired, true);
assert.equal(manifest.policy.technicalIdentifierAllowed, false);
assert.equal(manifest.policy.historicalOrdersMutated, false);
assert.equal(manifest.policy.whatsappSendAuthorized, false);
assert.equal(manifest.policy.dropiSubmitAuthorizedByThisFreeze, false);
assert.equal(manifest.policy.deployAuthorized, false);
assert.match(entry, /(?:dropiCustomerFullNameFreezeRuntimeGuardV64|postSaleGargalosFreezeRuntimeGuardV65)\.js/);
assert.match(runtimeGuard, /protocoloGAdMetricsFreezeRuntimeGuardV63\.js/);

assert.match(service, /export const validateEcuadorDropiCustomerName/);
assert.match(service, /DROPI_CUSTOMER_FULL_NAME_REQUIRED/);
assert.match(service, /customer_surname_required/);
assert.match(service, /customer_name_contains_digits/);
assert.match(service, /technical_customer_name_not_allowed/);
assert.match(routes, /dropiCustomerNameBlockedResponse/);
assert.match(routes, /router\.post\('\/droppi\/ec\/orders\/:orderId\/submit'/);
assert.match(routes, /router\.get\('\/droppi\/ec\/orders\/:orderId\/manual-link'/);
assert.match(routes, /router\.post\('\/droppi\/ec\/orders\/:orderId\/authorize-submit'/);
assert.equal(
    (routes.match(/return dropiCustomerNameBlockedResponse\(res, order, shipment\)/g) || []).length,
    3
);
assert.match(test, /garciajul96/);
assert.match(test, /miguelarellanoperalta/);
assert.match(test, /JULIO GARCIA/);
assert.match(freeze, /sem autoriza(?:cao|ção) de deploy/i);
assert.match(freeze, /n[aã]o envia WhatsApp, Dropi ou Meta\/CAPI/i);
assert.match(packageJson.scripts['senior:check'], /dropi-customer-full-name-v64\.test\.mjs/);
assert.match(packageJson.scripts.test, /guard:dropi-customer-full-name-v64/);

console.log('DROPI_CUSTOMER_FULL_NAME_V64_GUARD=OK');
