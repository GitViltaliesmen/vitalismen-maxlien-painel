import assert from 'node:assert/strict';
import test from 'node:test';

import funnelMetricsRoutes, { createCreativeSalesMetricsV185Handler } from '../src/routes/funnelMetrics.js';

const fakeModel = (rows, queries = []) => ({
    find(query) {
        queries.push(query);
        return { select() { return this; }, lean() { return Promise.resolve(rows); } };
    }
});

const fakeResponse = () => ({
    statusCode: 200, headers: {}, body: null,
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; }
});

test('endpoint V185 exige autenticação administrativa e opt-in scope=protocolo-g', async () => {
    const layer = funnelMetricsRoutes.stack.find(item => item.route?.path === '/creative-sales');
    assert.ok(layer);
    assert.deepEqual(layer.route.stack.map(item => item.handle.name), ['authMiddleware', 'adminOnly', '']);
    const handler = createCreativeSalesMetricsV185Handler();
    const response = fakeResponse();
    await handler({ query: {} }, response);
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { error: 'scope canonico de creative-sales e obrigatorio.' });
});

test('endpoint V185 faz somente leituras e retorna IDs persistidos sem depender do nome', async () => {
    const queries = [];
    const visitRows = [{
        _id: 'visit-1', visitorKey: 'visitor-1', country: 'EC', productKey: 'tex_ultra_ec', funnel: 'PROTOCOLO_G',
        firstSeenAt: '2026-09-18T13:00:00.000Z', campaignId: 'campaign-renamed', adsetId: 'adset-1', adId: '120249000642680192'
    }];
    const metaCalls = [];
    const handler = createCreativeSalesMetricsV185Handler({
        VisitModel: fakeModel(visitRows, queries),
        OrderModel: fakeModel([], queries),
        CorrelationModel: fakeModel([], queries),
        ContactModel: fakeModel([], queries),
        MessageModel: fakeModel([], queries),
        clock: () => new Date('2026-09-18T20:00:00.000Z'),
        metaInsights: async options => {
            metaCalls.push(options);
            return { status: 'available', source: 'live', rows: [{
                adId: '120249000642680192', campaignId: 'campaign-renamed', campaignName: 'Campanha renomeada',
                adsetId: 'adset-1', adsetName: 'Conjunto', adName: 'Anúncio', creativeId: 'creative-1',
                creativeName: 'Criativo', impressions: 10, reach: 8, clicks: 2, linkClicks: 2,
                landingPageViews: 1, spend: 1
            }], mutationCount: 0 };
        }
    });
    const response = fakeResponse();
    await handler({ query: { scope: 'protocolo-g', days: '1' } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(response.body.version, 'V185');
    assert.deepEqual(response.body.ids.ad, ['120249000642680192']);
    assert.equal(response.body.rows[0].campaignName, 'Campanha renomeada');
    assert.equal(response.body.writeCount, 0);
    assert.equal(response.body.metaMutationCount, 0);
    assert.equal(metaCalls.length, 1);
    assert.deepEqual(metaCalls[0].adIds, ['120249000642680192']);
    assert.equal(queries.length, 5);
});
