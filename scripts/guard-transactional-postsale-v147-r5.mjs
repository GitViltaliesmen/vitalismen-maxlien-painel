import assert from 'node:assert/strict';
import fs from 'node:fs';
await import('./lib/ec-runtime-successor-v147-r5-context.mjs');
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('docs/freeze/ec-transactional-postsale-v147-r5-20260910.json'));
assert.deepEqual(manifest.functionalFiles, [
    'src/services/postSaleNotificationDecisionService.js',
    'src/services/postSaleProductResolutionV147R5Service.js',
    'src/services/shipmentMessageService.js'
]);
const decision = read(manifest.functionalFiles[0]);
assert.match(decision, /engagementAutomation\.blockedReason.*opt_out/);
assert.match(decision, /kind: legacyKind/);
assert.match(decision, /review\?\.suppressedNotificationKinds/);
const messages = read(manifest.functionalFiles[2]);
const p5p6 = messages.slice(messages.indexOf('export const notifyDeliveredThankYou'), messages.indexOf('export const notifyProductUsage'));
assert.doesNotMatch(p5p6, /resolveProductFn|loadPostSaleProduct|shipmentProductFamily/);
assert.match(messages, /const product = await resolveProductFn\(\{ shipment \}\)/);
assert.match(messages, /product_usage_review_required/);
assert.equal(manifest.policy.transport, 'SINK');
assert.equal(manifest.policy.realMessagesSent, 0);
assert.equal(manifest.policy.newScheduler, false);
console.log('V147_R5_TRANSACTIONAL_POSTSALE_GUARD=PASS');
