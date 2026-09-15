import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
    V165_CANARY_RECIPIENT,
    V165_CANARY_TEXT,
    executeV165ControlledCanary,
    resolveV165CanaryConfig
} from '../src/whatsapp/core/ControlledOutboundCanaryV165.js';

const baseEnv = Object.freeze({
    V165_WEB_CANARY_APPROVED: 'YES',
    V165_ALLOWED_RECIPIENT: '5515998038637',
    V165_PAIRED_WEB_IDENTITY: '5531983002800',
    V165_SESSION_NAMESPACE: 'V152_TEST_WEB_01',
    WHATSAPP_SESSION_STORAGE_ROOT: process.platform === 'win32' ? 'C:\\vitalismen-v165-session' : '/var/lib/vitalismen-v165-session',
    V165_LEDGER_ROOT: process.platform === 'win32' ? 'C:\\vitalismen-v165-ledger' : '/var/lib/vitalismen-v165-ledger',
    V165_CONNECT_TIMEOUT_MS: '10000',
    V165_ACK_TIMEOUT_MS: '5000'
});

const config = (overrides = {}) => resolveV165CanaryConfig({ ...baseEnv, ...overrides }, {
    releaseRoot: process.platform === 'win32' ? 'C:\\release-v165' : '/opt/release-v165'
});

const createLedger = ({ duplicate = null } = {}) => {
    const transitions = [];
    return {
        transitions,
        async reserve() {
            if (duplicate) return { accepted: false, record: duplicate };
            transitions.push('INTENDED');
            return { accepted: true, reservationToken: 'once' };
        },
        async markSent(_token, providerMessageId) {
            transitions.push(`SENT:${providerMessageId}`);
            return { state: 'SENT', providerMessageIdSha256: 'hash-only' };
        },
        async markAcked(_token, status) {
            transitions.push(`ACKED:${status}`);
            return { state: 'ACKED', providerMessageIdSha256: 'hash-only' };
        },
        async markAmbiguous(_token, reason) {
            transitions.push(`AMBIGUOUS:${reason}`);
            return { state: 'AMBIGUOUS', providerMessageIdSha256: null };
        }
    };
};

const createSocketFactory = ({ ack = true, qr = false, sendError = null, user = '553183002800:1@s.whatsapp.net' } = {}) => {
    const observations = { sockets: 0, sends: [], ended: 0 };
    const factory = async () => {
        observations.sockets += 1;
        const ev = new EventEmitter();
        const socket = {
            ev,
            user: { id: user },
            async sendMessage(jid, payload) {
                observations.sends.push({ jid, payload });
                if (sendError) throw sendError;
                if (ack) queueMicrotask(() => ev.emit('messages.update', [{ key: { id: 'provider-raw-id' }, update: { status: 3 } }]));
                return { key: { id: 'provider-raw-id' } };
            },
            async end() { observations.ended += 1; }
        };
        setImmediate(() => ev.emit('connection.update', qr ? { qr: 'secret' } : { connection: 'open' }));
        return { socket, saveCreds: async () => {} };
    };
    return { factory, observations };
};

test('V165 aceita somente destinatário, identidade, sessão e paths externos exatos', () => {
    const resolved = config();
    assert.equal(resolved.recipient, V165_CANARY_RECIPIENT);
    assert.equal(resolved.text, V165_CANARY_TEXT);
    assert.throws(() => config({ V165_ALLOWED_RECIPIENT: '5515998038638' }), /recipient_exact/);
    assert.throws(() => config({ V165_PAIRED_WEB_IDENTITY: '5515991418416' }), /paired_identity_exact/);
    assert.throws(() => config({ V165_SESSION_NAMESPACE: 'OTHER' }), /namespace_mismatch/);
    assert.throws(() => config({ V165_WEB_CANARY_APPROVED: 'NO' }), /approval_required/);
});

test('V165 registra INTENDED antes do único envio literal e conclui ACKED', async () => {
    const ledger = createLedger();
    const socket = createSocketFactory();
    const result = await executeV165ControlledCanary({
        config: config(), ledger, socketFactory: socket.factory,
        sessionInspector: async () => ({ restorable: true, pairingRequired: false })
    });
    assert.equal(result.result, 'PASS');
    assert.equal(result.sendCalls, 1);
    assert.deepEqual(socket.observations.sends, [{
        jid: `${V165_CANARY_RECIPIENT}@s.whatsapp.net`, payload: { text: V165_CANARY_TEXT }
    }]);
    assert.deepEqual(ledger.transitions, ['INTENDED', 'SENT:provider-raw-id', 'ACKED:3']);
    assert.equal(socket.observations.ended, 1);
});

test('ledger existente bloqueia socket, rede e repetição', async () => {
    const ledger = createLedger({ duplicate: {
        state: 'ACKED', attemptCount: 1, providerMessageIdSha256: 'hash-only'
    } });
    const socket = createSocketFactory();
    const result = await executeV165ControlledCanary({
        config: config(), ledger, socketFactory: socket.factory,
        sessionInspector: async () => ({ restorable: true, pairingRequired: false })
    });
    assert.equal(result.result, 'DUPLICATE_BLOCKED');
    assert.equal(result.socketCreated, false);
    assert.equal(result.sendCalls, 0);
    assert.equal(socket.observations.sockets, 0);
});

test('QR inesperado e falha incerta geram AMBIGUOUS sem envio nem retry', async () => {
    const ledger = createLedger();
    const socket = createSocketFactory({ qr: true });
    const result = await executeV165ControlledCanary({
        config: config(), ledger, socketFactory: socket.factory,
        sessionInspector: async () => ({ restorable: true, pairingRequired: false })
    });
    assert.equal(result.result, 'AMBIGUOUS');
    assert.equal(result.sendCalls, 0);
    assert.equal(result.automaticRetry, false);
    assert.deepEqual(ledger.transitions, ['INTENDED', 'AMBIGUOUS:UNEXPECTED_QR']);
    assert.equal(socket.observations.ended, 1);
});

test('identidade Web divergente bloqueia o envio', async () => {
    const ledger = createLedger();
    const socket = createSocketFactory({ user: '5515991418416:1@s.whatsapp.net' });
    const result = await executeV165ControlledCanary({
        config: config(), ledger, socketFactory: socket.factory,
        sessionInspector: async () => ({ restorable: true, pairingRequired: false })
    });
    assert.equal(result.result, 'AMBIGUOUS');
    assert.equal(result.sendCalls, 0);
    assert.match(ledger.transitions.at(-1), /PAIRED_IDENTITY_MISMATCH/);
});
