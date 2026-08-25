import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import VslVisit from '../src/models/VslVisit.js';
import whatsappRoutes from '../src/routes/whatsapp.js';
import {
    hasProtocoloGContractSignal,
    isEcuadorTexUltraProtocoloG,
    META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
    protocoloGStructuredTracking,
    sanitizeProtocoloGAttribution,
    validateVilaliemenProtocoloGContract
} from '../src/services/metaProtocoloGAttributionService.js';
import {
    applyVisitAttributionToOrder,
    enrichOrderWithMetaAttribution,
    hasMetaAdAttribution,
    metaAttributionTrackingFromVisit
} from '../src/services/metaAttributionService.js';
import {
    claimMetaAttributionForInboundWhatsapp,
    metaAttributionCorrelationStatus,
    recordMetaAttributionCorrelation,
    selectUniqueVslAttributionCandidate
} from '../src/services/metaAttributionBridgeService.js';
import {
    buildPurchaseEventPayloadForOrder,
    getMetaConfigForOrder,
    sendPurchaseEventForOrder
} from '../src/services/metaConversionsService.js';
import { buildFunnelMetricsSnapshot } from '../src/services/funnelMetricsService.js';

const inboundAt = new Date('2026-08-24T18:00:00.000Z');
const expectedMessage = 'Hola, quiero el tratamiento Tex Ultra.';
const officialFixturePath = new URL('./fixtures/meta-ec-protocolo-g-maxlien-payload.json', import.meta.url);
const officialFixtureSha256 = 'ce253997d309e5ab921f94506a119302d3bf12d5560aa1fdac8b5c9ee4b5afe8';
const officialFixtureBuffer = fs.readFileSync(officialFixturePath);
const officialFixture = JSON.parse(officialFixtureBuffer.toString('utf8'));

const vslEntryHandler = () => {
    const layer = whatsappRoutes.stack.find((item) => item.route?.path === '/vsl-entry');
    assert.ok(layer, 'POST /vsl-entry não encontrado');
    assert.equal(layer.route.methods.post, true);
    return layer.route.stack.at(-1).handle;
};

const invokeVslEntryWithoutExternalEffects = async ({ payload, existingTracking = {} }) => {
    const originalFindOne = VslVisit.findOne;
    const originalFindOneAndUpdate = VslVisit.findOneAndUpdate;
    const previousSequence = process.env.WHATSAPP_SELLER_ROTATION_SEQUENCE_EC;
    const seller = '5515991418416';
    let persistedQuery = null;
    let persistedUpdate = null;
    let persistedVisit = null;
    const existing = {
        _id: '66cc00112233445566770001',
        assignedSeller: seller,
        assignedSellerAt: new Date('2026-08-24T17:55:00.000Z'),
        tracking: existingTracking,
        campaignId: existingTracking.campaign_id || '',
        adsetId: existingTracking.adset_id || '',
        adId: existingTracking.ad_id || '',
        placement: existingTracking.placement || '',
        attributionCapturedAt: existingTracking.attributionCapturedAt || null
    };
    VslVisit.findOne = async () => existing;
    VslVisit.findOneAndUpdate = (query, update) => {
        persistedQuery = query;
        persistedUpdate = update;
        persistedVisit = {
            _id: { toString: () => '66cc00112233445566770002' },
            ...update.$setOnInsert,
            ...update.$set
        };
        return { lean: async () => persistedVisit };
    };
    process.env.WHATSAPP_SELLER_ROTATION_SEQUENCE_EC = seller;

    let statusCode = 200;
    let responseBody = null;
    const req = {
        body: payload,
        ip: '203.0.113.200',
        headers: {},
        socket: {},
        get: () => 'Painel-Operador-Nao-Usar'
    };
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(body) {
            responseBody = body;
            return body;
        }
    };

    try {
        await vslEntryHandler()(req, res);
    } finally {
        VslVisit.findOne = originalFindOne;
        VslVisit.findOneAndUpdate = originalFindOneAndUpdate;
        if (previousSequence === undefined) delete process.env.WHATSAPP_SELLER_ROTATION_SEQUENCE_EC;
        else process.env.WHATSAPP_SELLER_ROTATION_SEQUENCE_EC = previousSequence;
    }
    return { statusCode, responseBody, persistedQuery, persistedUpdate, persistedVisit };
};

const fullPayload = (overrides = {}) => ({
    country: 'EC',
    productKey: 'tex_ultra_ec',
    product: 'TEX_ULTRA',
    funnel: 'PROTOCOLO_G',
    page: 'protocolo-g',
    path: '/protocolo-g',
    clicked: true,
    intent: 'whatsapp_click',
    skipMeta: true,
    vslVariant: 'protocolo_g',
    external_id: 'visitor-ec-pg-001',
    visitorId: 'visitor-ec-pg-001',
    fbclid: 'valid-click-id',
    fbc: 'fb.1.1787594400000.valid-click-id',
    fbp: 'fb.1.1787594300000.browser-id',
    utm_source: 'facebook',
    utm_medium: 'paid_social|222',
    utm_campaign: 'campanha_ec|111',
    utm_content: 'criativo_ec|333',
    utm_term: 'tex_ultra',
    campaign_id: '111',
    adset_id: '222',
    ad_id: '333',
    placement: 'facebook_feed',
    event_source_url: 'https://vilaliemen.shop/protocolo-g?utm_source=facebook',
    client_user_agent: 'Mozilla/5.0 cliente-real',
    message: expectedMessage,
    vslEntryMessage: expectedMessage,
    content_name: 'Tex Ultra Ecuador',
    content_ids: ['tex_ultra_ec'],
    content_type: 'product',
    ...overrides
});

const attributedVisit = (overrides = {}) => ({
    _id: '66cc00112233445566778899',
    visitorKey: 'EC:visit-hash',
    visitorId: 'visitor-ec-pg-001',
    externalId: 'visitor-ec-pg-001',
    country: 'EC',
    productKey: 'tex_ultra_ec',
    productName: 'Tex Ultra Ecuador',
    funnel: 'PROTOCOLO_G',
    campaignId: '111',
    adsetId: '222',
    adId: '333',
    placement: 'facebook_feed',
    sourceUrl: 'https://vilaliemen.shop/protocolo-g',
    userAgent: 'Mozilla/5.0 cliente-real',
    lastClickAt: new Date('2026-08-24T17:59:20.000Z'),
    firstSeenAt: new Date('2026-08-24T17:58:00.000Z'),
    lastSeenAt: new Date('2026-08-24T17:59:20.000Z'),
    lastWhatsappMessage: expectedMessage,
    attributionClaimedAt: new Date('2026-08-24T18:00:00.000Z'),
    attributionClaimSource: 'zapi_exact_message_unique_120s',
    tracking: protocoloGStructuredTracking(fullPayload()),
    ...overrides
});

const orderFor = (tracking = {}) => ({
    orderId: 'EC-TEST-PG-001',
    country: 'EC',
    status: 'confirmed',
    total: 80.99,
    currency: 'USD',
    source: 'whatsapp',
    customer: {
        name: 'Cliente Sintetico',
        phone: '+593999999999',
        city: 'Quito',
        province: 'Pichincha'
    },
    package: { id: 3, quantity: 3, label: 'Tex Ultra Ecuador 3 frascos' },
    tracking: {
        productKey: 'tex_ultra_ec',
        productName: 'Tex Ultra Ecuador',
        product: 'TEX_ULTRA',
        funnel: 'PROTOCOLO_G',
        ...tracking
    }
});

test('recepção valida o contrato completo Vilaliemen → Maxlien e o identificador external_id canônico', () => {
    const result = validateVilaliemenProtocoloGContract(fullPayload());
    assert.equal(hasProtocoloGContractSignal(fullPayload()), true);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
    assert.equal(result.externalId, 'visitor-ec-pg-001');
    assert.equal(result.attribution.campaign_id, '111');
    assert.equal(result.attribution.adset_id, '222');
    assert.equal(result.attribution.ad_id, '333');
    assert.equal(result.attribution.placement, 'facebook_feed');
});

test('fixture oficial Vilaliemen mantém SHA-256 congelado e é aceito pelo contrato sem recriação manual', () => {
    const calculated = crypto.createHash('sha256').update(officialFixtureBuffer).digest('hex');
    assert.equal(calculated, officialFixtureSha256);
    const result = validateVilaliemenProtocoloGContract(officialFixture);
    assert.equal(result.ok, true);
    assert.equal(result.externalId, officialFixture.external_id);
    assert.equal(result.attribution.attributionCapturedAt.toISOString(), '2026-08-24T16:00:00.000Z');
});

test('fixture oficial percorre endpoint → VslVisit → correlation → Order → Purchase sem efeito externo', async () => {
    const endpoint = await invokeVslEntryWithoutExternalEffects({ payload: officialFixture });
    assert.equal(endpoint.statusCode, 200);
    assert.equal(endpoint.responseBody.ok, true);
    assert.equal(endpoint.responseBody.meta.pageView, null);
    assert.equal(endpoint.responseBody.meta.viewContent, null);
    assert.equal(endpoint.responseBody.meta.initiateCheckout, null);
    assert.equal(endpoint.responseBody.meta.lead, null);
    assert.match(endpoint.persistedQuery.visitorKey, /^EC:/);

    const visit = endpoint.persistedVisit;
    assert.equal(visit.externalId, officialFixture.external_id);
    assert.equal(visit.country, 'EC');
    assert.equal(visit.productKey, 'tex_ultra_ec');
    assert.equal(visit.funnel, 'PROTOCOLO_G');
    assert.equal(visit.tracking.campaign_id, officialFixture.campaign_id);
    assert.equal(visit.tracking.adset_id, officialFixture.adset_id);
    assert.equal(visit.tracking.ad_id, officialFixture.ad_id);
    assert.equal(visit.tracking.placement, officialFixture.placement);
    assert.equal(visit.tracking.attributionCapturedAt.toISOString(), '2026-08-24T16:00:00.000Z');
    assert.equal(visit.userAgent, officialFixture.client_user_agent);
    assert.notEqual(visit.userAgent, 'Painel-Operador-Nao-Usar');

    const syntheticInboundAt = new Date(visit.lastClickAt.getTime() + 40_000);
    const savedVisit = {
        ...visit,
        customerPhone: '593999999999',
        attributionClaimedAt: syntheticInboundAt,
        attributionClaimSource: 'zapi_exact_message_unique_120s'
    };
    const correlationRecords = [];
    const VisitModel = {
        find() {
            return {
                sort() { return this; },
                lean: async () => [visit]
            };
        },
        findOneAndUpdate() {
            return { lean: async () => savedVisit };
        }
    };
    const claim = await claimMetaAttributionForInboundWhatsapp({
        country: 'EC',
        phone: '+593999999999',
        message: officialFixture.message,
        inboundAt: syntheticInboundAt,
        VisitModel,
        CorrelationModel: {
            create: async (record) => {
                correlationRecords.push(record);
                return record;
            }
        }
    });
    assert.equal(claim.claimed, true);
    assert.equal(correlationRecords[0].status, 'CLAIMED');

    const order = orderFor({ productKey: '', productName: '', product: '', funnel: '' });
    const purchase = await sendPurchaseEventForOrder(order, {
        dryRun: true,
        env: {
            META_PIXEL_ID_EC: 'dataset-ec-anterior',
            META_ACCESS_TOKEN_EC: 'credencial-sintetica-nao-real'
        },
        attributionEnricher: async (targetOrder) => applyVisitAttributionToOrder(
            targetOrder,
            savedVisit,
            { matchedAt: syntheticInboundAt }
        ),
        eventTime: 1787594400
    });
    assert.equal(purchase.ok, true);
    assert.equal(purchase.dryRun, true);
    assert.equal(purchase.datasetId, META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID);
    assert.equal(order.tracking.product, 'TEX_ULTRA');
    assert.equal(order.tracking.funnel, 'PROTOCOLO_G');
    assert.equal(order.tracking.external_id, officialFixture.external_id);
    assert.equal(order.tracking.campaign_id, officialFixture.campaign_id);
    assert.equal(order.tracking.adset_id, officialFixture.adset_id);
    assert.equal(order.tracking.ad_id, officialFixture.ad_id);
    assert.equal(order.tracking.placement, officialFixture.placement);
    assert.equal(order.tracking.attributionCapturedAt.toISOString(), '2026-08-24T16:00:00.000Z');
    assert.equal(purchase.payload.data[0].event_source_url, 'https://vilaliemen.shop/protocolo-g');
    assert.equal(purchase.payload.data[0].user_data.client_user_agent, officialFixture.client_user_agent);
    assert.equal('client_ip_address' in purchase.payload.data[0].user_data, false);
    assert.equal('test_event_code' in purchase.payload, false);
});

test('contrato Protocolo G falha fechado para país, produto, funil, origem, mensagem ou alias conflitante', () => {
    for (const payload of [
        fullPayload({ country: 'CO' }),
        fullPayload({ productKey: 'vit_power_ec' }),
        fullPayload({ funnel: 'OUTRO_FUNIL' }),
        fullPayload({ event_source_url: 'https://ec.maxlien.shop/protocolo-g' }),
        fullPayload({ message: 'Hola, quiero otro producto.', vslEntryMessage: 'Hola, quiero otro producto.' }),
        fullPayload({ visitorId: 'outro-visitor' })
    ]) {
        assert.equal(validateVilaliemenProtocoloGContract(payload).ok, false);
    }
});

test('schema de entrada preserva campos estruturados sem fabricar sinal ausente', () => {
    const tracking = protocoloGStructuredTracking(fullPayload());
    assert.equal(tracking.country, 'EC');
    assert.equal(tracking.product, 'TEX_ULTRA');
    assert.equal(tracking.funnel, 'PROTOCOLO_G');
    assert.equal(tracking.external_id, 'visitor-ec-pg-001');
    assert.equal(tracking.campaign_id, '111');
    assert.equal(tracking.adset_id, '222');
    assert.equal(tracking.ad_id, '333');
    assert.equal(tracking.placement, 'facebook_feed');

    const withoutClick = sanitizeProtocoloGAttribution(fullPayload({ fbclid: '', fbc: '' }));
    assert.equal(withoutClick.fbclid, '');
    assert.equal(withoutClick.fbc, '');
    const withoutBrowser = sanitizeProtocoloGAttribution(fullPayload({ fbp: '' }));
    assert.equal(withoutBrowser.fbp, '');

    const visitWithoutFbc = attributedVisit({
        tracking: protocoloGStructuredTracking(fullPayload({ fbc: '' }))
    });
    const trackingWithoutFbc = metaAttributionTrackingFromVisit(visitWithoutFbc);
    assert.equal(trackingWithoutFbc.fbclid, 'valid-click-id');
    assert.equal('fbc' in trackingWithoutFbc, false);
});

test('snapshot após TTL preserva external_id/fbp, remove atribuição expirada e não a reconstrói', async () => {
    const expiredPayload = {
        ...officialFixture,
        event_source_url: 'https://vilaliemen.shop/protocolo-g',
        future_optional_field: 'aceito-sem-quebrar'
    };
    for (const key of [
        'fbclid',
        'fbc',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'campaign_id',
        'adset_id',
        'ad_id',
        'placement',
        'attribution_captured_at'
    ]) delete expiredPayload[key];

    const contract = validateVilaliemenProtocoloGContract(expiredPayload);
    assert.equal(contract.ok, true);
    const tracking = protocoloGStructuredTracking(expiredPayload, contract);
    assert.equal(tracking.external_id, officialFixture.external_id);
    assert.equal(tracking.fbp, officialFixture.fbp);
    assert.equal(hasMetaAdAttribution(tracking), false);
    for (const key of [
        'fbclid', 'fbc', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
        'campaign_id', 'adset_id', 'ad_id', 'placement', 'attributionCapturedAt'
    ]) assert.equal(key in tracking, false, `${key} não pode ser reconstruído`);

    const staleAttribution = {
        fbclid: officialFixture.fbclid,
        fbc: officialFixture.fbc,
        utm_source: officialFixture.utm_source,
        campaign_id: officialFixture.campaign_id,
        adset_id: officialFixture.adset_id,
        ad_id: officialFixture.ad_id,
        placement: officialFixture.placement,
        attributionCapturedAt: new Date(officialFixture.attribution_captured_at)
    };
    const endpoint = await invokeVslEntryWithoutExternalEffects({
        payload: expiredPayload,
        existingTracking: staleAttribution
    });
    assert.equal(endpoint.statusCode, 200);
    assert.equal(endpoint.persistedVisit.campaignId, '');
    assert.equal(endpoint.persistedVisit.adsetId, '');
    assert.equal(endpoint.persistedVisit.adId, '');
    assert.equal(endpoint.persistedVisit.placement, '');
    assert.equal(endpoint.persistedVisit.attributionCapturedAt, null);
    assert.equal(endpoint.persistedVisit.tracking.fbp, officialFixture.fbp);
    assert.equal(hasMetaAdAttribution(endpoint.persistedVisit.tracking), false);

    const selection = selectUniqueVslAttributionCandidate({
        visits: [endpoint.persistedVisit],
        country: 'EC',
        message: officialFixture.message,
        inboundAt: new Date(endpoint.persistedVisit.lastClickAt.getTime() + 40_000)
    });
    assert.equal(selection.ok, false);
    assert.equal(selection.reason, 'no_unique_exact_visit');

    const order = orderFor({
        external_id: tracking.external_id,
        fbp: tracking.fbp,
        fbc: '',
        fbclid: ''
    });
    const built = buildPurchaseEventPayloadForOrder(order, { eventTime: 1787594400 });
    assert.equal(built.ok, true);
    assert.equal(built.payload.data[0].user_data.fbp, officialFixture.fbp);
    assert.equal('fbc' in built.payload.data[0].user_data, false);
    assert.equal('test_event_code' in built.payload, false);
});

test('1 candidato exato dentro de 120 segundos resulta em CLAIMED', () => {
    const result = selectUniqueVslAttributionCandidate({
        visits: [attributedVisit()],
        country: 'EC',
        message: expectedMessage,
        inboundAt
    });
    assert.equal(result.ok, true);
    assert.equal(result.candidate.visitorKey, 'EC:visit-hash');
});

test('0 candidatos resulta em UNMATCHED', () => {
    const result = selectUniqueVslAttributionCandidate({ visits: [], country: 'EC', message: expectedMessage, inboundAt });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no_unique_exact_visit');
    assert.equal(metaAttributionCorrelationStatus(result), 'UNMATCHED');
});

test('2 candidatos resultam em AMBIGUOUS e nenhum é escolhido', () => {
    const result = selectUniqueVslAttributionCandidate({
        visits: [attributedVisit(), attributedVisit({ _id: '66cc00112233445566778898', visitorKey: 'EC:visit-2' })],
        country: 'EC',
        message: expectedMessage,
        inboundAt
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'ambiguous_exact_visit');
    assert.equal(metaAttributionCorrelationStatus(result), 'AMBIGUOUS');
});

test('clique acima de 120 segundos resulta em UNMATCHED', () => {
    const result = selectUniqueVslAttributionCandidate({
        visits: [attributedVisit({ lastClickAt: new Date('2026-08-24T17:57:59.000Z') })],
        country: 'EC',
        message: expectedMessage,
        inboundAt
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no_unique_exact_visit');
});

test('country diferente resulta em UNMATCHED', () => {
    const result = selectUniqueVslAttributionCandidate({
        visits: [attributedVisit({ country: 'CO' })],
        country: 'EC',
        message: expectedMessage,
        inboundAt
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no_unique_exact_visit');
});

test('mensagem diferente resulta em UNMATCHED', () => {
    const result = selectUniqueVslAttributionCandidate({
        visits: [attributedVisit()],
        country: 'EC',
        message: 'Hola, otra frase.',
        inboundAt
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no_unique_exact_visit');
});

test('observabilidade persiste somente hashes e estados CLAIMED/AMBIGUOUS/UNMATCHED', async () => {
    const records = [];
    const CorrelationModel = { create: async (record) => { records.push(record); return record; } };
    for (const result of [
        { ok: true, claimed: true, candidateCount: 1 },
        { ok: false, reason: 'ambiguous_exact_visit', candidateCount: 2 },
        { ok: false, reason: 'no_unique_exact_visit', candidateCount: 0 }
    ]) {
        await recordMetaAttributionCorrelation({
            result,
            country: 'EC',
            phone: '+593999999999',
            message: expectedMessage,
            inboundAt,
            candidate: result.claimed ? attributedVisit() : null,
            CorrelationModel
        });
    }
    assert.deepEqual(records.map((record) => record.status), ['CLAIMED', 'AMBIGUOUS', 'UNMATCHED']);
    assert.equal(records.every((record) => record.phoneHash.length === 64), true);
    assert.equal(records.every((record) => !Object.hasOwn(record, 'phone')), true);
    assert.equal(records.every((record) => !Object.hasOwn(record, 'message')), true);
});

test('falha da observabilidade permanece fail-open e não altera o resultado da correlação', async () => {
    const result = await recordMetaAttributionCorrelation({
        result: { ok: true, claimed: true, candidateCount: 1 },
        country: 'EC',
        phone: '+593999999999',
        message: expectedMessage,
        inboundAt,
        candidate: attributedVisit(),
        CorrelationModel: { create: async () => { throw new Error('mongo_indisponivel'); } }
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 'CLAIMED');
    assert.equal(result.error, 'correlation_audit_write_failed');
});

test('cenário integrado visita → contato → telefone → pedido → Purchase conserva atribuição e roteia o Dataset correto', async () => {
    const visit = attributedVisit({ attributionClaimedAt: null, customerPhone: '' });
    const savedVisit = {
        ...visit,
        customerPhone: '593999999999',
        attributionClaimedAt: inboundAt,
        attributionClaimSource: 'zapi_exact_message_unique_120s'
    };
    const observations = [];
    const VisitModel = {
        find() {
            return {
                sort() { return this; },
                lean: async () => [visit]
            };
        },
        findOneAndUpdate() {
            return { lean: async () => savedVisit };
        }
    };
    const CorrelationModel = { create: async (record) => { observations.push(record); return record; } };
    const claim = await claimMetaAttributionForInboundWhatsapp({
        country: 'EC',
        phone: '+593999999999',
        message: expectedMessage,
        inboundAt,
        VisitModel,
        CorrelationModel
    });
    assert.equal(claim.claimed, true);
    assert.equal(observations[0].status, 'CLAIMED');

    const order = orderFor({ productKey: '', productName: '', product: '', funnel: '' });

    const purchase = await sendPurchaseEventForOrder(order, {
        dryRun: true,
        env: {
            META_PIXEL_ID_EC: 'dataset-ec-anterior',
            META_ACCESS_TOKEN_EC: 'token-sintetico-nao-real',
            META_PIXEL_ID_EC_TEX_ULTRA_PROTOCOLO_G: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID
        },
        attributionEnricher: async (targetOrder) => applyVisitAttributionToOrder(
            targetOrder,
            savedVisit,
            { matchedAt: inboundAt }
        ),
        eventTime: 1787594400
    });
    assert.equal(purchase.ok, true);
    assert.equal(purchase.attribution.enriched, true);
    assert.equal(order.tracking.campaign_id, '111');
    assert.equal(order.tracking.adset_id, '222');
    assert.equal(order.tracking.ad_id, '333');
    assert.equal(order.tracking.placement, 'facebook_feed');
    assert.equal(order.tracking.attributionCorrelationStatus, 'CLAIMED');
    assert.equal(purchase.datasetId, META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID);
    assert.equal(purchase.datasetRoute, 'ec_tex_ultra_protocolo_g');
    const event = purchase.payload.data[0];
    assert.equal(event.event_name, 'Purchase');
    assert.equal(event.event_id, 'EC-TEST-PG-001');
    assert.equal(event.custom_data.value, 80.99);
    assert.equal(event.custom_data.currency, 'USD');
    assert.equal(event.custom_data.content_ids[0], 'tex_ultra_ec');
    assert.equal(event.user_data.fbc, 'fb.1.1787594400000.valid-click-id');
    assert.equal(event.user_data.fbp, 'fb.1.1787594300000.browser-id');
    assert.equal(event.user_data.external_id[0].length, 64);
    assert.equal(event.user_data.client_user_agent, 'Mozilla/5.0 cliente-real');
    assert.equal('client_ip_address' in event.user_data, false);
});

test('enriquecimento pedido usa últimos 9 dígitos, lookback de 30 dias e somente visita já correlacionada', async () => {
    let observedQuery = null;
    const VisitModel = {
        findOne(query) {
            observedQuery = query;
            return {
                sort() { return this; },
                lean: async () => attributedVisit()
            };
        }
    };
    const order = orderFor({ product: '', funnel: '', productKey: '' });
    const result = await enrichOrderWithMetaAttribution(order, {
        VisitModel,
        now: () => inboundAt,
        lookbackDays: 30
    });
    assert.equal(result.enriched, true);
    assert.equal(observedQuery.country, 'EC');
    assert.equal(observedQuery.customerPhone.$regex, '999999999$');
    assert.deepEqual(observedQuery.attributionClaimedAt, { $exists: true, $ne: null });
    assert.equal(observedQuery.lastSeenAt.$gte.toISOString(), '2026-07-25T18:00:00.000Z');
});

test('atribuição válida já existente não é sobrescrita por outra visita', async () => {
    let queried = false;
    const order = orderFor({ fbc: 'fb.1.1787594400000.original' });
    const result = await enrichOrderWithMetaAttribution(order, {
        VisitModel: { findOne() { queried = true; } }
    });
    assert.equal(result.reason, 'order_already_has_attribution');
    assert.equal(queried, false);
    assert.equal(order.tracking.fbc, 'fb.1.1787594400000.original');
});

test('pedido fora de EC não é consultado nem enriquecido', async () => {
    let queried = false;
    const order = { ...orderFor(), country: 'CO', tracking: {} };
    const result = await enrichOrderWithMetaAttribution(order, {
        VisitModel: { findOne() { queried = true; } }
    });
    assert.equal(result.reason, 'unsupported_order');
    assert.equal(queried, false);
    assert.deepEqual(order.tracking, {});
});

test('roteamento Dataset é exclusivo e fail-closed para configuração divergente', () => {
    const env = {
        META_PIXEL_ID_EC: 'dataset-ec-anterior',
        META_ACCESS_TOKEN_EC: 'token-sintetico-nao-real',
        META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G: 'token-dedicado-sintetico-nao-real'
    };
    assert.equal(isEcuadorTexUltraProtocoloG(orderFor()), true);
    assert.deepEqual(getMetaConfigForOrder(orderFor(), env), {
        pixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
        accessToken: 'token-dedicado-sintetico-nao-real',
        route: 'ec_tex_ultra_protocolo_g'
    });
    assert.deepEqual(getMetaConfigForOrder(orderFor(), {
        ...env,
        META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G: ''
    }), {
        pixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
        accessToken: 'token-sintetico-nao-real',
        route: 'ec_tex_ultra_protocolo_g'
    });
    assert.deepEqual(getMetaConfigForOrder(orderFor({ funnel: 'OUTRO_FUNIL' }), env), {
        pixelId: 'dataset-ec-anterior',
        accessToken: 'token-sintetico-nao-real',
        route: 'country_ec_default'
    });
    assert.deepEqual(getMetaConfigForOrder(orderFor({ productKey: 'vit_power_ec', product: 'VIT_POWER' }), env), {
        pixelId: 'dataset-ec-anterior',
        accessToken: 'token-sintetico-nao-real',
        route: 'country_ec_default'
    });
    assert.deepEqual(getMetaConfigForOrder({ country: 'CO', tracking: {} }, env), {
        pixelId: null,
        accessToken: null,
        route: 'unsupported_country'
    });
    assert.deepEqual(getMetaConfigForOrder(orderFor(), {
        ...env,
        META_PIXEL_ID_EC_TEX_ULTRA_PROTOCOLO_G: 'dataset-incorreto'
    }), {
        pixelId: null,
        accessToken: null,
        route: 'ec_tex_ultra_protocolo_g_invalid_dataset_config'
    });
});

test('Purchase não inventa fbc/fbp e não usa IP ou User-Agent do operador no Protocolo G', () => {
    const previousTestCode = process.env.META_TEST_EVENT_CODE_EC;
    process.env.META_TEST_EVENT_CODE_EC = 'NAO_USAR_EM_EVENTO_NORMAL';
    try {
        const built = buildPurchaseEventPayloadForOrder(orderFor({
            fbclid: '',
            fbc: '',
            fbp: '',
            external_id: '',
            ext_id: '',
            ip: '203.0.113.10',
            userAgent: 'Painel do operador',
            clientContextSource: ''
        }), { eventTime: 1787594400, testEventCode: 'TAMBEM_NAO_USAR' });
        assert.equal(built.ok, true);
        const userData = built.payload.data[0].user_data;
        assert.equal('fbc' in userData, false);
        assert.equal('fbp' in userData, false);
        assert.equal('external_id' in userData, false);
        assert.equal('client_ip_address' in userData, false);
        assert.equal('client_user_agent' in userData, false);
        assert.equal('test_event_code' in built.payload, false);
    } finally {
        if (previousTestCode === undefined) delete process.env.META_TEST_EVENT_CODE_EC;
        else process.env.META_TEST_EVENT_CODE_EC = previousTestCode;
    }
});

test('pedido sem IDs publicitários ou sem tracking continua montando Purchase com dados legítimos', () => {
    const withoutAdIds = buildPurchaseEventPayloadForOrder(orderFor({
        campaign_id: '', adset_id: '', ad_id: '', placement: ''
    }));
    assert.equal(withoutAdIds.ok, true);

    const withoutTracking = buildPurchaseEventPayloadForOrder({
        ...orderFor(),
        tracking: { productKey: 'tex_ultra_ec', productName: 'Tex Ultra Ecuador' }
    });
    assert.equal(withoutTracking.ok, true);
    assert.equal(withoutTracking.payload.data[0].action_source, 'business_messaging');
});

test('dashboard EC expõe IDs estruturados, sinais e métricas de correlação sem telefone', () => {
    const order = orderFor({
        ...metaAttributionTrackingFromVisit(attributedVisit()),
        metaPurchaseSentAt: inboundAt,
        metaPurchaseDatasetId: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
        attributionCorrelationStatus: 'CLAIMED'
    });
    order.entryAt = new Date('2026-08-24T17:50:00.000Z');
    const snapshot = buildFunnelMetricsSnapshot({
        visits: [],
        orders: [order],
        correlations: [
            { status: 'CLAIMED', evaluatedAt: inboundAt },
            { status: 'AMBIGUOUS', evaluatedAt: inboundAt },
            { status: 'UNMATCHED', evaluatedAt: inboundAt }
        ],
        days: 1,
        now: new Date('2026-08-24T19:00:00.000Z')
    });
    assert.equal(snapshot.totals.correlationClaimed, 1);
    assert.equal(snapshot.totals.correlationAmbiguous, 1);
    assert.equal(snapshot.totals.correlationUnmatched, 1);
    const displayed = snapshot.recentAttributionOrders[0];
    assert.equal(displayed.country, 'EC');
    assert.equal(displayed.product.key, 'tex_ultra_ec');
    assert.equal(displayed.funnel, 'PROTOCOLO_G');
    assert.equal(displayed.tracking.campaign_id, '111');
    assert.equal(displayed.tracking.adset_id, '222');
    assert.equal(displayed.tracking.ad_id, '333');
    assert.equal(displayed.tracking.placement, 'facebook_feed');
    assert.equal(displayed.tracking.hasFbc, true);
    assert.equal(displayed.tracking.hasFbp, true);
    assert.equal(displayed.tracking.hasExternalId, true);
    assert.equal(displayed.tracking.correlationStatus, 'CLAIMED');
    assert.equal(displayed.metaDelivery.pixelId, META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID);
    assert.equal('phone' in displayed.customer, false);
});
