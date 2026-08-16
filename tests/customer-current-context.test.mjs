import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    CUSTOMER_CONTEXT_CONFIDENCE,
    buildCustomerCurrentContextSnapshot,
    createCustomerCurrentContextReader
} from '../src/services/customerCurrentContextService.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phone = '593991234567';
const now = new Date('2026-08-16T18:00:00.000Z');
const emptyCatalog = () => ({
    cityCandidates: [],
    provinceCandidates: [],
    agencyCandidates: [],
    agencyConfident: false,
    agency: null
});

const contactState = (overrides = {}) => ({
    _id: 'contact-1',
    chatId: `${phone}@s.whatsapp.net`,
    phoneDigits: phone,
    countryCode: 'EC',
    human: { mode: 'auto' },
    metadata: {},
    createdAt: new Date('2026-08-15T10:00:00.000Z'),
    updatedAt: new Date('2026-08-16T10:00:00.000Z'),
    ...overrides
});

const inboundMessage = (body, overrides = {}) => ({
    _id: overrides._id || 'message-1',
    chatId: `${phone}@s.whatsapp.net`,
    peerPhone: phone,
    from: `${phone}@s.whatsapp.net`,
    to: '593990000000@s.whatsapp.net',
    body,
    timestamp: 1786900000,
    isFromMe: false,
    isBot: false,
    ...overrides
});

const order = (overrides = {}) => ({
    _id: overrides._id || 'order-doc-1',
    orderId: overrides.orderId || 'EC-ORDER-1',
    country: 'EC',
    customer: {
        name: 'Cliente Teste',
        phone,
        city: 'Quito',
        province: 'Pichincha',
        address: 'Calle Uno',
        reference: 'Parque',
        ...(overrides.customer || {})
    },
    package: {
        label: 'Tex Ultra Ecuador 1 frasco',
        quantity: 1,
        ...(overrides.package || {})
    },
    total: 35.99,
    currency: 'USD',
    status: 'confirmed',
    confirmedAt: new Date('2026-08-16T12:00:00.000Z'),
    tracking: {
        productKey: 'tex_ultra_ec',
        productName: 'Tex Ultra Ecuador',
        ...(overrides.tracking || {})
    },
    conversationMemory: overrides.conversationMemory || {},
    createdAt: new Date('2026-08-16T11:00:00.000Z'),
    updatedAt: new Date('2026-08-16T12:00:00.000Z'),
    ...overrides,
    customer: {
        name: 'Cliente Teste',
        phone,
        city: 'Quito',
        province: 'Pichincha',
        address: 'Calle Uno',
        reference: 'Parque',
        ...(overrides.customer || {})
    },
    package: {
        label: 'Tex Ultra Ecuador 1 frasco',
        quantity: 1,
        ...(overrides.package || {})
    },
    tracking: {
        productKey: 'tex_ultra_ec',
        productName: 'Tex Ultra Ecuador',
        ...(overrides.tracking || {})
    }
});

const shipment = (overrides = {}) => ({
    _id: overrides._id || 'shipment-1',
    orderId: overrides.orderId || 'EC-ORDER-1',
    country: 'EC',
    client: { phone, ...(overrides.client || {}) },
    logistics: {
        status: 'created',
        agencyPickup: false,
        ...(overrides.logistics || {})
    },
    outcomes: { delivered: false, pickedUp: false, returned: false, prepaidOnly: false, ...(overrides.outcomes || {}) },
    updatedAt: new Date('2026-08-16T13:00:00.000Z'),
    ...overrides,
    client: { phone, ...(overrides.client || {}) },
    logistics: {
        status: 'created',
        agencyPickup: false,
        ...(overrides.logistics || {})
    },
    outcomes: { delivered: false, pickedUp: false, returned: false, prepaidOnly: false, ...(overrides.outcomes || {}) }
});

const snapshot = (overrides = {}) => buildCustomerCurrentContextSnapshot({
    phone,
    requestedDigits: phone,
    contactStates: [],
    messages: [],
    orders: [],
    shipments: [],
    vslVisits: [],
    generatedAt: now,
    catalogResolver: emptyCatalog,
    ...overrides
});

test('cliente novo sem historico retorna contexto vazio, auditavel e somente leitura', () => {
    const result = snapshot({ contactStates: [contactState()] });
    assert.equal(result.readOnly, true);
    assert.equal(result.customer.phone.value, phone);
    assert.equal(result.customer.currentOrder.confidence, CUSTOMER_CONTEXT_CONFIDENCE.UNKNOWN);
    assert.equal(result.customer.currentProduct.product.confidence, CUSTOMER_CONTEXT_CONFIDENCE.UNKNOWN);
    assert.deepEqual(result.customer.history, []);
});

test('cliente antigo mantem pedido terminal no historico sem promove-lo a pedido atual', () => {
    const delivered = order({ status: 'delivered', orderId: 'EC-OLD-1', _id: 'old-1', confirmedAt: new Date('2026-07-01T10:00:00.000Z') });
    const result = snapshot({ orders: [delivered] });
    assert.equal(result.customer.currentOrder.value, null);
    assert.equal(result.customer.history.length, 1);
    assert.equal(result.customer.history[0].orderId, 'EC-OLD-1');
    assert.equal(result.customer.history[0].historical, true);
    assert.equal(result.customer.currentProduct.product.confidence, CUSTOMER_CONTEXT_CONFIDENCE.UNKNOWN);
});

test('produto da VSL permanece independente do produto atual confirmado', () => {
    const state = contactState({
        metadata: {
            vslProductKey: 'vit_power_ec',
            vslProductName: 'Vit Power Ecuador',
            vslPath: '/m/'
        }
    });
    const result = snapshot({ contactStates: [state], orders: [order()] });
    assert.equal(result.customer.currentProduct.product.value.key, 'tex_ultra_ec');
    assert.equal(result.customer.vslOrigin.product.value.key, 'vit_power_ec');
    assert.ok(result.customer.conflicts.some((item) => item.code === 'VSL_NEGOTIATION_DIVERGENCE'));
});

test('nome corrigido explicitamente pelo cliente fica confirmado', () => {
    const result = snapshot({ messages: [inboundMessage('Mi nombre correcto es Maria Fernanda.')] });
    assert.equal(result.customer.identity.name.value, 'Maria Fernanda');
    assert.equal(result.customer.identity.name.confidence, CUSTOMER_CONTEXT_CONFIDENCE.CONFIRMED);
    assert.equal(result.customer.identity.name.source.kind, 'customer_message');
});

test('nome de perfil permanece inferido e no maximo provavel', () => {
    const result = snapshot({ messages: [inboundMessage('Hola', { notifyName: 'Maria Perfil' })] });
    assert.equal(result.customer.identity.name.value, 'Maria Perfil');
    assert.equal(result.customer.identity.name.confidence, CUSTOMER_CONTEXT_CONFIDENCE.PROBABLE);
    assert.equal(result.customer.identity.name.inferred, true);
});

test('cidade com mais de uma candidata de catalogo retorna AMBIGUO sem escolha silenciosa', () => {
    const result = snapshot({
        messages: [inboundMessage('Estoy en San Jose')],
        catalogResolver: () => ({
            cityCandidates: ['San Jose de Chimbo', 'San Jose de Minas'],
            provinceCandidates: [],
            agencyCandidates: [],
            agencyConfident: false,
            agency: null
        })
    });
    assert.equal(result.customer.location.city.value, null);
    assert.equal(result.customer.location.city.confidence, CUSTOMER_CONTEXT_CONFIDENCE.AMBIGUOUS);
    assert.equal(result.customer.location.city.candidates.length, 2);
});

test('catalogo local infere provincia apenas quando a cidade tem correspondencia exata e unica', () => {
    const state = contactState({ metadata: { customerDraft: { city: 'Quito' } } });
    const result = buildCustomerCurrentContextSnapshot({
        phone,
        requestedDigits: phone,
        contactStates: [state],
        generatedAt: now
    });
    assert.equal(result.customer.location.city.value, 'Quito');
    assert.equal(result.customer.location.province.value, 'PICHINCHA');
    assert.equal(result.customer.location.province.confidence, CUSTOMER_CONTEXT_CONFIDENCE.PROBABLE);
    assert.equal(result.customer.location.province.inferred, true);
});

test('agencia unica do catalogo local traz endereco e setor sem aplicar nada', () => {
    const agency = {
        name: 'Manta Central',
        city: 'Manta',
        province: 'Manabi',
        address: 'Avenida 4',
        sector: 'Centro'
    };
    const result = snapshot({
        messages: [inboundMessage('Agencia: Manta Central')],
        catalogResolver: () => ({
            cityCandidates: ['Manta'],
            provinceCandidates: ['Manabi'],
            agencyCandidates: [agency],
            agencyConfident: true,
            agency
        })
    });
    assert.equal(result.customer.location.agency.value, 'Manta Central');
    assert.equal(result.customer.location.sector.value, 'Centro');
    assert.equal(result.customer.location.address.value, 'Avenida 4');
    assert.equal(result.customer.location.agency.applicationAllowed, false);
});

test('historico entregue usa apenas snapshot local allowlist do Shipment', () => {
    const deliveredOrder = order({ status: 'delivered', orderId: 'EC-DELIVERED', _id: 'order-delivered' });
    const deliveredShipment = shipment({
        orderId: 'EC-DELIVERED',
        logistics: { status: 'DELIVERED', trackingNumber: 'GUIA-1' },
        outcomes: { delivered: true, pickedUp: true },
        raw: { secret: 'NAO_EXPOR' }
    });
    const result = snapshot({ orders: [deliveredOrder], shipments: [deliveredShipment] });
    assert.equal(result.customer.history[0].shipment.delivered, true);
    assert.equal(result.customer.history[0].shipment.trackingNumber, 'GUIA-1');
    assert.doesNotMatch(JSON.stringify(result), /NAO_EXPOR/);
});

test('pedido antigo nao retirado permanece historico e informativo', () => {
    const returnedOrder = order({ status: 'returned', orderId: 'EC-RETURNED', _id: 'order-returned' });
    const returnedShipment = shipment({
        orderId: 'EC-RETURNED',
        logistics: { status: 'DEVUELTO' },
        outcomes: { returned: true, prepaidOnly: true }
    });
    const result = snapshot({ orders: [returnedOrder], shipments: [returnedShipment] });
    assert.equal(result.customer.currentOrder.value, null);
    assert.equal(result.customer.history[0].shipment.returned, true);
    assert.equal(result.customer.history[0].shipment.prepaidOnly, true);
});

test('multiplos pedidos ativos geram ambiguidade e nenhum pedido atual e escolhido', () => {
    const result = snapshot({
        orders: [
            order({ _id: 'active-a', orderId: 'EC-A' }),
            order({ _id: 'active-b', orderId: 'EC-B', updatedAt: new Date('2026-08-16T13:00:00.000Z') })
        ]
    });
    assert.equal(result.customer.currentOrder.value, null);
    assert.equal(result.customer.currentOrder.confidence, CUSTOMER_CONTEXT_CONFIDENCE.AMBIGUOUS);
    assert.equal(result.customer.currentOrder.candidates.length, 2);
    assert.ok(result.customer.conflicts.some((item) => item.code === 'MULTIPLE_ACTIVE_ORDERS'));
});

test('vinculo explicito resolve o pedido atual mesmo quando existem dois pedidos ativos', () => {
    const state = contactState({ metadata: { activeOrderId: 'EC-B' } });
    const selected = order({
        _id: 'active-b',
        orderId: 'EC-B',
        tracking: { productKey: 'nitrix_ec', productName: 'Nitrix Oxide Ecuador' }
    });
    const result = snapshot({
        contactStates: [state],
        orders: [order({ _id: 'active-a', orderId: 'EC-A' }), selected]
    });
    assert.equal(result.customer.currentOrder.value.orderId, 'EC-B');
    assert.equal(result.customer.currentOrder.source.kind, 'explicit_current_order_link');
    assert.equal(result.customer.currentProduct.product.value.key, 'nitrix_ec');
    assert.equal(result.customer.conflicts.some((item) => item.code === 'MULTIPLE_ACTIVE_ORDERS'), false);
});

test('conflito entre ficha persistida e correcao do cliente preserva a prioridade do cliente', () => {
    const state = contactState({ metadata: { customerDraft: { name: 'Nome Antigo' } } });
    const result = snapshot({
        contactStates: [state],
        messages: [inboundMessage('Mi nombre correcto es Nombre Nuevo')]
    });
    assert.equal(result.customer.identity.name.value, 'Nombre Nuevo');
    assert.equal(result.customer.identity.name.confidence, CUSTOMER_CONTEXT_CONFIDENCE.CONFLICT);
    assert.ok(result.customer.conflicts.some((item) => item.code === 'NAME_MISMATCH'));
});

test('edicao manual comprovada por campo vence confirmacao posterior sem ocultar conflito', () => {
    const state = contactState({
        metadata: {
            customerDraft: { name: 'Nome Manual' },
            customerFieldProvenance: {
                name: { kind: 'manual', by: 'operador', confirmedAt: '2026-08-16T10:00:00.000Z' }
            }
        }
    });
    const result = snapshot({
        contactStates: [state],
        messages: [inboundMessage('Mi nombre correcto es Nome Conversa')]
    });
    assert.equal(result.customer.identity.name.value, 'Nome Manual');
    assert.equal(result.customer.identity.name.source.kind, 'manual_field_evidence');
    assert.equal(result.customer.identity.name.confidence, CUSTOMER_CONTEXT_CONFIDENCE.CONFLICT);
});

test('cauda de telefone com duas candidatas EC bloqueia a associacao', () => {
    const partial = '91234567';
    const result = buildCustomerCurrentContextSnapshot({
        phone: partial,
        requestedDigits: partial,
        orders: [
            order({ _id: 'phone-a', orderId: 'EC-PHONE-A', customer: { phone: '593991234567' } }),
            order({ _id: 'phone-b', orderId: 'EC-PHONE-B', customer: { phone: '593891234567' } })
        ],
        generatedAt: now,
        catalogResolver: emptyCatalog
    });
    assert.equal(result.customer.phone.value, null);
    assert.equal(result.customer.phone.confidence, CUSTOMER_CONTEXT_CONFIDENCE.AMBIGUOUS);
    assert.ok(result.customer.conflicts.some((item) => item.code === 'PHONE_MATCH_AMBIGUOUS'));
    assert.equal(result.customer.currentOrder.value, null);
});

test('produto sem prova permanece DESCONHECIDO e nao recebe fallback legado', () => {
    const result = snapshot({
        contactStates: [contactState({ metadata: { vslProductKey: 'vit_power_ec' } })],
        messages: [inboundMessage('Quiero saber el precio')]
    });
    assert.equal(result.customer.currentProduct.product.value, null);
    assert.equal(result.customer.currentProduct.product.confidence, CUSTOMER_CONTEXT_CONFIDENCE.UNKNOWN);
    assert.equal(result.customer.vslOrigin.product.value.key, 'vit_power_ec');
});

const collectApplicationFlags = (value, found = []) => {
    if (!value || typeof value !== 'object') return found;
    for (const [key, nested] of Object.entries(value)) {
        if (key === 'applicationAllowed') found.push(nested);
        collectApplicationFlags(nested, found);
    }
    return found;
};

test('todos os blocos, campos, candidatos e historicos mantem applicationAllowed false', () => {
    const result = snapshot({
        contactStates: [contactState({ metadata: { customerDraft: { name: 'Cliente', city: 'Quito' } } })],
        orders: [order()],
        messages: [inboundMessage('Nombre: Cliente\nCiudad: Quito')]
    });
    const flags = collectApplicationFlags(result);
    assert.ok(flags.length > 20);
    assert.equal(flags.every((flag) => flag === false), true);
});

const fakeReadOnlyModel = (name, rows, observations, mutationCalls) => {
    const model = {
        find(query) {
            const observation = { name, query, select: null, sort: null, limit: null, lean: false };
            observations.push(observation);
            return {
                select(value) { observation.select = value; return this; },
                sort(value) { observation.sort = value; return this; },
                limit(value) { observation.limit = value; return this; },
                lean() { observation.lean = true; return Promise.resolve(structuredClone(rows)); }
            };
        }
    };
    for (const method of ['save', 'updateOne', 'updateMany', 'findOneAndUpdate', 'insertOne', 'create', 'deleteOne', 'deleteMany', 'bulkWrite']) {
        model[method] = () => { mutationCalls.push(`${name}.${method}`); throw new Error(`forbidden ${method}`); };
    }
    return model;
};

test('reader usa somente find + select + sort + limit + lean e nao muda documentos ou timestamps', async () => {
    const datasets = {
        states: [contactState({ metadata: { customerDraft: { name: 'Imutavel' } } })],
        messages: [inboundMessage('Nombre: Imutavel', { providerPayload: { token: 'SEGREDO-ZAPI' } })],
        orders: [order()],
        shipments: [shipment({ raw: { token: 'SEGREDO-DROPI' } })],
        visits: [{
            _id: 'visit-1',
            visitorKey: 'visit-key',
            country: 'EC',
            customerPhone: phone,
            productKey: 'tex_ultra_ec',
            path: '/n/',
            metaPageViewResponse: { token: 'SEGREDO-META' },
            lastSeenAt: new Date('2026-08-16T11:00:00.000Z')
        }]
    };
    const before = structuredClone(datasets);
    const observations = [];
    const mutationCalls = [];
    const reader = createCustomerCurrentContextReader({
        ContactStateModel: fakeReadOnlyModel('ContactState', datasets.states, observations, mutationCalls),
        MessageModel: fakeReadOnlyModel('Message', datasets.messages, observations, mutationCalls),
        OrderModel: fakeReadOnlyModel('Order', datasets.orders, observations, mutationCalls),
        ShipmentModel: fakeReadOnlyModel('Shipment', datasets.shipments, observations, mutationCalls),
        VslVisitModel: fakeReadOnlyModel('VslVisit', datasets.visits, observations, mutationCalls),
        catalogResolver: emptyCatalog,
        clock: () => now
    });

    const result = await reader(phone);
    assert.deepEqual(datasets, before);
    assert.deepEqual(mutationCalls, []);
    assert.ok(observations.length >= 5);
    assert.equal(observations.every((item) => item.select && item.sort && item.limit && item.lean), true);
    assert.doesNotMatch(JSON.stringify(result), /SEGREDO-(?:ZAPI|DROPI|META)/);
    assert.equal(result.customer.currentOrder.value.orderId, 'EC-ORDER-1');
});

test('fonte do servico nao contem operacoes de escrita nem dependencias externas de efeito colateral', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'src', 'services', 'customerCurrentContextService.js'), 'utf8');
    assert.doesNotMatch(source, /\.(?:save|updateOne|updateMany|findOneAndUpdate|insertOne|create|deleteOne|deleteMany|bulkWrite)\s*\(/);
    assert.doesNotMatch(source, /from\s+['"][^'"]*(?:droppi|dropi|metaConversions|sendText|sendAudio|openai|scheduler|conversationEngine|botHandler)[^'"]*['"]/i);
    assert.match(source, /\.lean\(\)/);
});
