import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMetricsSiteSummaryV257 } from '../src/services/metricsSiteSummaryV257Service.js';

test('separa Tex e origem desconhecida; conta recompra na confirmação e nunca por horário inferido', () => {
    const startAt = new Date('2026-11-21T05:00:00Z');
    const endAt = new Date('2026-11-22T05:00:00Z');
    const visits = [{ country: 'EC', sourceUrl: 'https://plusmen.shop/tex?fbclid=abc', firstSeenAt: startAt }];
    const orders = [
        { country: 'EC', orderId: 'EC-REBUY-1', status: 'confirmed', confirmedAt: new Date('2026-11-21T20:00:00Z'),
            createdAt: new Date('2026-11-19T20:00:00Z'), total: 70,
            tracking: { sourceUrl: 'https://plusmen.shop/tex', metaPurchaseSentAt: new Date('2026-11-21T20:01:00Z'), metaPurchaseResponse: { events_received: 1 } } },
        { country: 'EC', orderId: 'EC-OTHER-2', status: 'confirmed', confirmedAt: new Date('2026-11-21T21:00:00Z'), total: 35.99,
            purchaseDeliveryV254: { state: 'pending' }, tracking: {} }
    ];
    const rows = buildMetricsSiteSummaryV257({ visits, orders, startAt, endAt });
    assert.deepEqual(rows.map((row) => row.site).sort(), ['SEM_ORIGEM_COMPROVADA', 'plusmen.shop/tex'].sort());
    assert.deepEqual(rows.find((row) => row.site === 'plusmen.shop/tex'), {
        site: 'plusmen.shop/tex', visits: 1, confirmedSales: 1, purchasePending: 0,
        metaAccepted: 1, metaAttributed: 0, revenue: 70
    });
    assert.equal(rows.find((row) => row.site === 'SEM_ORIGEM_COMPROVADA').purchasePending, 1);
});
