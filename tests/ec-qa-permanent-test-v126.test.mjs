import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    claimEcQaInboundContextV78
} from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';
import {
    buildEcQaSafeResetV126,
    ecQaPermanentBotInboundAllowedV126,
    ecQaPermanentClaimQueryV126,
    isEcQaPermanentTestStateV126
} from '../src/services/ecQaPermanentTestV126Service.js';

const qaState = () => ({
    _id: 'qa-state',
    phoneDigits: '5515998038637',
    chatId: '5515998038637@c.us',
    countryCode: 'BR',
    human: { mode: 'manual', pausedUntil: new Date('2036-01-01T00:00:00Z') },
    conversationBucket: { value: 'engagement', manualSelectedAt: new Date() },
    tags: ['TESTE_8637_PRIORIDADE', 'TESTE_FIXO_NAO_MEXER', 'BOT_TESTE_LIBERADO'],
    metadata: {
        testOnly: true,
        outboundTestOnly: true,
        botTestEnabled: true,
        fullFunnelTestEnabled: true,
        noDropiEver: true,
        qaTestContextV78: { status: 'consumed' },
        perAgentMemory: { tex_ultra_ec: { stage: 'offer' } },
        processedInboundMessageIds: ['provider-old']
    }
});

test('V126 habilita somente o estado canônico exato e integral do QA', () => {
    assert.equal(isEcQaPermanentTestStateV126(qaState()), true);
    assert.equal(isEcQaPermanentTestStateV126({ ...qaState(), phoneDigits: '593999111222' }), false);
    assert.equal(isEcQaPermanentTestStateV126({
        ...qaState(),
        metadata: { ...qaState().metadata, noDropiEver: false }
    }), false);
});

test('V126 permite bot no AQUECIMENTO só com VSL recente ou produto explícito', () => {
    const state = qaState();
    assert.equal(ecQaPermanentBotInboundAllowedV126({ state }), false);
    assert.equal(ecQaPermanentBotInboundAllowedV126({ state, publicVslLeadEntry: true }), true);
    assert.equal(ecQaPermanentBotInboundAllowedV126({ state, directProductInbound: true }), true);
    assert.equal(ecQaPermanentBotInboundAllowedV126({ state, persistedVslProductContext: { productKey: 'tex_ultra_ec' } }), true);
    assert.equal(ecQaPermanentBotInboundAllowedV126({
        state: { ...state, phoneDigits: '593999111222' },
        directProductInbound: true
    }), false);
});

test('V126 reivindica inbound permanente por providerMessageId sem janela ou teto', async () => {
    const calls = [];
    const result = await claimEcQaInboundContextV78({
        payload: {
            phone: '5515998038637',
            messageId: 'provider-v126-direct',
            text: { message: 'Hola, deseo informacion de Nitrix' },
            status: 'RECEIVED'
        },
        model: {
            async updateOne(query, update) {
                calls.push({ query, update });
                return { modifiedCount: 1 };
            }
        },
        allowQaFollowUp: true,
        allowQaPermanent: true,
        now: new Date('2026-09-04T18:00:00Z')
    });
    assert.equal(result.allowed, true);
    assert.equal(result.phase, 'permanent_direct');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].query.phoneDigits, '5515998038637');
    assert.equal(calls[0].query['metadata.noDropiEver'], true);
    assert.equal(calls[0].query['metadata.qaTestContextV78.expiresAt'], undefined);
    assert.equal(calls[0].query['metadata.qaTestContextV78.messageCount'], undefined);
});

test('V126 claim bloqueia duplicata do mesmo providerMessageId e routing concorrente', () => {
    const query = ecQaPermanentClaimQueryV126({
        messageId: 'provider-v126-1',
        now: new Date('2026-09-04T18:00:00Z')
    });
    assert.deepEqual(query.$and[0], {
        'metadata.qaTestContextV78.routingMessageId': { $ne: 'provider-v126-1' }
    });
    assert.equal(query.$and[1].$or[0]['metadata.qaTestContextV78.status'].$ne, 'routing');
});

test('reset V126 remove somente estado transitório e preserva identidade e dedupe histórico', () => {
    const state = qaState();
    const reset = buildEcQaSafeResetV126({ state, now: new Date('2026-09-04T18:00:00Z') });
    assert.equal(reset.allowed, true);
    assert.equal(reset.query._id, 'qa-state');
    assert.equal(reset.update.$set['human.mode'], 'auto');
    assert.equal(reset.update.$set.countryCode, 'BR');
    assert.equal(reset.update.$unset['metadata.qaTestContextV78'], '');
    assert.equal(reset.update.$unset['metadata.perAgentMemory'], '');
    assert.equal(reset.update.$unset['metadata.processedInboundMessageIds'], undefined);
    assert.equal(reset.update.$unset.firstInboundAt, undefined);
    assert.equal(reset.update.$unset.lastInboundAt, undefined);
});

test('V126 mantém bloqueios de pedido, Dropi, Shipment, Meta e pós-venda do QA', () => {
    const resetScript = fs.readFileSync('scripts/reset-ec-qa-8637-v126.mjs', 'utf8');
    const conversation = fs.readFileSync('src/services/conversationEngine.js', 'utf8');
    const orders = fs.readFileSync('src/routes/orders.js', 'utf8');
    const dropiGuard = fs.readFileSync('src/services/dropiOutboundOrderGuardService.js', 'utf8');
    assert.match(conversation, /pedido ignorado para teste limpo; nunca criar\/Dropi/);
    assert.match(orders, /if \(isBrazilTestOnly\(\{ phone, country \}\)\)/);
    assert.match(dropiGuard, /5515998038637/);
    assert.doesNotMatch(resetScript, /sendText|sendAudio|sendImage|submitDroppi|sendPurchaseEvent/);
    assert.doesNotMatch(resetScript, /Message\.(?:delete|remove)|deleteMany|deleteOne/);
});
