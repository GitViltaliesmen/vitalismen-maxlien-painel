import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { UnifiedMessageLedger } from '../src/whatsapp/core/UnifiedMessageLedger.js';
import { SessionManager } from '../src/whatsapp/core/SessionManager.js';
import { ZapiWhatsAppTransport } from '../src/whatsapp/transports/ZapiWhatsAppTransport.js';
import { WhatsAppWebTransport } from '../src/whatsapp/transports/WhatsAppWebTransport.js';
import { ProviderIndependentInboundOrchestrator } from '../src/whatsapp/core/ProviderIndependentInboundOrchestrator.js';
import { PersistentOutboundQueue } from '../src/whatsapp/core/PersistentOutboundQueue.js';
import { ConversationLease } from '../src/whatsapp/core/ConversationLease.js';

const fixtures = JSON.parse(await fs.readFile(new URL('./fixtures/v152-b-provider-parity.json', import.meta.url), 'utf8'));

const fakeLedgerRepositories = () => {
    const dedupes = new Map();
    const messages = new Map();
    return {
        dedupes,
        messages,
        dedupeRepository: {
            findOneAndUpdate: async (query, update) => {
                const existing = dedupes.get(query.key);
                if (existing) return { lastErrorObject: { updatedExisting: true }, value: existing };
                const value = { ...update.$setOnInsert };
                dedupes.set(query.key, value);
                return { lastErrorObject: { updatedExisting: false }, value };
            }
        },
        messageRepository: {
            findOneAndUpdate: async (query, update) => {
                const value = messages.get(query._id) || { ...update.$setOnInsert };
                messages.set(query._id, value);
                return value;
            },
            countDocuments: async () => 2
        }
    };
};

test('ledger deduplica texto, áudio, imagem, vídeo e documento pela mensagem lógica', async () => {
    const repositories = fakeLedgerRepositories();
    const ledger = new UnifiedMessageLedger(repositories);
    for (const kind of ['text', 'audio', 'image', 'video', 'document']) {
        const input = {
            logicalMessageId: `logical-${kind}`, channelId: 'LEGACY_ZAPI_PRIMARY', provider: 'ZAPI',
            phone: '593991112233', kind, contentFingerprint: `sha-${kind}`,
            payload: { from: 'system', to: '593991112233', type: kind }
        };
        assert.equal((await ledger.reserve(input)).accepted, true);
        assert.equal((await ledger.reserve(input)).duplicate, true);
    }
    assert.equal(repositories.dedupes.size, 5);
    assert.equal(repositories.messages.size, 5);
    assert.equal(await ledger.countPending('chat-1'), 2);
});

test('SessionManager exige raiz externa absoluta, persiste entre reinícios e aplica 0700/0600', async () => {
    assert.throws(() => new SessionManager({ storageRoot: 'auth_info_baileys' }), /absolute_required/);
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v152-b-session-'));
    try {
        const first = new SessionManager({ storageRoot: root });
        await assert.rejects(first.writeState('shadow-channel', 'qr-state', { qrCode: 'forbidden' }), /qr_material_persistence_forbidden/);
        const target = await first.writeState('shadow-channel', 'state', { generation: 1, paired: false });
        const second = new SessionManager({ storageRoot: root });
        assert.deepEqual(await second.readState('shadow-channel', 'state'), { generation: 1, paired: false });
        if (process.platform !== 'win32') {
            assert.equal((await fs.stat(path.dirname(target))).mode & 0o777, 0o700);
            assert.equal((await fs.stat(target)).mode & 0o777, 0o600);
        }
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('fixtures Z-API e WhatsApp Web geram o mesmo resultado de negócio', async () => {
    const zapi = new ZapiWhatsAppTransport({ fixtureMode: true, client: {} });
    const web = new WhatsAppWebTransport({ channelId: 'LEGACY_ZAPI_PRIMARY', fixtureClient: {} });
    const handlers = Object.fromEntries(['product', 'vsl', 'pickup', 'buyLater', 'engagement', 'botRouting'].map((key) => [key, async (message) => ({ key, text: message.text, phone: message.phone })]));
    const orchestrator = new ProviderIndependentInboundOrchestrator({ handlers });
    const zapiResult = await orchestrator.evaluate(zapi.normalizeInbound(fixtures.zapi));
    const webResult = await orchestrator.evaluate(web.normalizeInbound(fixtures.whatsappWeb));
    assert.deepEqual(zapiResult.result, webResult.result);
    assert.equal(zapiResult.phone, webResult.phone);
});

test('fila persistente reivindica e conclui registro do Message sem provedor', async () => {
    const calls = [];
    const repository = {
        findOneAndUpdate: async (query, update, options) => {
            calls.push({ query, update, options });
            return { _id: calls.length === 1 ? 'm1' : query._id, ...update.$set };
        }
    };
    const queue = new PersistentOutboundQueue({ messageRepository: repository, clock: () => new Date('2026-09-11T12:00:00Z') });
    assert.equal((await queue.claim('worker-shadow')).queueStatus, 'CLAIMED');
    assert.equal((await queue.complete('m1', 'worker-shadow')).queueStatus, 'COMPLETED');
    assert.equal(calls[0].query.queueStatus, 'PENDING');
});

test('ConversationLease usa aquisição/liberação atômicas e recupera lease expirado', async () => {
    const calls = [];
    const clock = () => new Date('2026-09-11T12:00:00Z');
    const repository = {
        findOneAndUpdate: async (query, update) => {
            calls.push({ kind: 'findOneAndUpdate', query, update });
            if (update.$inc) return { ...update.$set, version: 2 };
            return { ...query, ...update.$set };
        },
        updateMany: async (query, update) => {
            calls.push({ kind: 'updateMany', query, update });
            return { modifiedCount: 1 };
        }
    };
    const lease = new ConversationLease({ repository, clock });
    const acquired = await lease.acquire('conversation-a', 'handoff-worker', { channelId: 'A', ttlMs: 5000 });
    assert.equal(acquired.holder, 'handoff-worker');
    assert.equal(acquired.channelId, 'A');
    assert.ok(acquired.leaseToken);
    assert.equal(acquired.expiresAt.toISOString(), '2026-09-11T12:00:05.000Z');
    await lease.release('conversation-a', acquired.leaseToken);
    await lease.recoverStale();
    assert.equal(calls[1].query.leaseToken, acquired.leaseToken);
    assert.deepEqual(calls[2].query, { expiresAt: { $lte: clock() }, releasedAt: null });
});
