import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
    projectPanelCustomerReadModel,
    selectAuthoritativePanelOrder
} from '../src/services/panelCustomerReadModelService.js';
import {
    describePanelGlobalSearchQuery,
    searchPanelCustomersGlobally
} from '../src/services/panelGlobalCustomerSearchService.js';
import {
    canResolveStaleDropiRejectedReview,
    resolveStaleDropiRejectedReviewAtomic
} from '../src/services/dropiRejectedReviewResolutionService.js';
import {
    decidePostSaleNotification,
    POST_SALE_NOTIFICATION_DECISIONS
} from '../src/services/postSaleNotificationDecisionService.js';
import {
    classifyDropiShipmentMatch,
    validateDropiTrackingForReconciliation
} from '../src/services/dropiShipmentReconciliationService.js';
import { sanitizeDropiSyncEntry } from '../src/services/dropiSyncObservabilityService.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(fs.readFileSync(path.join(projectRoot, 'tests/fixtures/post-sale-gargalos-v65.json'), 'utf8'));
const fixtureCase = (key) => fixture.cases.find((item) => item.key === key);

const chain = (records = []) => ({
    sort() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(records); },
    catch() { return Promise.resolve(records); },
    then(resolve, reject) { return Promise.resolve(records).then(resolve, reject); }
});
const modelWith = (records = []) => ({ find: () => chain(records) });
const searchModels = ({ states = [], orders = [], shipments = [], messages = [] } = {}) => ({
    ContactState: modelWith(states),
    Order: modelWith(orders),
    Shipment: modelWith(shipments),
    Message: modelWith(messages)
});

const baseState = (phone, name = 'Alias tecnico') => ({
    _id: `state-${phone}`,
    chatId: `${phone}@c.us`,
    phoneDigits: phone,
    countryCode: 'EC',
    metadata: {
        profileName: name,
        customerDraft: { name, phone, status: 'Novo' }
    },
    human: { mode: 'auto' },
    tags: []
});
const baseOrder = ({ orderId, phone, name, status = 'processing', updatedAt = '2026-08-20T00:00:00Z' }) => ({
    orderId,
    country: 'EC',
    status,
    updatedAt,
    customer: { name, phone, city: 'Quito', province: 'Pichincha' },
    package: { quantity: 3, label: '3 frascos' },
    total: 80.99,
    currency: 'USD'
});
const baseShipment = ({
    orderId,
    phone,
    name,
    status = 'EN_RUTA',
    tracking = '189400001',
    productName = 'Tex Ultra Ecuador',
    updatedAt = '2026-08-21T00:00:00Z'
}) => ({
    _id: `shipment-${orderId}`,
    orderId,
    country: 'EC',
    provider: 'droppi',
    productName,
    updatedAt,
    client: { name, phone },
    logistics: {
        status,
        trackingNumber: tracking,
        agencyPickup: true,
        pickupReadyVerified: status === 'READY_FOR_PICKUP',
        lastStatusAt: updatedAt
    },
    automation: { submittedToDroppiAt: '2026-08-20T00:00:00Z' },
    review: { manualOnly: false, suppressedNotificationKinds: [] },
    outcomes: {}
});

test('busca V65 valida telefone, nome, pedido e bloqueia regex curta/irrestrita', () => {
    assert.equal(describePanelGlobalSearchQuery('815').kind, 'numeric');
    assert.equal(describePanelGlobalSearchQuery('+593 979 820 815').valid, true);
    assert.equal(describePanelGlobalSearchQuery('Ormeño Zamora').kind, 'name');
    assert.equal(describePanelGlobalSearchQuery('EC-ADMIN-3360').kind, 'order');
    assert.equal(describePanelGlobalSearchQuery('9').valid, false);
    assert.equal(describePanelGlobalSearchQuery('[').valid, false);
});

test('busca remota encontra cliente fora do lote rápido por telefone normalizado sem criar registro', async () => {
    const phone = '593979820815';
    const state = baseState(phone, 'Castillo Calixto');
    const order = baseOrder({ orderId: 'EC-ADMIN-3360', phone, name: 'Castillo Calixto Engelberto Manchay' });
    const shipment = baseShipment({ orderId: order.orderId, phone, name: order.customer.name, status: 'DEVUELTO' });
    const result = await searchPanelCustomersGlobally({
        query: '979820815',
        models: searchModels({ states: [state], orders: [order], shipments: [shipment] })
    });
    assert.equal(result.readOnly, true);
    assert.equal(result.count, 1);
    assert.equal(result.results[0].id, `${phone}@c.us`);
    assert.equal(result.results[0].orderStatus, 'devolvido');
    assert.equal(result.results[0].officialOrderName, order.customer.name);
});

test('busca remota encontra por nome, pedido, guia e retorna vazio de modo seguro', async () => {
    const phone = '593990287146';
    const state = baseState(phone, 'Contato Antigo');
    const order = { ...baseOrder({ orderId: 'EC-ADMIN-7146', phone, name: 'Cliente Oficial' }), dropiOrderId: '6657146', trackingNumber: '189400714' };
    const shipment = { ...baseShipment({ orderId: order.orderId, phone, name: order.customer.name, tracking: order.trackingNumber }), raw: { manualDropiOrderId: order.dropiOrderId } };
    for (const query of ['Cliente Oficial', 'EC-ADMIN-7146', '189400714', '6657146']) {
        const result = await searchPanelCustomersGlobally({
            query,
            models: searchModels({
                states: query === 'Cliente Oficial' ? [state] : [],
                orders: [order],
                shipments: [shipment]
            })
        });
        assert.equal(result.count, 1, query);
        assert.equal(result.results[0].orderId, order.orderId, query);
    }
    const empty = await searchPanelCustomersGlobally({ query: 'inexistente', models: searchModels() });
    assert.equal(empty.count, 0);
    assert.equal(empty.reason, 'not_found');
});

test('busca exata por guia não associa o primeiro pedido do mesmo telefone', async () => {
    const phone = '593999999999';
    const oldOrder = { ...baseOrder({ orderId: 'EC-OLD', phone, name: 'Nome Oficial', updatedAt: '2026-08-01' }), trackingNumber: '189400111' };
    const targetOrder = { ...baseOrder({ orderId: 'EC-TARGET', phone, name: 'Nome Oficial', updatedAt: '2026-08-02' }), trackingNumber: '189400222' };
    const targetShipment = baseShipment({ orderId: 'EC-TARGET', phone, name: 'Nome Oficial', tracking: '189400222' });
    const result = await searchPanelCustomersGlobally({
        query: '189400222',
        models: searchModels({ orders: [oldOrder, targetOrder], shipments: [targetShipment] })
    });
    const exact = result.results.find((item) => item.orderId === 'EC-TARGET');
    assert.ok(exact);
    assert.equal(exact.selectionReason, 'preferred_exact_search_match');
});

test('frontend V65 mantém resultado local e só mescla remoto sem duplicar telefone', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'public/panel-intelligence/remote-chat-search-v65.js'), 'utf8');
    const context = { window: {} };
    vm.runInNewContext(source, context);
    const api = context.window.VitalismenRemoteChatSearchV65;
    const local = [{ id: '593979820815@c.us', phone: '593979820815', name: 'Local' }];
    const remote = [
        { id: '979820815@c.us', phone: '979820815', name: 'Duplicado' },
        { id: '593990287146@c.us', phone: '593990287146', orderId: 'EC-7146' }
    ];
    assert.equal(api.mergeChats(local, remote).length, 2);
    assert.equal(api.matches(remote[1], 'EC-7146'), true);
    assert.equal(api.queryDescriptor('14').valid, false);
});

test('read model impede rascunho Novo de sobrescrever DEVUELTO', () => {
    const phone = '593984583448';
    const state = baseState(phone, 'LUIS ARMANDO');
    const order = baseOrder({ orderId: 'EC-ADMIN-3367', phone, name: 'LUIS ARMANDO', status: 'processing' });
    const shipment = baseShipment({ orderId: order.orderId, phone, name: order.customer.name, status: 'DEVUELTO' });
    const model = projectPanelCustomerReadModel({ contactState: state, orders: [order], shipments: [shipment] });
    assert.equal(model.orderStatus, 'devolvido');
    assert.equal(model.operationalStatus.source, 'shipment');
});

test('read model separa alias técnico do nome oficial e projeta READY/ENTREGADO', () => {
    const phone = '593969253940';
    const state = baseState(phone, 'garciajul96');
    const order = baseOrder({ orderId: 'EC-ADMIN-3359', phone, name: 'JULIO GARCIA' });
    const ready = projectPanelCustomerReadModel({
        contactState: state,
        orders: [order],
        shipments: [baseShipment({ orderId: order.orderId, phone, name: order.customer.name, status: 'READY_FOR_PICKUP' })]
    });
    assert.equal(ready.displayName, 'JULIO GARCIA');
    assert.equal(ready.conversationName, 'garciajul96');
    assert.equal(ready.identityDiffers, true);
    assert.equal(ready.orderStatus, 'pedido_enviado');
    assert.equal(ready.operationalStatus.key, 'na_agencia');
    const delivered = projectPanelCustomerReadModel({
        contactState: state,
        orders: [{ ...order, status: 'delivered' }],
        shipments: [baseShipment({ orderId: order.orderId, phone, name: order.customer.name, status: 'ENTREGADO' })]
    });
    assert.equal(delivered.orderStatus, 'entregue');
});

test('read model conserva conversa sem pedido e escolhe pedido ativo autoritativo entre múltiplos', () => {
    const phone = '593999998370';
    const state = baseState(phone, 'Contato sem pedido');
    const noOrder = projectPanelCustomerReadModel({ contactState: state, fallbackPhone: phone });
    assert.equal(noOrder.displayName, 'Contato sem pedido');
    assert.equal(noOrder.orderStatus, 'novo');
    const oldReturned = baseOrder({ orderId: 'EC-OLD', phone, name: 'Nome Antigo', status: 'returned', updatedAt: '2026-08-25' });
    const active = baseOrder({ orderId: 'EC-ACTIVE', phone, name: 'Nome Atual', status: 'processing', updatedAt: '2026-08-20' });
    const selection = selectAuthoritativePanelOrder({
        orders: [oldReturned, active],
        shipments: [
            baseShipment({ orderId: oldReturned.orderId, phone, name: oldReturned.customer.name, status: 'DEVUELTO', updatedAt: '2026-08-25' }),
            baseShipment({ orderId: active.orderId, phone, name: active.customer.name, status: 'EN_RUTA', updatedAt: '2026-08-20' })
        ]
    });
    assert.equal(selection.selectedOrderId, 'EC-ACTIVE');
});

const staleShipment = (overrides = {}) => ({
    _id: 'shipment-stale',
    orderId: 'EC-STALE',
    review: { manualOnly: true, reviewReason: 'dropi_rejected', reviewStatus: 'manual_send_required' },
    logistics: { status: 'READY_FOR_PICKUP', trackingNumber: '189400333', pickupReadyVerified: true, agencyPickup: true },
    raw: { manualDropiOrderId: '6653333' },
    ...overrides
});

test('manualOnly dropi_rejected só resolve com evidência posterior positiva e fechada', () => {
    const shipment = staleShipment();
    assert.equal(canResolveStaleDropiRejectedReview({ shipment, evidence: { source: 'dropi_panel', status: 'READY_FOR_PICKUP' } }).ok, false);
    assert.equal(canResolveStaleDropiRejectedReview({
        shipment,
        evidence: { source: 'dropi_panel', orderId: shipment.orderId, dropiOrderId: '6653333', status: 'READY_FOR_PICKUP' }
    }).ok, true);
    assert.equal(canResolveStaleDropiRejectedReview({
        shipment: staleShipment({ review: { manualOnly: true, reviewReason: 'wrong_product', reviewStatus: 'manual_review' } }),
        evidence: { source: 'dropi_panel', dropiOrderId: '6653333', status: 'READY_FOR_PICKUP' }
    }).ok, false);
});

test('resolução manualOnly usa lock atômico, registra antes/depois e suprime replay', async () => {
    const calls = [];
    let changed = false;
    const model = {
        async findOneAndUpdate(query, update) {
            calls.push({ query, update });
            if (changed) return null;
            if (query['review.resolutionLockToken']) {
                changed = true;
                return { ...staleShipment(), review: { manualOnly: false, reviewStatus: 'superseded_by_authoritative_logistics' } };
            }
            return staleShipment();
        }
    };
    const evidence = { source: 'dropi_orders_api', orderId: 'EC-STALE', dropiOrderId: '6653333', status: 'READY_FOR_PICKUP' };
    const first = await resolveStaleDropiRejectedReviewAtomic({ shipment: staleShipment(), evidence, model });
    const second = await resolveStaleDropiRejectedReviewAtomic({ shipment: staleShipment(), evidence, model });
    assert.equal(first.resolved, true);
    assert.equal(second.resolved, false);
    assert.equal(calls[1].update.$push.events.$each[0].payload.before.reviewReason, 'dropi_rejected');
    assert.ok(calls[1].update.$addToSet['review.suppressedNotificationKinds'].$each.includes('ready_for_pickup'));
});

const messageModel = (messages = []) => ({ find: () => chain(messages) });
const decisionShipmentFromFixture = (item) => ({
    _id: `shipment-${item.key}`,
    orderId: item.orderId,
    client: { phone: item.phone },
    logistics: {
        status: item.status,
        trackingNumber: item.trackingNumber,
        pickupReadyVerified: item.pickupReadyVerified,
        agencyPickup: item.agencyPickup
    },
    automation: {},
    review: {
        manualOnly: item.manualOnly,
        reviewReason: item.reviewReason,
        reviewStatus: item.reviewStatus,
        suppressedNotificationKinds: []
    },
    events: [],
    notificationLedger: [],
    outcomes: { returned: item.status === 'DEVUELTO' }
});

test('anti-spam reconhece marker estruturado e mensagem humana equivalente', async () => {
    const marker = decisionShipmentFromFixture(fixtureCase('6457'));
    marker.automation.guiaNotifiedAt = new Date();
    const structured = await decidePostSaleNotification({ shipment: marker, kind: 'guide', acquireLock: false });
    assert.equal(structured.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED);

    const item = fixtureCase('7146');
    const humanMessages = item.messages.map((body, index) => ({
        _id: `human-${index}`,
        body,
        isFromMe: true,
        isBot: false,
        senderRole: 'human',
        peerPhone: item.phone,
        createdAt: new Date('2026-08-26T12:00:00Z')
    }));
    const manual = await decidePostSaleNotification({
        shipment: { ...decisionShipmentFromFixture(item), review: { manualOnly: false, suppressedNotificationKinds: [] } },
        kind: 'ready_for_pickup',
        acquireLock: false,
        messageModel: messageModel(humanMessages)
    });
    assert.equal(manual.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY);
});

test('anti-spam bloqueia guia 6457 já comunicada e mantém 4818 inelegível para retirada', async () => {
    const guide = fixtureCase('6457');
    const guideDecision = await decidePostSaleNotification({
        shipment: decisionShipmentFromFixture(guide),
        kind: 'guide',
        acquireLock: false,
        messageModel: messageModel([{ _id: 'manual-guide', body: guide.messages[0], isFromMe: true, isBot: false, peerPhone: guide.phone }])
    });
    assert.equal(guideDecision.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY);
    const enRoute = await decidePostSaleNotification({
        shipment: decisionShipmentFromFixture(fixtureCase('4818')),
        kind: 'ready_for_pickup',
        acquireLock: false,
        messageModel: messageModel([])
    });
    assert.equal(enRoute.decision, POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE);
});

test('anti-spam persiste lock entre concorrência, restart e segunda execução do scheduler', async () => {
    let lockHeld = false;
    const shipmentModel = {
        async findOneAndUpdate() {
            if (lockHeld) return null;
            lockHeld = true;
            return decisionShipmentFromFixture(fixtureCase('6457'));
        }
    };
    const shipment = decisionShipmentFromFixture(fixtureCase('6457'));
    const first = await decidePostSaleNotification({ shipment, kind: 'guide', messageModel: messageModel([]), shipmentModel });
    const concurrent = await decidePostSaleNotification({ shipment, kind: 'guide', messageModel: messageModel([]), shipmentModel });
    const afterRestart = await decidePostSaleNotification({ shipment: { ...shipment }, kind: 'guide', messageModel: messageModel([]), shipmentModel });
    assert.equal(first.decision, POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND);
    assert.equal(concurrent.reason, 'persistent_notification_lock_or_marker');
    assert.equal(afterRestart.reason, 'persistent_notification_lock_or_marker');
});

test('resolução histórica de manualOnly não dispara replay', async () => {
    const shipment = decisionShipmentFromFixture(fixtureCase('9599'));
    shipment.review = { manualOnly: false, suppressedNotificationKinds: ['ready_for_pickup'] };
    const decision = await decidePostSaleNotification({
        shipment,
        kind: 'ready_for_pickup',
        acquireLock: false,
        messageModel: messageModel([])
    });
    assert.equal(decision.decision, POST_SALE_NOTIFICATION_DECISIONS.HISTORICAL_EVENT_SUPPRESSED);
});

test('reconciliador casa estritamente por Dropi ID, tracking e telefone', () => {
    const a = { ...baseShipment({ orderId: 'EC-A', phone: '593999111222', name: 'Cliente Uno' }), raw: { manualDropiOrderId: '6652142' } };
    const b = { ...baseShipment({ orderId: 'EC-B', phone: '593999111333', name: 'Cliente Dos', tracking: '189411028' }), raw: {} };
    assert.equal(classifyDropiShipmentMatch({ row: { dropiOrderId: '6652142', phone: a.client.phone, productName: 'Tex Ultra Ecuador' }, candidates: [a, b] }).shipment.orderId, 'EC-A');
    assert.equal(classifyDropiShipmentMatch({ row: { trackingNumber: '189411028', phone: b.client.phone, productName: 'Tex Ultra Ecuador' }, candidates: [a, b] }).matchType, 'tracking_number');
    assert.equal(classifyDropiShipmentMatch({ row: { phone: b.client.phone, clientName: b.client.name, productName: 'Tex Ultra Ecuador' }, candidates: [a, b] }).matchType, 'phone_fallback');
});

test('reconciliador falha fechado em ambiguidade, produto conflitante e tracking inválido', () => {
    const phone = '593999111444';
    const a = baseShipment({ orderId: 'EC-A', phone, name: 'Juan Cliente', productName: 'Tex Ultra Ecuador' });
    const b = baseShipment({ orderId: 'EC-B', phone, name: 'Juan Cliente', productName: 'Tex Ultra Ecuador' });
    assert.equal(classifyDropiShipmentMatch({ row: { phone, clientName: 'Juan Cliente', productName: 'Tex Ultra Ecuador' }, candidates: [a, b] }).state, 'AMBIGUOUS_MATCH');
    assert.equal(classifyDropiShipmentMatch({ row: { phone, clientName: 'Juan Cliente', productName: 'Vit Power Ecuador' }, candidates: [a] }).state, 'PRODUCT_CONFLICT');
    assert.equal(validateDropiTrackingForReconciliation(phone, phone).ok, false);
    assert.equal(classifyDropiShipmentMatch({ row: { phone, trackingNumber: phone }, candidates: [a] }).state, 'INVALID_TRACKING');
});

test('reconciliador pode recuperar em ciclo posterior sem criar Shipment fantasma', () => {
    const row = { dropiOrderId: '6652142', phone: '593999996457', productName: 'Tex Ultra Ecuador' };
    assert.equal(classifyDropiShipmentMatch({ row, candidates: [] }).state, 'NO_MATCH');
    const later = { ...baseShipment({ orderId: 'EC-LATER', phone: row.phone, name: 'Cliente Recuperado' }), raw: { manualDropiOrderId: row.dropiOrderId } };
    const recovered = classifyDropiShipmentMatch({ row, candidates: [later] });
    assert.equal(recovered.state, 'MATCHED');
    assert.equal(recovered.shipment.orderId, 'EC-LATER');
});

test('observabilidade sanitiza cada estado sem token, payload ou telefone completo', () => {
    const entry = sanitizeDropiSyncEntry({
        state: 'UPDATED',
        source: 'dropi_orders_api',
        orderId: 'EC-6457',
        dropiOrderId: '6652142',
        trackingNumber: '189411028',
        phone: '593999996457',
        token: 'SEGREDO',
        rawPayload: { secret: true },
        changedFields: ['logistics.trackingNumber']
    });
    assert.equal(entry.phoneTail, '6457');
    assert.equal(entry.token, undefined);
    assert.equal(entry.rawPayload, undefined);
    assert.deepEqual(entry.changedFields, ['logistics.trackingNumber']);
});
