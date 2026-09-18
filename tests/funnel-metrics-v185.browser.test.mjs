import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const pageErrors = [];
const mutationRequests = [];
const baseSnapshot = {
    generatedAt: '2026-09-18T20:00:00.000Z', days: 1, totals: { entries: 8 }, rows: [],
    recentAttributionOrders: [], recentPurchases: [], recentMissingPurchases: [],
    metaAds: { status: 'available', source: 'live', fetchedAt: '2026-09-18T20:00:00.000Z', startDay: '2026-09-18', endDay: '2026-09-18', totals: { landingPageViews: 0 }, ads: [], creativeMapping: [] },
    protocoloG: { totals: {}, rows: [], ads: [], commercial: { ads: [], coverage: { unknownOriginContacts: 0, unknownOriginOrders: 0 } } },
    operational: {
        totals: {}, rates: {}, health: {}, unmatchedRootCauses: {}, alerts: [], integrity: { status: 'PASS' },
        freshness: { metricsComputedAt: '2026-09-18T20:00:00.000Z' }
    }
};
const creativeSnapshot = {
    version: 'V185', computedAt: '2026-09-18T20:00:01.000Z',
    meta: { status: 'available', source: 'live' },
    totals: { entries: 8, landingPageViews: 0, conversations: 4, leads: 4, orders: 1, sales: 1, attributedSales: 0, revenue: 80.99, attributionCoverage: 80 },
    trackingGap: { vslEntries: 8, metaLandingPageViews: 0, vslMinusMeta: 8, metaMinusVsl: 0, coverage: 0 },
    rows: [
        { key: 'SEM_ATRIBUICAO', campaignId: '', adsetId: '', adId: '', creativeId: '', impressions: 0, reach: 0, clicks: 0, landingPageViews: 0, spend: 0, conversations: 0, leads: 0, orders: 1, sales: 1, revenue: 80.99, attribution: 'SEM_ATRIBUICAO' },
        { key: '120249000642680192', campaignId: 'c1', campaignName: 'Campanha renomeada', adsetId: 's1', adsetName: 'Conjunto 1', adId: '120249000642680192', adName: 'Anúncio 1', creativeId: 'cr1', creativeName: 'Criativo 1', impressions: 100, reach: 80, linkClicks: 15, landingPageViews: 0, spend: 10, conversations: 3, leads: 3, orders: 0, sales: 0, revenue: 0, attribution: 'PERSISTED_ID' },
        { key: '120249000412380192', campaignId: 'c2', campaignName: 'Outro nome', adsetId: 's2', adsetName: 'Conjunto 2', adId: '120249000412380192', adName: 'Anúncio 2', creativeId: 'cr2', creativeName: 'Criativo 2', impressions: 50, reach: 40, linkClicks: 7, landingPageViews: 0, spend: 5, conversations: 1, leads: 1, orders: 0, sales: 0, revenue: 0, attribution: 'PERSISTED_ID' }
    ],
    radar: {
        state: 'LEARNING', confidence: 'LOW', action: 'AGUARDAR', leaderAdId: '120249000642680192', leaderLabel: 'Criativo 1',
        score: { total: 42, formula: '20% qualidade + 25% conversa + 30% vendas + 15% custo + 10% amostra', components: { traffic_quality: 0, conversation_rate: 38, sales_evidence: 0, cost_efficiency: 0, sample_confidence: 40 } },
        hours: Array.from({ length: 24 }, (_, hour) => ({ hour, entries: hour === 13 ? 8 : 0, conversations: hour === 14 ? 4 : 0, score: hour === 14 ? 100 : hour === 13 ? 70 : 0 })),
        bestWindow: { hour: 14, label: '14h–15h', entries: 0, conversations: 4 },
        allocationPercent: null, suggestedDailyBudget: null,
        explanation: 'Há sinal real, mas a amostra ainda não autoriza sugestão de verba.'
    }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
page.on('pageerror', error => pageErrors.push(error.message));
page.on('request', request => {
    if (!['GET', 'OPTIONS'].includes(request.method())) mutationRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
});
await page.addInitScript(() => localStorage.setItem('vitalismen_admin_token', 'v185-browser-fixture'));
await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'panel.test') return route.abort();
    if (url.pathname === '/funnel-metrics.html') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(root, 'public/funnel-metrics.html'), 'utf8') });
    if (url.pathname === '/api/funnel-metrics/creative-sales') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(creativeSnapshot) });
    if (url.pathname === '/api/funnel-metrics') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(baseSnapshot) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
});

try {
    await page.goto('https://panel.test/funnel-metrics.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('#creativeSalesRows tr');
    assert.match(await page.locator('#creativeSalesStatus').innerText(), /V185/);
    assert.match(await page.locator('#creativeSalesMetrics').innerText(), /VSL − Meta\s*8/);
    assert.match(await page.locator('#creativeSalesMetrics').innerText(), /Cobertura de tracking\s*0%/);
    assert.match(await page.locator('#creativeSalesRows').innerText(), /120249000642680192/);
    assert.match(await page.locator('#creativeSalesRows').innerText(), /120249000412380192/);
    assert.match(await page.locator('#creativeSalesRows').innerText(), /SEM_ATRIBUICAO/);
    assert.equal(await page.locator('#radarConfidence').innerText(), 'LEARNING · LOW');
    assert.match(await page.locator('#radarCreative').innerText(), /Anúncio 1 · 120249000642680192/);
    assert.match(await page.locator('#radarCreativeNote').innerText(), /Criativo 1 · cr1/);
    assert.equal(await page.locator('#radarBestWindow').innerText(), '14h–15h');
    assert.equal(await page.locator('#radarBudget').innerText(), '—');
    assert.match(await page.locator('#radarBudgetNote').innerText(), /Amostra insuficiente/);
    assert.equal(await page.locator('.radar-hour-bar').count(), 24);
    const positions = await page.evaluate(() => ({
        summary: document.querySelector('#metrics').getBoundingClientRect().top,
        health: document.querySelector('#integrationHealth').closest('section').getBoundingClientRect().top,
        meta: document.querySelector('#metaAdsMetrics').closest('section').getBoundingClientRect().top,
        creatives: document.querySelector('#creativeSalesPanel').getBoundingClientRect().top,
        radar: document.querySelector('#investmentRadarPanel').getBoundingClientRect().top,
        lastSection: [...document.querySelectorAll('main > section')].at(-1).id
    }));
    assert.ok(positions.summary < positions.health && positions.health < positions.meta && positions.meta < positions.creatives && positions.creatives < positions.radar);
    assert.equal(positions.lastSection, 'investmentRadarPanel');
    for (const selector of ['[data-radar-action="invest"]', '[data-radar-action="hold"]', '[data-radar-action="wait"]']) await page.locator(selector).click();
    assert.equal(await page.locator('[data-radar-action="wait"].active-wait').count(), 1);
    assert.deepEqual(mutationRequests, []);
    assert.deepEqual(pageErrors, []);

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `overflow horizontal da página: ${overflow}px`);
} finally {
    await browser.close();
}
