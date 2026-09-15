import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
    V152_E_FORBIDDEN_PAIRED_PHONES,
    assertPairedPhoneAllowed,
    ensureSecureDirectory,
    hardenSessionTree,
    writeJsonAtomic
} from './ControlledRealPairingV152E.js';
import { inspectBaileysAuthStateForRestart } from './ControlledPairingRecoveryV152ER3.js';

export const V165_CANARY_EVENT_KEY = 'V165_WEB_OUTBOUND_CANARY_5515998038637';
export const V165_CANARY_RECIPIENT = '5515998038637';
export const V165_PAIRED_WEB_IDENTITY = '5531983002800';
export const V165_SESSION_NAMESPACE = 'V152_TEST_WEB_01';
export const V165_CANARY_TEXT = 'Prueba técnica controlada V165 por WhatsApp Web. No requiere respuesta comercial.';
export const V165_LEDGER_SCHEMA = 'V165_WEB_CONTROLLED_CANARY_LEDGER_V1';
export const V165_LEDGER_STATES = Object.freeze(['INTENDED', 'SENT', 'ACKED', 'AMBIGUOUS']);

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const boundedInteger = (value, fallback, minimum, maximum) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
};
const isInside = (parent, candidate) => {
    const relative = path.relative(path.resolve(parent), path.resolve(candidate));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};
const errorClass = (error) => {
    const text = String(error?.message || 'unknown');
    if (text.includes('unexpected_qr')) return 'UNEXPECTED_QR';
    if (text.includes('paired_identity')) return 'PAIRED_IDENTITY_MISMATCH';
    if (text.includes('connect_timeout')) return 'CONNECT_TIMEOUT';
    if (text.includes('connection_closed')) return 'CONNECTION_CLOSED';
    if (text.includes('provider_message_id')) return 'PROVIDER_RESULT_AMBIGUOUS';
    if (text.includes('session')) return 'SESSION_NOT_RESTORABLE';
    return 'PROVIDER_RESULT_AMBIGUOUS';
};

export const resolveV165CanaryConfig = (env = process.env, { releaseRoot = process.cwd(), requireApproval = true } = {}) => {
    if (requireApproval && String(env.V165_WEB_CANARY_APPROVED || '') !== 'YES') {
        throw new Error('v165_explicit_canary_approval_required');
    }
    if (String(env.V165_ALLOWED_RECIPIENT || '') !== V165_CANARY_RECIPIENT) {
        throw new Error('v165_recipient_exact_match_required');
    }
    if (String(env.V165_PAIRED_WEB_IDENTITY || '') !== V165_PAIRED_WEB_IDENTITY) {
        throw new Error('v165_paired_identity_exact_match_required');
    }
    if (String(env.V165_SESSION_NAMESPACE || '') !== V165_SESSION_NAMESPACE) {
        throw new Error('v165_session_namespace_mismatch');
    }
    const configuredSessionRoot = String(env.WHATSAPP_SESSION_STORAGE_ROOT || '');
    const configuredLedgerRoot = String(env.V165_LEDGER_ROOT || '');
    const sessionRoot = path.resolve(configuredSessionRoot);
    const ledgerRoot = path.resolve(configuredLedgerRoot);
    for (const [label, raw, configured] of [
        ['session', configuredSessionRoot, sessionRoot],
        ['ledger', configuredLedgerRoot, ledgerRoot]
    ]) {
        if (!path.isAbsolute(raw)
            || configured === path.parse(configured).root || isInside(releaseRoot, configured)) {
            throw new Error(`v165_${label}_root_invalid`);
        }
    }
    if (isInside(sessionRoot, ledgerRoot) || isInside(ledgerRoot, sessionRoot)) {
        throw new Error('v165_session_ledger_isolation_required');
    }
    return Object.freeze({
        recipient: V165_CANARY_RECIPIENT,
        pairedIdentity: V165_PAIRED_WEB_IDENTITY,
        sessionNamespace: V165_SESSION_NAMESPACE,
        sessionRoot,
        sessionDirectory: path.join(sessionRoot, V165_SESSION_NAMESPACE),
        ledgerRoot,
        ledgerFile: path.join(ledgerRoot, 'canary.json'),
        text: V165_CANARY_TEXT,
        connectTimeoutMs: boundedInteger(env.V165_CONNECT_TIMEOUT_MS, 90000, 10000, 180000),
        ackTimeoutMs: boundedInteger(env.V165_ACK_TIMEOUT_MS, 30000, 5000, 60000)
    });
};

const validateLedgerRecord = (record) => {
    if (!record || record.schema !== V165_LEDGER_SCHEMA || record.eventKey !== V165_CANARY_EVENT_KEY
        || record.recipientSha256 !== sha256(V165_CANARY_RECIPIENT)
        || record.textSha256 !== sha256(V165_CANARY_TEXT)
        || !V165_LEDGER_STATES.includes(record.state)
        || record.attemptCount !== 1) {
        throw new Error('v165_ledger_invalid');
    }
    return record;
};

export class V165CanaryLedger {
    constructor({ config, fsApi = fs, clock = () => new Date(), randomUUID = crypto.randomUUID } = {}) {
        if (!config?.ledgerFile) throw new Error('v165_ledger_config_required');
        this.config = config;
        this.fs = fsApi;
        this.clock = clock;
        this.randomUUID = randomUUID;
    }

    async read() {
        try {
            const stat = await this.fs.lstat(this.config.ledgerFile);
            if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600) {
                throw new Error('v165_ledger_permissions_invalid');
            }
            return validateLedgerRecord(JSON.parse(await this.fs.readFile(this.config.ledgerFile, 'utf8')));
        } catch (error) {
            if (error?.code === 'ENOENT') return null;
            throw error;
        }
    }

    async reserve() {
        await ensureSecureDirectory(this.config.ledgerRoot, this.fs);
        const reservationToken = this.randomUUID();
        const now = this.clock().toISOString();
        const record = {
            schema: V165_LEDGER_SCHEMA,
            eventKey: V165_CANARY_EVENT_KEY,
            state: 'INTENDED',
            attemptCount: 1,
            recipientSha256: sha256(V165_CANARY_RECIPIENT),
            textSha256: sha256(V165_CANARY_TEXT),
            reservationToken,
            intendedAt: now,
            sentAt: null,
            ackedAt: null,
            ambiguousAt: null,
            providerMessageIdSha256: null,
            deliveryAckStatus: null,
            errorClass: null,
            updatedAt: now
        };
        let handle;
        try {
            handle = await this.fs.open(this.config.ledgerFile, 'wx', 0o600);
            await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`);
            await handle.sync();
            await handle.chmod(0o600);
        } catch (error) {
            if (error?.code === 'EEXIST') {
                return Object.freeze({ accepted: false, record: await this.read() });
            }
            throw error;
        } finally {
            await handle?.close();
        }
        return Object.freeze({ accepted: true, reservationToken, record: validateLedgerRecord(record) });
    }

    async transition(reservationToken, patch, allowedStates) {
        const current = await this.read();
        if (!current || current.reservationToken !== reservationToken || !allowedStates.includes(current.state)) {
            throw new Error('v165_ledger_transition_rejected');
        }
        const next = validateLedgerRecord({
            ...current,
            ...patch,
            updatedAt: this.clock().toISOString()
        });
        await writeJsonAtomic(this.config.ledgerFile, next, this.fs);
        return next;
    }

    markSent(reservationToken, providerMessageId) {
        const now = this.clock().toISOString();
        return this.transition(reservationToken, {
            state: 'SENT',
            sentAt: now,
            providerMessageIdSha256: sha256(providerMessageId),
            errorClass: null
        }, ['INTENDED']);
    }

    markAcked(reservationToken, status) {
        return this.transition(reservationToken, {
            state: 'ACKED',
            ackedAt: this.clock().toISOString(),
            deliveryAckStatus: Number(status)
        }, ['SENT']);
    }

    markAmbiguous(reservationToken, reason) {
        return this.transition(reservationToken, {
            state: 'AMBIGUOUS',
            ambiguousAt: this.clock().toISOString(),
            errorClass: reason
        }, ['INTENDED']);
    }
}

export const inspectV165Session = async (config, fsApi = fs) => {
    const stat = await fsApi.lstat(config.sessionDirectory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700) {
        throw new Error('v165_session_directory_invalid');
    }
    const canonical = await fsApi.realpath(config.sessionDirectory);
    if (path.resolve(canonical) !== path.resolve(config.sessionDirectory)) throw new Error('v165_session_symlink_forbidden');
    const credsPath = path.join(config.sessionDirectory, 'creds.json');
    const credsStat = await fsApi.lstat(credsPath);
    if (!credsStat.isFile() || credsStat.isSymbolicLink() || (credsStat.mode & 0o777) !== 0o600) {
        throw new Error('v165_session_creds_invalid');
    }
    const creds = JSON.parse(await fsApi.readFile(credsPath, 'utf8'));
    if (!inspectBaileysAuthStateForRestart(creds).structurallyComplete) {
        throw new Error('v165_session_not_restorable');
    }
    return Object.freeze({ restorable: true, pairingRequired: false });
};

const waitForOpen = (socket, config) => new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
        clearTimeout(timer);
        socket.ev.off?.('connection.update', onUpdate);
    };
    const onUpdate = (update = {}) => {
        if (update.qr) {
            cleanup();
            reject(new Error('v165_unexpected_qr'));
            return;
        }
        if (update.connection === 'close') {
            cleanup();
            reject(new Error('v165_connection_closed'));
            return;
        }
        if (update.connection !== 'open') return;
        try {
            assertPairedPhoneAllowed(String(socket.user?.id || ''), {
                testChannelPhone: config.pairedIdentity,
                forbiddenPairedPhones: V152_E_FORBIDDEN_PAIRED_PHONES
            }, {
                evidence: {
                    source: 'BAILEYS_SOCKET_USER',
                    providerAddressObserved: true,
                    authenticatedProviderAddress: true,
                    authorizedChannelId: V165_SESSION_NAMESPACE,
                    observedChannelId: V165_SESSION_NAMESPACE
                }
            });
            cleanup();
            resolve();
        } catch {
            cleanup();
            reject(new Error('v165_paired_identity_mismatch'));
        }
    };
    socket.ev.on('connection.update', onUpdate);
    timer = setTimeout(() => {
        cleanup();
        reject(new Error('v165_connect_timeout'));
    }, config.connectTimeoutMs);
});

const createAckTracker = (socket) => {
    const statuses = new Map();
    let providerMessageId = '';
    let resolveAck;
    let settled = false;
    let timer;
    const ackPromise = new Promise((resolve) => {
        resolveAck = (status) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(status);
        };
    });
    const onUpdates = (updates = []) => {
        for (const item of Array.isArray(updates) ? updates : []) {
            const id = String(item?.key?.id || '');
            const status = Number(item?.update?.status ?? item?.status ?? 0);
            if (id) statuses.set(id, Math.max(statuses.get(id) || 0, status));
            if (providerMessageId && id === providerMessageId && status >= 3) resolveAck(status);
        }
    };
    socket.ev.on('messages.update', onUpdates);
    return Object.freeze({
        bind(id) {
            providerMessageId = String(id || '');
            const observed = statuses.get(providerMessageId) || 0;
            if (observed >= 3) resolveAck(observed);
        },
        wait(timeoutMs) {
            timer = setTimeout(() => resolveAck(0), timeoutMs);
            return ackPromise;
        },
        close() {
            clearTimeout(timer);
            socket.ev.off?.('messages.update', onUpdates);
        }
    });
};

export const executeV165ControlledCanary = async ({
    config,
    ledger,
    socketFactory,
    sessionInspector = inspectV165Session
} = {}) => {
    if (!config || !ledger || typeof socketFactory !== 'function') throw new Error('v165_dependencies_required');
    await sessionInspector(config);
    const reservation = await ledger.reserve();
    if (!reservation.accepted) {
        return Object.freeze({
            result: 'DUPLICATE_BLOCKED',
            ledgerState: reservation.record.state,
            attempts: reservation.record.attemptCount,
            sent: ['SENT', 'ACKED'].includes(reservation.record.state) ? 1 : 0,
            providerAccepted: ['SENT', 'ACKED'].includes(reservation.record.state),
            deliveryAckObserved: reservation.record.state === 'ACKED',
            providerMessageIdSha256: reservation.record.providerMessageIdSha256 || '',
            socketCreated: false,
            sendCalls: 0,
            automaticRetry: false
        });
    }

    let socket;
    let ackTracker;
    let credentialWrites = Promise.resolve();
    let detachCreds = () => {};
    let sendCalls = 0;
    let sentRecord = null;
    try {
        const record = await socketFactory({ config });
        socket = record?.socket;
        if (!socket?.ev || typeof socket.sendMessage !== 'function' || typeof record?.saveCreds !== 'function') {
            throw new Error('v165_socket_factory_invalid');
        }
        const onCreds = () => {
            credentialWrites = credentialWrites.then(async () => {
                await record.saveCreds();
                await hardenSessionTree(config.sessionDirectory);
            });
        };
        socket.ev.on('creds.update', onCreds);
        detachCreds = () => socket.ev.off?.('creds.update', onCreds);
        await waitForOpen(socket, config);
        ackTracker = createAckTracker(socket);
        sendCalls += 1;
        const response = await socket.sendMessage(`${V165_CANARY_RECIPIENT}@s.whatsapp.net`, { text: V165_CANARY_TEXT });
        const providerMessageId = String(response?.key?.id || '');
        if (!providerMessageId) throw new Error('v165_provider_message_id_missing');
        sentRecord = await ledger.markSent(reservation.reservationToken, providerMessageId);
        ackTracker.bind(providerMessageId);
        const ackStatus = await ackTracker.wait(config.ackTimeoutMs);
        const finalRecord = ackStatus >= 3
            ? await ledger.markAcked(reservation.reservationToken, ackStatus)
            : sentRecord;
        return Object.freeze({
            result: finalRecord.state === 'ACKED' ? 'PASS' : 'ACCEPTED_PENDING_VISUAL_CONFIRMATION',
            ledgerState: finalRecord.state,
            attempts: 1,
            sent: 1,
            providerAccepted: true,
            deliveryAckObserved: finalRecord.state === 'ACKED',
            providerMessageIdSha256: finalRecord.providerMessageIdSha256,
            socketCreated: true,
            sendCalls,
            automaticRetry: false
        });
    } catch (error) {
        let finalRecord = sentRecord;
        if (!finalRecord) {
            finalRecord = await ledger.markAmbiguous(reservation.reservationToken, errorClass(error));
        }
        return Object.freeze({
            result: finalRecord.state === 'SENT' ? 'ACCEPTED_PENDING_VISUAL_CONFIRMATION' : 'AMBIGUOUS',
            ledgerState: finalRecord.state,
            attempts: 1,
            sent: finalRecord.state === 'SENT' ? 1 : 0,
            providerAccepted: finalRecord.state === 'SENT',
            deliveryAckObserved: false,
            providerMessageIdSha256: finalRecord.providerMessageIdSha256 || '',
            socketCreated: Boolean(socket),
            sendCalls,
            automaticRetry: false
        });
    } finally {
        ackTracker?.close();
        detachCreds();
        await credentialWrites.catch(() => {});
        try { await socket?.end?.(undefined); } catch {}
    }
};

export const sanitizeV165Ledger = (record) => Object.freeze(record ? {
    state: record.state,
    attemptCount: record.attemptCount,
    providerMessageIdSha256: record.providerMessageIdSha256 || '',
    deliveryAckObserved: record.state === 'ACKED',
    duplicateBlocked: true,
    automaticRetry: false
} : {
    state: 'ABSENT',
    attemptCount: 0,
    providerMessageIdSha256: '',
    deliveryAckObserved: false,
    duplicateBlocked: false,
    automaticRetry: false
});
