import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    V167B_EVENT_KEY_HASH,
    V167B_SCHEMA,
    V167B_TEXT,
    V167BFileDecisionRepository,
    buildV167BMessagePayload,
    executeV167BAuthorizedWorkerSend,
    resolveV167BConfig,
    validateV167BRequest
} from '../src/whatsapp/core/AuthorizedWebCanaryV167B.js';
import { V167ProviderDecisionLedger } from '../src/whatsapp/core/ControlledProviderRoutingV167.js';

const config = resolveV167BConfig({
    V167B_AUTHORIZED_WEB_CANARY_ENABLED: 'true',
    V167B_AUTHORIZED_PHONE: '5515998038637',
    V167B_SOCKET_PATH: '/run/vitalismen-whatsapp-web-v167b.sock',
    V167B_ACK_TIMEOUT_MS: '1000'
});

const request = Object.freeze({
    schema: V167B_SCHEMA,
    eventKeyHash: V167B_EVENT_KEY_HASH,
    phone: '5515998038637',
    purpose: config.purpose,
    text: V167B_TEXT
});

const readyWorker = ({ providerMessageId = '3EB0V167BTEST', ack = 3, fail = false } = {}) => {
    const ev = new EventEmitter();
    let sends = 0;
    const socket = {
        ev,
        async sendMessage(jid, content) {
            sends += 1;
            assert.equal(jid, '5515998038637@s.whatsapp.net');
            assert.deepEqual(content, { text: V167B_TEXT });
            if (fail) throw new Error('ambiguous provider result');
            queueMicrotask(() => ev.emit('messages.update', [{ key: { id: providerMessageId }, update: { status: ack } }]));
            return { key: { id: providerMessageId } };
        }
    };
    return {
        socketRecord: { socket },
        snapshot: () => ({
            phone: '5531983002800',
            sessionNamespace: 'V152_TEST_WEB_01',
            sessionState: 'RESTORED',
            connectionState: 'CONNECTED',
            status: 'ACTIVE',
            health: 'PASS',
            pairingRequired: 'NO',
            shadow: true,
            draining: true,
            weight: 0,
            capacity: 0
        }),
        sendCount: () => sends
    };
};

test('configuração e payload ficam presos ao telefone QA, sessão e texto V167B', () => {
    assert.equal(config.phone, '5515998038637');
    assert.equal(config.channelId, 'V152_TEST_WEB_01');
    assert.equal(config.pairedIdentity, '5531983002800');
    assert.equal(config.socketPath, '/run/vitalismen-whatsapp-web-v167b.sock');
    const payload = buildV167BMessagePayload({ now: new Date('2026-09-15T23:00:00Z') });
    assert.equal(payload.peerPhone, '5515998038637');
    assert.equal(payload.provider, 'WHATSAPP_WEB');
    assert.equal(payload.queueStatus, undefined);
    assert.equal(payload.body, V167B_TEXT);
    assert.equal(payload.timestamp, 1789513200);
});

test('contrato rejeita telefone, texto, purpose e event hash divergentes', () => {
    assert.equal(validateV167BRequest(request, config).phone, '5515998038637');
    for (const patch of [
        { phone: '593991112233' },
        { text: 'mensagem livre' },
        { purpose: 'COMMERCIAL' },
        { eventKeyHash: '0'.repeat(64) }
    ]) {
        assert.throws(() => validateV167BRequest({ ...request, ...patch }, config), /request_contract_rejected/);
    }
});

test('worker persistente envia uma vez, observa ACK e bloqueia reexecução no mesmo processo', async () => {
    const worker = readyWorker();
    const seenEvents = new Set();
    const gate = { inFlight: false };
    const first = await executeV167BAuthorizedWorkerSend({ worker, config, request, seenEvents, gate });
    const second = await executeV167BAuthorizedWorkerSend({ worker, config, request, seenEvents, gate });
    assert.deepEqual(
        { ok: first.ok, accepted: first.accepted, provider: first.provider, ack: first.ack, deliveryState: first.deliveryState },
        { ok: true, accepted: true, provider: 'WHATSAPP_WEB', ack: 3, deliveryState: 'DELIVERED' }
    );
    assert.equal(second.reason, 'DUPLICATE_BLOCKED');
    assert.equal(worker.sendCount(), 1);
});

test('worker não pronto bloqueia antes da rede e resultado ambíguo nunca produz segunda chamada', async () => {
    const notReady = readyWorker();
    notReady.snapshot = () => ({ ...readyWorker().snapshot(), health: 'FAIL' });
    const blocked = await executeV167BAuthorizedWorkerSend({ worker: notReady, config, request });
    assert.equal(blocked.reason, 'WEB_WORKER_NOT_READY');
    assert.equal(notReady.sendCount(), 0);

    const ambiguous = readyWorker({ fail: true });
    const seenEvents = new Set();
    const first = await executeV167BAuthorizedWorkerSend({ worker: ambiguous, config, request, seenEvents });
    const second = await executeV167BAuthorizedWorkerSend({ worker: ambiguous, config, request, seenEvents });
    assert.equal(first.ambiguous, true);
    assert.equal(second.reason, 'DUPLICATE_BLOCKED');
    assert.equal(ambiguous.sendCount(), 1);
});

test('ledger externo reserva atomicamente e preserva estado terminal para bloquear duplicata', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v167b-ledger-'));
    const filePath = path.join(root, 'decision.json');
    try {
        const repository = new V167BFileDecisionRepository({ filePath });
        const ledger = new V167ProviderDecisionLedger({ repository, clock: () => new Date('2026-09-15T23:00:00Z') });
        const first = await ledger.reserve({ eventKey: config.eventKey, phone: config.phone, selectedProvider: 'whatsapp_web' });
        const duplicate = await ledger.reserve({ eventKey: config.eventKey, phone: config.phone, selectedProvider: 'zapi' });
        assert.equal(first.accepted, true);
        assert.equal(duplicate.duplicate, true);
        assert.equal(duplicate.record.selectedProvider, 'whatsapp_web');
        await ledger.transition(first.record.eventKeyHash, 'whatsapp_web', 'INTENDED', 'SENT');
        assert.equal((await repository.read()).sendState, 'SENT');
        if (process.platform !== 'win32') assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});
