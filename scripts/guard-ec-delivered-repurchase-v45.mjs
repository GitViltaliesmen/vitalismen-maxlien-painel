import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const service = read('src/services/ecDeliveredRepurchaseService.js');
const orders = read('src/routes/orders.js');
const whatsapp = read('src/routes/whatsapp.js');
const panel = read('public/qr.html');
const admin = read('src/services/adminPanelStatusService.js');
const testFile = read('tests/ec-delivered-repurchase-v45.test.mjs');
const freeze = read('docs/EC_DELIVERED_REPURCHASE_FREEZE_V45_20260822.md');

assert.match(service, /terminalStatusFromShipment/);
assert.match(service, /repurchaseOrderCreationPolicy/);
assert.match(service, /EC-RECOMPRA-/);
assert.match(orders, /authenticated: Boolean\(req\.user\)/);
assert.match(orders, /previousOrderId: repurchaseContext\?\.previousOrderId \|\| ''/);
assert.match(orders, /previousDeliveredAt: repurchaseContext\?\.previousDeliveredAt \|\| null/);
assert.match(whatsapp, /historicalOrderId: orderLifecycle\.historicalOrderId/);
assert.match(whatsapp, /hasOperationalOrder: orderLifecycle\.hasOperationalOrder/);
assert.match(panel, /projectedHistoricalOrderId/);
assert.match(admin, /repurchase_cycle/);
assert.match(testFile, /Shipment ENTREGADO como histórico/);
assert.match(freeze, /nenhuma autorização ou submissão Dropi é criada automaticamente/);
assert.doesNotMatch(orders, /authorize-repurchase|authorize-submit|dispatch\/run/);
assert.match(panel, /chatConversationBucket\(chat\) !== 'engagement'/);

console.log('EC_DELIVERED_REPURCHASE_V45_GUARD=OK');
