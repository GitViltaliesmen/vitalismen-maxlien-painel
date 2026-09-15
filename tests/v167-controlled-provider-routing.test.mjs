import assert from 'node:assert/strict';
import test from 'node:test';

import {
    ControlledOutboundCoordinatorV167,
    V167ProviderDecisionLedger,
    V167_PROVIDER,
    V167_ROUTING_PURPOSE,
    resolveOutboundProvider,
    sanitizeV167Decision
} from '../src/whatsapp/core/ControlledProviderRoutingV167.js';

const readyContext = Object.freeze({
    webRoutingEnabled: true,
    purpose: V167_ROUTING_PURPOSE,
    explicitControlledAction: true,
    webWorker: Object.freeze({
        processName: 'vitalismen-whatsapp-web-shadow-v164',
        active: true,
        health: 'PASS',
        sessionNamespace: 'V152_TEST_WEB_01',
        pairedIdentity: '5531983002800',
        sessionState: 'RESTORED',
        connectionState: 'CONNECTED',
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0,
        concurrentSockets: 1,
        pairingRequired: false
    })
});

const fakeRepository = () => {
    const values = new Map();
    return {
        values,
        async findOneAndUpdate(query, update) {
            if (update.$setOnInsert) {
                const previous = values.get(query.eventKeyHash);
                if (previous) return { lastErrorObject: { updatedExisting: true }, value: previous };
                values.set(query.eventKeyHash, { ...update.$setOnInsert });
                return { lastErrorObject: { updatedExisting: false }, value: values.get(query.eventKeyHash) };
            }
            const previous = values.get(query.eventKeyHash);
            if (!previous || previous.selectedProvider !== query.selectedProvider || previous.sendState !== query.sendState) return null;
            const next = { ...previous, ...update.$set };
            values.set(query.eventKeyHash, next);
            return next;
        }
    };
};

const setup = ({ webResult = { providerMessageId: 'web-id' }, zapiResult = { providerMessageId: 'zapi-id' } } = {}) => {
    const repository = fakeRepository();
    const calls = { claims: [], web: [], zapi: [] };
    const coordinator = new ControlledOutboundCoordinatorV167({
        ledger: new V167ProviderDecisionLedger({ repository, clock: () => new Date('2026-09-15T16:00:00Z') }),
        queueClaimer: async (input) => { calls.claims.push(input); return { accepted: true }; },
        webPort: { mode: 'PERSISTENT_EXISTING_SOCKET', send: async (input) => { calls.web.push(input); if (webResult instanceof Error) throw webResult; return webResult; } },
        zapiPort: { send: async (input) => { calls.zapi.push(input); return zapiResult; } },
        timeoutMs: 1000
    });
    return { coordinator, repository, calls };
};

test('telefone controlado integral seleciona Web; qualquer outro continua Z-API', () => {
    assert.equal(resolveOutboundProvider('5515998038637', readyContext), V167_PROVIDER.WEB);
    for (const phone of ['+593 99 111 2233', '5515998038638', '15998038637', '998038637']) {
        assert.equal(resolveOutboundProvider(phone, readyContext), phone.replace(/\D/g, '').length < 10 ? V167_PROVIDER.BLOCKED : V167_PROVIDER.ZAPI);
    }
});

test('rota Web exige ação explícita, regra habilitada e worker persistente saudável', () => {
    assert.equal(resolveOutboundProvider('5515998038637', { ...readyContext, webRoutingEnabled: false }), V167_PROVIDER.ZAPI);
    assert.equal(resolveOutboundProvider('5515998038637', { ...readyContext, explicitControlledAction: false }), V167_PROVIDER.BLOCKED);
    assert.equal(resolveOutboundProvider('5515998038637', { ...readyContext, webWorker: { ...readyContext.webWorker, health: 'FAIL' } }), V167_PROVIDER.BLOCKED);
    assert.equal(resolveOutboundProvider('5515998038637', { ...readyContext, webWorker: { ...readyContext.webWorker, concurrentSockets: 2 } }), V167_PROVIDER.BLOCKED);
    assert.equal(resolveOutboundProvider('5515998038637', { ...readyContext, webWorker: { ...readyContext.webWorker, pairingRequired: true } }), V167_PROVIDER.BLOCKED);
});

test('evento Web possui uma decisão, um claim e uma chamada exclusiva', async () => {
    const { coordinator, calls } = setup();
    const result = await coordinator.dispatch({ eventKey: 'v167-web-1', phone: '5515998038637', payload: { text: 'fixture-only' }, context: readyContext });
    assert.deepEqual({ sent: result.sent, provider: result.provider, fallback: result.fallback }, { sent: true, provider: V167_PROVIDER.WEB, fallback: false });
    assert.equal(calls.claims.length, 1);
    assert.equal(calls.web.length, 1);
    assert.equal(calls.zapi.length, 0);
});

test('cliente geral possui uma decisão Z-API e nenhuma chamada Web', async () => {
    const { coordinator, calls } = setup();
    const result = await coordinator.dispatch({ eventKey: 'v167-zapi-1', phone: '593991112233', payload: { text: 'fixture-only' }, context: readyContext });
    assert.equal(result.provider, V167_PROVIDER.ZAPI);
    assert.equal(calls.claims.length, 1);
    assert.equal(calls.web.length, 0);
    assert.equal(calls.zapi.length, 1);
});

test('erro ou resultado ambíguo Web fica terminal e nunca cai para Z-API', async () => {
    for (const webResult of [new Error('provider failed'), {}, null]) {
        const { coordinator, repository, calls } = setup({ webResult });
        const result = await coordinator.dispatch({ eventKey: `v167-ambiguous-${String(webResult)}`, phone: '5515998038637', payload: {}, context: readyContext });
        assert.equal(result.state, 'AMBIGUOUS');
        assert.equal(result.fallback, false);
        assert.equal(calls.web.length, 1);
        assert.equal(calls.zapi.length, 0);
        assert.equal([...repository.values.values()][0].sendState, 'AMBIGUOUS');
    }
});

test('claim recusado fica ambíguo antes do provider e não tenta fallback', async () => {
    const repository = fakeRepository();
    const calls = { claims: 0, web: 0, zapi: 0 };
    const coordinator = new ControlledOutboundCoordinatorV167({
        ledger: new V167ProviderDecisionLedger({ repository }),
        queueClaimer: async () => { calls.claims += 1; return { accepted: false }; },
        webPort: { mode: 'PERSISTENT_EXISTING_SOCKET', send: async () => { calls.web += 1; } },
        zapiPort: { send: async () => { calls.zapi += 1; } }
    });
    const result = await coordinator.dispatch({
        eventKey: 'v167-claim-rejected',
        phone: '5515998038637',
        payload: {},
        context: readyContext
    });
    assert.deepEqual(
        { state: result.state, fallback: result.fallback, claims: calls.claims, web: calls.web, zapi: calls.zapi },
        { state: 'AMBIGUOUS', fallback: false, claims: 1, web: 0, zapi: 0 }
    );
});

test('dedupe bloqueia segunda claim e segundo provider para o mesmo evento', async () => {
    const { coordinator, calls } = setup();
    const input = { eventKey: 'v167-once', phone: '5515998038637', payload: {}, context: readyContext };
    assert.equal((await coordinator.dispatch(input)).sent, true);
    const duplicate = await coordinator.dispatch({ ...input, phone: '593991112233' });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.provider, V167_PROVIDER.WEB);
    assert.equal(calls.claims.length, 1);
    assert.equal(calls.web.length, 1);
    assert.equal(calls.zapi.length, 0);
});

test('persistência sanitizada limita o registro aos cinco campos autorizados', async () => {
    const repository = fakeRepository();
    const ledger = new V167ProviderDecisionLedger({ repository, clock: () => new Date('2026-09-15T16:00:00Z') });
    const reserved = await ledger.reserve({ eventKey: 'fixture-secret-event', phone: '5515998038637', selectedProvider: V167_PROVIDER.WEB });
    const safe = sanitizeV167Decision(reserved.record);
    assert.deepEqual(Object.keys(safe), ['eventKeyHash', 'phoneHash', 'selectedProvider', 'decisionAt', 'sendState']);
    assert.equal(JSON.stringify(safe).includes('5515998038637'), false);
    assert.equal(JSON.stringify(safe).includes('fixture-secret-event'), false);
});
