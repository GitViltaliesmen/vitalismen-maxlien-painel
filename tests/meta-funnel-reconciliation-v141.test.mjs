import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    applyInvestmentRadarSafetyV141,
    resolveFunnelMetricsRange
} from '../src/services/funnelMetricsService.js';
import { buildFunnelOperationalMetricsV141 } from '../src/services/funnelOperationalMetricsV141Service.js';
import { loadMetaAdsInsights } from '../src/services/metaAdsInsightsService.js';
import { ensurePurchaseAfterHumanDropiSuccessV141 } from '../src/routes/shipments.js';

const startAt = new Date('2026-09-06T05:00:00.000Z');
const endAt = new Date('2026-09-08T05:00:00.000Z');
const contact = ({ phone, at, bucket = 'attendance' }) => ({
    countryCode: 'EC',
    phoneDigits: phone,
    firstInboundAt: at,
    tags: ['ZAPI_INBOUND_CAPTURED', 'VSL_EC', 'WHATSAPP_CLICK', 'TEX_ULTRA_EC'],
    conversationBucket: { value: bucket },
    metadata: { vslVariant: 'protocolo_g' }
});
const message = ({ phone, at, bot = false, delivered = true }) => ({
    _id: `${phone}-${at}-${bot}`,
    peerPhone: phone,
    createdAt: at,
    provider: 'zapi',
    providerMessageId: `${phone}-${at}`,
    isFromMe: bot,
    isBot: bot,
    type: bot ? 'audio' : 'chat',
    hasMedia: bot,
    deliveryStatus: delivered ? 'delivered' : 'failed',
    ack: delivered ? 2 : 0
});

test('janela explicita usa meia-noite de Guayaquil e limite final exclusivo', () => {
    const range = resolveFunnelMetricsRange({ fromDay: '2026-09-06', toDay: '2026-09-08' });
    assert.equal(range.startAt.toISOString(), startAt.toISOString());
    assert.equal(range.endAt.toISOString(), endAt.toISOString());
    assert.equal(range.days, 2);
    assert.equal(range.explicit, true);
});

test('funil V141 conta fatos persistidos mesmo depois da conversa mudar de fila', () => {
    const contacts = [
        contact({ phone: '593111111111', at: '2026-09-06T05:17:00.000Z', bucket: 'orders' }),
        contact({ phone: '593222222222', at: '2026-09-06T05:11:00.000Z' }),
        contact({ phone: '593333333333', at: '2026-09-07T05:50:00.000Z' })
    ];
    const messages = contacts.flatMap((item) => [
        message({ phone: item.phoneDigits, at: item.firstInboundAt }),
        message({ phone: item.phoneDigits, at: new Date(new Date(item.firstInboundAt).getTime() + 1000), bot: true })
    ]);
    const orders = [{
        country: 'EC', orderId: 'EC-ADMIN-FIXTURE', entryAt: '2026-09-07T05:51:00.000Z',
        customer: { phone: '+593333333333' }, status: 'processing', total: 80.99,
        tracking: { productKey: 'tex_ultra_ec' }
    }];
    const result = buildFunnelOperationalMetricsV141({ contacts, messages, orders, startAt, endAt,
        metaAds: { status: 'available', totals: { landingPageViews: 10 } } });
    assert.equal(result.semantics, 'event_history_in_canonical_window');
    assert.equal(result.totals.zapiInbound, 3);
    assert.equal(result.totals.botTriggered, 3);
    assert.equal(result.totals.botSent, 3);
    assert.equal(result.totals.botDelivered, 3);
    assert.equal(result.totals.ordersCreated, 1);
    assert.equal(result.totals.ordersConfirmed, 1);
    assert.equal(result.totals.purchaseEligible, 1);
    assert.equal(result.totals.purchaseSent, 0);
    assert.equal(result.totals.revenue, 80.99);
    assert.equal(result.integrity.status, 'PASS');
});

test('limite final exclusivo nao carrega evento da janela seguinte', () => {
    const result = buildFunnelOperationalMetricsV141({
        contacts: [contact({ phone: '593111111111', at: endAt })],
        messages: [message({ phone: '593111111111', at: endAt })],
        startAt,
        endAt
    });
    assert.equal(result.totals.zapiInbound, 0);
    assert.equal(result.totals.zapiInboundMessages, 0);
});

test('radar falha fechado para cache stale, fetch falho, janela divergente ou amostra baixa', () => {
    const base = { state: 'ready', sampleEntries: 50, bestWindow: { label: '09h-12h' } };
    for (const metaAds of [
        { status: 'available', fetchStatus: 'failed', stale: true, startDay: '2026-09-06', endDay: '2026-09-07' },
        { status: 'available', fetchStatus: 'ok', stale: false, startDay: '2026-09-05', endDay: '2026-09-07' }
    ]) {
        const result = applyInvestmentRadarSafetyV141(base, { metaAds, startDay: '2026-09-06', endDay: '2026-09-07' });
        assert.equal(result.enabled, false);
        assert.equal(result.bestWindow, null);
        assert.equal(result.creativeWinner, null);
        assert.equal(result.budgetSuggestion, null);
    }
    const low = applyInvestmentRadarSafetyV141({ ...base, sampleEntries: 19 }, {
        metaAds: { status: 'available', fetchStatus: 'ok', stale: false, startDay: '2026-09-06', endDay: '2026-09-07' },
        startDay: '2026-09-06', endDay: '2026-09-07'
    });
    assert.equal(low.enabled, false);
    assert.ok(low.blockedReasons.includes('SAMPLE_INSUFFICIENT'));
});

test('cache Meta exige a mesma janela e registra falha live sem esconder cache antigo', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v141-meta-cache-'));
    const cacheFile = path.join(dir, 'ec.json');
    fs.writeFileSync(cacheFile, JSON.stringify({ status: 'available', fetchedAt: '2026-09-07T05:00:00.000Z', startDay: '2026-09-04', endDay: '2026-09-04', totals: {} }));
    let calls = 0;
    const result = await loadMetaAdsInsights({
        days: 2,
        now: new Date('2026-09-07T05:01:00.000Z'),
        startDay: '2026-09-06',
        endDay: '2026-09-07',
        accountId: '123',
        env: { META_ACCESS_TOKEN: 'expired' },
        cacheFile,
        fetchImpl: async () => {
            calls += 1;
            return new Response(JSON.stringify({ error: { code: 190, error_subcode: 463, message: 'expired' } }), { status: 401 });
        }
    });
    assert.equal(calls, 1);
    assert.equal(result.source, 'cache');
    assert.equal(result.stale, true);
    assert.equal(result.fetchStatus, 'failed');
    assert.equal(result.errorCode, 'META_ACCESS_TOKEN_EXPIRED');
    assert.equal(result.lastError.code, 'META_ACCESS_TOKEN_EXPIRED');
});

test('consulta Meta live GET atualiza cache e mapeia o criativo sem mutar anuncios', async () => {
    const cacheFile = path.join(os.tmpdir(), `v141-meta-live-${Date.now()}.json`);
    const methods = [];
    const result = await loadMetaAdsInsights({
        days: 2,
        now: new Date('2026-09-07T20:00:00.000Z'),
        startDay: '2026-09-06',
        endDay: '2026-09-07',
        accountId: '123',
        env: { META_ACCESS_TOKEN: 'fixture' },
        cacheFile,
        fetchImpl: async (url, options) => {
            methods.push(options.method);
            if (String(url).includes('/insights?')) return new Response(JSON.stringify({ data: [{
                date_start: '2026-09-06', campaign_id: 'c1', campaign_name: 'Campanha',
                adset_id: 's1', adset_name: 'Conjunto', ad_id: 'a1', ad_name: 'Anuncio',
                impressions: '100', reach: '80', clicks: '15', inline_link_clicks: '12', spend: '8',
                outbound_clicks: [{ action_type: 'outbound_click', value: '11' }],
                actions: [{ action_type: 'landing_page_view', value: '10' }, { action_type: 'purchase', value: '1' }],
                action_values: [{ action_type: 'purchase', value: '80.99' }]
            }] }), { status: 200 });
            return new Response(JSON.stringify({ id: 'a1', name: 'Anuncio', effective_status: 'ACTIVE', url_tags: 'utm_source=meta',
                creative: { id: 'cr1', name: 'Criativo 1', video_id: 'v1', thumbnail_url: 'https://example.invalid/t.jpg', object_story_spec: { video_data: { call_to_action: { value: { link: 'https://vilaliemen.shop/protocolo-g' } } } } } }), { status: 200 });
        }
    });
    assert.equal(result.source, 'live');
    assert.equal(result.fetchStatus, 'ok');
    assert.equal(result.dataThrough, '2026-09-07');
    assert.equal(result.totals.outboundClicks, 11);
    assert.equal(result.totals.purchaseValue, 80.99);
    assert.equal(result.creativeMapping[0].creativeId, 'cr1');
    assert.equal(methods.every((method) => method === 'GET'), true);
});

test('Purchase futuro nasce somente depois de Dropi bem sucedido com autorizacao humana e deduplica', async () => {
    let sends = 0;
    let saves = 0;
    let locks = 0;
    const order = { orderId: 'EC-ADMIN-FIXTURE', tracking: {} };
    const args = {
        order,
        shipment: { automation: { dropiSubmitAuthorizedAt: new Date() } },
        dropiResult: { ok: true, dropiOrderId: '123' },
        purchaseSender: async () => { sends += 1; return { ok: true, eventId: order.orderId, response: { events_received: 1 } }; },
        purchaseLock: () => { locks += 1; },
        persistOrder: async () => { saves += 1; }
    };
    const first = await ensurePurchaseAfterHumanDropiSuccessV141(args);
    const second = await ensurePurchaseAfterHumanDropiSuccessV141(args);
    assert.equal(first.ok, true);
    assert.equal(first.metaAccepted, true);
    assert.equal(second.alreadySent, true);
    assert.equal(sends, 1);
    assert.equal(saves, 1);
    assert.equal(locks, 1);
});

test('sem sucesso Dropi ou sem autorizacao humana o emissor CAPI fica em zero', async () => {
    let sends = 0;
    const purchaseSender = async () => { sends += 1; return { ok: true }; };
    const order = { orderId: 'EC-ADMIN-FIXTURE', tracking: {} };
    const failed = await ensurePurchaseAfterHumanDropiSuccessV141({ order, shipment: { automation: { dropiSubmitAuthorizedAt: new Date() } }, dropiResult: { ok: false }, purchaseSender });
    const unauthorized = await ensurePurchaseAfterHumanDropiSuccessV141({ order, shipment: { automation: {} }, dropiResult: { ok: true }, purchaseSender });
    assert.equal(failed.reason, 'dropi_not_successful');
    assert.equal(unauthorized.reason, 'human_dropi_authorization_missing');
    assert.equal(sends, 0);
});

test('dashboard V141 bloqueia recomendacao stale e exibe os novos fatos', () => {
    const html = fs.readFileSync(new URL('../public/funnel-metrics.html', import.meta.url), 'utf8');
    assert.match(html, /Dados insuficientes ou desatualizados/);
    assert.match(html, /Z-API inbound/);
    assert.match(html, /Purchase elegível/);
    assert.match(html, /Saúde das integrações/);
    assert.doesNotMatch(html, /fetch\([^)]*method:\s*['"]POST['"]/);
});

test('refresh Meta V141 independe da abertura do dashboard e permanece somente GET', () => {
    const script = fs.readFileSync(new URL('../scripts/refresh-meta-ads-insights-v141.mjs', import.meta.url), 'utf8');
    const service = fs.readFileSync(new URL('../ops/systemd/vitalismen-meta-ads-insights-v141.service', import.meta.url), 'utf8');
    const timer = fs.readFileSync(new URL('../ops/systemd/vitalismen-meta-ads-insights-v141.timer', import.meta.url), 'utf8');
    assert.match(script, /loadMetaAdsInsights/);
    assert.doesNotMatch(script, /method:\s*['"]POST['"]/);
    assert.match(service, /refresh-meta-ads-insights-v141\.mjs/);
    assert.match(timer, /OnUnitActiveSec=5min/);
});
