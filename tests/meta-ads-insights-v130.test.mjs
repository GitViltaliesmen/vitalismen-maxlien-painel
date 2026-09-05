import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadMetaAdsInsights, summarizeMetaAdsInsights } from '../src/services/metaAdsInsightsService.js';

test('resume Marketing API por anuncio sem confundir alcance com Landing Page Views', () => {
    const result = summarizeMetaAdsInsights([
        {
            date_start: '2026-09-04', campaign_id: 'c1', campaign_name: 'EC | PURCHASE',
            adset_id: 's1', adset_name: 'LAL1', ad_id: 'a1', ad_name: 'Criativo 1',
            impressions: '1000', reach: '840', inline_link_clicks: '114', spend: '20.00',
            actions: [
                { action_type: 'landing_page_view', value: '93' },
                { action_type: 'offsite_conversion.fb_pixel_purchase', value: '2' }
            ]
        },
        {
            date_start: '2026-09-04', campaign_id: 'c1', campaign_name: 'EC | PURCHASE',
            adset_id: 's1', adset_name: 'LAL1', ad_id: 'a2', ad_name: 'Criativo 2',
            impressions: '200', reach: '114', inline_link_clicks: '20', spend: '2.67',
            actions: [{ action_type: 'landing_page_view', value: '17' }]
        }
    ]);
    assert.equal(result.totals.reach, 954);
    assert.equal(result.totals.impressions, 1200);
    assert.equal(result.totals.landingPageViews, 110);
    assert.equal(result.totals.purchases, 2);
    assert.equal(result.ads.length, 2);
});

test('consulta somente leitura, pagina, filtra campanha EC e grava cache sanitizado', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-ads-v130-'));
    const cacheFile = path.join(dir, 'ec.json');
    const calls = [];
    const fetchImpl = async (url, options) => {
        calls.push(String(url));
        assert.equal(options.method, 'GET');
        assert.equal(options.headers.Authorization, 'Bearer segredo');
        const parsed = new URL(url);
        if (parsed.pathname.endsWith('/me/adaccounts')) return new Response(JSON.stringify({
            data: [{ id: 'act_123', account_status: 1 }]
        }), { status: 200, headers: { 'content-type': 'application/json' } });
        return new Response(JSON.stringify({ data: [{
            date_start: '2026-09-04', campaign_name: 'EC | LAL1', ad_id: '1', ad_name: 'A',
            impressions: '10', reach: '9', inline_link_clicks: '8', spend: '1',
            actions: [{ action_type: 'landing_page_view', value: '7' }]
        }, {
            date_start: '2026-09-04', campaign_name: 'CO | IGNORAR', ad_id: '2', impressions: '50'
        }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const result = await loadMetaAdsInsights({
        days: 1,
        now: new Date('2026-09-05T02:00:00.000Z'),
        env: { META_ACCESS_TOKEN: 'segredo', META_ADS_CAMPAIGN_NAME_FILTER_EC: 'EC |' },
        fetchImpl,
        cacheFile
    });
    assert.equal(result.status, 'available');
    assert.equal(result.accountId, '123');
    assert.equal(result.totals.landingPageViews, 7);
    assert.equal(calls.every((url) => url.includes('/v26.0/')), true);
    assert.equal(calls.every((url) => !url.includes('segredo')), true);
    assert.equal(fs.readFileSync(cacheFile, 'utf8').includes('segredo'), false);
});

test('filtra pelo nome do conjunto de anuncios observado no Gerenciador', async () => {
    const result = await loadMetaAdsInsights({
        env: { META_ACCESS_TOKEN: 'segredo' },
        accountId: '26714145304913323',
        campaignFilter: 'EC | LAL1-ENTREGUES | M40+ | EXC-BUYERS | PURCHASE',
        cacheFile: path.join(os.tmpdir(), `meta-ads-v130-adset-${Date.now()}.json`),
        fetchImpl: async () => new Response(JSON.stringify({ data: [{
            date_start: '2026-09-03',
            campaign_name: 'PB1 | EC | SALES | TEX_ULTRA',
            adset_name: 'EC | LAL1-ENTREGUES | M40+ | EXC-BUYERS | PURCHASE',
            ad_id: '1',
            ad_name: 'POST-BUYERS | V1',
            impressions: '905',
            reach: '840',
            inline_link_clicks: '144',
            spend: '2.67'
        }] }), { status: 200, headers: { 'content-type': 'application/json' } })
    });
    assert.equal(result.status, 'available');
    assert.equal(result.ads.length, 1);
    assert.equal(result.totals.reach, 840);
});

test('explica permissao ads_read ausente sem derrubar as metricas locais', async () => {
    const result = await loadMetaAdsInsights({
        env: { META_ADS_ACCESS_TOKEN_EC: 'token-sem-ads-read' },
        cacheFile: path.join(os.tmpdir(), `meta-ads-v130-${Date.now()}.json`),
        fetchImpl: async () => new Response(JSON.stringify({
            error: { code: 200, message: '(#200) Missing Permissions' }
        }), { status: 403, headers: { 'content-type': 'application/json' } })
    });
    assert.equal(result.status, 'unavailable');
    assert.equal(result.errorCode, 'META_ADS_READ_PERMISSION_MISSING');
});

test('identifica token Meta expirado sem expor a credencial', async () => {
    const result = await loadMetaAdsInsights({
        env: { META_ACCESS_TOKEN: 'token-expirado' },
        accountId: '123',
        cacheFile: path.join(os.tmpdir(), `meta-ads-v130-expired-${Date.now()}.json`),
        fetchImpl: async () => new Response(JSON.stringify({
            error: { code: 190, error_subcode: 463, message: 'Session has expired' }
        }), { status: 400, headers: { 'content-type': 'application/json' } })
    });
    assert.equal(result.status, 'unavailable');
    assert.equal(result.errorCode, 'META_ACCESS_TOKEN_EXPIRED');
    assert.equal(JSON.stringify(result).includes('token-expirado'), false);
});
