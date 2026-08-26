import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    buildFunnelMetricsSnapshot,
    PROTOCOLO_G_MEASUREMENT_STARTED_AT
} from '../src/services/funnelMetricsService.js';

const identity = ({ campaignId, adId, campaignName, adName, placement }) => ({
    country: 'EC',
    productKey: 'tex_ultra_ec',
    funnel: 'PROTOCOLO_G',
    campaignId,
    adsetId: `${campaignId}-set`,
    adId,
    placement,
    tracking: {
        country: 'EC',
        productKey: 'tex_ultra_ec',
        product: 'TEX_ULTRA',
        funnel: 'PROTOCOLO_G',
        utm_campaign: `${campaignName}|${campaignId}`,
        utm_content: `${adName}|${adId}`
    }
});

test('V63 exclui o histórico anterior ao deploy e quebra o funil por anúncio', () => {
    const visits = [
        {
            ...identity({
                campaignId: 'pre',
                adId: 'pre-ad',
                campaignName: 'Histórico antigo',
                adName: 'Não considerar',
                placement: 'Facebook_Mobile_Reels'
            }),
            firstSeenAt: '2026-08-26T05:10:00.000Z',
            lastClickAt: '2026-08-26T05:11:00.000Z',
            protocoloGStages: { landingAt: '2026-08-26T05:10:00.000Z' }
        },
        {
            ...identity({
                campaignId: 'campaign-a',
                adId: 'ad-a',
                campaignName: 'Anúncio 1',
                adName: 'Criativo A',
                placement: 'Instagram_Reels'
            }),
            firstSeenAt: '2026-08-26T05:20:00.000Z',
            lastClickAt: '2026-08-26T06:00:00.000Z',
            attributionClaimedAt: '2026-08-26T06:01:00.000Z',
            protocoloGStages: {
                landingAt: '2026-08-26T05:20:00.000Z',
                videoStartedAt: '2026-08-26T05:21:00.000Z',
                watched25At: '2026-08-26T05:32:00.000Z',
                earlyCtaVisibleAt: '2026-08-26T05:33:00.000Z',
                formOpenedAt: '2026-08-26T05:34:00.000Z',
                formSubmittedAt: '2026-08-26T05:35:00.000Z'
            }
        },
        {
            ...identity({
                campaignId: 'campaign-b',
                adId: 'ad-b',
                campaignName: 'Anúncio 2',
                adName: 'Criativo B',
                placement: 'Facebook_Mobile_Feed'
            }),
            firstSeenAt: '2026-08-26T05:25:00.000Z',
            protocoloGStages: { landingAt: '2026-08-26T05:25:00.000Z' }
        }
    ];
    const orders = [{
        country: 'EC',
        status: 'confirmed',
        total: 35.99,
        entryAt: '2026-08-26T06:30:00.000Z',
        tracking: {
            productKey: 'tex_ultra_ec',
            product: 'TEX_ULTRA',
            funnel: 'PROTOCOLO_G',
            campaign_id: 'campaign-a',
            adset_id: 'campaign-a-set',
            ad_id: 'ad-a',
            placement: 'Instagram_Reels',
            utm_campaign: 'Anúncio 1|campaign-a',
            utm_content: 'Criativo A|ad-a',
            metaPurchaseSentAt: '2026-08-26T06:31:00.000Z'
        }
    }];

    const snapshot = buildFunnelMetricsSnapshot({
        visits,
        orders,
        days: 1,
        now: new Date('2026-08-26T08:00:00.000Z')
    });

    assert.equal(snapshot.protocoloG.version, 'V63');
    assert.equal(snapshot.protocoloG.measurementStartedAt, PROTOCOLO_G_MEASUREMENT_STARTED_AT);
    assert.equal(snapshot.protocoloG.totals.landing, 2);
    assert.equal(snapshot.protocoloG.totals.whatsappClicks, 1);
    assert.equal(snapshot.protocoloG.totals.salesCreated, 1);
    assert.equal(snapshot.protocoloG.totals.purchasesSent, 1);
    assert.equal(snapshot.protocoloG.ads.length, 2);

    const [adA, adB] = snapshot.protocoloG.ads;
    assert.equal(adA.adId, 'ad-a');
    assert.equal(adA.campaignName, 'Anúncio 1');
    assert.equal(adA.adName, 'Criativo A');
    assert.deepEqual(adA.placements, ['Instagram_Reels']);
    assert.equal(adA.videoStartRate, 100);
    assert.equal(adA.watched25Rate, 100);
    assert.equal(adA.whatsappRate, 100);
    assert.equal(adA.salesCreated, 1);
    assert.equal(adA.purchasesSent, 1);
    assert.equal(adB.adId, 'ad-b');
    assert.equal(adB.videoStartRate, 0);
    assert.equal(snapshot.protocoloG.ads.some((ad) => ad.adId === 'pre-ad'), false);
});

test('interface V63 identifica o corte e a leitura por anúncio', () => {
    const dashboard = fs.readFileSync(new URL('../public/funnel-metrics.html', import.meta.url), 'utf8');
    const route = fs.readFileSync(new URL('../src/routes/funnelMetrics.js', import.meta.url), 'utf8');
    assert.match(dashboard, /Por anúncio — somente pós-correção/);
    assert.match(dashboard, /protocoloGAdRows/);
    assert.match(dashboard, /Válido desde/);
    assert.match(dashboard, /Amostra \$\{landings\}\/20/);
    for (const field of [
        'campaignId',
        'adsetId',
        'adId',
        'tracking.productKey',
        'tracking.funnel',
        'tracking.utm_campaign',
        'tracking.utm_content'
    ]) {
        assert.match(route, new RegExp(field.replace('.', '\\.')));
    }
});
