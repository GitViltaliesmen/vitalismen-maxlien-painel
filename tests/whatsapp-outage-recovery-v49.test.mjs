import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    classifyEcConversationSnapshot,
    EC_CONVERSATION_BUCKETS
} from '../src/services/ecConversationBucketService.js';
import {
    evaluateOperationalWhatsappHealth,
    zapiSubscriptionBlockedFromMessages
} from '../src/routes/health.js';

const inbound = (body) => ({
    _id: `in-${body}`,
    body,
    type: 'chat',
    timestamp: Math.floor(Date.now() / 1000),
    isFromMe: false,
    senderRole: 'client',
    providerMessageId: `provider-${body}`
});

const state = (stage = '') => ({
    chatId: '593998773837@c.us',
    phoneDigits: '593998773837',
    human: { mode: 'auto' },
    metadata: {
        productKey: 'tex_ultra_ec',
        perAgentMemory: {
            tex_ultra_ec: { stage }
        }
    },
    conversationBucket: { value: 'attendance' }
});

test('V49 mantém SI contextual no atendimento quando o funil aguarda confirmação', () => {
    const message = inbound('Siiiii');
    const result = classifyEcConversationSnapshot({
        state: state('awaiting_confirmation'),
        messages: [message],
        currentMessage: message
    });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.ATTENDANCE);
    assert.equal(result.metrics.contextualFunnelReply, true);
    assert.equal(result.metrics.activeCommercialStage, 'awaiting_confirmation');
    assert.deepEqual(result.reasons, ['active_funnel_reply']);
});

test('V49 mantém dado livre no atendimento durante coleta ativa do funil', () => {
    const message = inbound('Puerto Francisco de Orellana');
    const result = classifyEcConversationSnapshot({
        state: state('awaiting_city'),
        messages: [message],
        currentMessage: message
    });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.ATTENDANCE);
    assert.equal(result.metrics.contextualFunnelReply, true);
});

test('V49 não converte resposta solta em intenção comercial fora de etapa ativa', () => {
    const message = inbound('SI');
    const result = classifyEcConversationSnapshot({
        state: state('question_handoff'),
        messages: [message],
        currentMessage: message
    });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.REVIEW);
    assert.equal(result.metrics.contextualFunnelReply, false);
});

test('V49 detecta assinatura Z-API bloqueada mesmo com status conectado', () => {
    const lastFailure = {
        createdAt: new Date('2026-08-23T22:40:31.364Z'),
        sendError: '{"error":"To continue sending a message, you must subscribe to this instance again"}'
    };
    const lastSuccess = { createdAt: new Date('2026-08-23T20:51:06.792Z') };
    assert.equal(zapiSubscriptionBlockedFromMessages({ lastFailure, lastSuccess }), true);
    const health = evaluateOperationalWhatsappHealth({
        zapiConfigured: true,
        zapiConnected: true,
        zapiOutboundBlocked: true
    });
    assert.equal(health.ready, false);
    assert.deepEqual(health.degradedReasons, ['zapi_subscription_inactive']);
});

test('V49 limpa o bloqueio depois de saída Z-API comprovadamente bem-sucedida', () => {
    const lastFailure = {
        createdAt: new Date('2026-08-23T22:40:31.364Z'),
        sendError: 'To continue sending a message, you must subscribe to this instance again'
    };
    const lastSuccess = { createdAt: new Date('2026-08-23T22:55:00.000Z') };
    assert.equal(zapiSubscriptionBlockedFromMessages({ lastFailure, lastSuccess }), false);
});

test('V49 mantém o health somente leitura e sem envio de canário', () => {
    const source = fs.readFileSync(new URL('../src/routes/health.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /sendZapi(?:Text|Audio|Image|Video|Document)/);
    assert.doesNotMatch(source, /router\.(?:post|put|patch|delete)\s*\(/);
    assert.match(source, /zapi_subscription_inactive/);
    assert.equal(
        [...source.matchAll(/connectionStatus:\s*zapi\.connected\s*\?\s*'online'\s*:\s*'offline'/g)].length,
        2
    );
});

test('V49 permanece encadeada pelo guard atual ou por sucessor declarado', () => {
    const entryGuard = fs.readFileSync(new URL('../src/services/ecEngagementFreezeRuntimeGuardV40.js', import.meta.url), 'utf8');
    assert.match(entryGuard, /(?:whatsappOutageRecoveryFreezeRuntimeGuardV49|panelManualEditPersistenceFreezeRuntimeGuardV50|panelCustomerSelectionIsolationFreezeRuntimeGuardV51|postSaleHealthRecoveryFreezeRuntimeGuardV53|texUltraDeliveryClosureFreezeRuntimeGuardV54)\.js/);
});
