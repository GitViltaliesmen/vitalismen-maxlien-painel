import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import whatsappRoutes, {
    panelProductContextForChat,
    resolveProfilePictureUrl
} from '../src/routes/whatsapp.js';
import ContactState from '../src/models/ContactState.js';
import Message from '../src/models/Message.js';
import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeSource = fs.readFileSync(path.join(projectRoot, 'src', 'routes', 'whatsapp.js'), 'utf8');

const queryResult = (value) => {
    const promise = Promise.resolve(value);
    const query = {
        sort() { return query; },
        limit() { return query; },
        select() { return query; },
        lean() { return query; },
        then(onFulfilled, onRejected) { return promise.then(onFulfilled, onRejected); },
        catch(onRejected) { return promise.catch(onRejected); }
    };
    return query;
};

const fakeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

const replaceMethod = (target, name, replacement, restorers) => {
    const hadOwn = Object.prototype.hasOwnProperty.call(target, name);
    const descriptor = hadOwn ? Object.getOwnPropertyDescriptor(target, name) : null;
    Object.defineProperty(target, name, {
        configurable: true,
        writable: true,
        value: replacement
    });
    restorers.push(() => {
        if (hadOwn) Object.defineProperty(target, name, descriptor);
        else delete target[name];
    });
};

const fixture = () => {
    const updatedAt = '2026-08-15T12:00:00.000Z';
    const state = {
        _id: 'contact-state-readonly',
        chatId: '593991234567@c.us',
        phoneDigits: '593991234567',
        countryCode: 'EC',
        assignedAgent: 'nitrix_ec',
        tags: [],
        human: { mode: 'auto', note: '' },
        firstInboundAt: '2026-08-14T10:00:00.000Z',
        lastInboundAt: '2026-08-15T11:00:00.000Z',
        lastOutboundAt: '2026-08-15T11:05:00.000Z',
        createdAt: '2026-08-14T10:00:00.000Z',
        updatedAt,
        metadata: {
            vslProductKey: 'vit_power_ec',
            vslProductName: 'Vit Power Ecuador',
            vslPath: '/m/',
            productKey: 'nitrix_ec',
            productName: 'Nitrix Oxide Ecuador',
            productMedia: '/media/sales/ec/nitrix_bottle.png',
            customerDraft: {
                name: 'Cliente Somente Leitura',
                phone: '+593991234567',
                country: 'EC',
                city: 'Quito',
                province: 'Pichincha',
                status: 'novo',
                product: 'Nitrix Oxide Ecuador',
                productKey: 'nitrix_ec',
                productName: 'Nitrix Oxide Ecuador',
                productMedia: '/media/sales/ec/nitrix_bottle.png',
                updatedAt
            }
        }
    };
    const message = {
        body: 'Quiero Vit Power',
        timestamp: 1786791600,
        isFromMe: false,
        type: 'chat',
        chatId: state.chatId,
        from: state.chatId,
        to: 'bot',
        peerPhone: state.phoneDigits,
        notifyName: 'Cliente Somente Leitura'
    };
    const order = {
        orderId: 'EC-READONLY-1',
        country: 'EC',
        status: 'confirmed',
        customer: {
            name: 'Cliente Somente Leitura',
            phone: '+593991234567',
            city: 'Quito',
            province: 'Pichincha',
            address: 'Agencia Centro',
            reference: 'Frente ao parque'
        },
        package: { quantity: 3, label: '3 frascos' },
        total: 95.99,
        currency: 'USD',
        entryAt: '2026-08-15T10:00:00.000Z',
        createdAt: '2026-08-15T10:00:00.000Z',
        tracking: { productKey: 'vit_power_ec' }
    };
    return { state, message, order };
};

const responseContractKeys = [
    'address', 'assignedAgent', 'city', 'conversationBucket', 'country', 'createdAt', 'currency', 'customerDraft',
    'entryAt', 'firstInboundAt', 'flowDataOk', 'historicalOrderId', 'human', 'id', 'identityConflict', 'isGroup', 'lastActivityAt',
    'lastInboundAt', 'lastMessage', 'lastOutboundAt', 'name', 'notes', 'orderId', 'orderStatus',
    'packageLabel', 'phone', 'previousDeliveredAt', 'productKey', 'productMedia', 'productName', 'profilePictureUrl',
    'province', 'quantity', 'reference', 'tags', 'total', 'unansweredCount', 'unreadCount', 'updatedAt', 'vslPath',
    'vslProductKey', 'vslProductName', 'zapiCapturedContact'
].sort();

test('GET /api/whatsapp/chats declara modo sem persistencia nos caminhos fast e enriched', () => {
    const routeStart = routeSource.indexOf("router.get('/chats'");
    const routeEnd = routeSource.indexOf("router.get('/media-proxy'", routeStart);
    assert.ok(routeStart >= 0 && routeEnd > routeStart, 'bloco GET /chats nao localizado');
    const getChatsSource = routeSource.slice(routeStart, routeEnd);
    const productCalls = [...getChatsSource.matchAll(/panelProductContextForChat\(\{([\s\S]*?)\}\)/g)];

    assert.equal(productCalls.length, 2, 'os caminhos fast e enriched devem continuar cobertos');
    productCalls.forEach((call) => assert.match(call[1], /persistChanges:\s*false/));
    assert.match(getChatsSource, /resolveProfilePictureUrl\(\{[\s\S]*?persistCache:\s*false[\s\S]*?\}\)/);
    assert.doesNotMatch(
        getChatsSource,
        /\b(?:ContactState|Message|Order|Shipment)\.(?:updateOne|updateMany|findOneAndUpdate|bulkWrite|create|insertOne|deleteOne|deleteMany)\s*\(/
    );
});

test('caminhos fast e enriched preservam resposta e nao alteram modelos nem timestamps', async () => {
    const { state, message, order } = fixture();
    const stateBefore = structuredClone(state);
    const writeCalls = [];
    const restorers = [];
    const models = [ContactState, Message, Order, Shipment];
    const writeMethods = [
        'updateOne', 'updateMany', 'findOneAndUpdate', 'bulkWrite', 'create', 'insertOne',
        'deleteOne', 'deleteMany'
    ];

    try {
        replaceMethod(ContactState, 'find', () => queryResult([state]), restorers);
        replaceMethod(ContactState, 'findOne', () => queryResult(state), restorers);
        replaceMethod(Message, 'find', () => queryResult([message]), restorers);
        replaceMethod(Message, 'findOne', (filter = {}) => queryResult(filter.isFromMe === true ? null : message), restorers);
        replaceMethod(Message, 'countDocuments', () => queryResult(0), restorers);
        replaceMethod(Order, 'find', () => queryResult([order]), restorers);
        replaceMethod(Order, 'findOne', () => queryResult(order), restorers);
        replaceMethod(Shipment, 'find', () => queryResult([]), restorers);

        for (const model of models) {
            for (const method of writeMethods) {
                replaceMethod(model, method, (...args) => {
                    writeCalls.push({ model: model.modelName, method, args });
                    return Promise.resolve({ acknowledged: true });
                }, restorers);
            }
            replaceMethod(model.prototype, 'save', function saveSpy(...args) {
                writeCalls.push({ model: model.modelName, method: 'save', args });
                return Promise.resolve(this);
            }, restorers);
        }

        const productContext = await panelProductContextForChat({
            contactState: state,
            order,
            customerDraft: state.metadata.customerDraft,
            lastMessage: message,
            phoneDigits: state.phoneDigits,
            persistChanges: false
        });
        assert.equal(productContext.customerDraft.orderId, order.orderId);

        const profileUrl = await resolveProfilePictureUrl({
            sock: { profilePictureUrl: async () => 'https://ec.maxlien.shop/profile/read-only.jpg' },
            contactState: { _id: 'profile-readonly', metadata: {} },
            primaryId: state.chatId,
            linkedIds: [state.chatId],
            phoneDigits: state.phoneDigits,
            persistCache: false
        });
        assert.equal(profileUrl, 'https://ec.maxlien.shop/profile/read-only.jpg');

        const routeLayer = whatsappRoutes.stack.find((layer) => layer.route?.path === '/chats');
        assert.ok(routeLayer, 'rota GET /chats nao encontrada');
        assert.equal(routeLayer.route.methods.get, true);
        const handler = routeLayer.route.stack.at(-1).handle;
        const responses = [];

        for (const query of [
            { country: 'EC', fast: 'true' },
            { country: 'EC' }
        ]) {
            const response = fakeResponse();
            await handler({ query }, response);
            assert.equal(response.statusCode, 200);
            assert.equal(Array.isArray(response.body), true);
            assert.equal(response.body.length, 1);
            assert.deepEqual(Object.keys(response.body[0]).sort(), responseContractKeys);
            assert.equal(response.body[0].id, state.chatId);
            assert.equal(response.body[0].phone.replace(/\D/g, ''), state.phoneDigits);
            assert.equal(response.body[0].customerDraft.orderId, order.orderId);
            assert.equal(response.body[0].historicalOrderId, null);
            assert.equal(response.body[0].previousDeliveredAt, null);
            responses.push(response.body[0]);
        }

        assert.deepEqual(Object.keys(responses[0]).sort(), Object.keys(responses[1]).sort());
        assert.deepEqual(state, stateBefore, 'o ContactState em memoria nao pode ser alterado');
        assert.equal(state.updatedAt, stateBefore.updatedAt);
        assert.equal(state.metadata.customerDraft.updatedAt, stateBefore.metadata.customerDraft.updatedAt);
        assert.equal(state.metadata.productKey, stateBefore.metadata.productKey);
        assert.equal(state.metadata.productName, stateBefore.metadata.productName);
        assert.equal(state.metadata.productMedia, stateBefore.metadata.productMedia);
        assert.equal(state.assignedAgent, stateBefore.assignedAgent);
        assert.deepEqual(writeCalls, [], 'nenhum metodo de persistencia pode ser chamado pelo GET');
    } finally {
        restorers.reverse().forEach((restore) => restore());
    }
});
