import assert from 'node:assert/strict';
import test from 'node:test';
import whatsappRoutes from '../src/routes/whatsapp.js';
import zapiRoutes, { classifyZapiGenericWebhookPayload } from '../src/routes/zapi.js';
import ContactState from '../src/models/ContactState.js';
import Message from '../src/models/Message.js';
import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';
import { panelLastReadMarkerSeconds, panelHandledThroughSeconds } from '../src/services/panelReadStateService.js';
import { ecBotCoreMutationRouteGuardV78, currentEcBotCoreRuntimeContextV78 } from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';
import { buildEcBotCoreV78OverlayEnvironment, EC_BOT_CORE_V78_DATASET_ID } from '../src/services/ecBotCoreOperationalV78Service.js';
import { ecPanelCustomerPersistenceV122MongoAllowed } from '../src/services/ecPanelCustomerPersistenceV122Service.js';

const result = value => {
    const promise = Promise.resolve(value);
    const query = { sort() { return query; }, limit() { return query; }, select() { return query; }, lean() { return query; }, then(a, b) { return promise.then(a, b); }, catch(a) { return promise.catch(a); } };
    return query;
};
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const queryField = (filter, field) => filter?.[field] ?? filter?.$and?.map(part => queryField(part, field)).find(value => value !== undefined);
const patch = (target, key, fn, restore) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, writable: true, value: fn });
    restore.push(() => descriptor ? Object.defineProperty(target, key, descriptor) : delete target[key]);
};

test('POST chats/read atravessa V78 somente com persistencia ContactState; rotas vizinhas continuam bloqueadas', async () => {
    const previous = { ...process.env };
    Object.assign(process.env, buildEcBotCoreV78OverlayEnvironment({ baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID } }), { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID, PANEL_AUTH_DISABLED: 'false' });
    try {
        let reached = false;
        const path = '/api/whatsapp/chats/read';
        await ecBotCoreMutationRouteGuardV78({ method: 'POST', originalUrl: path }, response(), () => {
            reached = true;
            const context = currentEcBotCoreRuntimeContextV78();
            for (const collection of ['contactstates', 'orders', 'shipments', 'messages', 'users']) {
                assert.equal(ecPanelCustomerPersistenceV122MongoAllowed({ method: 'POST', path, collection, context }), collection === 'contactstates');
            }
        });
        assert.equal(reached, true);
        for (const path of ['/api/whatsapp/chats/delete', '/api/whatsapp/chats/read/all']) {
            const res = response();
            await ecBotCoreMutationRouteGuardV78({ method: 'POST', originalUrl: path }, res, () => assert.fail('route escaped'));
            assert.equal(res.statusCode, 423);
        }
    } finally {
        for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
        Object.assign(process.env, previous);
    }
});

test('fast/refresh e enriched/sync preservam atendimento; somente inbound posterior reabre', async () => {
    const restore = [];
    const phone = '593999999999';
    const state = { _id: 'fixture-state', chatId: phone + '@c.us', phoneDigits: phone, countryCode: 'EC', tags: [], human: { mode: 'auto' }, metadata: {}, createdAt: '2026-09-04T10:00:00Z', updatedAt: '2026-09-04T12:00:00Z' };
    const base = 1788523200;
    let messages = [];
    let recentMessagesOnly = false;
    const add = (timestamp, isFromMe, type = 'chat', isBot = false) => {
        messages.unshift({ _id: `fixture-${timestamp}`, timestamp, isFromMe, type, isBot, senderRole: isFromMe ? (isBot ? 'bot' : 'human') : 'client', chatId: state.chatId, peerPhone: phone, from: isFromMe ? 'bot' : state.chatId, to: isFromMe ? state.chatId : 'bot', body: 'fixture' });
        if (isFromMe) {
            state.lastOutboundAt = new Date(timestamp * 1000);
            if (!isBot) Object.assign(state.human, { assignedTo: 'fixture-operator', assignedName: 'Operador Fixture', lastManualBy: 'Operador Fixture', lastManualAt: new Date(timestamp * 1000) });
        } else state.lastInboundAt = new Date(timestamp * 1000);
    };
    try {
        patch(ContactState, 'find', () => result([structuredClone(state)]), restore);
        patch(ContactState, 'findOne', () => result(structuredClone(state)), restore);
        patch(Message, 'find', () => result(structuredClone(recentMessagesOnly ? messages.filter(x => !x.isFromMe) : messages)), restore);
        patch(Message, 'findOne', filter => result(messages.find(x => queryField(filter, 'isFromMe') === undefined || x.isFromMe === queryField(filter, 'isFromMe')) || null), restore);
        patch(Message, 'countDocuments', filter => result(messages.filter(x => x.isFromMe === queryField(filter, 'isFromMe') && x.timestamp > Number(queryField(filter, 'timestamp')?.$gt || 0)).length), restore);
        patch(Order, 'find', () => result([]), restore);
        patch(Order, 'findOne', () => result(null), restore);
        patch(Shipment, 'find', () => result([]), restore);
        for (const model of [ContactState, Message, Order, Shipment]) for (const method of ['updateOne', 'updateMany', 'create', 'deleteMany']) patch(model, method, () => assert.fail('GET nao pode gravar'), restore);
        const handler = whatsappRoutes.stack.find(x => x.route?.path === '/chats').route.stack.at(-1).handle;
        const check = async (unread, unanswered, label) => {
            for (const query of [{ country: 'EC', fast: 'true' }, { country: 'EC' }]) {
                const res = response();
                await handler({ query }, res);
                assert.equal(res.statusCode, 200, label);
                const chat = res.body.find(x => x.id === state.chatId);
                assert.ok(chat, label);
                assert.equal(chat.unreadCount, unread, label + ' unread ' + JSON.stringify(query));
                assert.equal(chat.unansweredCount, unanswered, label + ' unanswered ' + JSON.stringify(query));
            }
        };
        add(base, false);
        await check(1, 1, 'inbound inicial');
        add(base + 1, true, 'chat', true);
        await check(1, 0, 'bot preserva unread e semantica anterior de resposta');
        state.metadata.panelLastReadMessageTimestamp = base;
        await check(0, 0, 'operador abriu');
        for (const [index, type] of ['chat', 'audio', 'image', 'template'].entries()) {
            add(base + 10 + index * 10, false);
            await check(1, 1, 'novo inbound antes de ' + type);
            add(base + 11 + index * 10, true, type);
            await check(0, 0, type + ' refresh');
            recentMessagesOnly = true;
            await check(0, 0, type + ' background sync sem outbound na janela recente');
            recentMessagesOnly = false;
        }
        add(base + 100, false);
        await check(1, 1, 'somente inbound posterior reabre');
        state.metadata.panelLastReadMessageTimestamp = base + 100;
        await check(0, 0, 'leitura persistida mesmo sem nova resposta');
    } finally { restore.reverse().forEach(fn => fn()); }
});

test('marcadores persistidos usam maximo entre aliases e nao propagam NaN', () => {
    const states = [{ metadata: { panelLastReadMessageTimestamp: 100 } }, { human: { assignedTo: 'fixture-operator', assignedName: 'Operador Fixture', lastManualBy: 'Operador Fixture', lastManualAt: new Date(120000) }, lastOutboundAt: new Date(140000) }];
    assert.equal(panelLastReadMarkerSeconds(states), 120);
    assert.equal(panelHandledThroughSeconds({ states, lastOutboundAt: 130 }), 140);
    assert.equal(panelHandledThroughSeconds({ states: [{ metadata: { panelLastReadAt: 'invalid' }, human: { lastManualAt: 'invalid' }, lastOutboundAt: 'invalid' }], lastOutboundAt: NaN }), 0);
});

test('captura inbound e handoff automatico nao escondem pendencia como atendimento humano', () => {
    for (const lastManualBy of ['zapi', 'sistema', 'tex_ultra_customer_question', 'nitrix_fast_state_queue_watchdog']) {
        const state = { human: { assignedTo: 'old-operator', assignedName: 'Atendimento Tex Ultra EC', lastManualBy, lastManualAt: new Date(200000) }, metadata: { panelLastReadMessageTimestamp: 100 } };
        assert.equal(panelLastReadMarkerSeconds([state]), 100);
        assert.equal(panelHandledThroughSeconds({ states: [state] }), 100);
    }
});

test('ecos reais fromMe em todas as posicoes suportadas nunca classificam inbound', () => {
    for (const type of ['chat', 'audio', 'image', 'template']) for (const echo of [{ fromMe: true }, { message: { fromMe: true } }, { data: { fromMe: true } }, { key: { fromMe: true } }, { message: { key: { fromMe: true } } }]) {
        assert.equal(classifyZapiGenericWebhookPayload({ type: 'ReceivedCallback', status: 'RECEIVED', text: { message: type }, ...echo }).kind, 'delivery');
    }
    assert.equal(classifyZapiGenericWebhookPayload({ fromMe: false, type: 'ReceivedCallback', status: 'RECEIVED', text: { message: 'novo inbound' } }).kind, 'inbound');
});

test('webhook echo atualiza a mesma mensagem pelo provider ID sem criar inbound', async () => {
    const restore = [];
    const previous = { ...process.env };
    Object.assign(process.env, { VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'true', ZAPI_PERSIST_INBOUND_ENABLED: 'true', ZAPI_PERSIST_ACK_ENABLED: 'true', VITALISMEN_STRICT_READ_ONLY: 'false', SAFE_OBSERVATION_POLICY: '', VITALISMEN_CANARY_V75_ENABLED: 'false' });
    let saved = 0;
    const outbound = { _id: 'zapi_out_fixture-echo', providerMessageId: 'fixture-echo', isFromMe: true, isBot: false, senderRole: 'human', timestamp: 100, ack: 1, deliveryStatus: 'sent', set(fields) { Object.assign(this, fields); }, async save() { saved++; return this; } };
    try {
        patch(Message, 'findOne', filter => {
            assert.equal(filter.$or.some(x => x.providerMessageId === 'fixture-echo'), true);
            return result(outbound);
        }, restore);
        for (const model of [Message, ContactState]) for (const method of ['create', 'updateOne', 'updateMany']) patch(model, method, () => assert.fail('echo nao deve criar inbound/contato'), restore);
        const handler = zapiRoutes.stack.find(x => x.route?.path === '/webhook/received').route.stack.at(-1).handle;
        for (const type of ['chat', 'audio']) {
            const res = response();
            await handler({ body: { fromMe: true, messageId: 'fixture-echo', phone: '593999999999', status: 'DELIVERED', type } }, res);
            assert.equal(res.statusCode, 200);
            assert.equal(res.body.result.matched, true);
            assert.equal(res.body.result.method, 'provider_id');
            assert.equal(outbound.isFromMe, true);
            assert.equal(outbound.timestamp, 100);
        }
        assert.equal(saved, 2);
    } finally {
        restore.reverse().forEach(fn => fn());
        for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
        Object.assign(process.env, previous);
    }
});
