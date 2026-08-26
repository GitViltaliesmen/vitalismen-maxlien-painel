import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import VslVisit from '../src/models/VslVisit.js';
import whatsappRoutes from '../src/routes/whatsapp.js';
import {
    protocoloGStageField,
    validateVilaliemenProtocoloGStageContract
} from '../src/services/metaProtocoloGAttributionService.js';
import {
    buildFunnelMetricsSnapshot,
    funnelMetricsMongoWindow
} from '../src/services/funnelMetricsService.js';

const stagePayload = (overrides = {}) => ({
    country: 'EC',
    productKey: 'tex_ultra_ec',
    product: 'TEX_ULTRA',
    funnel: 'PROTOCOLO_G',
    page: 'protocolo-g',
    path: '/protocolo-g',
    event_source_url: 'https://vilaliemen.shop/protocolo-g?campaign_id=111',
    external_id: 'visitor-ec-pg-v62-001',
    visitorId: 'visitor-ec-pg-v62-001',
    clicked: false,
    intent: 'vsl_stage',
    stage: 'landing',
    skipMeta: true,
    vslVariant: 'protocolo_g',
    campaign_id: '111',
    adset_id: '222',
    ad_id: '333',
    placement: 'instagram_reels',
    client_user_agent: 'Mozilla/5.0 cliente-real',
    ...overrides
});

const stageHandler = () => {
    const layer = whatsappRoutes.stack.find((item) => item.route?.path === '/vsl-stage');
    assert.ok(layer, 'POST /vsl-stage não encontrado');
    assert.equal(layer.route.methods.post, true);
    return layer.route.stack.at(-1).handle;
};

test('contrato V62 aceita somente as etapas não conversivas previstas', () => {
    for (const stage of [
        'landing',
        'video_started',
        'watched_25',
        'watched_50',
        'early_cta_visible',
        'form_opened',
        'form_submitted'
    ]) {
        const contract = validateVilaliemenProtocoloGStageContract(stagePayload({ stage }));
        assert.equal(contract.ok, true, `${stage}: ${contract.errors.join(', ')}`);
        assert.equal(contract.stageField, protocoloGStageField(stage));
    }

    const purchase = validateVilaliemenProtocoloGStageContract(stagePayload({ stage: 'purchase' }));
    assert.equal(purchase.ok, false);
    assert.equal(purchase.errors.includes('invalid_stage'), true);
    const clicked = validateVilaliemenProtocoloGStageContract(stagePayload({ clicked: true }));
    assert.equal(clicked.errors.includes('invalid_clicked'), true);
    const wrongSource = validateVilaliemenProtocoloGStageContract(stagePayload({
        event_source_url: 'https://ec.maxlien.shop/n/'
    }));
    assert.equal(wrongSource.errors.includes('invalid_event_source_url'), true);
});

test('endpoint V62 persiste a primeira ocorrência sem vendedor, painel ou Meta', async () => {
    const originalFindOne = VslVisit.findOne;
    const originalFindOneAndUpdate = VslVisit.findOneAndUpdate;
    let observedUpdate = null;
    VslVisit.findOne = async () => null;
    VslVisit.findOneAndUpdate = (_query, update) => {
        observedUpdate = update;
        return { lean: async () => ({ _id: { toString: () => 'visit-stage-v62' } }) };
    };

    let statusCode = 200;
    let responseBody = null;
    const req = {
        body: stagePayload({ stage: 'watched_25' }),
        ip: '203.0.113.20',
        headers: {},
        socket: {},
        get: () => 'Proxy-Vilaliemen'
    };
    const res = {
        status(code) { statusCode = code; return this; },
        json(body) { responseBody = body; return body; }
    };

    try {
        await stageHandler()(req, res);
    } finally {
        VslVisit.findOne = originalFindOne;
        VslVisit.findOneAndUpdate = originalFindOneAndUpdate;
    }

    assert.equal(statusCode, 202);
    assert.equal(responseBody.accepted, true);
    assert.equal(responseBody.stage, 'watched_25');
    assert.equal(observedUpdate.$set.productKey, 'tex_ultra_ec');
    assert.equal(observedUpdate.$set.funnel, 'PROTOCOLO_G');
    assert.equal(observedUpdate.$set.userAgent, 'Mozilla/5.0 cliente-real');
    assert.ok(observedUpdate.$min['protocoloGStages.watched25At'] instanceof Date);
    assert.equal('$inc' in observedUpdate, false);
    assert.equal('assignedSeller' in observedUpdate.$set, false);
    assert.equal('lastClickAt' in observedUpdate.$set, false);
    assert.equal('metaLeadSentAt' in observedUpdate.$set, false);
});

test('painel separa o Protocolo G das demais entradas do Equador', () => {
    const now = new Date('2026-08-26T18:00:00.000Z');
    const stageAt = '2026-08-26T15:00:00.000Z';
    const visits = [
        {
            country: 'EC',
            productKey: 'tex_ultra_ec',
            funnel: 'PROTOCOLO_G',
            firstSeenAt: stageAt,
            visits: 1,
            lastClickAt: '2026-08-26T15:20:00.000Z',
            attributionClaimedAt: '2026-08-26T15:21:00.000Z',
            protocoloGStages: {
                landingAt: stageAt,
                videoStartedAt: '2026-08-26T15:01:00.000Z',
                watched25At: '2026-08-26T15:12:00.000Z',
                earlyCtaVisibleAt: '2026-08-26T15:13:00.000Z',
                formOpenedAt: '2026-08-26T15:14:00.000Z',
                formSubmittedAt: '2026-08-26T15:15:00.000Z'
            }
        },
        {
            country: 'EC',
            productKey: 'vit_power_ec',
            funnel: 'VIT_POWER',
            firstSeenAt: '2026-08-26T16:00:00.000Z',
            visits: 1,
            lastClickAt: '2026-08-26T16:10:00.000Z'
        }
    ];
    const orders = [
        {
            country: 'EC',
            status: 'confirmed',
            total: 35.99,
            entryAt: '2026-08-26T15:30:00.000Z',
            tracking: {
                productKey: 'tex_ultra_ec',
                product: 'TEX_ULTRA',
                funnel: 'PROTOCOLO_G',
                metaPurchaseSentAt: '2026-08-26T15:31:00.000Z'
            }
        },
        {
            country: 'EC',
            status: 'confirmed',
            total: 35.99,
            entryAt: '2026-08-26T16:30:00.000Z',
            tracking: { productKey: 'vit_power_ec', product: 'VIT_POWER', funnel: 'VIT_POWER' }
        }
    ];

    const snapshot = buildFunnelMetricsSnapshot({ visits, orders, days: 1, now });
    assert.equal(snapshot.totals.entries, 2);
    assert.equal(snapshot.totals.whatsappVisitors, 2);
    assert.equal(snapshot.totals.salesCreated, 2);
    assert.equal(snapshot.protocoloG.totals.landing, 1);
    assert.equal(snapshot.protocoloG.totals.videoStarted, 1);
    assert.equal(snapshot.protocoloG.totals.watched25, 1);
    assert.equal(snapshot.protocoloG.totals.watched50, 0);
    assert.equal(snapshot.protocoloG.totals.earlyCtaVisible, 1);
    assert.equal(snapshot.protocoloG.totals.formSubmitted, 1);
    assert.equal(snapshot.protocoloG.totals.whatsappClicks, 1);
    assert.equal(snapshot.protocoloG.totals.attributedConversations, 1);
    assert.equal(snapshot.protocoloG.totals.salesCreated, 1);
    assert.equal(snapshot.protocoloG.totals.purchasesSent, 1);
});

test('consulta e interface cobrem todas as etapas exclusivas da V62', () => {
    const window = funnelMetricsMongoWindow({ days: 1, now: new Date('2026-08-26T18:00:00.000Z') });
    const visitFields = window.visitQuery.$or.map((item) => Object.keys(item)[0]);
    for (const field of [
        'attributionClaimedAt',
        'protocoloGStages.landingAt',
        'protocoloGStages.videoStartedAt',
        'protocoloGStages.watched25At',
        'protocoloGStages.watched50At',
        'protocoloGStages.earlyCtaVisibleAt',
        'protocoloGStages.formOpenedAt',
        'protocoloGStages.formSubmittedAt'
    ]) assert.equal(visitFields.includes(field), true, field);

    const dashboard = fs.readFileSync(new URL('../public/funnel-metrics.html', import.meta.url), 'utf8');
    const receiver = fs.readFileSync(new URL('../src/routes/whatsapp.js', import.meta.url), 'utf8');
    assert.match(dashboard, /Protocolo G — Tex Ultra/);
    assert.match(dashboard, /Não mistura outras VSLs do Equador/);
    assert.match(dashboard, /CTA secundária aos 12 minutos/);
    assert.match(dashboard, /Dia a dia — EC geral/);
    assert.match(receiver, /visits: existing && !protocoloGContract \? 1 : 0/);
});
