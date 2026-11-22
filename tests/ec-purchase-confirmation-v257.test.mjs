import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePurchaseIntentV254 } from '../src/services/metaPurchaseDeliveryV254Service.js';

const policy = Object.freeze({
    kind: 'EC_ORDER_INTEGRATION_V254',
    isCurrent: () => true,
    activatedAt: () => '2026-11-01T00:00:00.000Z'
});

const confirmedOrder = (orderId, previousOrderId = '') => ({
    country: 'EC', orderId, previousOrderId, status: 'confirmed',
    confirmedAt: new Date('2026-11-21T18:00:00.000Z'),
    customer: { phone: '+593991234567' },
    package: { quantity: 2 }, total: 70, currency: 'USD',
    tracking: { productKey: 'tex_ultra_ec' }
});

test('confirmação cria uma intenção única, inclusive para recompra com identidade própria', () => {
    const previous = globalThis.__VITALISMEN_EC_ORDER_INTEGRATION_V254;
    globalThis.__VITALISMEN_EC_ORDER_INTEGRATION_V254 = policy;
    try {
        const first = confirmedOrder('EC-FIRST-1');
        const repurchase = confirmedOrder('EC-REBUY-2', first.orderId);
        assert.equal(preparePurchaseIntentV254(first, { transition: true }), true);
        assert.equal(preparePurchaseIntentV254(first, { transition: true }), false);
        assert.equal(preparePurchaseIntentV254(repurchase, { transition: true }), true);
        assert.notEqual(first.purchaseDeliveryV254.ledgerId, repurchase.purchaseDeliveryV254.ledgerId);
        assert.equal(repurchase.purchaseDeliveryV254.state, 'pending');
    } finally {
        if (previous === undefined) delete globalThis.__VITALISMEN_EC_ORDER_INTEGRATION_V254;
        else globalThis.__VITALISMEN_EC_ORDER_INTEGRATION_V254 = previous;
    }
});

test('status sem confirmação ou pedido incompleto não cria venda Meta', () => {
    const previous = globalThis.__VITALISMEN_EC_ORDER_INTEGRATION_V254;
    globalThis.__VITALISMEN_EC_ORDER_INTEGRATION_V254 = policy;
    try {
        const pending = confirmedOrder('EC-PENDING-1');
        pending.status = 'pending';
        assert.equal(preparePurchaseIntentV254(pending, { transition: true }), false);
        const incomplete = confirmedOrder('EC-INCOMPLETE-1');
        incomplete.total = 0;
        assert.equal(preparePurchaseIntentV254(incomplete, { transition: true }), false);
    } finally {
        if (previous === undefined) delete globalThis.__VITALISMEN_EC_ORDER_INTEGRATION_V254;
        else globalThis.__VITALISMEN_EC_ORDER_INTEGRATION_V254 = previous;
    }
});
