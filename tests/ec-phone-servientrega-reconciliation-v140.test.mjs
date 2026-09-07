import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    V140_RECONCILIATION_CLASSES,
    canonicalEcPhoneE164V140,
    classifyCanonicalProjectionV140,
    disambiguatePhoneOrderV140,
    historicalSuppressionKindsV140,
    reconcileV140Rows,
    validServientregaGuideV140
} from '../src/services/ecPhoneServientregaReconciliationV140Service.js';

const stateFixture = ({ orderId = 'EC-V140-1', phone = '+593968544878', status = 'confirmado', logisticsStatus = '' } = {}) => ({
    _id: `customer-${orderId}`,
    phoneDigits: phone.replace(/\D/g, ''),
    metadata: {
        customerDraft: { orderId, phone, status, productKey: 'tex_ultra_ec' },
        logistics: { status: logisticsStatus }
    }
});

const bundleFixture = ({
    orderId = 'EC-V140-1',
    phone = '+593968544878',
    shipmentId = 'shipment-v140-1',
    status = 'CREATED',
    guide = '',
    dropiOrderId = '',
    orderStatus = 'confirmed',
    orderShippingStatus = '',
    panelStatus = 'pedido_enviado',
    contactStatus = 'confirmado',
    contactLogisticsStatus = '',
    productKey = 'tex_ultra_ec',
    createdAt = '2026-08-24T02:03:29.179Z'
} = {}) => {
    const shipment = {
        _id: shipmentId,
        orderId,
        productName: productKey === 'tex_ultra_ec' ? 'Tex Ultra Ecuador' : 'Vit Power Ecuador',
        client: { phone },
        logistics: {
            status,
            trackingNumber: guide,
            agencyPickup: true,
            pickupReadyVerified: status === 'READY_FOR_PICKUP'
        },
        automation: {
            dropiSubmitAuthorizedAt: new Date('2026-08-24T04:03:34.149Z'),
            dropiSubmitAuthorizedBy: 'fixture-operator',
            postSaleSafetyLedger: {}
        },
        review: { suppressedNotificationKinds: [] },
        raw: {
            latestDroppiPayload: dropiOrderId ? { dropiOrderId } : {}
        },
        events: [],
        notificationLedger: [],
        saved: 0,
        async save() { this.saved += 1; return this; },
        createdAt
    };
    return {
        shipment,
        order: {
            _id: `mongo-${orderId}`,
            orderId,
            country: 'EC',
            status: orderStatus,
            shippingStatus: orderShippingStatus,
            trackingNumber: guide,
            dropiOrderId,
            customer: { phone },
            tracking: { productKey },
            createdAt
        },
        state: stateFixture({ orderId, phone, status: contactStatus, logisticsStatus: contactLogisticsStatus }),
        lead: { id: orderId.endsWith('-1') ? '3435' : '3436', phone, status: panelStatus, createdAt }
    };
};

const rowFixture = (overrides = {}) => ({
    phone: '968544878',
    dropiOrderId: '6904922',
    trackingNumber: '189613429',
    internalOrderId: 'EC-V140-1',
    productKey: 'tex_ultra_ec',
    productName: 'Tex Ultra Ecuador',
    createdAt: '2026-08-24T04:06:15.020Z',
    ...overrides
});

const carrierFixture = (status = 'GUIA_GENERADA') => ({
    ok: true,
    carrier: 'servientrega',
    trackingNumber: '189613429',
    statusAtual: 'Pendiente',
    ultimoMovimiento: 'Generado Cliente Corporativo',
    normalizedStatus: status
});

test('V140 normaliza somente telefone móvel EC canônico E.164', () => {
    assert.equal(canonicalEcPhoneE164V140('+593 968 544 878'), '+593968544878');
    assert.equal(canonicalEcPhoneE164V140('0968544878'), '+593968544878');
    assert.equal(canonicalEcPhoneE164V140('968544878'), '+593968544878');
    assert.equal(canonicalEcPhoneE164V140('5515998038637'), '');
    assert.equal(canonicalEcPhoneE164V140(''), '');
});

test('V140 exige guia válida distinta do telefone', () => {
    assert.equal(validServientregaGuideV140('189613429', '+593968544878'), '189613429');
    assert.equal(validServientregaGuideV140('968544878', '+593968544878'), '');
    assert.equal(validServientregaGuideV140('123', '+593968544878'), '');
});

test('V140 telefone com um único Order e Shipment é match inequívoco', () => {
    const bundle = bundleFixture();
    const result = disambiguatePhoneOrderV140({ row: rowFixture(), bundles: [bundle] });
    assert.equal(result.matched, true);
    assert.equal(result.matchType, 'phone_unique_compatible');
    assert.equal(result.bundle.order.orderId, 'EC-V140-1');
});

test('V140 não sobrescreve identidade incompatível mesmo com telefone único', () => {
    const bundle = bundleFixture({ guide: '189600000', dropiOrderId: '6904000' });
    const result = disambiguatePhoneOrderV140({ row: rowFixture(), bundles: [bundle] });
    assert.equal(result.matched, false);
    assert.equal(result.classification, V140_RECONCILIATION_CLASSES.ERROR);
    assert.equal(result.reason, 'phone_match_has_conflicting_order_identity');
});

test('V140 desambigua múltiplos pedidos por guia, Dropi, Order, produto e data', () => {
    const first = bundleFixture({ dropiOrderId: '6904922', guide: '189613429' });
    const second = bundleFixture({
        orderId: 'EC-V140-2',
        shipmentId: 'shipment-v140-2',
        dropiOrderId: '6904999',
        guide: '189619999',
        productKey: 'vit_power_ec',
        createdAt: '2026-09-02T02:03:29.179Z'
    });
    const result = disambiguatePhoneOrderV140({ row: rowFixture(), bundles: [second, first] });
    assert.equal(result.matched, true);
    assert.equal(result.bundle.order.orderId, 'EC-V140-1');
    assert.match(result.matchType, /dropiOrderId/);
    assert.match(result.matchType, /guide/);
});

test('V140 pula telefone com múltiplos pedidos ainda ambíguos', () => {
    const first = bundleFixture({ orderId: 'EC-V140-A', shipmentId: 'shipment-v140-a' });
    const second = bundleFixture({ orderId: 'EC-V140-B', shipmentId: 'shipment-v140-b' });
    const result = disambiguatePhoneOrderV140({
        row: rowFixture({ dropiOrderId: '', trackingNumber: '', internalOrderId: '', createdAt: '', productKey: '', productName: '' }),
        bundles: [first, second]
    });
    assert.equal(result.matched, false);
    assert.equal(result.classification, V140_RECONCILIATION_CLASSES.AMBIGUOUS);
});

test('V140 detecta divergência em toda a projeção canônica', () => {
    const result = classifyCanonicalProjectionV140({
        bundle: bundleFixture(),
        row: rowFixture(),
        servientrega: carrierFixture()
    });
    assert.equal(result.classification, V140_RECONCILIATION_CLASSES.DIVERGENT);
    assert.equal(result.expected.orderStatus, 'shipped');
    assert.equal(result.expected.panelStatus, 'pedido_enviado');
});

test('V140 dry-run consulta Servientrega e mantém writes=0 e messages=0', async () => {
    const bundle = bundleFixture();
    let trackerCalls = 0;
    const result = await reconcileV140Rows({
        rows: [rowFixture()],
        bundles: [bundle],
        dryRun: true,
        onlyPhone: '+593968544878',
        trackGuide: async () => { trackerCalls += 1; return carrierFixture(); }
    });
    assert.equal(result.candidatesFound, 1);
    assert.equal(result.phoneMatched, 1);
    assert.equal(result.reconciled, 0);
    assert.equal(result.writes, 0);
    assert.equal(result.messagesSent, 0);
    assert.equal(trackerCalls, 1);
    assert.equal(bundle.shipment.saved, 0);
});

test('V140 aplica divergência somente no Shipment existente e no lifecycle V139', async () => {
    const bundle = bundleFixture();
    let lifecycleCalls = 0;
    const result = await reconcileV140Rows({
        rows: [rowFixture()],
        bundles: [bundle],
        dryRun: false,
        onlyPhone: '+593968544878',
        trackGuide: async () => carrierFixture(),
        applyLifecycle: async (options) => {
            lifecycleCalls += 1;
            assert.equal(options.shipmentDocument, bundle.shipment);
            assert.equal(options.source, 'carrier_tracking');
            assert.equal(options.status, 'GUIA_GENERADA');
            return { ok: true, effectiveStatus: 'GUIA_GENERADA', adminSync: { ok: true }, order: bundle.order };
        }
    });
    assert.equal(result.reconciled, 1);
    assert.equal(result.messagesSent, 0);
    assert.equal(lifecycleCalls, 1);
    assert.equal(bundle.shipment.saved, 1);
    assert.equal(bundle.shipment.raw.latestDroppiPayload.dropiOrderId, '6904922');
    assert.ok(bundle.shipment.review.suppressedNotificationKinds.includes('guide'));
    assert.equal(bundle.shipment.review.reviewStatus, 'historical_sent_notice_review_required');
    assert.equal(bundle.shipment.events.at(-1).kind, 'v140_phone_reconciliation_identity_applied');
});

test('V140 bloqueia retirada antes do estado real e libera apenas READY', () => {
    const shipment = bundleFixture().shipment;
    assert.deepEqual(historicalSuppressionKindsV140({ status: 'GUIA_GENERADA', shipment }), ['guide']);
    assert.deepEqual(historicalSuppressionKindsV140({ status: 'EN_RUTA', shipment }), ['guide', 'in_transit']);
    assert.deepEqual(historicalSuppressionKindsV140({ status: 'READY_FOR_PICKUP', shipment }), ['guide', 'in_transit']);
    assert.deepEqual(historicalSuppressionKindsV140({ status: 'ENTREGADO', shipment }), ['guide', 'in_transit', 'ready_for_pickup']);
});

test('V140 dez sincronizações iguais produzem uma aplicação e nenhuma repetição', async () => {
    const bundle = bundleFixture();
    let lifecycleCalls = 0;
    for (let index = 0; index < 10; index += 1) {
        const result = await reconcileV140Rows({
            rows: [rowFixture()],
            bundles: [bundle],
            dryRun: false,
            onlyPhone: '+593968544878',
            trackGuide: async () => carrierFixture(),
            applyLifecycle: async () => {
                lifecycleCalls += 1;
                bundle.shipment.logistics.status = 'GUIA_GENERADA';
                bundle.shipment.logistics.trackingNumber = '189613429';
                bundle.order.status = 'shipped';
                bundle.order.shippingStatus = 'GUIA_GENERADA';
                bundle.order.trackingNumber = '189613429';
                bundle.order.dropiOrderId = '6904922';
                bundle.state.metadata.customerDraft.status = 'pedido_enviado';
                bundle.state.metadata.logistics.status = 'GUIA_GENERADA';
                bundle.lead.status = 'pedido_enviado';
                return { ok: true, effectiveStatus: 'GUIA_GENERADA', adminSync: { ok: true }, order: bundle.order };
            }
        });
        assert.equal(result.messagesSent, 0);
    }
    assert.equal(lifecycleCalls, 1);
    assert.equal(bundle.shipment.events.filter((event) => event.kind === 'v140_phone_reconciliation_identity_applied').length, 1);
});

test('V140 usa a fonte Dropi existente, o tracker e o lifecycle V139 e não chama criação/envio', () => {
    const service = fs.readFileSync(new URL('../src/services/ecPhoneServientregaReconciliationV140Service.js', import.meta.url), 'utf8');
    const browser = fs.readFileSync(new URL('../src/services/droppiEcuadorBrowserService.js', import.meta.url), 'utf8');
    const scheduler = fs.readFileSync(new URL('../src/services/schedulerService.js', import.meta.url), 'utf8');
    assert.match(service, /fetchDroppiEcuadorOrdersApiReadOnly/);
    assert.match(service, /trackServientregaGuide/);
    assert.match(service, /applyShipmentLifecycleStatus/);
    assert.doesNotMatch(service, /submitDroppiEcuadorOrder|upsertDroppiEcuadorShipment|new Shipment|Shipment\.create/);
    assert.match(browser, /fetchOrdersApiRows\(page/);
    assert.match(scheduler, /dryRun: true/);
    assert.match(scheduler, /dryRun: false/);
});
