import fs from 'node:fs/promises';
import path from 'node:path';
import {
    V152_E_CHANNEL_ID,
    V152_E_FORBIDDEN_PAIRED_PHONES,
    V152_E_SESSION_NAMESPACE,
    V152_E_TEST_CHANNEL_PHONE,
    assertPairedPhoneAllowed,
    ensureSecureDirectory,
    hardenSessionTree,
    writeJsonAtomic
} from './ControlledRealPairingV152E.js';

export const V152_E_R4_PHASE = 'V152-E-R4_PERSISTENT_SHADOW_WORKER';
export const V152_E_R4_PROCESS_NAME = 'vitalismen-whatsapp-web-shadow-v152-e-r4';
export const V152_E_R4_DEFAULT_STATE_ROOT = '/var/lib/vitalismen-whatsapp-web-shadow-state';
export const V152_E_R4_STATE_FILE = 'health.json';

const TERMINAL_DISCONNECTS = new Map([
    [401, 'LOGGED_OUT'],
    [403, 'SESSION_REVOKED'],
    [405, 'SESSION_REVOKED'],
    [411, 'MULTIDEVICE_MISMATCH'],
    [440, 'CONNECTION_REPLACED'],
    [500, 'BAD_SESSION']
]);
const TRANSIENT_DISCONNECTS = new Map([
    [408, 'CONNECTION_TIMEOUT'],
    [428, 'CONNECTION_CLOSED'],
    [503, 'SERVICE_UNAVAILABLE'],
    [515, 'RESTART_REQUIRED']
]);
const SAFE_NAMESPACE = /^[a-z0-9][a-z0-9_-]{1,79}$/i;
const SAFE_STATE_KEYS = new Set([
    'schema',
    'phase',
    'channelId',
    'provider',
    'phone',
    'sessionNamespace',
    'sessionState',
    'connectionState',
    'status',
    'health',
    'lastConnectedAt',
    'lastDisconnectedAt',
    'lastErrorClass',
    'reconnectAttempt',
    'pairingRequired',
    'shadow',
    'draining',
    'weight',
    'capacity',
    'workerPid',
    'workerStartedAt',
    'heartbeatAt',
    'shadowInboundCount',
    'lastShadowInboundAt',
    'updatedAt'
]);

const digits = (value) => String(value || '').replace(/\D/g, '');
const boundedInteger = (value, fallback, minimum, maximum) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
};
const boundedNumber = (value, fallback, minimum, maximum) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
};
const isInside = (parent, candidate) => {
    const relative = path.relative(path.resolve(parent), path.resolve(candidate));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};
const iso = (value) => (value instanceof Date ? value : new Date(value)).toISOString();
const disconnectStatusCode = (update = {}) => Number(
    update?.lastDisconnect?.error?.output?.statusCode
    || update?.lastDisconnect?.error?.statusCode
    || update?.statusCode
    || 0
) || 0;

export const classifyV152ER4Disconnect = (update = {}) => {
    if (update.explicit === true) {
        return Object.freeze({ statusCode: disconnectStatusCode(update), errorClass: 'EXPLICIT_DISCONNECT', reconnect: false, pairingRequired: false });
    }
    const statusCode = disconnectStatusCode(update);
    if (TERMINAL_DISCONNECTS.has(statusCode)) {
        return Object.freeze({ statusCode, errorClass: TERMINAL_DISCONNECTS.get(statusCode), reconnect: false, pairingRequired: true });
    }
    if (TRANSIENT_DISCONNECTS.has(statusCode)) {
        return Object.freeze({ statusCode, errorClass: TRANSIENT_DISCONNECTS.get(statusCode), reconnect: true, pairingRequired: false });
    }
    return Object.freeze({ statusCode, errorClass: statusCode ? 'UNKNOWN_DISCONNECT' : 'DISCONNECT_REASON_UNAVAILABLE', reconnect: false, pairingRequired: false });
};

export const resolveV152ER4StateRoot = (env = process.env) => {
    const configured = String(env.V152_E_R4_STATE_ROOT || V152_E_R4_DEFAULT_STATE_ROOT);
    if (!path.isAbsolute(configured) || path.resolve(configured) === path.parse(path.resolve(configured)).root) {
        throw new Error('v152_e_r4_state_root_absolute_required');
    }
    return path.resolve(configured);
};

export const resolveV152ER4Config = (env = process.env, { releaseRoot = process.cwd() } = {}) => {
    if (String(env.V152_E_R4_PERSISTENT_SHADOW_APPROVED || '') !== 'true') {
        throw new Error('v152_e_r4_explicit_shadow_worker_approval_required');
    }
    const channelId = String(env.V152_E_CHANNEL_ID || '');
    const sessionNamespace = String(env.V152_E_SESSION_NAMESPACE || '');
    const testChannelPhone = digits(env.V152_E_TEST_CHANNEL_PHONE);
    const sessionStorageRoot = path.resolve(String(env.WHATSAPP_SESSION_STORAGE_ROOT || ''));
    const stateRoot = resolveV152ER4StateRoot(env);
    if (channelId !== V152_E_CHANNEL_ID) throw new Error('v152_e_r4_channel_id_mismatch');
    if (sessionNamespace !== V152_E_SESSION_NAMESPACE || !SAFE_NAMESPACE.test(sessionNamespace)) {
        throw new Error('v152_e_r4_session_namespace_mismatch');
    }
    if (testChannelPhone !== V152_E_TEST_CHANNEL_PHONE) throw new Error('v152_e_r4_test_channel_phone_mismatch');
    if (!path.isAbsolute(String(env.WHATSAPP_SESSION_STORAGE_ROOT || ''))) {
        throw new Error('v152_e_r4_session_storage_absolute_required');
    }
    for (const configuredPath of [sessionStorageRoot, stateRoot]) {
        if (configuredPath === path.parse(configuredPath).root || isInside(releaseRoot, configuredPath)) {
            throw new Error('v152_e_r4_runtime_path_inside_release_forbidden');
        }
    }
    if (isInside(sessionStorageRoot, stateRoot) || isInside(stateRoot, sessionStorageRoot)) {
        throw new Error('v152_e_r4_state_and_session_paths_must_be_separate');
    }
    return Object.freeze({
        phase: V152_E_R4_PHASE,
        processName: V152_E_R4_PROCESS_NAME,
        channelId,
        provider: 'WHATSAPP_WEB',
        testChannelPhone,
        sessionNamespace,
        sessionStorageRoot,
        sessionDirectory: path.join(sessionStorageRoot, sessionNamespace),
        stateRoot,
        stateDirectory: path.join(stateRoot, sessionNamespace),
        stateFile: path.join(stateRoot, sessionNamespace, V152_E_R4_STATE_FILE),
        forbiddenPairedPhones: V152_E_FORBIDDEN_PAIRED_PHONES,
        reconnectBaseMs: boundedInteger(env.V152_E_R4_RECONNECT_BASE_MS, 2000, 100, 60000),
        reconnectMaxMs: boundedInteger(env.V152_E_R4_RECONNECT_MAX_MS, 30000, 1000, 300000),
        reconnectMaxAttempts: boundedInteger(env.V152_E_R4_RECONNECT_MAX_ATTEMPTS, 5, 1, 20),
        reconnectWindowMs: boundedInteger(env.V152_E_R4_RECONNECT_WINDOW_MS, 300000, 10000, 3600000),
        reconnectCooldownMs: boundedInteger(env.V152_E_R4_RECONNECT_COOLDOWN_MS, 300000, 10000, 3600000),
        reconnectJitterRatio: boundedNumber(env.V152_E_R4_RECONNECT_JITTER_RATIO, 0.2, 0, 0.5),
        heartbeatMs: boundedInteger(env.V152_E_R4_HEARTBEAT_MS, 10000, 1000, 60000),
        healthStaleMs: boundedInteger(env.V152_E_R4_HEALTH_STALE_MS, 30000, 5000, 300000)
    });
};

const sanitizedWorkerState = (value = {}) => {
    const unexpected = Object.keys(value).filter((key) => !SAFE_STATE_KEYS.has(key));
    if (unexpected.length > 0) throw new Error(`v152_e_r4_unsafe_state_key_${unexpected[0]}`);
    return Object.freeze({
        schema: 'V152_E_R4_SHADOW_WORKER_STATE_V1',
        phase: V152_E_R4_PHASE,
        channelId: V152_E_CHANNEL_ID,
        provider: 'WHATSAPP_WEB',
        phone: V152_E_TEST_CHANNEL_PHONE,
        sessionNamespace: V152_E_SESSION_NAMESPACE,
        sessionState: String(value.sessionState || 'UNKNOWN'),
        connectionState: String(value.connectionState || 'DISCONNECTED'),
        status: String(value.status || 'INACTIVE'),
        health: String(value.health || 'INACTIVE'),
        lastConnectedAt: value.lastConnectedAt || null,
        lastDisconnectedAt: value.lastDisconnectedAt || null,
        lastErrorClass: value.lastErrorClass || null,
        reconnectAttempt: Number(value.reconnectAttempt || 0),
        pairingRequired: value.pairingRequired === 'MANUAL_OPERATOR_ACTION' ? 'MANUAL_OPERATOR_ACTION' : 'NO',
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0,
        workerPid: Number(value.workerPid || process.pid),
        workerStartedAt: value.workerStartedAt || null,
        heartbeatAt: value.heartbeatAt || null,
        shadowInboundCount: Number(value.shadowInboundCount || 0),
        lastShadowInboundAt: value.lastShadowInboundAt || null,
        updatedAt: value.updatedAt || null
    });
};

export class V152ER4StateStore {
    constructor({ config, fsApi = fs } = {}) {
        if (!config?.stateFile || !config?.stateDirectory) throw new Error('v152_e_r4_state_store_config_required');
        this.config = config;
        this.fs = fsApi;
    }

    async write(value) {
        const now = new Date().toISOString();
        const safe = sanitizedWorkerState({ ...value, updatedAt: now });
        await ensureSecureDirectory(this.config.stateRoot, this.fs);
        await ensureSecureDirectory(this.config.stateDirectory, this.fs);
        await writeJsonAtomic(this.config.stateFile, safe, this.fs);
        return safe;
    }

    async read() {
        try {
            return sanitizedWorkerState(JSON.parse(await this.fs.readFile(this.config.stateFile, 'utf8')));
        } catch (error) {
            if (error?.code === 'ENOENT') return null;
            throw error;
        }
    }
}

export class V152ER4ReconnectPolicy {
    constructor({ config, clock = () => new Date(), random = Math.random } = {}) {
        this.config = config;
        this.clock = clock;
        this.random = random;
        this.attempts = [];
    }

    reset() {
        this.attempts = [];
    }

    next() {
        const nowMs = this.clock().getTime();
        this.attempts = this.attempts.filter((timestamp) => nowMs - timestamp < this.config.reconnectWindowMs);
        if (this.attempts.length >= this.config.reconnectMaxAttempts) {
            const oldest = this.attempts[0];
            const remainingWindow = Math.max(0, this.config.reconnectWindowMs - (nowMs - oldest));
            return Object.freeze({ allowed: false, attempt: this.attempts.length, cooldownMs: Math.max(this.config.reconnectCooldownMs, remainingWindow) });
        }
        this.attempts.push(nowMs);
        const attempt = this.attempts.length;
        const base = Math.min(this.config.reconnectMaxMs, this.config.reconnectBaseMs * (2 ** (attempt - 1)));
        const jitterScale = ((this.random() * 2) - 1) * this.config.reconnectJitterRatio;
        const delayMs = Math.max(0, Math.round(base * (1 + jitterScale)));
        return Object.freeze({ allowed: true, attempt, delayMs, cooldownMs: 0 });
    }
}

export const projectV152ER4PanelSession = (state, {
    now = new Date(),
    staleMs = 30000
} = {}) => {
    const heartbeatMs = state?.heartbeatAt ? new Date(state.heartbeatAt).getTime() : 0;
    const fresh = heartbeatMs > 0 && now.getTime() - heartbeatMs <= staleMs;
    const connected = fresh
        && state?.connectionState === 'CONNECTED'
        && state?.health === 'PASS'
        && state?.status === 'ACTIVE';
    const status = connected ? 'connected' : (state?.status === 'DEGRADED' || !fresh ? 'degraded' : 'inactive');
    const healthDetail = connected ? 'PASS' : (!fresh && state ? 'STALE_WORKER_HEARTBEAT' : String(state?.lastErrorClass || 'WORKER_NOT_REPORTED'));
    return Object.freeze({
        sessionId: V152_E_CHANNEL_ID,
        channelId: V152_E_CHANNEL_ID,
        provider: 'WHATSAPP_WEB',
        ownPhoneDigits: V152_E_TEST_CHANNEL_PHONE,
        phoneNumber: V152_E_TEST_CHANNEL_PHONE,
        isReady: connected,
        status,
        sessionState: String(state?.sessionState || 'UNKNOWN'),
        connectionState: connected ? 'CONNECTED' : String(state?.connectionState || 'DISCONNECTED'),
        health: { healthy: connected, detail: healthDetail },
        lastConnectedAt: state?.lastConnectedAt || null,
        lastDisconnectedAt: state?.lastDisconnectedAt || null,
        lastErrorClass: state?.lastErrorClass || null,
        reconnectAttempt: Number(state?.reconnectAttempt || 0),
        pairingRequired: state?.pairingRequired || 'NO',
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0,
        qrCode: null,
        qrCodeRaw: null
    });
};

export const readV152ER4PanelSession = async ({ env = process.env, now = new Date(), fsApi = fs } = {}) => {
    const stateRoot = resolveV152ER4StateRoot(env);
    const stateFile = path.join(stateRoot, V152_E_SESSION_NAMESPACE, V152_E_R4_STATE_FILE);
    let state = null;
    try {
        state = sanitizedWorkerState(JSON.parse(await fsApi.readFile(stateFile, 'utf8')));
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
    }
    const staleMs = boundedInteger(env.V152_E_R4_HEALTH_STALE_MS, 30000, 5000, 300000);
    return projectV152ER4PanelSession(state, { now, staleMs });
};

export const mergeV152ER4PanelSessions = (sessions = [], shadowSession) => {
    const retained = sessions.filter((session) => String(session?.sessionId || '') !== V152_E_CHANNEL_ID
        && String(session?.channelId || '') !== V152_E_CHANNEL_ID);
    return Object.freeze([...retained, shadowSession || projectV152ER4PanelSession(null)]);
};

export class PersistentShadowWorkerV152ER4 {
    constructor({
        config,
        stateStore,
        socketFactory,
        clock = () => new Date(),
        random = Math.random,
        setTimer = setTimeout,
        clearTimer = clearTimeout,
        setIntervalFn = setInterval,
        clearIntervalFn = clearInterval
    } = {}) {
        if (!config || !stateStore || typeof socketFactory !== 'function') {
            throw new Error('v152_e_r4_worker_dependencies_required');
        }
        this.config = config;
        this.stateStore = stateStore;
        this.socketFactory = socketFactory;
        this.clock = clock;
        this.setTimer = setTimer;
        this.clearTimer = clearTimer;
        this.setIntervalFn = setIntervalFn;
        this.clearIntervalFn = clearIntervalFn;
        this.reconnectPolicy = new V152ER4ReconnectPolicy({ config, clock, random });
        this.running = false;
        this.terminal = false;
        this.socketRecord = null;
        this.socketGeneration = 0;
        this.connectInFlight = null;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.pendingCredentialWrites = Promise.resolve();
        this.stateWrites = Promise.resolve();
        this.tasks = new Set();
        this.state = sanitizedWorkerState({
            sessionState: 'UNKNOWN',
            connectionState: 'DISCONNECTED',
            status: 'INACTIVE',
            health: 'INACTIVE',
            reconnectAttempt: 0,
            workerPid: process.pid,
            shadowInboundCount: 0
        });
    }

    snapshot() {
        return Object.freeze({ ...this.state });
    }

    async start() {
        if (this.running) return this.snapshot();
        this.running = true;
        this.terminal = false;
        const startedAt = iso(this.clock());
        await this.#publish({
            sessionState: 'RESTORE_PENDING',
            connectionState: 'CONNECTING',
            status: 'INACTIVE',
            health: 'STARTING',
            workerPid: process.pid,
            workerStartedAt: startedAt,
            heartbeatAt: startedAt,
            lastErrorClass: null,
            pairingRequired: 'NO',
            reconnectAttempt: 0
        });
        this.#startHeartbeat();
        await this.#connect('START');
        return this.snapshot();
    }

    async stop() {
        this.running = false;
        this.terminal = true;
        if (this.reconnectTimer) this.clearTimer(this.reconnectTimer);
        if (this.heartbeatTimer) this.clearIntervalFn(this.heartbeatTimer);
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        await this.pendingCredentialWrites.catch(() => {});
        await this.#closeActiveSocket();
        await this.#publish({
            connectionState: 'STOPPED',
            status: 'INACTIVE',
            health: 'INACTIVE',
            lastDisconnectedAt: iso(this.clock()),
            lastErrorClass: 'EXPLICIT_DISCONNECT',
            reconnectAttempt: 0,
            heartbeatAt: iso(this.clock())
        });
        await this.whenIdle();
        return this.snapshot();
    }

    async whenIdle() {
        for (;;) {
            const pending = [...this.tasks];
            await Promise.allSettled(pending);
            await Promise.allSettled([this.pendingCredentialWrites, this.stateWrites]);
            if (pending.length === 0 || this.tasks.size === 0) return;
        }
    }

    async handleConnectionUpdate(update = {}, generation = this.socketGeneration) {
        if (!this.#isCurrent(generation)) return this.snapshot();
        if (update.qr) {
            await this.#enterTerminalState('QR_GENERATION_BLOCKED', { pairingRequired: true });
            return this.snapshot();
        }
        if (update.connection === 'open') {
            try {
                const providerAddress = String(this.socketRecord?.socket?.user?.id || '');
                assertPairedPhoneAllowed(providerAddress, this.config, {
                    evidence: {
                        source: 'BAILEYS_SOCKET_USER',
                        providerAddressObserved: true,
                        authenticatedProviderAddress: true,
                        authorizedChannelId: this.config.channelId,
                        observedChannelId: this.config.channelId
                    }
                });
                await this.pendingCredentialWrites;
                this.reconnectPolicy.reset();
                await this.#publish({
                    sessionState: 'RESTORED',
                    connectionState: 'CONNECTED',
                    status: 'ACTIVE',
                    health: 'PASS',
                    lastConnectedAt: iso(this.clock()),
                    lastErrorClass: null,
                    reconnectAttempt: 0,
                    pairingRequired: 'NO',
                    heartbeatAt: iso(this.clock())
                });
            } catch {
                await this.#enterTerminalState('PHONE_MISMATCH', { pairingRequired: true });
            }
            return this.snapshot();
        }
        if (update.connection === 'close') {
            const classification = classifyV152ER4Disconnect(update);
            await this.#detachCurrentSocket(generation);
            if (!classification.reconnect || !this.running) {
                await this.#enterTerminalState(classification.errorClass, {
                    pairingRequired: classification.pairingRequired,
                    closeSocket: false
                });
                return this.snapshot();
            }
            await this.#publish({
                connectionState: 'DISCONNECTED',
                status: 'DEGRADED',
                health: 'DEGRADED',
                lastDisconnectedAt: iso(this.clock()),
                lastErrorClass: classification.errorClass,
                pairingRequired: 'NO',
                heartbeatAt: iso(this.clock())
            });
            this.#scheduleReconnect();
        }
        return this.snapshot();
    }

    async handleCredsUpdate(_update = {}, generation = this.socketGeneration) {
        if (!this.#isCurrent(generation)) return;
        const record = this.socketRecord;
        this.pendingCredentialWrites = this.pendingCredentialWrites.then(async () => {
            await record.saveCreds();
            await hardenSessionTree(this.config.sessionDirectory);
        });
        try {
            await this.pendingCredentialWrites;
        } catch {
            await this.#enterTerminalState('AUTH_PERSISTENCE_FAILED', { pairingRequired: true });
        }
    }

    async handleMessagesUpsert(payload = {}, generation = this.socketGeneration) {
        if (!this.#isCurrent(generation)) return;
        const count = Array.isArray(payload.messages) ? payload.messages.length : 0;
        if (count === 0) return;
        await this.#publish({
            shadowInboundCount: Number(this.state.shadowInboundCount || 0) + count,
            lastShadowInboundAt: iso(this.clock()),
            heartbeatAt: iso(this.clock())
        });
    }

    async #connect(trigger) {
        if (!this.running || this.terminal || this.socketRecord) return;
        if (this.connectInFlight) return this.connectInFlight;
        this.connectInFlight = (async () => {
            await this.#publish({
                connectionState: 'CONNECTING',
                status: this.state.status === 'ACTIVE' ? 'DEGRADED' : this.state.status,
                health: 'STARTING',
                lastErrorClass: trigger === 'START' ? null : this.state.lastErrorClass,
                heartbeatAt: iso(this.clock())
            });
            try {
                const record = await this.socketFactory({ config: this.config, trigger });
                if (!record?.socket?.ev || typeof record.saveCreds !== 'function') {
                    throw new Error('v152_e_r4_socket_factory_contract_invalid');
                }
                if (!this.running || this.terminal) {
                    await record.socket.end?.(undefined);
                    return;
                }
                if (this.socketRecord) throw new Error('v152_e_r4_single_socket_violation');
                const generation = ++this.socketGeneration;
                this.socketRecord = { ...record, generation, listeners: [] };
                this.#listen('connection.update', (update) => this.#track(this.handleConnectionUpdate(update, generation)));
                this.#listen('creds.update', (update) => this.#track(this.handleCredsUpdate(update, generation)));
                this.#listen('messages.upsert', (payload) => this.#track(this.handleMessagesUpsert(payload, generation)));
                await this.#publish({
                    sessionState: 'RESTORED',
                    connectionState: 'CONNECTING',
                    status: 'INACTIVE',
                    health: 'STARTING',
                    heartbeatAt: iso(this.clock())
                });
            } catch (error) {
                const terminal = /session_not_paired|session_not_restorable|session_path|single_socket|factory_contract/.test(String(error?.message || ''));
                if (terminal) {
                    await this.#enterTerminalState('SESSION_NOT_RESTORABLE', { pairingRequired: true });
                } else {
                    await this.#publish({
                        connectionState: 'DISCONNECTED',
                        status: 'DEGRADED',
                        health: 'DEGRADED',
                        lastDisconnectedAt: iso(this.clock()),
                        lastErrorClass: 'SOCKET_CREATE_FAILED',
                        pairingRequired: 'NO',
                        heartbeatAt: iso(this.clock())
                    });
                    this.#scheduleReconnect();
                }
            }
        })().finally(() => {
            this.connectInFlight = null;
        });
        return this.connectInFlight;
    }

    #listen(event, listener) {
        this.socketRecord.socket.ev.on(event, listener);
        this.socketRecord.listeners.push([event, listener]);
    }

    #isCurrent(generation) {
        return Boolean(this.socketRecord && this.socketRecord.generation === generation);
    }

    #track(promise) {
        const task = Promise.resolve(promise).finally(() => this.tasks.delete(task));
        this.tasks.add(task);
        return task;
    }

    async #detachCurrentSocket(generation = this.socketGeneration) {
        if (!this.#isCurrent(generation)) return;
        const record = this.socketRecord;
        this.socketRecord = null;
        for (const [event, listener] of record.listeners) record.socket.ev.off?.(event, listener);
        try { await record.socket.end?.(undefined); } catch {}
    }

    async #closeActiveSocket() {
        if (!this.socketRecord) return;
        await this.#detachCurrentSocket(this.socketRecord.generation);
    }

    async #enterTerminalState(errorClass, { pairingRequired = false, closeSocket = true } = {}) {
        this.terminal = true;
        if (this.reconnectTimer) this.clearTimer(this.reconnectTimer);
        this.reconnectTimer = null;
        if (closeSocket) await this.#closeActiveSocket();
        await this.#publish({
            sessionState: pairingRequired ? 'PAIRING_REQUIRED' : this.state.sessionState,
            connectionState: 'DISCONNECTED',
            status: pairingRequired ? 'INACTIVE' : 'DEGRADED',
            health: 'DEGRADED',
            lastDisconnectedAt: iso(this.clock()),
            lastErrorClass: errorClass,
            reconnectAttempt: 0,
            pairingRequired: pairingRequired ? 'MANUAL_OPERATOR_ACTION' : 'NO',
            heartbeatAt: iso(this.clock())
        });
    }

    #scheduleReconnect() {
        if (!this.running || this.terminal || this.reconnectTimer || this.socketRecord) return;
        const decision = this.reconnectPolicy.next();
        const delayMs = decision.allowed ? decision.delayMs : decision.cooldownMs;
        this.#track(this.#publish({
            reconnectAttempt: decision.attempt,
            lastErrorClass: decision.allowed ? this.state.lastErrorClass : 'RECONNECT_COOLDOWN',
            heartbeatAt: iso(this.clock())
        }));
        this.reconnectTimer = this.setTimer(() => {
            this.reconnectTimer = null;
            if (!this.running || this.terminal || this.socketRecord) return;
            this.#track(this.#connect(decision.allowed ? 'TRANSIENT_RECONNECT' : 'COOLDOWN_RECONNECT'));
        }, delayMs);
    }

    #startHeartbeat() {
        if (this.heartbeatTimer) return;
        this.heartbeatTimer = this.setIntervalFn(() => {
            if (!this.running) return;
            this.#track(this.#publish({ heartbeatAt: iso(this.clock()) }));
        }, this.config.heartbeatMs);
    }

    #publish(patch) {
        this.state = sanitizedWorkerState({ ...this.state, ...patch });
        const snapshot = this.state;
        this.stateWrites = this.stateWrites.then(() => this.stateStore.write(snapshot));
        return this.stateWrites;
    }
}
