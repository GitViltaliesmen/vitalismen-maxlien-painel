import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { ChannelRegistry } from '../src/whatsapp/core/ChannelRegistry.js';
import { isEligibleChannel } from '../src/whatsapp/core/ChannelRouter.js';
import {
    PersistentShadowWorkerV152ER4,
    V152ER4ReconnectPolicy,
    V152ER4StateStore,
    V152_E_R4_PROCESS_NAME,
    classifyV152ER4Disconnect,
    mergeV152ER4PanelSessions,
    projectV152ER4PanelSession,
    resolveV152ER4Config
} from '../src/whatsapp/core/PersistentShadowWorkerV152ER4.js';

const require = createRequire(import.meta.url);

const makeConfig = async (overrides = {}) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v152-e-r4-'));
    const releaseRoot = path.join(root, 'release');
    const sessionRoot = path.join(root, 'runtime', 'sessions');
    const stateRoot = path.join(root, 'runtime', 'state');
    await fs.mkdir(releaseRoot, { recursive: true });
    await fs.mkdir(path.join(sessionRoot, 'V152_TEST_WEB_01'), { recursive: true });
    const env = {
        V152_E_R4_PERSISTENT_SHADOW_APPROVED: 'true',
        V152_E_CHANNEL_ID: 'V152_TEST_WEB_01',
        V152_E_SESSION_NAMESPACE: 'V152_TEST_WEB_01',
        V152_E_TEST_CHANNEL_PHONE: '5531983002800',
        WHATSAPP_SESSION_STORAGE_ROOT: sessionRoot,
        V152_E_R4_STATE_ROOT: stateRoot,
        V152_E_R4_RECONNECT_BASE_MS: '1000',
        V152_E_R4_RECONNECT_MAX_MS: '8000',
        V152_E_R4_RECONNECT_MAX_ATTEMPTS: '3',
        V152_E_R4_RECONNECT_WINDOW_MS: '10000',
        V152_E_R4_RECONNECT_COOLDOWN_MS: '20000',
        V152_E_R4_RECONNECT_JITTER_RATIO: '0',
        ...overrides
    };
    return { root, config: resolveV152ER4Config(env, { releaseRoot }) };
};

class MemoryStateStore {
    writes = [];
    async write(value) {
        const copy = JSON.parse(JSON.stringify(value));
        this.writes.push(copy);
        this.value = copy;
        return copy;
    }
}

const fakeSocketRecord = ({ phone = '5531983002800', onEnd = () => {} } = {}) => {
    const ev = new EventEmitter();
    return {
        socket: {
            ev,
            user: { id: `${phone}@s.whatsapp.net` },
            async end() { onEnd(); }
        },
        async saveCreds() {}
    };
};

const makeWorker = async ({ socketFactory, setTimer = () => 1, clearTimer = () => {}, clock = () => new Date('2026-09-13T03:00:00Z') } = {}) => {
    const { config } = await makeConfig();
    const store = new MemoryStateStore();
    const worker = new PersistentShadowWorkerV152ER4({
        config,
        stateStore: store,
        socketFactory,
        clock,
        random: () => 0.5,
        setTimer,
        clearTimer,
        setIntervalFn: () => 2,
        clearIntervalFn: () => {}
    });
    return { worker, store, config };
};

test('R4 exige autorização e identidades isoladas exatas', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v152-e-r4-config-'));
    assert.throws(() => resolveV152ER4Config({}, { releaseRoot: root }), /explicit_shadow_worker_approval/);
    await assert.rejects(() => makeConfig({ V152_E_CHANNEL_ID: 'LEGACY_ZAPI_PRIMARY' }), /channel_id_mismatch/);
    await assert.rejects(() => makeConfig({ V152_E_TEST_CHANNEL_PHONE: '5531971862958' }), /test_channel_phone_mismatch/);
    await assert.rejects(() => makeConfig({ V152_E_SESSION_NAMESPACE: 'legacy-zapi-primary' }), /session_namespace_mismatch/);
});

test('state store fica fora da sessão e recusa campos sensíveis ou desconhecidos', async () => {
    const { config } = await makeConfig();
    const store = new V152ER4StateStore({ config });
    const written = await store.write({
        connectionState: 'CONNECTED',
        sessionState: 'RESTORED',
        status: 'ACTIVE',
        health: 'PASS',
        heartbeatAt: '2026-09-13T03:00:00.000Z'
    });
    assert.equal(written.phone, '5531983002800');
    assert.equal(written.shadow, true);
    assert.equal(written.weight, 0);
    assert.equal(path.dirname(config.stateDirectory), config.stateRoot);
    assert.equal(config.stateDirectory.startsWith(config.sessionStorageRoot), false);
    await assert.rejects(() => store.write({ token: 'must-not-persist' }), /unsafe_state_key_token/);
    const raw = await fs.readFile(config.stateFile, 'utf8');
    assert.doesNotMatch(raw, /token|cookie|pairingCode|qrCode|authState/i);
});

test('worker restaura uma sessão, valida o telefone e mantém um único socket', async () => {
    let factoryCalls = 0;
    let endCalls = 0;
    const record = fakeSocketRecord({ onEnd: () => { endCalls += 1; } });
    const { worker, store } = await makeWorker({
        socketFactory: async () => { factoryCalls += 1; return record; }
    });
    await worker.start();
    await worker.start();
    assert.equal(factoryCalls, 1);
    await worker.handleConnectionUpdate({ connection: 'open' });
    assert.equal(worker.snapshot().connectionState, 'CONNECTED');
    assert.equal(worker.snapshot().health, 'PASS');
    assert.equal(worker.snapshot().status, 'ACTIVE');
    assert.equal(worker.snapshot().phone, '5531983002800');
    assert.equal(store.value.shadow, true);
    assert.equal(store.value.draining, true);
    await worker.stop();
    assert.equal(endCalls, 1);
});

test('telefone errado falha fechado sem logout, QR ou reconexão', async () => {
    let timerCalls = 0;
    const { worker } = await makeWorker({
        socketFactory: async () => fakeSocketRecord({ phone: '5531971862958' }),
        setTimer: () => { timerCalls += 1; return 1; }
    });
    await worker.start();
    await worker.handleConnectionUpdate({ connection: 'open' });
    assert.equal(worker.snapshot().connectionState, 'DISCONNECTED');
    assert.equal(worker.snapshot().pairingRequired, 'MANUAL_OPERATOR_ACTION');
    assert.equal(worker.snapshot().lastErrorClass, 'PHONE_MISMATCH');
    assert.equal(timerCalls, 0);
    await worker.stop();
});

test('QR inesperado é bloqueado sem persistir material ou iniciar novo pairing', async () => {
    const rawQr = 'sensitive-qr-material-that-must-never-persist';
    const { worker, store } = await makeWorker({ socketFactory: async () => fakeSocketRecord() });
    await worker.start();
    await worker.handleConnectionUpdate({ connection: 'connecting', qr: rawQr });
    assert.equal(worker.snapshot().lastErrorClass, 'QR_GENERATION_BLOCKED');
    assert.equal(worker.snapshot().pairingRequired, 'MANUAL_OPERATOR_ACTION');
    assert.equal(JSON.stringify(store.writes).includes(rawQr), false);
    await worker.stop();
});

test('inbound acidental vira somente contador shadow e não persiste corpo', async () => {
    const body = 'customer text that must not reach bot or disk';
    const { worker, store } = await makeWorker({ socketFactory: async () => fakeSocketRecord() });
    await worker.start();
    await worker.handleConnectionUpdate({ connection: 'open' });
    await worker.handleMessagesUpsert({ messages: [{ message: { conversation: body } }] });
    assert.equal(worker.snapshot().shadowInboundCount, 1);
    assert.equal(JSON.stringify(store.writes).includes(body), false);
    await worker.stop();
});

test('queda transitória aplica backoff e reconecta sem socket simultâneo', async () => {
    const scheduled = [];
    let factoryCalls = 0;
    let activeSockets = 0;
    let peakSockets = 0;
    const factory = async () => {
        factoryCalls += 1;
        activeSockets += 1;
        peakSockets = Math.max(peakSockets, activeSockets);
        return fakeSocketRecord({ onEnd: () => { activeSockets -= 1; } });
    };
    const { worker } = await makeWorker({
        socketFactory: factory,
        setTimer: (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length; }
    });
    await worker.start();
    await worker.handleConnectionUpdate({ connection: 'open' });
    await worker.handleConnectionUpdate({ connection: 'close', statusCode: 428 });
    assert.equal(activeSockets, 0);
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].delay, 1000);
    scheduled.shift().callback();
    await worker.whenIdle();
    assert.equal(factoryCalls, 2);
    assert.equal(peakSockets, 1);
    await worker.handleConnectionUpdate({ connection: 'open' });
    assert.equal(worker.snapshot().health, 'PASS');
    await worker.stop();
});

test('política de reconnect é exponencial, limitada e entra em cooldown', async () => {
    const { config } = await makeConfig();
    let now = new Date('2026-09-13T03:00:00Z');
    const policy = new V152ER4ReconnectPolicy({ config, clock: () => now, random: () => 0.5 });
    assert.deepEqual(policy.next(), { allowed: true, attempt: 1, delayMs: 1000, cooldownMs: 0 });
    assert.deepEqual(policy.next(), { allowed: true, attempt: 2, delayMs: 2000, cooldownMs: 0 });
    assert.deepEqual(policy.next(), { allowed: true, attempt: 3, delayMs: 4000, cooldownMs: 0 });
    assert.deepEqual(policy.next(), { allowed: false, attempt: 3, cooldownMs: 20000 });
    now = new Date('2026-09-13T03:00:21Z');
    assert.deepEqual(policy.next(), { allowed: true, attempt: 1, delayMs: 1000, cooldownMs: 0 });
});

test('loggedOut, badSession e connectionReplaced nunca entram em loop', async () => {
    for (const [statusCode, errorClass] of [[401, 'LOGGED_OUT'], [500, 'BAD_SESSION'], [440, 'CONNECTION_REPLACED']]) {
        const scheduled = [];
        const { worker } = await makeWorker({
            socketFactory: async () => fakeSocketRecord(),
            setTimer: (callback, delay) => { scheduled.push({ callback, delay }); return 1; }
        });
        await worker.start();
        await worker.handleConnectionUpdate({ connection: 'open' });
        await worker.handleConnectionUpdate({ connection: 'close', statusCode });
        assert.equal(worker.snapshot().lastErrorClass, errorClass);
        assert.equal(worker.snapshot().pairingRequired, 'MANUAL_OPERATOR_ACTION');
        assert.equal(scheduled.length, 0);
        await worker.stop();
    }
    assert.equal(classifyV152ER4Disconnect({ statusCode: 428 }).reconnect, true);
    assert.equal(classifyV152ER4Disconnect({ statusCode: 515 }).reconnect, true);
});

test('projeção do painel deriva conexão do heartbeat e falha fechado quando stale', () => {
    const state = {
        connectionState: 'CONNECTED',
        sessionState: 'RESTORED',
        status: 'ACTIVE',
        health: 'PASS',
        heartbeatAt: '2026-09-13T03:00:00.000Z',
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0
    };
    const fresh = projectV152ER4PanelSession(state, { now: new Date('2026-09-13T03:00:10Z'), staleMs: 30000 });
    assert.equal(fresh.isReady, true);
    assert.equal(fresh.status, 'connected');
    assert.deepEqual(fresh.health, { healthy: true, detail: 'PASS' });
    assert.equal(fresh.qrCode, null);
    const stale = projectV152ER4PanelSession(state, { now: new Date('2026-09-13T03:01:00Z'), staleMs: 30000 });
    assert.equal(stale.isReady, false);
    assert.equal(stale.health.detail, 'STALE_WORKER_HEARTBEAT');
    const merged = mergeV152ER4PanelSessions([{ sessionId: 'default' }, { sessionId: 'V152_TEST_WEB_01', status: 'old' }], fresh);
    assert.deepEqual(merged.map((item) => item.sessionId), ['default', 'V152_TEST_WEB_01']);
});

test('ChannelRegistry inclui Z-API, canal real, template e telefone antigo sem elegibilidade Web', () => {
    const channels = ChannelRegistry.v152ER4Projection({
        workerState: { connectionState: 'CONNECTED', status: 'ACTIVE', health: 'PASS' }
    });
    assert.deepEqual(channels.map((channel) => channel.channelId), [
        'LEGACY_ZAPI_PRIMARY',
        'V152_TEST_WEB_01',
        'WHATSAPP_WEB_TEMPLATE',
        'OLD_BLOCKED_PHONE'
    ]);
    const testChannel = channels[1];
    assert.equal(testChannel.status, 'ACTIVE');
    assert.equal(testChannel.health.healthy, true);
    assert.equal(testChannel.shadow, true);
    assert.equal(testChannel.draining, true);
    assert.equal(testChannel.weight, 0);
    assert.equal(testChannel.capacity, 0);
    assert.equal(isEligibleChannel(testChannel), false);
});

test('configuração PM2 segue supervisor oficial sem ativar produção', () => {
    const configPath = path.resolve('ops/ecosystem.v152-e-r4.config.cjs');
    delete require.cache[configPath];
    const ecosystem = require(configPath);
    assert.equal(ecosystem.apps.length, 1);
    const app = ecosystem.apps[0];
    assert.equal(app.name, V152_E_R4_PROCESS_NAME);
    assert.equal(app.exec_mode, 'fork');
    assert.equal(app.instances, 1);
    assert.equal(app.autorestart, true);
    assert.equal(app.env.V152_E_CHANNEL_ID, 'V152_TEST_WEB_01');
    assert.equal(app.env.V152_E_SESSION_NAMESPACE, 'V152_TEST_WEB_01');
    assert.equal(app.env.V152_E_TEST_CHANNEL_PHONE, '5531983002800');
    assert.equal(app.env.WHATSAPP_SESSION_STORAGE_ROOT, '/var/lib/vitalismen-whatsapp-web-sessions');
});
