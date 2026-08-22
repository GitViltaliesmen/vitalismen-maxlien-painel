import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { operationalOrderLineage } from '../src/services/ecDeliveredRepurchaseService.js';

test('V46 preserva a linhagem da recompra entregue ao salvar novamente a ficha', () => {
    const lineage = operationalOrderLineage({
        existingOrder: {
            orderId: 'EC-RECOMPRA-V46',
            previousOrderId: 'EC-ANTERIOR-V46',
            entryReason: 'repeat_purchase_after_delivered'
        },
        sourceOrderId: 'EC-RECOMPRA-V46',
        sourceIsAdminOrder: false
    });

    assert.deepEqual(lineage, {
        deliveredRepurchase: true,
        previousOrderId: 'EC-ANTERIOR-V46',
        entryReason: 'repeat_purchase_after_delivered',
        preserveExistingNotes: true
    });
});

test('V46 mantém o comportamento anterior para pedido comum e espelho administrativo', () => {
    assert.deepEqual(operationalOrderLineage({
        existingOrder: { orderId: 'EC-COMUM', previousOrderId: '', entryReason: 'new_purchase' },
        sourceOrderId: 'EC-COMUM',
        sourceIsAdminOrder: false
    }), {
        deliveredRepurchase: false,
        previousOrderId: '',
        entryReason: 'whatsapp_panel_confirmed',
        preserveExistingNotes: false
    });

    assert.deepEqual(operationalOrderLineage({
        sourceOrderId: 'EC-ADMIN-1621',
        sourceIsAdminOrder: true
    }), {
        deliveredRepurchase: false,
        previousOrderId: 'EC-ADMIN-1621',
        entryReason: 'admin_panel_confirmed_whatsapp_mirror',
        preserveExistingNotes: false
    });
});

test('V46 liga a preservação ao salvamento da ficha sem repetir Purchase ou Dropi', () => {
    const whatsapp = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const admin = fs.readFileSync('src/services/adminPanelStatusService.js', 'utf8');
    const orders = fs.readFileSync('src/routes/orders.js', 'utf8');

    assert.match(whatsapp, /const orderLineage = operationalOrderLineage\(\{/);
    assert.match(whatsapp, /previousOrderId: orderLineage\.previousOrderId/);
    assert.match(whatsapp, /entryReason: orderLineage\.entryReason/);
    assert.match(whatsapp, /sourceOrderId: cleanDraft\.sourceOrderId \|\| cleanDraft\.orderId \|\| ''/);
    assert.match(whatsapp, /currentNegotiationOrderId: cleanDraft\.currentNegotiationOrderId \|\| operationalOrderSync\.orderId/);
    assert.match(admin, /payload\.get\("repurchase_cycle"\)/);
    assert.match(orders, /alreadySent: purchase\.alreadySent \|\| false/);
    assert.doesNotMatch(whatsapp, /authorize-submit|dispatch\/run/);
});
