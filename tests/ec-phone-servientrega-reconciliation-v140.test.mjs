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
import {
    HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE,
    restoreHistoricalExternalDroppiBinding,
    validateHistoricalExternalDroppiBinding
} from '../src/services/droppiEcuadorImportService.js';
import { applyShipmentLifecycleStatus } from '../src/services/shipmentLifecycleStatusService.js';
import { dropiPostSaleEvidenceV139 } from '../src/services/ecDropiStatusPostSaleV139Service.js';

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
    assert.match(service, /restoreHistoricalExternalDroppiBinding/);
    assert.doesNotMatch(service, /submitDroppiEcuadorOrder|new Shipment|Shipment\.create|new Order|Order\.create/);
    assert.match(browser, /fetchOrdersApiRows\(page/);
    assert.match(scheduler, /dryRun: true/);
    assert.match(scheduler, /dryRun: false/);
});

const externalCases = [
    ['+593990195217', 'customer-3463', '3463', '6886503', '189613431'],
    ['+593983996761', 'customer-3464', '3464', '6886310', '189613437'],
    ['+593994897441', 'customer-3494', '3494', '6886278', '189613438'],
    ['+593992418689', 'customer-3496', '3496', '6886247', '189613439']
];

const externalAnchorFixture = ([phone, customerId, leadId]) => ({
    shipment: null,
    order: null,
    state: {
        _id: customerId,
        phoneDigits: phone.replace(/\D/g, ''),
        metadata: { customerDraft: { phone, status: 'pedido_enviado', orderId: '' }, logistics: {} }
    },
    lead: { id: leadId, phone, status: 'pedido_enviado' },
    externalAnchor: true
});

const externalRowFixture = ([phone, , , dropiOrderId, trackingNumber]) => ({
    phone,
    dropiOrderId,
    trackingNumber,
    internalOrderId: '',
    productKey: '',
    productName: '',
    createdAt: '2026-09-06T13:00:00.000Z'
});

test('V140 valida vínculo externo somente com telefone, Dropi, guia, Customer e Lead inequívocos', () => {
    const tuple = externalCases[0];
    const anchor = externalAnchorFixture(tuple);
    const row = externalRowFixture(tuple);
    const result = validateHistoricalExternalDroppiBinding({
        row,
        state: anchor.state,
        lead: anchor.lead,
        carrier: { ok: true, trackingNumber: row.trackingNumber, normalizedStatus: 'GUIA_GENERADA' }
    });
    assert.equal(result.ok, true);
    assert.equal(result.phone, tuple[0]);
    assert.equal(result.dropiOrderId, tuple[3]);
    assert.equal(result.guide, tuple[4]);
    assert.equal(result.orderId, tuple[3]);
    assert.equal(result.source, HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE);

    const conflict = validateHistoricalExternalDroppiBinding({
        row,
        state: anchor.state,
        lead: { ...anchor.lead, phone: '+593900000000' },
        carrier: { ok: true, trackingNumber: row.trackingNumber, normalizedStatus: 'GUIA_GENERADA' }
    });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.reason, 'phone_identity_conflict');
});

test('V140 importador histórico reutilizado não presume produto, quantidade ou valor', async () => {
    const tuple = externalCases[0];
    const anchor = externalAnchorFixture(tuple);
    const row = externalRowFixture(tuple);
    let payload = null;
    const shipment = {
        _id: 'shipment-external-3463',
        orderId: tuple[3],
        client: { phone: tuple[0] },
        logistics: { status: 'GUIA_GENERADA', trackingNumber: tuple[4] },
        raw: { historicalExternalReconciliation: { source: HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE } }
    };
    const result = await restoreHistoricalExternalDroppiBinding({
        row,
        state: anchor.state,
        lead: anchor.lead,
        carrier: { ok: true, trackingNumber: row.trackingNumber, normalizedStatus: 'GUIA_GENERADA' },
        dryRun: false,
        shipmentModel: { findOne: () => Promise.resolve(null) },
        orderModel: { findOne: () => Promise.resolve(null) },
        upsertShipment: async (value) => { payload = value; return shipment; },
        now: () => new Date('2026-09-07T22:00:00.000Z')
    });
    assert.equal(result.ok, true);
    assert.equal(result.restored, true);
    assert.equal(result.messagesSent, 0);
    assert.equal(payload.orderId, tuple[3]);
    assert.equal(payload.historicalIdentityOnly, true);
    assert.equal(payload.reconciliationSource, HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE);
    assert.equal(payload.productName, undefined);
    assert.equal(payload.quantity, undefined);
    assert.equal(payload.total, undefined);
});

test('V140 completa proveniência de Shipment externo existente antes de considerá-lo vinculado', async () => {
    const tuple = externalCases[0];
    const anchor = externalAnchorFixture(tuple);
    const row = externalRowFixture(tuple);
    const existingShipment = {
        _id: 'shipment-without-provenance',
        orderId: tuple[3],
        client: { phone: tuple[0] },
        logistics: { status: 'GUIA_GENERADA', trackingNumber: tuple[4] },
        raw: { manualDropiOrderId: tuple[3] }
    };
    let upsertCalls = 0;
    const result = await restoreHistoricalExternalDroppiBinding({
        row,
        state: anchor.state,
        lead: anchor.lead,
        carrier: { ok: true, trackingNumber: tuple[4], normalizedStatus: 'GUIA_GENERADA' },
        dryRun: false,
        shipmentModel: { findOne: () => Promise.resolve(existingShipment) },
        orderModel: { findOne: () => Promise.resolve(null) },
        upsertShipment: async (payload) => {
            upsertCalls += 1;
            assert.equal(payload.customerId, tuple[1]);
            assert.equal(payload.leadId, tuple[2]);
            return { ...existingShipment, raw: { historicalExternalReconciliation: { source: HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE } } };
        }
    });
    assert.equal(result.ok, true);
    assert.equal(result.restored, true);
    assert.equal(result.alreadyBound, undefined);
    assert.equal(upsertCalls, 1);
});

test('V140 dry-run dos quatro vínculos reais mantém zero writes e quatro pendências comprovadas', async () => {
    const rows = externalCases.map(externalRowFixture);
    const bundles = externalCases.map(externalAnchorFixture);
    let restoreCalls = 0;
    const result = await reconcileV140Rows({
        rows,
        bundles,
        dryRun: true,
        trackGuide: async (guide) => ({ ok: true, trackingNumber: guide, normalizedStatus: 'GUIA_GENERADA' }),
        restoreExternalBinding: async ({ row, state, lead, dryRun }) => {
            restoreCalls += 1;
            assert.equal(dryRun, true);
            return {
                ok: true,
                writes: 0,
                messagesSent: 0,
                expected: {
                    orderId: row.dropiOrderId,
                    customerId: String(state._id),
                    leadId: String(lead.id),
                    guide: row.trackingNumber,
                    productName: '',
                    quantity: null,
                    total: null
                }
            };
        }
    });
    assert.equal(result.candidatesFound, 4);
    assert.equal(result.phoneMatched, 4);
    assert.equal(result.reconcilable, 4);
    assert.equal(result.reconciled, 0);
    assert.equal(result.restoredExternalLinks, 0);
    assert.equal(result.missingLinkRemaining, 4);
    assert.equal(result.writes, 0);
    assert.equal(result.messagesSent, 0);
    assert.equal(restoreCalls, 4);
});

test('V140 não escolhe entre dois pedidos Dropi externos do mesmo telefone', async () => {
    const tuple = externalCases[0];
    const second = [tuple[0], tuple[1], tuple[2], '7999999', '199999999'];
    let restoreCalls = 0;
    const result = await reconcileV140Rows({
        rows: [externalRowFixture(tuple), externalRowFixture(second)],
        bundles: [externalAnchorFixture(tuple)],
        dryRun: true,
        trackGuide: async () => ({ ok: true, normalizedStatus: 'GUIA_GENERADA' }),
        restoreExternalBinding: async () => { restoreCalls += 1; return { ok: true }; }
    });
    assert.equal(result.candidatesFound, 2);
    assert.equal(result.phoneMatched, 0);
    assert.equal(result.ambiguousSkipped, 2);
    assert.equal(result.writes, 0);
    assert.equal(result.messagesSent, 0);
    assert.equal(restoreCalls, 0);
    assert.ok(result.results.every((item) => item.reason === 'multiple_dropi_orders_for_external_phone'));
});

test('V140 fixture restaura os quatro vínculos e zera missing link sem mensagens', async () => {
    const rows = externalCases.map(externalRowFixture);
    const bundles = externalCases.map(externalAnchorFixture);
    const result = await reconcileV140Rows({
        rows,
        bundles,
        dryRun: false,
        trackGuide: async (guide) => ({ ok: true, carrier: 'servientrega', trackingNumber: guide, normalizedStatus: 'GUIA_GENERADA' }),
        restoreExternalBinding: async ({ row }) => ({
            ok: true,
            restored: true,
            writes: 1,
            messagesSent: 0,
            expected: { orderId: row.dropiOrderId, guide: row.trackingNumber },
            shipment: {
                _id: `shipment-${row.dropiOrderId}`,
                orderId: row.dropiOrderId,
                logistics: { status: 'GUIA_GENERADA', trackingNumber: row.trackingNumber }
            }
        }),
        applyLifecycle: async ({ shipmentDocument, status }) => ({
            ok: true,
            effectiveStatus: status,
            shipment: shipmentDocument,
            shipmentChanged: false,
            contactStateChanged: true,
            adminSync: { ok: true, changed: 1 },
            externalBindingConflict: ''
        })
    });
    assert.equal(result.candidatesFound, 4);
    assert.equal(result.phoneMatched, 4);
    assert.equal(result.reconcilable, 4);
    assert.equal(result.reconciled, 4);
    assert.equal(result.restoredExternalLinks, 4);
    assert.equal(result.missingLinkRemaining, 0);
    assert.equal(result.messagesSent, 0);
    assert.equal(result.errors, 0);
});

test('V140 lifecycle propaga binding histórico ao ContactState e painel sem Order local', async () => {
    const tuple = externalCases[0];
    const state = {
        _id: tuple[1],
        metadata: { customerDraft: { phone: tuple[0], status: 'pedido_enviado', orderId: '' }, logistics: {} },
        markModified() {},
        async save() { this.saved = (this.saved || 0) + 1; return this; }
    };
    const shipment = {
        _id: 'shipment-external-lifecycle',
        orderId: tuple[3],
        client: { phone: tuple[0] },
        logistics: { status: 'CREATED', trackingNumber: tuple[4], distributionCompany: 'SERVIENTREGA' },
        automation: {},
        outcomes: {},
        review: {},
        events: [],
        raw: {
            manualDropiOrderId: tuple[3],
            historicalExternalReconciliation: {
                source: HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE,
                phone: tuple[0],
                customerId: tuple[1],
                leadId: tuple[2],
                dropiOrderId: tuple[3],
                trackingNumber: tuple[4],
                sourceDropi: true,
                sourceServientrega: true,
                restoredAt: new Date('2026-09-07T22:00:00.000Z')
            }
        },
        async save() { this.saved = (this.saved || 0) + 1; return this; },
        toObject() { return this; }
    };
    let panelCalls = 0;
    const result = await applyShipmentLifecycleStatus({
        shipmentId: shipment._id,
        shipmentDocument: shipment,
        status: 'GUIA_GENERADA',
        carrierResult: { carrier: 'servientrega', trackingNumber: tuple[4] },
        orderModel: { findOne: () => Promise.resolve(null) },
        contactStateModel: { findOne: () => ({ sort: () => Promise.resolve(state) }) },
        syncContactPanel: (draft, options) => {
            panelCalls += 1;
            assert.equal(draft.phone, tuple[0]);
            assert.equal(options.adminStatus, 'pedido_enviado');
            return { ok: true, changed: 1 };
        }
    });
    assert.equal(result.ok, true);
    assert.equal(result.externalBindingConflict, '');
    assert.equal(result.contactStateChanged, true);
    assert.equal(state.metadata.customerDraft.orderId, '');
    assert.equal(state.metadata.customerDraft.status, 'pedido_enviado');
    assert.equal(state.metadata.logistics.externalOrderId, tuple[3]);
    assert.equal(state.metadata.logistics.dropiOrderId, tuple[3]);
    assert.equal(state.metadata.logistics.trackingNumber, tuple[4]);
    assert.equal(state.metadata.logistics.status, 'GUIA_GENERADA');
    assert.equal(state.metadata.logistics.source, HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE);
    assert.equal(panelCalls, 1);
});

test('V140 proveniência externa habilita somente pós-venda, sem forjar autorização de envio', () => {
    const tuple = externalCases[0];
    const shipment = {
        client: { phone: tuple[0] },
        logistics: { status: 'GUIA_GENERADA', trackingNumber: tuple[4] },
        automation: { dropiSubmitAuthorizedAt: null, dropiSubmitAuthorizedBy: '' },
        raw: {
            manualDropiOrderId: tuple[3],
            historicalExternalReconciliation: {
                source: HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE,
                phone: tuple[0],
                customerId: tuple[1],
                leadId: tuple[2],
                dropiOrderId: tuple[3],
                trackingNumber: tuple[4],
                sourceDropi: true,
                sourceServientrega: true
            }
        }
    };
    const evidence = dropiPostSaleEvidenceV139(shipment);
    assert.equal(evidence.authorized, false);
    assert.equal(evidence.historicalExternal, true);
    assert.equal(evidence.postSaleIdentityVerified, true);
    assert.equal(evidence.eligible, true);
    assert.equal(evidence.reason, 'historical_external_event_verified');
});

test('V140 bloqueia proveniência externa que diverge do Shipment persistido', async () => {
    const tuple = externalCases[0];
    const shipment = {
        _id: 'shipment-external-conflict',
        orderId: tuple[3],
        client: { phone: tuple[0] },
        logistics: { status: 'CREATED', trackingNumber: tuple[4] },
        automation: {},
        outcomes: {},
        review: {},
        events: [],
        raw: {
            manualDropiOrderId: tuple[3],
            historicalExternalReconciliation: {
                source: HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE,
                phone: tuple[0],
                customerId: tuple[1],
                leadId: tuple[2],
                dropiOrderId: '9999999',
                trackingNumber: tuple[4],
                sourceDropi: true,
                sourceServientrega: true
            }
        },
        async save() { return this; },
        toObject() { return this; }
    };
    let contactQueries = 0;
    const result = await applyShipmentLifecycleStatus({
        shipmentId: shipment._id,
        shipmentDocument: shipment,
        status: 'GUIA_GENERADA',
        orderModel: { findOne: () => Promise.resolve(null) },
        contactStateModel: { findOne: () => { contactQueries += 1; return Promise.resolve(null); } }
    });
    assert.equal(result.ok, true);
    assert.equal(result.externalBindingConflict, 'historical_external_evidence_conflict');
    assert.equal(contactQueries, 0);
    assert.equal(dropiPostSaleEvidenceV139(shipment).historicalExternal, false);
});

test('V140 novo status real após o bootstrap não suprime a notificação futura aplicável', async () => {
    const tuple = externalCases[0];
    const bundle = {
        order: null,
        shipment: {
            _id: 'shipment-external-from-now',
            orderId: tuple[3],
            client: { phone: tuple[0] },
            logistics: { status: 'GUIA_GENERADA', trackingNumber: tuple[4], pickupReadyVerified: false },
            automation: {},
            review: { suppressedNotificationKinds: ['guide'] },
            raw: {
                manualDropiOrderId: tuple[3],
                historicalExternalReconciliation: {
                    source: HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE,
                    phone: tuple[0],
                    customerId: tuple[1],
                    leadId: tuple[2],
                    dropiOrderId: tuple[3],
                    trackingNumber: tuple[4],
                    sourceDropi: true,
                    sourceServientrega: true
                }
            },
            events: [{ kind: 'historical_external_reconciliation_restored', at: new Date() }],
            notificationLedger: [],
            async save() { return this; }
        },
        state: {
            _id: tuple[1],
            phoneDigits: tuple[0].replace(/\D/g, ''),
            metadata: {
                customerDraft: { phone: tuple[0], status: 'pedido_enviado', orderId: '' },
                logistics: { status: 'GUIA_GENERADA', orderStatus: 'shipped', dropiOrderId: tuple[3], trackingNumber: tuple[4] }
            }
        },
        lead: { id: tuple[2], phone: tuple[0], status: 'pedido_enviado' }
    };
    let lifecycleCalls = 0;
    const result = await reconcileV140Rows({
        rows: [externalRowFixture(tuple)],
        bundles: [bundle],
        dryRun: false,
        trackGuide: async () => ({ ok: true, carrier: 'servientrega', trackingNumber: tuple[4], normalizedStatus: 'EN_RUTA' }),
        applyLifecycle: async () => {
            lifecycleCalls += 1;
            return { ok: true, effectiveStatus: 'EN_RUTA', adminSync: { ok: true } };
        }
    });
    assert.equal(result.reconciled, 1);
    assert.equal(result.messagesSent, 0);
    assert.equal(lifecycleCalls, 1);
    assert.deepEqual(bundle.shipment.review.suppressedNotificationKinds, ['guide']);
});
