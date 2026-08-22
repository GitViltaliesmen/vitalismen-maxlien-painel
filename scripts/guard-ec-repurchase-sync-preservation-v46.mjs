import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('./assert-ec-repurchase-sync-preservation-activation-approved-v46.mjs');
await import('./guard-ec-delivered-repurchase-v45.mjs');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const service = read('src/services/ecDeliveredRepurchaseService.js');
const whatsapp = read('src/routes/whatsapp.js');
const admin = read('src/services/adminPanelStatusService.js');
const testFile = read('tests/ec-repurchase-sync-preservation-v46.test.mjs');
const freeze = read('docs/EC_REPURCHASE_SYNC_PRESERVATION_FREEZE_V46_20260822.md');

assert.match(service, /operationalOrderLineage/);
assert.match(service, /repeat_purchase_after_delivered/);
assert.match(whatsapp, /previousOrderId: orderLineage\.previousOrderId/);
assert.match(whatsapp, /entryReason: orderLineage\.entryReason/);
assert.match(whatsapp, /sourceOrderId: cleanDraft\.sourceOrderId \|\| cleanDraft\.orderId/);
assert.match(admin, /repurchase_cycle/);
assert.match(testFile, /preserva a linhagem da recompra entregue/);
assert.match(freeze, /sem nova ordem e[\s\S]*sem novo evento/);
assert.doesNotMatch(whatsapp, /authorize-submit|dispatch\/run/);

console.log('EC_REPURCHASE_SYNC_PRESERVATION_V46_GUARD=OK');
