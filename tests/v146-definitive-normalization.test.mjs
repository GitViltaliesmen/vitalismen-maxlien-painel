import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    botRepurchaseEligibilityV146,
    freshCommercialCycleDraftV146,
    freshCycleOrderIdV146,
    repeatPurchasePendingOrderV146
} from '../src/services/ecCommercialCycleV146Service.js';
import { projectPanelCustomerReadModel } from '../src/services/panelCustomerReadModelService.js';
import { findServientregaEcuadorAgencies, normalizeAgencyText } from '../src/services/servientregaEcuadorAgencyService.js';
import {
    compareConversationRecencyV146,
    lastRelevantConversationActivityAtV146
} from '../src/services/panelConversationRecencyV146Service.js';
import {
    initiateCheckoutBusinessActionV146,
    initiateCheckoutEventIdV146,
    sendInitiateCheckoutForPendingOrderV146
} from '../src/services/metaInitiateCheckoutV146Service.js';
import { postSaleRuntimeDiagnosisV146 } from '../src/services/postSaleRuntimeV146Service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const source = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const deliveredOrder = () => ({
    orderId: 'EC-DELIVERED-001',
    country: 'EC',
    status: 'delivered',
    updatedAt: '2026-08-26T12:00:00.000Z',
    customer: {
        name: 'Cliente Uno',
        phone: '+593998191091',
        city: 'Quito',
        province: 'Pichincha',
        address: 'Direccion X',
        reference: 'Referencia X'
    },
    delivery: { mode: 'agency', agencyId: 'OLD', agencyName: 'Agencia X' },
    package: { quantity: 3, id: 3, label: '3 frascos' },
    total: 80.99
});

const deliveredShipment = () => ({
    orderId: 'EC-DELIVERED-001',
    country: 'EC',
    client: {
        name: 'Cliente Uno',
        phone: '+593998191091',
        city: 'Quito',
        province: 'Pichincha',
        address: 'Direccion X',
        reference: 'Referencia X'
    },
    logistics: {
        status: 'ENTREGADO',
        trackingNumber: '185531793',
        agencyName: 'Agencia X',
        lastStatusAt: '2026-08-26T12:00:00.000Z'
    },
    outcomes: { delivered: true },
    updatedAt: '2026-08-26T12:00:00.000Z'
});

test('V146 cria ciclo novo, limpa dados do pedido e mantém o histórico imutável', () => {
    const previous = deliveredOrder();
    const snapshot = structuredClone(previous);
    const draft = freshCommercialCycleDraftV146({
        draft: {
            name: 'Cliente Uno',
            phone: '+593998191091',
            city: 'Quito',
            province: 'Pichincha',
            address: 'Direccion X',
            reference: 'Referencia X',
            deliveryMode: 'agency',
            agencyId: 'OLD',
            agencyName: 'Agencia X',
            quantity: 3,
            total: 80.99,
            productKey: 'vit_power_ec',
            productName: 'Vit Power Ecuador'
        },
        previousOrder: previous,
        newOrderId: 'EC-RECOMPRA-NEW-001',
        updatedAt: '2026-09-08T20:00:00.000Z'
    });

    assert.equal(draft.orderId, 'EC-RECOMPRA-NEW-001');
    assert.equal(draft.previousOrderId, previous.orderId);
    assert.equal(draft.status, 'recompra');
    assert.equal(draft.address, '');
    assert.equal(draft.reference, '');
    assert.equal(draft.deliveryMode, '');
    assert.equal(draft.agencyName, '');
    assert.equal(draft.quantity, '');
    assert.equal(draft.total, '');
    assert.equal(draft.productKey, 'vit_power_ec');
    assert.deepEqual(previous, snapshot);
    assert.match(freshCycleOrderIdV146({ previousOrderId: previous.orderId, now: 1, random: 0.5 }), /^EC-RECOMPRA-/);
});

test('V146 não herda endereço, agência ou referência no fluxo automático de recompra', () => {
    const pending = repeatPurchasePendingOrderV146({ shipment: deliveredShipment(), peerPhone: '593998191091' });
    assert.equal(pending.name, 'Cliente Uno');
    assert.equal(pending.city, 'Quito');
    assert.equal(pending.address, '');
    assert.equal(pending.reference, '');
    assert.equal(pending.deliveryMode, '');
    assert.equal(pending.agencyName, '');
    assert.equal(pending.quantity, '');
    assert.equal(pending.total, '');
    assert.equal(pending.previousOrderId, 'EC-DELIVERED-001');
});

test('V146 projeta recompra e endereço novo sem reidratar o pedido entregue', () => {
    const contactState = {
        phoneDigits: '593998191091',
        metadata: {
            customerDraft: {
                name: 'Cliente Uno',
                phone: '+593998191091',
                city: 'Quito',
                province: 'Pichincha',
                address: 'Direccion Y',
                reference: 'Referencia Y',
                deliveryMode: 'home',
                agencyId: '',
                agencyName: '',
                quantity: 1,
                total: 35.99,
                orderId: 'EC-RECOMPRA-NEW-001',
                currentNegotiationOrderId: 'EC-RECOMPRA-NEW-001',
                previousOrderId: 'EC-DELIVERED-001',
                historicalOrderId: 'EC-DELIVERED-001',
                newCommercialCycle: true,
                status: 'recompra',
                updatedAt: '2026-09-08T20:00:00.000Z'
            }
        }
    };
    const projected = projectPanelCustomerReadModel({
        contactState,
        orders: [deliveredOrder()],
        shipments: [deliveredShipment()],
        fallbackPhone: '+593998191091'
    });
    assert.equal(projected.orderStatus, 'recompra');
    assert.equal(projected.customerDraft.orderId, 'EC-RECOMPRA-NEW-001');
    assert.equal(projected.customerDraft.historicalOrderId, 'EC-DELIVERED-001');
    assert.equal(projected.customerDraft.address, 'Direccion Y');
    assert.equal(projected.customerDraft.reference, 'Referencia Y');
    assert.equal(projected.customerDraft.deliveryMode, 'home');
    assert.equal(projected.customerDraft.agencyName, '');
    assert.equal(projected.customerDraft.quantity, 1);
    assert.equal(projected.customerDraft.total, 35.99);
});

test('V146 usa a ficha salva mais nova para X→Y→Z e não vaza entre clientes', () => {
    const order = deliveredOrder();
    const project = (phone, address, updatedAt) => projectPanelCustomerReadModel({
        contactState: { metadata: { customerDraft: { phone, address, status: 'novo', updatedAt } } },
        orders: [{ ...order, customer: { ...order.customer, phone } }],
        fallbackPhone: phone
    }).customerDraft.address;
    assert.equal(project('+593998191091', 'Direccion Y', '2026-09-08T20:00:00.000Z'), 'Direccion Y');
    assert.equal(project('+593998191091', 'Direccion Z', '2026-09-08T21:00:00.000Z'), 'Direccion Z');
    assert.equal(project('+593999999999', '', '2026-09-08T22:00:00.000Z'), '');
});

test('V146 respeita humano no comando e libera nova intenção somente em auto', () => {
    const locked = botRepurchaseEligibilityV146({
        human: { mode: 'manual', pausedUntil: '2036-01-01T00:00:00.000Z' },
        explicitNewPurchase: true,
        delivered: true
    });
    assert.deepEqual(locked, { eligible: false, reason: 'human_takeover_active', botSends: 0 });
    const released = botRepurchaseEligibilityV146({
        human: { mode: 'auto' },
        explicitNewPurchase: true,
        delivered: true
    });
    assert.equal(released.eligible, true);
});

test('V146 ordena por atividade real e ignora updatedAt genérico', () => {
    const oldWithGenericUpdate = {
        lastRelevantConversationActivityAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-08T23:59:00.000Z',
        unreadCount: 4
    };
    const recentlyHandled = {
        lastRelevantConversationActivityAt: '2026-09-08T20:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z'
    };
    assert.ok(compareConversationRecencyV146(oldWithGenericUpdate, recentlyHandled) > 0);
    assert.equal(
        lastRelevantConversationActivityAtV146({
            contactState: {
                lastInboundAt: '2026-09-08T19:00:00.000Z',
                updatedAt: '2026-09-08T23:59:00.000Z',
                human: { lastManualAt: '2026-09-08T20:00:00.000Z' }
            }
        }),
        '2026-09-08T20:00:00.000Z'
    );
});

test('V146 ranqueia agência e não retorna falso positivo', () => {
    const exact = findServientregaEcuadorAgencies({ query: '24 de Mayo Padre Lasso', limit: 5 });
    assert.equal(normalizeAgencyText(exact[0].name), '24 DE MAYO PADRE LASSO');
    assert.equal(exact[0].matchKind, 'exact');
    assert.equal(exact[0].topMatch, true);
    const prefix = findServientregaEcuadorAgencies({ query: 'Padre Lasso', limit: 5 });
    assert.equal(normalizeAgencyText(prefix[0].name), '24 DE MAYO PADRE LASSO');
    assert.ok(['prefix', 'multi_token'].includes(prefix[0].matchKind));
    const locality = findServientregaEcuadorAgencies({ query: 'Quito', limit: 5 });
    assert.equal(normalizeAgencyText(locality[0].city), 'QUITO');
    const typo = findServientregaEcuadorAgencies({ query: 'Qito', limit: 5 });
    assert.equal(normalizeAgencyText(typo[0].city), 'QUITO');
    assert.equal(typo[0].matchKind, 'bounded_fuzzy');
    assert.deepEqual(findServientregaEcuadorAgencies({ query: 'zzzzzzzz', limit: 5 }), []);
});

test('V146 define InitiateCheckout por ação comercial e mantém event_id estável', () => {
    assert.equal(initiateCheckoutBusinessActionV146({ intent: 'whatsapp_click', clicked: true }).occurred, false);
    assert.equal(initiateCheckoutBusinessActionV146({ intent: 'checkout_started' }).occurred, true);
    assert.equal(initiateCheckoutEventIdV146({ cycleId: 'EC-RECOMPRA-NEW-001' }), 'InitiateCheckout:EC-RECOMPRA-NEW-001');
});

test('V146 persiste e deduplica InitiateCheckout de um rascunho válido com sink', async () => {
    const state = {
        _id: 'state-1',
        phoneDigits: '593998191091',
        metadata: {
            vslVisitId: 'visit-1',
            customerDraft: { name: 'Cliente Uno', city: 'Quito', province: 'Pichincha', productKey: 'vit_power_ec' }
        }
    };
    const visit = {
        _id: 'visit-1',
        visitorId: 'visitor-1',
        sourceUrl: 'https://example.invalid/vsl',
        productKey: 'vit_power_ec',
        productName: 'Vit Power Ecuador',
        tracking: { external_id: 'visitor-1', fbp: 'fb.1.synthetic' }
    };
    const setPath = (target, dotted, value) => {
        const parts = dotted.split('.');
        const last = parts.pop();
        const parent = parts.reduce((node, part) => (node[part] ||= {}), target);
        parent[last] = value;
    };
    const apply = (target, update) => {
        Object.entries(update.$set || {}).forEach(([key, value]) => setPath(target, key, value));
        Object.keys(update.$unset || {}).forEach((key) => setPath(target, key, undefined));
    };
    const lean = (value) => ({ lean: () => Promise.resolve(value) });
    const models = {
        ContactState: {
            findById: () => lean(structuredClone(state)),
            findOneAndUpdate: (_query, update) => {
                if (state.metadata.metaInitiateCheckoutV146?.sentAt || state.metadata.metaInitiateCheckoutV146?.lockUntil) return lean(null);
                apply(state, update);
                return lean(structuredClone(state));
            },
            updateOne: async (_query, update) => apply(state, update)
        },
        VslVisit: {
            findById: () => lean(structuredClone(visit)),
            updateOne: async (_query, update) => apply(visit, update)
        }
    };
    let sends = 0;
    const sendEvent = async (event) => {
        sends += 1;
        return { ok: true, eventId: event.event_id, datasetRoute: 'EC_DEFAULT', response: { events_received: 1 } };
    };
    const first = await sendInitiateCheckoutForPendingOrderV146({
        contactStateId: 'state-1',
        agentKey: 'vit_power_ec',
        parsedOrder: { name: 'Cliente Uno', phone: '+593998191091', city: 'Quito', province: 'Pichincha', quantity: 3, total: 80.99 },
        orderId: 'EC-RECOMPRA-NEW-001',
        models,
        sendEvent
    });
    const second = await sendInitiateCheckoutForPendingOrderV146({
        contactStateId: 'state-1',
        agentKey: 'vit_power_ec',
        parsedOrder: { quantity: 3 },
        orderId: 'EC-RECOMPRA-NEW-001',
        models,
        sendEvent
    });
    assert.equal(first.accepted, true);
    assert.equal(first.eventsReceived, 1);
    assert.equal(second.alreadySent, true);
    assert.equal(sends, 1);
    assert.equal(state.metadata.metaInitiateCheckoutV146.occurred, true);
    assert.equal(state.metadata.metaInitiateCheckoutV146.sent, true);
    assert.equal(state.metadata.metaInitiateCheckoutV146.accepted, true);
    assert.equal(state.metadata.metaInitiateCheckoutV146.eventId, 'InitiateCheckout:EC-RECOMPRA-NEW-001');
});

test('V146 diagnostica o primeiro elo do pós-venda sem executar envio', () => {
    const disabled = postSaleRuntimeDiagnosisV146({
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'true',
        DISABLE_SCHEDULER: '1',
        SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED: 'false',
        SHIPMENT_STATUS_DISPATCH_ENABLED: 'false',
        SHIPMENT_PICKUP_REMINDERS_ENABLED: 'false',
        PICKUP_PROOF_SWEEP_ENABLED: 'false'
    });
    assert.equal(disabled.running, false);
    assert.equal(disabled.rootCause, 'scheduler_registration_disabled');
    const enabled = postSaleRuntimeDiagnosisV146({
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'true',
        DISABLE_SCHEDULER: '0',
        SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED: 'true',
        SHIPMENT_STATUS_DISPATCH_ENABLED: 'true',
        SHIPMENT_PICKUP_REMINDERS_ENABLED: 'true',
        PICKUP_PROOF_SWEEP_ENABLED: 'true'
    });
    assert.equal(enabled.running, true);
});

test('V146 mantém os contratos visuais e operacionais da microcamada', () => {
    const panel = source('public/qr.html');
    const router = source('src/services/agentRouter.js');
    const conversation = source('src/services/conversationEngine.js');
    const whatsapp = source('src/routes/whatsapp.js');
    assert.match(panel, /Melhor resultado/);
    assert.match(panel, /Clique na agência correta para selecioná-la/);
    assert.doesNotMatch(panel, /const automaticMatch = intelligence\.selectAutomaticAgency/);
    assert.match(panel, /Object\.assign\(customerDraft, syncedDraft\)/);
    assert.match(router, /botRepurchaseEligibilityV146: 'blocked_by_human_takeover'/);
    assert.doesNotMatch(router, /answer_doubts_without_reopening_funnel/);
    assert.match(conversation, /repeatPurchasePendingOrderV146/);
    assert.match(whatsapp, /fresh_commercial_cycle_created_no_dropi_no_shipment_no_purchase/);
    assert.match(whatsapp, /initiateCheckoutAction\.occurred/);
});
