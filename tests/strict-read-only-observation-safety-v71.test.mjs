import assert from 'node:assert/strict';
import fs from 'node:fs';
import test, { after, before } from 'node:test';
import express from 'express';
import axios from 'axios';
import ContactState from '../src/models/ContactState.js';
import Message from '../src/models/Message.js';
import OperationalSafetyState from '../src/models/OperationalSafetyState.js';
import OutboundDedupe from '../src/models/OutboundDedupe.js';
import Shipment from '../src/models/Shipment.js';
import VslVisit from '../src/models/VslVisit.js';
import healthRoutes from '../src/routes/health.js';
import whatsappRoutes, { resolveProfilePictureUrl } from '../src/routes/whatsapp.js';
import zapiRoutes from '../src/routes/zapi.js';
import { reserveOutboundOnce } from '../src/services/outboundDedupeService.js';
import { lockShipmentForBrowserWorkEc } from '../src/services/droppiEcuadorBrowserService.js';
import { sendZapiText } from '../src/services/zapiClient.js';
import {
    MONGOOSE_MUTATION_METHODS,
    STRICT_READ_ONLY_OBSERVATION,
    STRICT_READ_ONLY_OPERATION_BLOCKED,
    installStrictReadOnlyMongooseGuard,
    isZapiInboundRoutingEnabled,
    resolveStrictReadOnlyObservation,
    startBaileysIfAllowed,
    strictReadOnlyHealthContract,
    strictReadOnlyMutationRouteGuard,
    strictReadOnlyRouteDecision
} from '../src/services/strictReadOnlyObservationService.js';
import {
    DEFAULT_COLLECTIONS,
    assertReadOnlyCommands,
    buildCollectionBaseline
} from '../scripts/audit-document-level-baseline-readonly.mjs';

const ENV_KEYS = [
    'NODE_ENV',
    'VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED',
    'VITALISMEN_STRICT_READ_ONLY',
    'SAFE_OBSERVATION_POLICY',
    'WHATSAPP_CONNECT_ENABLED',
    'ZAPI_ROUTE_INBOUND_TO_BOT',
    'ZAPI_PERSIST_INBOUND_ENABLED',
    'ZAPI_PERSIST_ACK_ENABLED',
    'VSL_STAGE_PERSIST_ENABLED',
    'DISABLE_SCHEDULER',
    'POST_SALE_V66_MUTATIONS_ENABLED',
    'DROPPI_EC_ACTIVE_SYNC_MODE',
    'ZAPI_INSTANCE_ID',
    'ZAPI_INSTANCE_TOKEN',
    'ZAPI_TOKEN',
    'ZAPI_CLIENT_TOKEN',
    'ZAPI_ACCOUNT_SECURITY_TOKEN'
];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

const setStrictEnv = () => {
    Object.assign(process.env, {
        NODE_ENV: 'production',
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'false',
        VITALISMEN_STRICT_READ_ONLY: 'true',
        SAFE_OBSERVATION_POLICY: 'STRICT_READ_ONLY',
        WHATSAPP_CONNECT_ENABLED: 'false',
        ZAPI_ROUTE_INBOUND_TO_BOT: 'false',
        ZAPI_PERSIST_INBOUND_ENABLED: 'false',
        ZAPI_PERSIST_ACK_ENABLED: 'false',
        VSL_STAGE_PERSIST_ENABLED: 'false',
        DISABLE_SCHEDULER: '1',
        POST_SALE_V66_MUTATIONS_ENABLED: 'false',
        DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
        ZAPI_INSTANCE_ID: '',
        ZAPI_INSTANCE_TOKEN: '',
        ZAPI_TOKEN: '',
        ZAPI_CLIENT_TOKEN: '',
        ZAPI_ACCOUNT_SECURITY_TOKEN: ''
    });
};

before(setStrictEnv);
after(() => {
    for (const key of ENV_KEYS) {
        if (originalEnv[key] === undefined) delete process.env[key];
        else process.env[key] = originalEnv[key];
    }
});

const listen = (app) => new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
});
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
const requestJson = async (server, path, options = {}) => {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        ...options,
        headers: { 'content-type': 'application/json', ...(options.headers || {}) }
    });
    const body = await response.json();
    return { status: response.status, body };
};

const query = (value) => ({
    sort() { return this; },
    select() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(value); },
    catch(handler) { return this.lean().catch(handler); }
});

test('safe observation resolve fail-closed para configuração missing, inválida e ambígua', () => {
    for (const env of [
        { NODE_ENV: 'production' },
        { VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'false' },
        { VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'invalid', SAFE_OBSERVATION_POLICY: 'unknown' }
    ]) {
        const state = resolveStrictReadOnlyObservation(env);
        assert.equal(state.enabled, true);
        assert.equal(state.mode, 'SAFE_OBSERVATION_ONLY');
        assert.equal(state.policy, 'STRICT_READ_ONLY');
        assert.deepEqual(state.allowedWriteClasses, []);
    }
});

test('health contract V71 declara exatamente zero classes de write', () => {
    const contract = strictReadOnlyHealthContract(process.env);
    assert.deepEqual(contract, {
        mode: 'SAFE_OBSERVATION_ONLY',
        policy: 'STRICT_READ_ONLY',
        strictReadOnly: true,
        allowedWriteClasses: [],
        zapiReadOnlyStatusAllowed: true,
        zapiInboundPersistenceAllowed: false,
        zapiAckPersistenceAllowed: false,
        baileysEnabled: false,
        mutatingRoutesEnabled: false,
        dropiApplyAllowed: false,
        mutatingSchedulers: 0
    });
});

test('GET /api/health repetido executa apenas leituras e expõe contrato estrito', async () => {
    const originals = {
        messageFindOne: Message.findOne,
        messageCount: Message.countDocuments,
        contactCount: ContactState.countDocuments,
        safetyFindById: OperationalSafetyState.findById
    };
    const commands = [];
    Message.findOne = () => { commands.push('find'); return query(null); };
    Message.countDocuments = async () => { commands.push('count'); return 0; };
    ContactState.countDocuments = async () => { commands.push('count'); return 0; };
    OperationalSafetyState.findById = () => { commands.push('find'); return query({
        dataCompatibilityVersion: 66,
        minRuntimeVersion: 66,
        writerRuntimeVersion: 66,
        bridgeComplete: true
    }); };
    const app = express();
    app.use('/api/health', healthRoutes);
    const server = await listen(app);
    try {
        for (let index = 0; index < 3; index += 1) {
            const response = await requestJson(server, '/api/health/');
            assert.equal(response.status, 200, JSON.stringify(response.body));
            assert.equal(response.body.automationSafety.strictReadOnly, true);
            assert.deepEqual(response.body.automationSafety.allowedWriteClasses, []);
            assert.equal(response.body.transports.baileys.required, false);
            assert.equal(response.body.transports.baileys.disabledByStrictReadOnly, true);
        }
        assertReadOnlyCommands(commands);
    } finally {
        await close(server);
        Message.findOne = originals.messageFindOne;
        Message.countDocuments = originals.messageCount;
        ContactState.countDocuments = originals.contactCount;
        OperationalSafetyState.findById = originals.safetyFindById;
    }
});

test('dashboard e read models passam; POST/PUT/PATCH/DELETE param antes do primeiro write', async () => {
    const commands = [];
    const writes = [];
    const app = express();
    app.use(express.json());
    app.use(strictReadOnlyMutationRouteGuard);
    for (const path of [
        '/qr.html',
        '/api/auth/me',
        '/api/whatsapp/chats',
        '/api/whatsapp/messages/593999999999',
        '/api/whatsapp/chats/search',
        '/api/whatsapp/customer-profile/593999999999'
    ]) app.get(path, (_req, res) => { commands.push('find'); res.json({ ok: true }); });
    for (const method of ['post', 'put', 'patch', 'delete']) {
        app[method]('/api/shipments/direct-action', (_req, res) => {
            writes.push(method);
            res.json({ ok: true });
        });
    }
    const server = await listen(app);
    try {
        for (const path of ['/qr.html', '/api/auth/me', '/api/whatsapp/chats', '/api/whatsapp/messages/593999999999', '/api/whatsapp/chats/search', '/api/whatsapp/customer-profile/593999999999']) {
            assert.equal((await requestJson(server, path)).status, 200);
        }
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
            const response = await requestJson(server, '/api/shipments/direct-action', { method, body: '{}' });
            assert.equal(response.status, 423);
            assert.equal(response.body.code, STRICT_READ_ONLY_OPERATION_BLOCKED);
        }
        assert.deepEqual(writes, []);
        assertReadOnlyCommands(commands);
    } finally {
        await close(server);
    }
});

test('profile picture failure com persistCache=false nunca atualiza ContactState', async () => {
    const original = ContactState.updateOne;
    let updates = 0;
    ContactState.updateOne = async () => { updates += 1; };
    try {
        const result = await resolveProfilePictureUrl({
            sock: { profilePictureUrl: async () => { throw new Error('fixture unavailable'); } },
            contactState: { _id: 'fixture', metadata: {} },
            primaryId: '593999999999@s.whatsapp.net',
            linkedIds: [],
            phoneDigits: '593999999999',
            persistCache: false
        });
        assert.equal(result, '');
        assert.equal(updates, 0);
    } finally {
        ContactState.updateOne = original;
    }
});

test('VSL stage e attribution bookkeeping respondem success/no-op com VslVisit writes zero', async () => {
    const originals = { findOne: VslVisit.findOne, findOneAndUpdate: VslVisit.findOneAndUpdate };
    let writes = 0;
    VslVisit.findOne = () => { throw new Error('read must not execute before strict no-op'); };
    VslVisit.findOneAndUpdate = () => { writes += 1; throw new Error('write forbidden'); };
    const app = express();
    app.use(express.json());
    app.use('/api/whatsapp', whatsappRoutes);
    const server = await listen(app);
    try {
        for (const path of ['/api/whatsapp/vsl-stage', '/api/whatsapp/vsl-entry']) {
            const response = await requestJson(server, path, { method: 'POST', body: JSON.stringify({ fixture: true }) });
            assert.equal(response.status, 202);
            assert.equal(response.body.code, STRICT_READ_ONLY_OBSERVATION);
        }
        assert.equal(writes, 0);
    } finally {
        await close(server);
        VslVisit.findOne = originals.findOne;
        VslVisit.findOneAndUpdate = originals.findOneAndUpdate;
    }
});

test('Z-API ACK com match e inbound EC válido são aceitos sem persistência, engine ou provider', async () => {
    const originals = {
        messageFindOne: Message.findOne,
        messageUpdateMany: Message.updateMany,
        messageSave: Message.prototype.save,
        contactFindOne: ContactState.findOne,
        contactSave: ContactState.prototype.save,
        shipmentUpdateOne: Shipment.updateOne,
        axiosPost: axios.post
    };
    const calls = { message: 0, contact: 0, shipment: 0, provider: 0 };
    Message.findOne = () => query({ _id: 'matching-message' });
    Message.updateMany = async () => { calls.message += 1; };
    Message.prototype.save = async () => { calls.message += 1; };
    ContactState.findOne = () => query({ _id: 'matching-contact' });
    ContactState.prototype.save = async () => { calls.contact += 1; };
    Shipment.updateOne = async () => { calls.shipment += 1; };
    axios.post = async () => { calls.provider += 1; return { data: {} }; };
    const app = express();
    app.use(express.json());
    app.use('/api/zapi', zapiRoutes);
    const server = await listen(app);
    try {
        const delivery = await requestJson(server, '/api/zapi/webhook/delivery', {
            method: 'POST',
            body: JSON.stringify({ messageId: 'matching-message', status: 'READ' })
        });
        assert.equal(delivery.status, 202);
        assert.equal(delivery.body.accepted, true);
        const inbound = await requestJson(server, '/api/zapi/webhook/received', {
            method: 'POST',
            body: JSON.stringify({ phone: '593999999999', fromMe: false, text: { message: 'Quiero uno' } })
        });
        assert.equal(inbound.status, 202);
        assert.equal(inbound.body.accepted, true);
        assert.deepEqual(calls, { message: 0, contact: 0, shipment: 0, provider: 0 });
    } finally {
        await close(server);
        Message.findOne = originals.messageFindOne;
        Message.updateMany = originals.messageUpdateMany;
        Message.prototype.save = originals.messageSave;
        ContactState.findOne = originals.contactFindOne;
        ContactState.prototype.save = originals.contactSave;
        Shipment.updateOne = originals.shipmentUpdateOne;
        axios.post = originals.axiosPost;
    }
});

test('Baileys não inicia nem registra socket/listeners em strict', async () => {
    const counters = { starts: 0, sockets: 0, creds: 0, upserts: 0 };
    const result = await startBaileysIfAllowed({
        env: process.env,
        startConfiguredSessions: async () => {
            counters.starts += 1;
            counters.sockets += 1;
            counters.creds += 1;
            counters.upserts += 1;
        }
    });
    assert.deepEqual(result, { started: false, reason: 'strict_read_only' });
    assert.deepEqual(counters, { starts: 0, sockets: 0, creds: 0, upserts: 0 });
    const index = fs.readFileSync('src/index.js', 'utf8');
    assert.ok(index.indexOf('resolveStrictReadOnlyObservation(process.env)') < index.indexOf('connectDB()'));
    assert.match(index, /startBaileysIfAllowed/);
});

test('dedupe, provider Z-API e Shipment direto bloqueiam antes de qualquer efeito', async () => {
    const originals = {
        dedupeFindOneAndUpdate: OutboundDedupe.findOneAndUpdate,
        shipmentFindOneAndUpdate: Shipment.findOneAndUpdate,
        axiosPost: axios.post
    };
    const calls = { dedupe: 0, shipment: 0, provider: 0 };
    OutboundDedupe.findOneAndUpdate = async () => { calls.dedupe += 1; };
    Shipment.findOneAndUpdate = async () => { calls.shipment += 1; };
    axios.post = async () => { calls.provider += 1; return { data: {} }; };
    try {
        await assert.rejects(
            reserveOutboundOnce({ jid: '593999999999@s.whatsapp.net', kind: 'text', value: 'fixture' }),
            (error) => error.code === STRICT_READ_ONLY_OPERATION_BLOCKED
        );
        await assert.rejects(
            lockShipmentForBrowserWorkEc({ _id: 'shipment-fixture' }),
            (error) => error.code === STRICT_READ_ONLY_OPERATION_BLOCKED
        );
        await assert.rejects(
            sendZapiText({ phone: '593999999999', message: 'fixture' }),
            (error) => error.code === STRICT_READ_ONLY_OPERATION_BLOCKED
        );
        assert.deepEqual(calls, { dedupe: 0, shipment: 0, provider: 0 });
    } finally {
        OutboundDedupe.findOneAndUpdate = originals.dedupeFindOneAndUpdate;
        Shipment.findOneAndUpdate = originals.shipmentFindOneAndUpdate;
        axios.post = originals.axiosPost;
    }
});

test('barreira Mongoose global rejeita toda classe mutante e permite leitura', async () => {
    let env = { VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'false' };
    const observed = [];
    class FakeCollection {
        find() { observed.push('find'); return 'read'; }
    }
    for (const method of MONGOOSE_MUTATION_METHODS) {
        FakeCollection.prototype[method] = function mutation() {
            observed.push(method);
            return 'write';
        };
    }
    class FakeConnection {
        createCollection() { observed.push('createCollection'); }
        dropCollection() { observed.push('dropCollection'); }
        dropDatabase() { observed.push('dropDatabase'); }
    }
    installStrictReadOnlyMongooseGuard({ Collection: FakeCollection, Connection: FakeConnection }, { envProvider: () => env });
    const collection = new FakeCollection();
    assert.equal(collection.find(), 'read');
    for (const method of MONGOOSE_MUTATION_METHODS) {
        assert.throws(() => collection[method](), (error) => error.code === STRICT_READ_ONLY_OPERATION_BLOCKED);
    }
    assert.throws(() => new FakeConnection().createCollection(), (error) => error.code === STRICT_READ_ONLY_OPERATION_BLOCKED);
    assert.deepEqual(observed, ['find']);
    env = {
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'true',
        VITALISMEN_STRICT_READ_ONLY: 'false',
        SAFE_OBSERVATION_POLICY: ''
    };
    assert.equal(collection.updateOne(), 'write');
    assert.deepEqual(observed, ['find', 'updateOne']);
});

test('baseline before/after das oito coleções permanece byte-identical após cenários strict', async () => {
    const fixtures = Object.fromEntries(DEFAULT_COLLECTIONS.map((collection, index) => [collection, [{
        _id: `${collection}-${index}`,
        updatedAt: '2026-08-28T00:00:00.000Z',
        status: 'fixture',
        metadata: { unchanged: true }
    }]]));
    const before = DEFAULT_COLLECTIONS.map((collection) => buildCollectionBaseline(collection, fixtures[collection]));

    const observedCommands = [];
    const app = express();
    app.use(express.json());
    app.use(strictReadOnlyMutationRouteGuard);
    for (const path of ['/api/health', '/qr.html', '/api/whatsapp/chats']) {
        app.get(path, (_req, res) => {
            observedCommands.push('find');
            res.json({ ok: true, readOnly: true });
        });
    }
    app.use('/api/zapi', zapiRoutes);
    app.use('/api/whatsapp', whatsappRoutes);

    const server = await listen(app);
    try {
        for (const path of ['/api/health', '/qr.html', '/api/whatsapp/chats']) {
            assert.equal((await requestJson(server, path)).status, 200);
        }
        const webhook = await requestJson(server, '/api/zapi/webhook', {
            method: 'POST',
            body: JSON.stringify({ phone: '593999999999', text: { message: 'fixture' } })
        });
        assert.equal(webhook.status, 202);
        assert.equal(webhook.body.code, STRICT_READ_ONLY_OBSERVATION);
        const vslStage = await requestJson(server, '/api/whatsapp/vsl-stage', {
            method: 'POST',
            body: JSON.stringify({ stage: 'fixture' })
        });
        assert.equal(vslStage.status, 202);
        assert.equal(vslStage.body.code, STRICT_READ_ONLY_OBSERVATION);

        assertReadOnlyCommands(observedCommands);
        const afterBaseline = DEFAULT_COLLECTIONS.map((collection) => buildCollectionBaseline(collection, fixtures[collection]));
        assert.deepEqual(afterBaseline, before);
        assert.equal(before.length, 8);
    } finally {
        await close(server);
    }
});

test('modo operacional normal preserva writes, ACK/inbound e roteamento existentes', () => {
    const env = {
        NODE_ENV: 'production',
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'true',
        VITALISMEN_STRICT_READ_ONLY: 'false',
        SAFE_OBSERVATION_POLICY: '',
        WHATSAPP_CONNECT_ENABLED: 'true',
        ZAPI_ROUTE_INBOUND_TO_BOT: 'true',
        ZAPI_PERSIST_INBOUND_ENABLED: 'true',
        ZAPI_PERSIST_ACK_ENABLED: 'true',
        VSL_STAGE_PERSIST_ENABLED: 'true'
    };
    const state = resolveStrictReadOnlyObservation(env);
    assert.equal(state.enabled, false);
    assert.equal(isZapiInboundRoutingEnabled(env), true);
    assert.equal(strictReadOnlyRouteDecision({ method: 'POST', path: '/api/shipments/direct-action', env }).allowed, true);
});
