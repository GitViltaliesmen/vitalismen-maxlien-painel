import assert from 'node:assert/strict';
import test from 'node:test';
import { ChannelRouter } from '../src/whatsapp/core/ChannelRouter.js';
import { CustomerAffinity } from '../src/whatsapp/core/CustomerAffinity.js';
import { ControlledHandoff } from '../src/whatsapp/core/ControlledHandoff.js';
import { ShadowModeGate } from '../src/whatsapp/core/ShadowModeGate.js';
import { ChannelRegistry } from '../src/whatsapp/core/ChannelRegistry.js';
import { OutboundCoordinator } from '../src/whatsapp/core/OutboundCoordinator.js';

const active = (channelId, priority = 1, extra = {}) => ({
    channelId, status: 'ACTIVE', health: { healthy: true }, draining: false,
    priority, weight: 1, capacity: 10, currentLoad: 0, ...extra
});

test('registro projeta canal atual ativo e antigo bloqueado sem migração', () => {
    const projected = ChannelRegistry.projection();
    assert.equal(projected[0].channelId, 'LEGACY_ZAPI_PRIMARY');
    assert.equal(projected[0].phoneNumber, '5531971862958');
    assert.equal(projected[0].status, 'ACTIVE');
    assert.equal(projected[1].phoneNumber, '5515991418416');
    assert.equal(projected[1].status, 'BLOCKED');
});

test('afinidade legada é lida como espelho e não reescrita', async () => {
    let writes = 0;
    const contactStateRepository = {
        findOne: () => ({ lean: async () => ({ metadata: { senderWallet: { assignedSessionId: '5531971862958' } } }) }),
        findOneAndUpdate: async () => { writes += 1; }
    };
    const channelRegistry = { get: async () => null };
    const affinity = new CustomerAffinity({ contactStateRepository, channelRegistry });
    assert.deepEqual(await affinity.get('chat-1'), {
        channelId: 'LEGACY_ZAPI_PRIMARY', legacySessionId: '5531971862958', source: 'LEGACY_COMPATIBILITY_MIRROR'
    });
    assert.equal(writes, 0);
});

test('router preserva afinidade e não faz failover implícito se canal adoece', async () => {
    const channels = new Map([
        ['A', active('A', 1, { health: { healthy: false } })],
        ['B', active('B', 2)]
    ]);
    const router = new ChannelRouter({
        registry: { get: async (id) => channels.get(id), list: async () => [...channels.values()] },
        affinity: { get: async () => ({ channelId: 'A' }) },
        shadowGate: new ShadowModeGate()
    });
    const result = await router.select({ conversationId: 'c1', customerKey: '593991112233' });
    assert.equal(result.blocked, true);
    assert.equal(result.failover, false);
    assert.equal(result.channel, null);
});

test('novo cliente evita canal indisponível e respeita prioridade/capacidade', async () => {
    const channels = [
        active('FULL', 1, { capacity: 1, currentLoad: 1 }),
        active('BLOCKED', 1, { status: 'BLOCKED' }),
        active('DRAINING', 1, { draining: true }),
        active('UNHEALTHY', 1, { health: { healthy: false } }),
        active('READY', 2),
        active('LOW', 3)
    ];
    const router = new ChannelRouter({
        registry: { get: async () => null, list: async () => channels },
        affinity: { get: async () => null },
        shadowGate: new ShadowModeGate()
    });
    assert.equal((await router.select({ conversationId: 'new' })).channel.channelId, 'READY');
});

test('canais da mesma prioridade respeitam peso de forma determinística', async () => {
    const channels = [active('A', 1, { weight: 1 }), active('B', 1, { weight: 4 })];
    const router = new ChannelRouter({
        registry: { get: async () => null, list: async () => channels },
        affinity: { get: async () => null },
        shadowGate: new ShadowModeGate()
    });
    const counts = { A: 0, B: 0 };
    for (let index = 0; index < 500; index += 1) {
        const selected = await router.select({ conversationId: `new-${index}`, customerKey: `customer-${index}` });
        counts[selected.channel.channelId] += 1;
    }
    assert.ok(counts.B > counts.A, JSON.stringify(counts));
});

test('afinidade persiste entre instâncias do router', async () => {
    const stored = new Map([['customer-a', { channelId: 'A' }]]);
    const affinity = { get: async (id) => stored.get(id) || null };
    const registry = { get: async (id) => active(id), list: async () => [active('A'), active('B')] };
    const first = new ChannelRouter({ registry, affinity, shadowGate: new ShadowModeGate() });
    const restarted = new ChannelRouter({ registry, affinity, shadowGate: new ShadowModeGate() });
    assert.equal((await first.select({ conversationId: 'customer-a' })).channel.channelId, 'A');
    assert.equal((await restarted.select({ conversationId: 'customer-a' })).channel.channelId, 'A');
});

test('handoffCustomer obtém lease, atualiza afinidade atomicamente uma vez e registra transferência', async () => {
    const calls = [];
    const affinityState = new Map([['c1', 'A']]);
    const simulationSession = {
        shadow: true,
        compareAndAssign: async (conversationId, fromChannelId, toChannelId) => {
            calls.push(['compareAndAssign', conversationId, fromChannelId, toChannelId]);
            if (affinityState.get(conversationId) !== fromChannelId) throw new Error('affinity_compare_and_assign_conflict');
            affinityState.set(conversationId, toChannelId);
            return { channelId: toChannelId };
        }
    };
    const handoff = new ControlledHandoff({
        lease: {
            acquire: async () => ({ leaseToken: 'lease-token' }),
            release: async (...args) => calls.push(['release', ...args])
        },
        registry: { get: async () => active('B') },
        affinity: {
            get: async (conversationId) => ({ channelId: affinityState.get(conversationId) }),
            compareAndAssign: async (...args) => simulationSession.compareAndAssign(...args.slice(0, 3))
        },
        ledger: { countPending: async () => 0 },
        transferRepository: { create: async (record) => calls.push(['create', record]) },
        shadowGate: new ShadowModeGate()
    });
    const result = await handoff.handoffCustomer({
        conversationId: 'c1', fromChannelId: 'A', toChannelId: 'B',
        reason: 'operator_shadow_test', actor: 'senior-review', simulationSession
    });
    assert.equal(result.status, 'SIMULATED');
    assert.equal(result.reason, 'operator_shadow_test');
    assert.equal(result.actor, 'senior-review');
    assert.equal(affinityState.get('c1'), 'B');
    assert.equal(calls.filter(([kind]) => kind === 'compareAndAssign').length, 1);
    assert.equal(calls.filter(([kind]) => kind === 'create').length, 1);
    assert.equal(calls.some(([kind]) => kind === 'release'), true);
    await assert.rejects(handoff.handoffCustomer({ conversationId: 'c2', fromChannelId: 'A', toChannelId: 'B' }), {
        code: 'V152_B_REAL_EFFECT_BLOCKED'
    });
});

test('bot, manual e pós-venda preparam outbound sem conhecer cliente de provedor', async () => {
    const reservations = [];
    const coordinator = new OutboundCoordinator({
        registry: { get: async () => ({ ...active('A'), provider: 'ZAPI' }) },
        ledger: { reserve: async (value) => { reservations.push(value); return { accepted: true }; } },
        shadowGate: new ShadowModeGate()
    });
    for (const source of ['BOT', 'MANUAL', 'POSTSALE']) {
        const result = await coordinator.prepare({
            source, channelId: 'A', logicalMessageId: source, phone: '593991112233',
            kind: 'text', contentFingerprint: source
        });
        assert.equal(result.status, 'SHADOW_RESERVED');
        assert.equal(result.realOutbound, false);
        assert.equal(result.provider, 'ZAPI');
    }
    assert.equal(reservations.length, 3);
    await assert.rejects(coordinator.dispatch(), { code: 'V152_B_REAL_EFFECT_BLOCKED' });
});
