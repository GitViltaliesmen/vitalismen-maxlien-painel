import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    dropiPostSaleEvidenceV139,
    nonRegressingOrderStatusV139,
    persistDropiStatusProjectionV139,
    persistManualPanelStatusV139
} from '../src/services/ecDropiStatusPostSaleV139Service.js';
import { normalizeDroppiEcuadorStatus } from '../src/services/droppiEcuadorService.js';
import { normalizeCarrierTrackingStatus } from '../src/services/carrierTrackingService.js';
import { applyShipmentLifecycleStatus } from '../src/services/shipmentLifecycleStatusService.js';
import {
    buildShippedCommunicationV29,
    logisticsCommunicationPolicy
} from '../src/services/logisticsCommunicationV29.js';
import {
    completePostSaleNotificationStage,
    decidePostSaleNotification,
    POST_SALE_NOTIFICATION_DECISIONS
} from '../src/services/postSaleNotificationDecisionService.js';

const stateDocument = () => ({
    metadata: {
        customerDraft: {
            orderId: 'EC-V139-FIXTURE',
            status: 'confirmado',
            phone: '593960000139'
        }
    },
    saved: 0,
    markModified() {},
    async save() { this.saved += 1; return this; }
});

const contactStateModelFor = (state) => ({
    findOne() {
        return {
            async sort() { return state; }
        };
    }
});

const orderDocument = (status = 'confirmed') => ({
    orderId: 'EC-V139-FIXTURE',
    status,
    country: 'EC',
    customer: { phone: '593960000139', name: 'Cliente Fixture V139' },
    saved: 0,
    async save() { this.saved += 1; return this; }
});

const authorizedShipment = (status = 'GUIA_GENERADA') => ({
    _id: 'shipment-v139-fixture',
    orderId: 'EC-V139-FIXTURE',
    client: { phone: '593960000139', name: 'Cliente Fixture V139' },
    logistics: {
        status,
        trackingNumber: '189600139',
        agencyPickup: true,
        pickupReadyVerified: status === 'READY_FOR_PICKUP'
    },
    automation: {
        dropiSubmitAuthorizedAt: new Date('2026-09-07T12:00:00Z'),
        dropiSubmitAuthorizedBy: 'fixture-operator',
        postSaleSafetyLedger: {},
        notificationLocks: {}
    },
    raw: {
        manualDropiOrderId: '6866139',
        latestDroppiPayload: { dropiOrderId: '6866139' }
    },
    events: [],
    saved: 0,
    async save() { this.saved += 1; return this; },
    toObject() { return this; }
});

test('V139 reutiliza o normalizador histórico para a resposta real da Servientrega', () => {
    assert.equal(
        normalizeCarrierTrackingStatus('Pendiente Generado Cliente Corporativo'),
        'GUIA_GENERADA'
    );
});

test('V139 status escolhido no painel persiste no Order e ContactState após nova leitura', async () => {
    const order = orderDocument('confirmed');
    const state = stateDocument();
    const panelCalls = [];
    const result = await persistManualPanelStatusV139({
        order,
        lead: { id: 9139, phone: order.customer.phone },
        panelStatus: 'pedido_enviado',
        contactStateModel: contactStateModelFor(state),
        syncPanel: (_order, options) => { panelCalls.push(options); return { ok: true, lead_id: 9139 }; }
    });
    assert.equal(result.ok, true);
    assert.equal(order.status, 'shipped');
    assert.equal(state.metadata.customerDraft.status, 'pedido_enviado');
    assert.equal(state.metadata.customerDraft.orderId, order.orderId);
    assert.equal(order.saved, 1);
    assert.equal(state.saved, 1);
    assert.equal(panelCalls.length, 1);
});

test('V139 rota de Order converte status canônico para o vocabulário persistido do painel', async () => {
    const order = orderDocument('confirmed');
    const state = stateDocument();
    const result = await persistManualPanelStatusV139({
        order,
        panelStatus: 'shipped',
        contactStateModel: contactStateModelFor(state),
        syncPanel: () => ({ ok: true })
    });
    assert.equal(result.panelStatus, 'pedido_enviado');
    assert.equal(state.metadata.customerDraft.status, 'pedido_enviado');
});

test('V139 sync Dropi projeta ID, guia e status sem depender do envio ao cliente', async () => {
    const order = orderDocument('confirmed');
    const state = stateDocument();
    let panelCalls = 0;
    const result = await persistDropiStatusProjectionV139({
        shipment: authorizedShipment(),
        orderModel: { async findOne() { return order; } },
        contactStateModel: contactStateModelFor(state),
        syncPanel: () => { panelCalls += 1; return { ok: true, lead_id: 9139 }; }
    });
    assert.equal(result.ok, true);
    assert.equal(order.status, 'shipped');
    assert.equal(order.dropiOrderId, '6866139');
    assert.equal(order.trackingNumber, '189600139');
    assert.equal(order.shippingStatus, 'GUIA_GENERADA');
    assert.equal(state.metadata.customerDraft.status, 'pedido_enviado');
    assert.equal(state.metadata.logistics.status, 'GUIA_GENERADA');
    assert.equal(panelCalls, 1);
    assert.equal(result.panel?.lead_id, 9139);
});

test('V139 status logístico antigo não rebaixa pedido já enviado ou terminal', () => {
    assert.equal(nonRegressingOrderStatusV139('shipped', 'processing'), 'shipped');
    assert.equal(nonRegressingOrderStatusV139('delivered', 'shipped'), 'delivered');
    assert.equal(nonRegressingOrderStatusV139('confirmed', 'shipped'), 'shipped');
});

test('V139 aplica dez consultas iguais como uma única transição canônica', async () => {
    const shipment = authorizedShipment('CREATED');
    const order = orderDocument('confirmed');
    const state = stateDocument();
    let panelCalls = 0;
    const options = {
        shipmentId: shipment._id,
        shipmentDocument: shipment,
        status: 'GUIA_GENERADA',
        source: 'carrier_tracking',
        carrierResult: {
            carrier: 'servientrega',
            trackingNumber: '189600139'
        },
        orderModel: { async findOne() { return order; } },
        contactStateModel: contactStateModelFor(state),
        syncPanel: () => { panelCalls += 1; return { ok: true }; }
    };
    for (let index = 0; index < 10; index += 1) {
        const result = await applyShipmentLifecycleStatus(options);
        assert.equal(result.effectiveStatus, 'GUIA_GENERADA');
    }
    assert.equal(shipment.events.filter((event) => event.kind === 'shipment_lifecycle_status_applied').length, 1);
    assert.equal(shipment.saved, 1);
    assert.equal(order.saved, 1);
    assert.equal(state.saved, 1);
    assert.equal(panelCalls, 1);
    assert.equal(order.status, 'shipped');
    assert.equal(state.metadata.customerDraft.status, 'pedido_enviado');
});

test('V139 pós-venda exige ID Dropi real e autorização humana persistida', () => {
    assert.equal(dropiPostSaleEvidenceV139(authorizedShipment()).eligible, true);
    const noId = authorizedShipment();
    noId.raw = {};
    assert.equal(dropiPostSaleEvidenceV139(noId).reason, 'missing_real_dropi_order_id');
    const noAuthorization = authorizedShipment();
    noAuthorization.automation.dropiSubmitAuthorizedAt = null;
    assert.equal(dropiPostSaleEvidenceV139(noAuthorization).reason, 'missing_human_dropi_authorization');
});

test('V139 primeiro aviso registra providerMessageId uma vez e dedupe bloqueia repetição', async () => {
    const shipment = authorizedShipment();
    const writes = [];
    const shipmentModel = {
        async updateOne(query, update) {
            writes.push({ query, update });
            return { modifiedCount: 1 };
        }
    };
    const completion = await completePostSaleNotificationStage({
        shipment,
        stage: 'GUIDE',
        variant: 'guide_text',
        lockToken: 'v139-lock',
        providerMessageId: 'provider-v139-1',
        shipmentModel
    });
    assert.equal(completion.completed, true);
    const ledger = writes[0].update.$set['automation.postSaleSafetyLedger.GUIDE'];
    assert.equal(ledger.state, 'SENT');
    assert.equal(ledger.providerMessageId, 'provider-v139-1');
    shipment.automation.postSaleSafetyLedger.GUIDE = ledger;
    const second = await decidePostSaleNotification({ shipment, kind: 'guide', acquireLock: false });
    assert.equal(second.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED);
});

test('V139 agência recebe guia sem liberação e pickup somente no status explícito', () => {
    const shipped = authorizedShipment('GUIA_GENERADA');
    const shippedPolicy = logisticsCommunicationPolicy(shipped);
    assert.equal(shippedPolicy.allowPickupLanguage, false);
    const message = buildShippedCommunicationV29(shipped);
    assert.match(message, /pedido ya fue enviado/i);
    assert.match(message, /número de guía/i);
    assert.match(message, /no vaya todavía a la agencia/i);
    assert.match(message, /Le avisaremos/i);
    assert.equal(normalizeDroppiEcuadorStatus('INGRESANDO EN AGENCIA'), 'EN_RUTA');
    const ready = authorizedShipment('READY_FOR_PICKUP');
    assert.equal(logisticsCommunicationPolicy(ready).allowPickupLanguage, true);
});

test('V139 integra projeção antes do envio e mantém autorização manual V138', () => {
    const dispatcher = fs.readFileSync(new URL('../src/services/shipmentStatusDispatcherService.js', import.meta.url), 'utf8');
    const browserSync = fs.readFileSync(new URL('../src/services/droppiEcuadorService.js', import.meta.url), 'utf8');
    const panel = fs.readFileSync(new URL('../public/leads-window.html', import.meta.url), 'utf8');
    const route = fs.readFileSync(new URL('../src/routes/shipments.js', import.meta.url), 'utf8');
    const orderRoute = fs.readFileSync(new URL('../src/routes/orders.js', import.meta.url), 'utf8');
    assert.ok(dispatcher.indexOf('persistDropiStatusProjectionV139') < dispatcher.indexOf('notifyShipmentGuideGenerated(shipmentForSend)'));
    assert.match(dispatcher, /dropiPostSaleEvidenceV139/);
    assert.match(browserSync, /persistDropiStatusProjectionV139\(\{ shipment \}\)/);
    assert.match(panel, /\/api\/orders\/\$\{encodeURIComponent\(orderId\)\}/);
    assert.match(orderRoute, /persistManualPanelStatusV139/);
    assert.match(orderRoute, /dropiCalled: false/);
    assert.match(orderRoute, /postSaleTriggered: false/);
    assert.match(route, /ecManualDropiHumanActionV138/);
    assert.match(route, /dropiSubmitAuthorizedAt/);
});
