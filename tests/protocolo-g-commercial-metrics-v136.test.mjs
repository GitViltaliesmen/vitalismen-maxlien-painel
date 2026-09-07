import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProtocoloGCommercialMetrics } from '../src/services/protocoloGCommercialMetricsService.js';

const now = '2026-09-07T12:00:00Z';
const base = { startAt: '2026-09-01T05:00:00Z', endAt: now };
const origin = { country: 'EC', tracking: { productKey: 'tex_ultra_ec', funnel: 'PROTOCOLO_G' } };
test('criativo A converte, B nao converte, sem identificador fica SEM_ATRIBUICAO', () => {
    const visits = ['A', 'B'].map(id => ({ ...origin, _id: id, visitorKey: 'visit-' + id, adId: id }));
    const contacts = visits.map(v => ({ _id: 'contact-' + v._id, firstInboundAt: now, conversationBucket: { value: 'attendance' },
        metadata: { vslVisitId: v._id, metaAttributionBridge: { claimedAt: now }, customerDraft: { orderId: v._id === 'A' ? 'order-A' : '' } } }));
    const orders = [{ ...origin, orderId: 'order-A', status: 'confirmed', total: 35.99, createdAt: now,
        tracking: { ...origin.tracking, attributionVisitorKey: 'visit-A', attributionCorrelationStatus: 'CLAIMED' } },
    { ...origin, orderId: 'unknown', status: 'confirmed', total: 70, createdAt: now }];
    const result = buildProtocoloGCommercialMetrics({ ...base, visits, contacts, orders, ads: visits.map(v => ({ adId: v.adId, landing: 1, whatsappClicks: 1 })) });
    const byId = new Map(result.ads.map(a => [a.adId || 'SEM_ATRIBUICAO', a]));
    assert.equal(byId.get('A').confirmed, 1); assert.equal(byId.get('B').confirmed, 0);
    assert.equal(byId.get('A').commercialLeads, 1); assert.equal(byId.get('SEM_ATRIBUICAO').orders, 1);
    assert.equal(byId.get('A').evidence.find(e => e.orderId)?.visitorKey, 'visit-A');
});
test('aquecimento, QA e vinculo ambiguo nunca viram venda atribuida por telefone', () => {
    const visits = [{ ...origin, _id: 'v', visitorKey: 'key', adId: 'A' }];
    const contacts = [{ _id: 'warmup', conversationBucket: { value: 'engagement' }, metadata: { vslVisitId: 'v', customerDraft: { orderId: 'warmup-order' } } }];
    const orders = [{ ...origin, orderId: 'warmup-order', status: 'confirmed', createdAt: now },
        { ...origin, orderId: 'ambiguous', status: 'confirmed', createdAt: now, tracking: { ...origin.tracking, ad_id: 'A', attributionCorrelationStatus: 'AMBIGUOUS' } }];
    const result = buildProtocoloGCommercialMetrics({ ...base, visits, contacts, orders });
    assert.equal(result.ads.length, 1); assert.equal(result.ads[0].attribution, 'SEM_ATRIBUICAO'); assert.equal(result.ads[0].orders, 1);
});
test('status logistico usa orderId, preserva origem apos troca manual e evita duplicacao', () => {
    const order = { orderId: 'o', country: 'EC', status: 'delivered', total: 95.99, createdAt: now,
        tracking: { productKey: 'vit_power_ec', sourceUrl: 'https://vilaliemen.shop/protocolo-g', ad_id: 'A' } };
    const result = buildProtocoloGCommercialMetrics({ ...base, orders: [order, order], shipments: [{ orderId: 'o', automation: { submittedToDroppiAt: now } }] });
    assert.equal(result.ads[0].orders, 1); assert.equal(result.ads[0].shipped, 1); assert.equal(result.ads[0].delivered, 1);
    assert.equal(result.ads[0].orderValue, 95.99);
});

test('nao copia vendas ou conversas de aquecimento do agregado antigo; status e valores nao sao inventados', () => {
    const result = buildProtocoloGCommercialMetrics({ ...base, ads: [{ adId: 'A', landing: 2, attributedConversations: 5, salesCreated: 4, purchasesSent: 3 }],
        orders: ['cancelled', 'returned'].map(status => ({ ...origin, orderId: status, createdAt: now, status, total: 'invalid', tracking: { ...origin.tracking, ad_id: 'A' } })) });
    const row = result.ads[0];
    assert.equal(row.attributedConversations, 0); assert.equal(row.salesCreated, 2); assert.equal(row.purchasesSent, 0);
    assert.equal(row.cancelled, 1); assert.equal(row.returned, 1); assert.equal(row.orderValue, 0);
    assert.equal(row.confirmed, 0); assert.equal(row.shipped, 0);
});

test('outro pais e origem desconhecida nao sao atribuídos ao Protocolo-G', () => {
    const result = buildProtocoloGCommercialMetrics({ ...base, orders: [
        { country: 'EC', orderId: 'unknown-origin', createdAt: now, status: 'confirmed', tracking: { ad_id: 'A' } },
        { ...origin, country: 'XX', orderId: 'other-country', createdAt: now }
    ] });
    assert.equal(result.ads.length, 0); assert.equal(result.coverage.unknownOriginOrders, 1);
});

test('identificadores contraditorios entre pedido e visita ficam sem atribuicao', () => {
    const result = buildProtocoloGCommercialMetrics({ ...base,
        visits: [{ ...origin, _id: 'v', visitorKey: 'v-key', adId: 'B' }],
        orders: [{ ...origin, orderId: 'o', createdAt: now, status: 'confirmed', tracking: {
            ...origin.tracking, ad_id: 'A', attributionVisitorKey: 'v-key', attributionCorrelationStatus: 'CLAIMED'
        } }] });
    assert.equal(result.ads[0].attribution, 'SEM_ATRIBUICAO');
});

test('rota oficial carrega vinculos e remessa por IDs, entrega ciclo comercial sem escrita', async () => {
    const { createFunnelMetricsHandler } = await import('../src/routes/funnelMetrics.js');
    const queries = [];
    const model = (kind, rows) => ({ find(query) { queries.push({ kind, query }); return {
        select() { return this; }, lean: async () => rows
    }; } });
    const order = { ...origin, orderId: 'o', createdAt: now, status: 'shipped', total: 35.99, tracking: { ...origin.tracking, ad_id: 'A' } };
    const handler = createFunnelMetricsHandler({ VisitModel: model('visits', []), OrderModel: model('orders', [order]),
        ContactModel: model('contacts', []), ShipmentModel: model('shipments', [{ orderId: 'o', automation: { submittedToDroppiAt: now } }]),
        CorrelationModel: model('correlations', []), clock: () => new Date(now), pixelId: () => '', datasetIdForOrder: () => '', adsInsights: async () => ({ status: 'unavailable' }) });
    const res = { set() {}, json(body) { this.body = body; }, status(code) { this.statusCode = code; return this; } };
    await handler({ query: { days: '7' } }, res);
    assert.equal(res.body.protocoloG.commercial.ads[0].shipped, 1);
    assert.deepEqual(queries.find(q => q.kind === 'shipments').query, { country: 'EC', orderId: { $in: ['o'] } });
    assert.equal(queries.find(q => q.kind === 'contacts').query.countryCode, 'EC');
});
