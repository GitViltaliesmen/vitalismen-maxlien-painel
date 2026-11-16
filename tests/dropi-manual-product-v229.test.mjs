import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentManualDropiSelectionV229 as allowed } from '../src/services/dropiManualProductSelectionV229Service.js';

function fixture() {
  return {
    now: new Date('2026-11-16T08:00:00Z'), productKey: 'vit_power_ec',
    conflictingMessage: { createdAt: new Date('2026-11-16T06:41:10Z') },
    order: { country: 'EC', source: 'manual', orderId: 'EC-QA-NOT-REAL',
      customer: { phone: '593980000001' }, tracking: { productKey: 'vit_power_ec' },
      confirmedAt: new Date('2026-11-16T07:05:59Z') },
    contact: { phoneDigits: '593980000001', metadata: {
      customerDraft: { orderId: 'EC-QA-NOT-REAL', productKey: 'vit_power_ec' },
      productRouteLock: { active: true, source: 'panel_customer_product_selection',
        reason: 'operator_selected_current_negotiation_product', selectedBy: 'Admin QA',
        productKey: 'vit_power_ec', lockedAt: '2026-11-16T07:05:58Z' }
    } }
  };
}
test('later authenticated Vit Power selection wins over old Nitrix keyword for this exact order', () => assert.equal(allowed(fixture()), true));
for (const [name, change] of [
  ['newer conflict', x => { x.conflictingMessage.createdAt = new Date('2026-11-16T07:06:00Z'); }],
  ['other order', x => { x.contact.metadata.customerDraft.orderId = 'EC-OTHER'; }],
  ['other phone', x => { x.contact.phoneDigits = '593980000002'; }],
  ['Brazil QA', x => { x.contact.phoneDigits = x.order.customer.phone = '5515998038637'; }],
  ['no lock', x => { delete x.contact.metadata.productRouteLock; }],
  ['automatic source', x => { x.contact.metadata.productRouteLock.source = 'inbound'; }],
  ['inactive lock', x => { x.contact.metadata.productRouteLock.active = false; }],
  ['missing operator', x => { x.contact.metadata.productRouteLock.selectedBy = ''; }],
  ['conflicting draft', x => { x.contact.metadata.customerDraft.productKey = 'nitrix_ec'; }],
  ['conflicting order', x => { x.order.tracking.productKey = 'nitrix_ec'; }],
  ['selection after confirmation', x => { x.contact.metadata.productRouteLock.lockedAt = '2026-11-16T07:07:00Z'; }],
  ['future confirmation', x => { x.order.confirmedAt = new Date('2026-11-17T07:00:00Z'); }],
  ['unknown product', x => { x.productKey = ''; }],
  ['unverified date', x => { x.conflictingMessage.createdAt = undefined; }],
  ['checkout source', x => { x.order.source = 'checkout'; }]
]) test('does not override guard: ' + name, () => { const x = fixture(); change(x); assert.equal(allowed(x), false); });

for (const asDate of [true, false]) test('preserves same-second milliseconds with Mongo Date and JSON timestamps: ' + asDate, () => {
 const x = fixture();
 x.contact.metadata.productRouteLock.lockedAt = '2026-11-16T07:05:58.639Z';
 x.order.confirmedAt = asDate ? new Date('2026-11-16T07:05:58.715Z') : '2026-11-16T07:05:58.715Z';
 assert.equal(allowed(x), true);
 x.order.confirmedAt = asDate ? new Date('2026-11-16T07:05:58.638Z') : '2026-11-16T07:05:58.638Z';
 assert.equal(allowed(x), false);
});

for (const value of [null, undefined, false, 0, new Date('invalid')]) test('unknown conflicting-message timestamp never grants an exception: ' + String(value), () => {
 const x = fixture(); x.conflictingMessage.createdAt = value; assert.equal(allowed(x), false);
});
