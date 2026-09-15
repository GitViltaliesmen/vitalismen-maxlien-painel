import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

import {
    V167_CONTROLLED_PHONE,
    V167_ROUTING_PURPOSE,
    V167_WEB_CHANNEL,
    V167_WEB_IDENTITY,
    v167WebWorkerReady
} from './ControlledProviderRoutingV167.js';

export const V167B_SCHEMA = 'V167B_AUTHORIZED_WEB_CANARY_V1';
export const V167B_EVENT_KEY = 'V167B_AUTHORIZED_WEB_CANARY_5515998038637';
export const V167B_TEXT = 'Prueba técnica controlada V167B por WhatsApp Web. No requiere respuesta comercial.';
export const V167B_SOCKET_PATH = '/run/vitalismen-whatsapp-web-v167b.sock';
export const V167B_WORKER_ID = 'v167b-authorized-web-canary';
export const V167B_DECISION_ROOT = '/var/lib/vitalismen-whatsapp-web-v167b';
export const V167B_DECISION_FILE = `${V167B_DECISION_ROOT}/decision.json`;

const clean = (value) => String(value || '').trim();
const digits = (value) => clean(value).replace(/\D/g, '');
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const boundedInteger = (value, fallback, minimum, maximum) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
};

export const V167B_EVENT_KEY_HASH = sha256(V167B_EVENT_KEY);
export const V167B_CONTENT_FINGERPRINT = sha256(V167B_TEXT);

export const resolveV167BConfig = (env = process.env) => {
    if (clean(env.V167B_AUTHORIZED_WEB_CANARY_ENABLED) !== 'true') {
        throw new Error('v167b_explicit_runtime_enable_required');
    }
    if (digits(env.V167B_AUTHORIZED_PHONE) !== V167_CONTROLLED_PHONE) {
        throw new Error('v167b_authorized_phone_mismatch');
    }
    if (clean(env.V167B_SOCKET_PATH || V167B_SOCKET_PATH) !== V167B_SOCKET_PATH) {
        throw new Error('v167b_socket_path_mismatch');
    }
    return Object.freeze({
        socketPath: V167B_SOCKET_PATH,
        phone: V167_CONTROLLED_PHONE,
        pairedIdentity: V167_WEB_IDENTITY,
        channelId: V167_WEB_CHANNEL,
        purpose: V167_ROUTING_PURPOSE,
        eventKey: V167B_EVENT_KEY,
        eventKeyHash: V167B_EVENT_KEY_HASH,
        text: V167B_TEXT,
        contentFingerprint: V167B_CONTENT_FINGERPRINT,
        decisionRoot: V167B_DECISION_ROOT,
        decisionFile: V167B_DECISION_FILE,
        requestTimeoutMs: boundedInteger(env.V167B_REQUEST_TIMEOUT_MS, 30000, 5000, 60000),
        ackTimeoutMs: boundedInteger(env.V167B_ACK_TIMEOUT_MS, 15000, 1000, 30000)
    });
};

export class V167BFileDecisionRepository {
    constructor({ filePath, fsApi = fs } = {}) {
        if (!path.isAbsolute(clean(filePath)) || path.basename(filePath) !== 'decision.json') {
            throw new Error('v167b_decision_file_invalid');
        }
        this.filePath = path.resolve(filePath);
        this.root = path.dirname(this.filePath);
        this.fs = fsApi;
    }

    async read() {
        try {
            const stat = await this.fs.lstat(this.filePath);
            if (!stat.isFile() || stat.isSymbolicLink()
                || (process.platform !== 'win32' && (stat.mode & 0o777) !== 0o600)) {
                throw new Error('v167b_decision_file_permissions_invalid');
            }
            return JSON.parse(await this.fs.readFile(this.filePath, 'utf8'));
        } catch (error) {
            if (error?.code === 'ENOENT') return null;
            throw error;
        }
    }

    async findOneAndUpdate(filter = {}, update = {}, options = {}) {
        await this.fs.mkdir(this.root, { recursive: true, mode: 0o700 });
        await this.fs.chmod(this.root, 0o700);
        if (update.$setOnInsert && options.upsert === true) {
            let handle;
            try {
                handle = await this.fs.open(this.filePath, 'wx', 0o600);
                await handle.writeFile(`${JSON.stringify(update.$setOnInsert, null, 2)}\n`);
                await handle.sync();
                await handle.chmod(0o600);
                return { value: update.$setOnInsert, lastErrorObject: { updatedExisting: false } };
            } catch (error) {
                if (error?.code !== 'EEXIST') throw error;
                return { value: await this.read(), lastErrorObject: { updatedExisting: true } };
            } finally {
                await handle?.close();
            }
        }
        const current = await this.read();
        if (!current) return null;
        const matches = Object.entries(filter).every(([key, value]) => current[key] === value);
        if (!matches || !update.$set) return null;
        const next = { ...current, ...update.$set };
        const temporary = `${this.filePath}.tmp.${process.pid}.${crypto.randomUUID()}`;
        let handle;
        try {
            handle = await this.fs.open(temporary, 'wx', 0o600);
            await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`);
            await handle.sync();
            await handle.chmod(0o600);
            await handle.close();
            handle = null;
            await this.fs.rename(temporary, this.filePath);
        } finally {
            await handle?.close();
            await this.fs.unlink(temporary).catch((error) => {
                if (error?.code !== 'ENOENT') throw error;
            });
        }
        return next;
    }
}

export const projectV167BWorkerReadiness = (worker) => {
    const state = worker?.snapshot?.() || {};
    return Object.freeze({
        processName: 'vitalismen-whatsapp-web-shadow-v164',
        active: state.status === 'ACTIVE',
        health: state.health,
        sessionNamespace: state.sessionNamespace,
        pairedIdentity: digits(state.phone),
        sessionState: state.sessionState,
        connectionState: state.connectionState,
        shadow: state.shadow === true,
        draining: state.draining === true,
        weight: Number(state.weight),
        capacity: Number(state.capacity),
        concurrentSockets: worker?.socketRecord?.socket ? 1 : 0,
        pairingRequired: state.pairingRequired !== 'NO'
    });
};

export const validateV167BRequest = (request = {}, config) => {
    if (request.schema !== V167B_SCHEMA
        || clean(request.eventKeyHash) !== config.eventKeyHash
        || digits(request.phone) !== config.phone
        || clean(request.purpose) !== config.purpose
        || clean(request.text) !== config.text) {
        throw new Error('v167b_request_contract_rejected');
    }
    return Object.freeze({
        schema: V167B_SCHEMA,
        eventKeyHash: config.eventKeyHash,
        phone: config.phone,
        purpose: config.purpose,
        text: config.text
    });
};

const createAckTracker = (socket) => {
    const statuses = new Map();
    let providerMessageId = '';
    let resolveAck;
    let timer;
    let settled = false;
    const promise = new Promise((resolve) => {
        resolveAck = (status) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(Number(status || 0));
        };
    });
    const onUpdates = (updates = []) => {
        for (const item of Array.isArray(updates) ? updates : []) {
            const id = clean(item?.key?.id);
            const status = Number(item?.update?.status ?? item?.status ?? 0);
            if (!id) continue;
            statuses.set(id, Math.max(statuses.get(id) || 0, status));
            if (providerMessageId === id && status >= 3) resolveAck(status);
        }
    };
    socket.ev.on('messages.update', onUpdates);
    return Object.freeze({
        bind(id) {
            providerMessageId = clean(id);
            const observed = statuses.get(providerMessageId) || 0;
            if (observed >= 3) resolveAck(observed);
        },
        wait(timeoutMs) {
            timer = setTimeout(() => resolveAck(0), timeoutMs);
            return promise;
        },
        close() {
            clearTimeout(timer);
            socket.ev.off?.('messages.update', onUpdates);
        }
    });
};

const writeJsonLine = (socket, value) => {
    if (!socket.destroyed) socket.end(`${JSON.stringify(value)}\n`);
};

export const executeV167BAuthorizedWorkerSend = async ({
    worker,
    config,
    request,
    seenEvents = new Set(),
    gate = { inFlight: false }
} = {}) => {
    let validated;
    try {
        validated = validateV167BRequest(request, config);
    } catch {
        return Object.freeze({ ok: false, accepted: false, ambiguous: false, reason: 'REQUEST_CONTRACT_REJECTED' });
    }
    if (gate.inFlight || seenEvents.has(validated.eventKeyHash)) {
        return Object.freeze({ ok: false, accepted: false, ambiguous: false, reason: 'DUPLICATE_BLOCKED' });
    }
    if (!v167WebWorkerReady(projectV167BWorkerReadiness(worker))) {
        return Object.freeze({ ok: false, accepted: false, ambiguous: false, reason: 'WEB_WORKER_NOT_READY' });
    }
    const socket = worker.socketRecord?.socket;
    if (!socket || typeof socket.sendMessage !== 'function') {
        return Object.freeze({ ok: false, accepted: false, ambiguous: false, reason: 'WEB_SOCKET_UNAVAILABLE' });
    }
    gate.inFlight = true;
    seenEvents.add(validated.eventKeyHash);
    const ackTracker = createAckTracker(socket);
    try {
        const response = await socket.sendMessage(`${config.phone}@s.whatsapp.net`, { text: config.text });
        const providerMessageId = clean(response?.key?.id);
        if (!providerMessageId) {
            return Object.freeze({ ok: false, accepted: false, ambiguous: true, reason: 'PROVIDER_RESULT_AMBIGUOUS' });
        }
        ackTracker.bind(providerMessageId);
        const ack = await ackTracker.wait(config.ackTimeoutMs);
        return Object.freeze({
            ok: true,
            accepted: true,
            ambiguous: false,
            provider: 'WHATSAPP_WEB',
            providerMessageId,
            ack,
            deliveryState: ack >= 4 ? 'READ' : ack >= 3 ? 'DELIVERED' : 'SENT'
        });
    } catch {
        return Object.freeze({ ok: false, accepted: false, ambiguous: true, reason: 'PROVIDER_RESULT_AMBIGUOUS' });
    } finally {
        ackTracker.close();
        gate.inFlight = false;
    }
};

export class V167BAuthorizedWebControlServer {
    constructor({ worker, config, fsApi = fs, netApi = net } = {}) {
        if (!worker || !config?.socketPath) throw new Error('v167b_control_server_dependencies_required');
        this.worker = worker;
        this.config = config;
        this.fs = fsApi;
        this.net = netApi;
        this.server = null;
        this.gate = { inFlight: false };
        this.seenEvents = new Set();
    }

    async start() {
        if (this.server) return;
        const parent = path.dirname(this.config.socketPath);
        if (parent !== '/run' || path.basename(this.config.socketPath) !== path.basename(V167B_SOCKET_PATH)) {
            throw new Error('v167b_control_socket_unsafe');
        }
        try {
            const stat = await this.fs.lstat(this.config.socketPath);
            if (!stat.isSocket() || stat.isSymbolicLink()) throw new Error('v167b_control_socket_collision');
            await this.fs.unlink(this.config.socketPath);
        } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
        }
        this.server = this.net.createServer((socket) => this.#handleConnection(socket));
        await new Promise((resolve, reject) => {
            const onError = (error) => {
                this.server?.off('listening', onListening);
                reject(error);
            };
            const onListening = () => {
                this.server?.off('error', onError);
                resolve();
            };
            this.server.once('error', onError);
            this.server.once('listening', onListening);
            this.server.listen(this.config.socketPath);
        });
        await this.fs.chmod(this.config.socketPath, 0o600);
    }

    async stop() {
        const server = this.server;
        this.server = null;
        if (server) await new Promise((resolve) => server.close(() => resolve()));
        await this.fs.unlink(this.config.socketPath).catch((error) => {
            if (error?.code !== 'ENOENT') throw error;
        });
    }

    #handleConnection(socket) {
        socket.setEncoding('utf8');
        let input = '';
        let handled = false;
        const fail = (reason) => writeJsonLine(socket, {
            ok: false,
            accepted: false,
            ambiguous: false,
            reason: clean(reason) || 'REQUEST_REJECTED'
        });
        socket.on('data', (chunk) => {
            if (handled) return;
            input += chunk;
            if (input.length > 4096) {
                handled = true;
                fail('REQUEST_TOO_LARGE');
                return;
            }
            const newline = input.indexOf('\n');
            if (newline < 0) return;
            handled = true;
            const raw = input.slice(0, newline);
            void this.#dispatch(raw).then((result) => writeJsonLine(socket, result)).catch((error) => fail(error?.message));
        });
        socket.once('error', () => {});
    }

    async #dispatch(raw) {
        let request;
        try {
            request = JSON.parse(raw);
        } catch {
            return Object.freeze({ ok: false, accepted: false, ambiguous: false, reason: 'REQUEST_CONTRACT_REJECTED' });
        }
        return executeV167BAuthorizedWorkerSend({
            worker: this.worker,
            config: this.config,
            request,
            seenEvents: this.seenEvents,
            gate: this.gate
        });
    }
}

export const sendV167BControlRequest = ({ config, netApi = net } = {}) => new Promise((resolve, reject) => {
    if (!config?.socketPath) {
        reject(new Error('v167b_control_client_config_required'));
        return;
    }
    let client;
    let input = '';
    let settled = false;
    const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        client?.destroy();
        if (error) reject(error);
        else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('v167b_control_request_timeout')), config.requestTimeoutMs);
    client = netApi.createConnection(config.socketPath, () => {
        client.write(`${JSON.stringify({
            schema: V167B_SCHEMA,
            eventKeyHash: config.eventKeyHash,
            phone: config.phone,
            purpose: config.purpose,
            text: config.text
        })}\n`);
    });
    client.setEncoding('utf8');
    client.on('data', (chunk) => {
        input += chunk;
        if (input.length > 4096) finish(new Error('v167b_control_response_too_large'));
        const newline = input.indexOf('\n');
        if (newline < 0) return;
        try {
            finish(null, JSON.parse(input.slice(0, newline)));
        } catch {
            finish(new Error('v167b_control_response_invalid'));
        }
    });
    client.once('error', (error) => finish(error));
    client.once('end', () => {
        if (!settled && !input.includes('\n')) finish(new Error('v167b_control_response_incomplete'));
    });
});

export const buildV167BMessagePayload = ({ now = new Date() } = {}) => {
    const providerId = V167_WEB_IDENTITY;
    return Object.freeze({
        _id: `v167b:${V167B_EVENT_KEY_HASH.slice(0, 32)}`,
        chatId: `${V167_CONTROLLED_PHONE}@c.us`,
        peerPhone: V167_CONTROLLED_PHONE,
        from: `${providerId}@c.us`,
        to: `${V167_CONTROLLED_PHONE}@c.us`,
        body: V167B_TEXT,
        type: 'chat',
        hasMedia: false,
        timestamp: Math.floor(now.getTime() / 1000),
        sessionId: V167_WEB_CHANNEL,
        ownerPhoneDigits: providerId,
        isFromMe: true,
        isBot: false,
        senderRole: 'system',
        ack: 0,
        deliveryStatus: 'pending',
        provider: 'WHATSAPP_WEB',
        logicalMessageId: V167B_EVENT_KEY,
        channelId: V167_WEB_CHANNEL
    });
};

export const sanitizeV167BResult = (value = {}) => Object.freeze({
    ok: value.ok === true,
    accepted: value.accepted === true,
    ambiguous: value.ambiguous === true,
    provider: clean(value.provider),
    providerMessageId: clean(value.providerMessageId),
    ack: Number(value.ack || 0),
    deliveryState: clean(value.deliveryState),
    reason: clean(value.reason)
});
