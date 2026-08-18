import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/customerDataResolutionFreezeRuntimeGuardV28.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const service = read('src/services/customerDataResolutionService.js');
const funnel = read('src/services/texUltraFunnelService.js');
const orders = read('src/routes/orders.js');
const whatsapp = read('src/routes/whatsapp.js');
const panel = read('public/qr.html');
const index = read('src/index.js');
const packageJson = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/ec-panel-quality.yml');
const manifest = JSON.parse(read('docs/freeze/customer-data-resolution-v28-20260818.json'));

assert.equal(manifest.publicationStatus, 'local_candidate_not_authorized');
assert.equal(manifest.operatorPublicationApproval.status, 'required_explicit');
assert.equal(manifest.operatorPublicationApproval.scope, 'controlled_deploy_v28_after_explicit_operator_approval');
assert.equal(manifest.stagingStatus, 'approved_local_synthetic_only');
assert.equal(manifest.operatorStagingApproval.status, 'approved_in_thread');
assert.equal(manifest.operatorStagingApproval.scope, 'freeze_commit_and_local_synthetic_staging_without_production');
assert.match(index, /import '\.\/services\/customerDataResolutionFreezeRuntimeGuardV28\.js';/);
assert.doesNotMatch(index, /^import '.+FreezeRuntimeGuardV(?:17|18|19|20|21|22|23|24|25|26|27)\.js';/m);
assert.match(service, /SEGMENTATION_REQUIRED/);
assert.match(service, /resolveEcuadorLocation/);
assert.match(service, /assertCustomerOrderDataReady/);
assert.match(funnel, /awaiting_name_resolution/);
assert.match(orders, /customer_data_not_ready/);
assert.match(whatsapp, /resolve-customer-data/);
assert.match(panel, /customerDataQualityScore/);
assert.match(packageJson.scripts['senior:check'], /guard-customer-data-resolution-v28\.mjs/);
assert.match(packageJson.scripts['senior:check'], /customer-data-resolution-v28\.test\.mjs/);
assert.match(packageJson.scripts['deploy:ec-safe'], /assert-customer-data-resolution-approved-v28\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-customer-data-resolution-approved-v28\.mjs/);
assert.match(workflow, /scripts\/guard-customer-data-resolution-v28\.mjs/);
assert.match(workflow, /tests\/customer-data-resolution-v28\.test\.mjs/);

console.log('CUSTOMER_DATA_RESOLUTION_V28_GUARD=OK');
