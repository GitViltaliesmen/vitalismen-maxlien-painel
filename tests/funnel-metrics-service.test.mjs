import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    buildFunnelMetricsSnapshot,
    clampFunnelMetricsDays,
    ecuadorDayKey,
    ecuadorMetricsRange,
    funnelMetricsMongoWindow
} from '../src/services/funnelMetricsService.js';

const now = new Date('2026-08-15T15:00:00.000Z');

test('calcula a janela pelo dia civil do Equador e limita o periodo', () => {
    const range = ecuadorMetricsRange({ days: 2, now });
    assert.equal(range.startAt.toISOString(), '2026-08-14T05:00:00.000Z');
    assert.equal(range.endAt.toISOString(), now.toISOString());
    assert.equal(ecuadorDayKey('2026-08-15T04:59:59.000Z'), '2026-08-14');
    assert.equal(ecuadorDayKey('2026-08-15T05:00:00.000Z'), '2026-08-15');
    assert.equal(clampFunnelMetricsDays('0'), 1);
    assert.equal(clampFunnelMetricsDays('999'), 90);
    assert.equal(clampFunnelMetricsDays('invalido'), 7);
});

test('soma VSL, vendas e Purchase sem misturar pedidos inelegiveis', () => {
    const visits = [
        {
            firstSeenAt: '2026-08-14T05:00:00.000Z',
            visits: 3,
            metaPageViewSentAt: '2026-08-14T05:00:02.000Z',
            lastClickAt: '2026-08-14T07:00:00.000Z',
            metaLeadSentAt: '2026-08-14T07:01:00.000Z'
        },
        {
            firstSeenAt: '2026-08-15T04:59:59.000Z',
            visits: 1,
            metaPageViewSentAt: '2026-08-15T04:59:59.000Z'
        },
        {
            firstSeenAt: '2026-08-15T05:01:00.000Z',
            visits: 1,
            lastClickAt: '2026-08-15T06:00:00.000Z'
        }
    ];
    const orders = [
        {
            orderId: 'EC-1',
            customer: { name: 'Cliente Um', phone: 'nao-expor' },
            status: 'confirmed',
            total: 35.99,
            entryAt: '2026-08-14T08:00:00.000Z',
            tracking: {
                metaPurchaseSentAt: '2026-08-15T05:30:00.000Z',
                metaPurchaseResponse: { events_received: 1 },
                fbp: 'fb.1'
            }
        },
        {
            orderId: 'EC-2',
            customer: { name: 'Cliente Dois' },
            status: 'shipped',
            total: 70,
            entryAt: '2026-08-15T06:00:00.000Z',
            tracking: { fbclid: 'click-2' }
        },
        {
            orderId: 'EC-DRAFT',
            customer: { name: 'Rascunho' },
            status: 'draft',
            total: 10,
            entryAt: '2026-08-15T07:00:00.000Z',
            tracking: {}
        },
        {
            orderId: 'EC-OLD',
            customer: { name: 'Compra anterior' },
            status: 'delivered',
            total: 80,
            entryAt: '2026-08-01T07:00:00.000Z',
            tracking: {
                metaPurchaseSentAt: '2026-08-15T08:00:00.000Z',
                metaPurchaseResponse: { data: { events_received: 1 } }
            }
        }
    ];

    const snapshot = buildFunnelMetricsSnapshot({ visits, orders, days: 2, now, pixelId: 'pixel-ec' });
    assert.deepEqual(snapshot.rows.map((row) => row.day), ['2026-08-14', '2026-08-15']);
    assert.equal(snapshot.rows[0].entries, 2);
    assert.equal(snapshot.rows[0].repeatViews, 2);
    assert.equal(snapshot.rows[1].entries, 1);
    assert.equal(snapshot.totals.entries, 3);
    assert.equal(snapshot.totals.pageViewsSent, 2);
    assert.equal(snapshot.totals.whatsappVisitors, 2);
    assert.equal(snapshot.totals.clickRate, 66.7);
    assert.equal(snapshot.totals.leadsSent, 1);
    assert.equal(snapshot.totals.salesCreated, 3);
    assert.equal(snapshot.totals.salesValue, 115.99);
    assert.equal(snapshot.totals.purchasesSent, 2);
    assert.equal(snapshot.totals.purchaseValueSent, 115.99);
    assert.equal(snapshot.totals.purchaseCoverage, 50);
    assert.equal(snapshot.totals.missingPurchaseEligible, 1);
    assert.deepEqual(snapshot.recentPurchases.map((order) => order.orderId), ['EC-OLD', 'EC-1']);
    assert.deepEqual(snapshot.recentMissingPurchases.map((order) => order.orderId), ['EC-2']);
    assert.equal(snapshot.recentPurchases[1].metaDelivery.eventsReceived, 1);
    assert.equal(snapshot.recentPurchases[1].metaDelivery.pixelId, 'pixel-ec');
    assert.equal('phone' in snapshot.recentPurchases[1].customer, false);
});

test('consulta Mongo cobre cada timestamp usado pelo contrato', () => {
    const window = funnelMetricsMongoWindow({ days: 7, now });
    assert.equal(window.visitQuery.country, 'EC');
    assert.equal(window.orderQuery.country, 'EC');
    assert.deepEqual(
        window.visitQuery.$or.map((item) => Object.keys(item)[0]),
        ['firstSeenAt', 'metaPageViewSentAt', 'lastClickAt', 'metaLeadSentAt']
    );
    assert.deepEqual(
        window.orderQuery.$or.map((item) => Object.keys(item)[0]),
        ['entryAt', 'draftCreatedAt', 'createdAt', 'tracking.metaPurchaseSentAt']
    );
});

test('registro operacional V34 fixa release e rollback sem expor credenciais', () => {
    const record = fs.readFileSync(new URL(
        '../docs/RESULTADO_ATIVACAO_PROTOCOLO_G_TEX_ULTRA_V34_20260822.md',
        import.meta.url
    ), 'utf8');
    assert.match(record, /20260822T002400Z_production-20260822-b50a86b/);
    assert.match(record, /20260821T225331Z_production-20260821-cb8f6fe/);
    assert.match(record, /257\/257/);
    assert.doesNotMatch(record, /(?:TOKEN|SECRET|PASSWORD|OPENAI_API_KEY|ZAPI_CLIENT_TOKEN)\s*=/i);
    assert.doesNotMatch(record, /\b(?:gho_|ghp_|sk-)[A-Za-z0-9_-]{12,}/);
});

test('registro da mídia manual fixa release, rollback e canários sem expor credenciais', () => {
    const record = fs.readFileSync(new URL(
        '../docs/RESULTADO_ATIVACAO_MIDIA_MANUAL_POS_VENDA_EC_20260822.md',
        import.meta.url
    ), 'utf8');
    assert.match(record, /20260822T025119Z_production-20260822-eedf503/);
    assert.match(record, /20260822T002400Z_production-20260822-b50a86b/);
    assert.match(record, /257\/257/);
    assert.match(record, /3EB048B7F966B52EB879B3/);
    assert.match(record, /3EB06945CA631B7AD042C5/);
    assert.match(record, /vídeo externo novo[\s\S]*permanece pendente/i);
    assert.doesNotMatch(record, /(?:TOKEN|SECRET|PASSWORD|OPENAI_API_KEY|ZAPI_CLIENT_TOKEN)\s*=/i);
    assert.doesNotMatch(record, /\b(?:gho_|ghp_|sk-)[A-Za-z0-9_-]{12,}/);
});
