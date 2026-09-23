import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildCreativeSalesMetricsV185,
    clearCreativeSalesMetricsV185CacheForTests,
    collectCreativeSalesFactsV185,
    loadCreativeMetaInsightsV185
} from '../src/services/creativeSalesMetricsV185Service.js';

const startAt = new Date('2026-09-18T05:00:00.000Z');
const endAt = new Date('2026-09-19T05:00:00.000Z');
const identity = { country: 'EC', productKey: 'tex_ultra_ec', funnel: 'PROTOCOLO_G' };
const visit = (id, adId, hour = 13) => ({
    _id: id,
    visitorKey: `visitor-${id}`,
    ...identity,
    firstSeenAt: `2026-09-18T${String(hour).padStart(2, '0')}:00:00.000Z`,
    campaignId: '120248999999900192',
    adsetId: '120248999999910192',
    adId,
    clickCount: 1,
    lastClickAt: `2026-09-18T${String(hour).padStart(2, '0')}:05:00.000Z`,
    protocoloGStages: {}
});

const availableMeta = rows => ({ status: 'available', source: 'live', rows, mutationCount: 0 });

test('descobre IDs persistidos atuais independentemente do nome da campanha', () => {
    const facts = collectCreativeSalesFactsV185({
        visits: [
            visit('v1', '120249000642680192'),
            visit('v2', '120249000412380192')
        ],
        startAt,
        endAt
    });
    assert.deepEqual(facts.discoveredAdIds.sort(), ['120249000412380192', '120249000642680192']);
    assert.equal(facts.earlyStages, 'NO_DATA');
});

test('descobre criativo por clique atual mesmo quando a primeira visita e anterior ao periodo', () => {
    const previousVisit = {
        ...visit('v-old', '120249000642680192'),
        firstSeenAt: '2026-09-17T20:00:00.000Z',
        lastClickAt: '2026-09-18T14:05:00.000Z',
        clickCount: 3
    };
    const facts = collectCreativeSalesFactsV185({ visits: [previousVisit], startAt, endAt });
    assert.deepEqual(facts.discoveredAdIds, ['120249000642680192']);
    assert.equal(facts.rows[0].entries, 0);
    assert.equal(facts.rows[0].whatsappClicks, 3);
});

test('venda sem ID fica em SEM_ATRIBUICAO e nunca e creditada a um criativo', () => {
    const facts = collectCreativeSalesFactsV185({
        visits: [visit('v1', '120249000642680192')],
        contacts: [{
            countryCode: 'EC', firstInboundAt: '2026-09-18T14:00:00.000Z',
            metadata: { vslVisitId: 'v1', customerDraft: { orderId: 'ORDER-1' } }
        }],
        orders: [{
            orderId: 'ORDER-1', country: 'EC', status: 'confirmado', total: 80.99,
            confirmedAt: '2026-09-18T15:00:00.000Z', tracking: {}
        }],
        startAt,
        endAt
    });
    const snapshot = buildCreativeSalesMetricsV185({ facts, meta: availableMeta([]), startDay: '2026-09-18', endDay: '2026-09-18' });
    assert.equal(snapshot.rows.find(row => row.adId === '120249000642680192').sales, 0);
    const unattributed = snapshot.rows.find(row => row.key === 'SEM_ATRIBUICAO');
    assert.equal(unattributed.sales, 1);
    assert.equal(unattributed.revenue, 80.99);
});

test('radar cobre NO_DATA, LEARNING, READY e DEGRADED com verba fail-closed', () => {
    const emptyFacts = collectCreativeSalesFactsV185({ startAt, endAt });
    const noData = buildCreativeSalesMetricsV185({ facts: emptyFacts, meta: { status: 'no_data', rows: [] }, startDay: '2026-09-18', endDay: '2026-09-18' });
    assert.equal(noData.radar.state, 'NO_DATA');
    assert.equal(noData.radar.suggestedDailyBudget, null);

    const smallFacts = collectCreativeSalesFactsV185({ visits: [visit('v1', 'a1')], startAt, endAt });
    const learning = buildCreativeSalesMetricsV185({ facts: smallFacts, meta: availableMeta([{ adId: 'a1', spend: 10, landingPageViews: 1 }]), startDay: '2026-09-18', endDay: '2026-09-18' });
    assert.equal(learning.radar.state, 'LEARNING');
    assert.equal(learning.radar.action, 'AGUARDAR');
    assert.equal(learning.radar.confidence, 'LOW');
    assert.equal(learning.radar.leaderAdId, 'a1');
    assert.equal(learning.radar.bestWindow.label, '08h–09h');
    assert.equal(learning.radar.suggestedDailyBudget, null);

    const degraded = buildCreativeSalesMetricsV185({ facts: smallFacts, meta: { status: 'degraded', rows: [] }, startDay: '2026-09-18', endDay: '2026-09-18' });
    assert.equal(degraded.radar.state, 'DEGRADED');
    assert.equal(degraded.radar.confidence, 'DEGRADED');
    assert.equal(degraded.radar.degradationReason, 'META_DATA_UNAVAILABLE');
    assert.equal(degraded.radar.suggestedDailyBudget, null);

    const readyFacts = collectCreativeSalesFactsV185({
        visits: Array.from({ length: 20 }, (_, index) => visit(`v${index}`, 'a1')),
        correlations: Array.from({ length: 10 }, (_, index) => ({ status: 'CLAIMED', visitId: `v${index}`, inboundAt: `2026-09-18T14:${String(index).padStart(2, '0')}:00.000Z` })),
        orders: [0, 1].map(index => ({
            country: 'EC', orderId: `ORDER-${index}`, status: 'confirmado', total: 80.99,
            confirmedAt: `2026-09-18T15:0${index}:00.000Z`,
            tracking: { ...identity, attributionVisitorKey: `visitor-v${index}`, ad_id: 'a1' }
        })),
        startAt,
        endAt
    });
    const ready = buildCreativeSalesMetricsV185({ facts: readyFacts, meta: availableMeta([{ adId: 'a1', spend: 100, landingPageViews: 20, linkClicks: 25 }]), startDay: '2026-09-18', endDay: '2026-09-18' });
    assert.equal(ready.radar.state, 'READY');
    assert.equal(ready.radar.confidence, 'MEDIUM');
    assert.ok(ready.radar.suggestedDailyBudget > 0);
    assert.equal(ready.writeCount, 0);
    assert.equal(ready.metaMutationCount, 0);
});

test('tracking gap mostra VSL 8 e LPV Meta 0 sem inverter o sinal', () => {
    const facts = collectCreativeSalesFactsV185({
        visits: Array.from({ length: 8 }, (_, index) => visit(`v${index}`, 'a1')),
        startAt,
        endAt
    });
    const snapshot = buildCreativeSalesMetricsV185({ facts, meta: availableMeta([{ adId: 'a1', landingPageViews: 0 }]), startDay: '2026-09-18', endDay: '2026-09-18' });
    assert.deepEqual(snapshot.trackingGap, {
        vslEntries: 8,
        metaLandingPageViews: 0,
        vslMinusMeta: 8,
        metaMinusVsl: 0,
        coverage: 0
    });
});

test('Meta V185 usa somente GET, ignora nome textual e aceita campanha renomeada', async () => {
    clearCreativeSalesMetricsV185CacheForTests();
    const methods = [];
    const result = await loadCreativeMetaInsightsV185({
        adIds: ['120249000642680192'],
        startDay: '2026-09-18',
        endDay: '2026-09-18',
        accountId: '123',
        token: 'fixture',
        fetchImpl: async (url, options) => {
            methods.push(options.method);
            if (String(url).includes('/insights?')) return new Response(JSON.stringify({ data: [{
                campaign_id: 'c1', campaign_name: 'Nome completamente renomeado', adset_id: 's1',
                ad_id: '120249000642680192', ad_name: 'Novo rótulo', impressions: '100', reach: '80',
                clicks: '20', inline_link_clicks: '15', spend: '12', actions: [{ action_type: 'landing_page_view', value: '8' }]
            }] }), { status: 200 });
            return new Response(JSON.stringify({
                id: '120249000642680192', name: 'Novo rótulo', effective_status: 'ACTIVE',
                campaign: { id: 'c1', name: 'Nome completamente renomeado' },
                adset: { id: 's1', name: 'Conjunto novo' }, creative: { id: 'cr1', name: 'Criativo novo' }
            }), { status: 200 });
        }
    });
    assert.equal(result.status, 'available');
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].campaignName, 'Nome completamente renomeado');
    assert.equal(result.rows[0].landingPageViews, 8);
    assert.equal(result.rows[0].status, '');
    assert.equal(result.rows[0].effectiveStatus, 'ACTIVE');
    assert.equal(result.rows[0].ctr, 15);
    assert.equal(result.rows[0].cpc, 0.8);
    assert.equal(result.rows[0].cpm, 120);
    assert.equal(methods.every(method => method === 'GET'), true);
    assert.equal(result.mutationCount, 0);
});

test('cache V185 e somente memoria por cinco minutos e evita nova chamada Meta', async () => {
    clearCreativeSalesMetricsV185CacheForTests();
    let calls = 0;
    const options = {
        adIds: ['future-ad-id'], startDay: '2026-09-18', endDay: '2026-09-18', accountId: '123', token: 'fixture',
        now: new Date('2026-09-18T20:00:00.000Z'),
        fetchImpl: async url => {
            calls += 1;
            if (String(url).includes('/insights?')) return new Response(JSON.stringify({ data: [] }), { status: 200 });
            return new Response(JSON.stringify({ id: 'future-ad-id', name: 'Novo anúncio futuro' }), { status: 200 });
        }
    };
    const live = await loadCreativeMetaInsightsV185(options);
    const firstCallCount = calls;
    const cached = await loadCreativeMetaInsightsV185({ ...options, now: new Date('2026-09-18T20:04:59.000Z') });
    assert.equal(live.source, 'live');
    assert.equal(cached.source, 'memory_cache');
    assert.equal(calls, firstCallCount);
});
