import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { adminRepurchaseCycleFlag } from '../src/services/adminPanelStatusService.js';

test('V47 serializa o ciclo de recompra como inteiro compatível com Python', () => {
    const active = adminRepurchaseCycleFlag({
        previousOrderId: 'EC-ANTERIOR-V47',
        entryReason: 'repeat_purchase_after_delivered'
    });
    const inactive = adminRepurchaseCycleFlag({
        previousOrderId: '',
        entryReason: 'new_purchase'
    });

    assert.equal(active, 1);
    assert.equal(inactive, 0);
    assert.equal(Number.isInteger(active), true);
    assert.equal(Number.isInteger(inactive), true);
});

test('V47 não interpola booleano JavaScript no payload Python do painel', () => {
    const service = fs.readFileSync('src/services/adminPanelStatusService.js', 'utf8');
    const syncStart = service.indexOf('export const syncOrderToOnlineAdminPanel');
    const syncEnd = service.indexOf('export const syncContactDraftToOnlineAdminPanel');
    const syncBlock = service.slice(syncStart, syncEnd);

    assert.match(syncBlock, /repurchase_cycle: adminRepurchaseCycleFlag\(order\)/);
    assert.doesNotMatch(syncBlock, /repurchase_cycle: Boolean\(/);
    assert.match(syncBlock, /payload\.get\("repurchase_cycle"\)/);
});
