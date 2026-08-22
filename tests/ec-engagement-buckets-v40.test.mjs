import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    classifyEcConversationSnapshot,
    conversationBucketPanelView,
    currentInboundKind,
    EC_CONVERSATION_BUCKETS
} from '../src/services/ecConversationBucketService.js';
import {
    buildEcEngagementReplyPlan,
    ecEngagementReplyPolicy
} from '../src/services/ecEngagementReplyService.js';

const root = process.cwd();
const originalAutoReplyFlag = process.env.EC_ENGAGEMENT_AUTO_REPLY_ENABLED;
process.env.EC_ENGAGEMENT_AUTO_REPLY_ENABLED = 'true';
after(() => {
    if (originalAutoReplyFlag === undefined) delete process.env.EC_ENGAGEMENT_AUTO_REPLY_ENABLED;
    else process.env.EC_ENGAGEMENT_AUTO_REPLY_ENABLED = originalAutoReplyFlag;
});

const now = new Date('2026-08-22T18:00:00.000Z');
const atDaysAgo = (days, seconds = 0) => Math.floor((now.getTime() - days * 86400000 + seconds * 1000) / 1000);
const inbound = (id, body, days = 0, options = {}) => ({
    _id: id,
    body,
    type: options.type || 'chat',
    hasMedia: options.hasMedia || false,
    timestamp: atDaysAgo(days, options.seconds || 0),
    isFromMe: false,
    senderRole: 'client',
    providerMessageId: options.providerMessageId || id
});
const outbound = (id, body, days = 0) => ({
    _id: id,
    body,
    type: 'chat',
    timestamp: atDaysAgo(days),
    isFromMe: true,
    senderRole: 'human',
    providerMessageId: id
});
const safeDialogue = () => [
    inbound('i1', 'Hola, como esta?', 3),
    outbound('o1', 'Muy bien, gracias.', 3),
    inbound('i2', 'Hoy trabaje bastante, y usted?', 2),
    outbound('o2', 'Todo bien por aqui.', 2),
    inbound('i3', 'Que bueno, como sigue el dia?', 1),
    outbound('o3', 'Muy tranquilo.', 1),
    inbound('i4', 'Me alegra saberlo, que hace hoy?', 0)
];
const state = (extra = {}) => ({
    _id: 'state-1',
    chatId: '593999111222@c.us',
    phoneDigits: '593999111222',
    tags: [],
    human: { mode: 'manual' },
    metadata: {},
    conversationBucket: { value: 'attendance' },
    engagementAutomation: {},
    ...extra
});

test('1. conversa segura repetida recebe AQUECIMENTO com alta confianca', () => {
    const result = classifyEcConversationSnapshot({ state: state(), messages: safeDialogue(), now });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.ENGAGEMENT);
    assert.equal(result.confidence, 'high');
    assert.equal(result.metrics.activeDays >= 2, true);
});

test('2. intencao direta de Vit Power volta para ATENDIMENTO', () => {
    const message = inbound('buy-vit', 'Quiero Vit Power, cuanto cuesta?', 0);
    const result = classifyEcConversationSnapshot({ state: state(), messages: [message], currentMessage: message, now });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.ATTENDANCE);
    assert.equal(result.metrics.commercialIntent, true);
});

test('3. intencao direta de Nitrix volta para ATENDIMENTO', () => {
    const message = inbound('buy-nitrix', 'Quiero Nitrix Oxide', 0);
    const result = classifyEcConversationSnapshot({ state: state(), messages: [message], currentMessage: message, now });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.ATTENDANCE);
});

test('4. objecao de preco volta para ATENDIMENTO', () => {
    const message = inbound('price', 'Esta muy caro, tiene un precio mas barato?', 0);
    const result = classifyEcConversationSnapshot({ state: state(), messages: [message], currentMessage: message, now });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.ATTENDANCE);
    assert.equal(result.metrics.priceObjection, true);
});

test('5. quantidade forte volta para ATENDIMENTO', () => {
    const message = inbound('qty', 'Quiero 3 frascos', 0);
    const result = classifyEcConversationSnapshot({ state: state(), messages: [message], currentMessage: message, now });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.ATTENDANCE);
    assert.equal(result.metrics.strongPurchase, true);
});

test('6. pedido ativo recebe PEDIDOS independentemente da conversa', () => {
    const result = classifyEcConversationSnapshot({
        state: state(),
        messages: safeDialogue(),
        orders: [{ status: 'confirmed' }],
        now
    });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.ORDERS);
    assert.equal(result.metrics.activeOrders, 1);
});

test('7. shipment ativo recebe PEDIDOS', () => {
    const result = classifyEcConversationSnapshot({
        state: state(),
        messages: safeDialogue(),
        shipments: [{ logistics: { status: 'IN_TRANSIT' }, outcomes: {} }],
        now
    });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.ORDERS);
});

test('8. shipment encerrado nao cria obrigacao ativa', () => {
    const result = classifyEcConversationSnapshot({
        state: state(),
        messages: safeDialogue(),
        shipments: [{ logistics: { status: 'DELIVERED' }, outcomes: { delivered: true } }],
        now
    });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.ENGAGEMENT);
});

test('9. suporte logistico recebe PEDIDOS', () => {
    const message = inbound('support', 'Donde esta la guia de mi pedido?', 0);
    const result = classifyEcConversationSnapshot({ state: state(), messages: [message], currentMessage: message, now });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.ORDERS);
    assert.equal(result.metrics.supportIntent, true);
});

test('10. conteudo sexual explicito recebe REVISAR/RISCO', () => {
    const messages = [...safeDialogue(), inbound('risk', 'Quiero pagar por sexo xxx', 1)];
    const result = classifyEcConversationSnapshot({ state: state(), messages, now });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.REVIEW);
    assert.equal(result.metrics.risk, true);
    assert.ok(result.hardExclusions.includes('safety_risk'));
});

test('11. opt-out recebe REVISAR e bloqueio', () => {
    const message = inbound('stop', 'No me escriba mas, pare por favor', 0);
    const result = classifyEcConversationSnapshot({ state: state(), messages: [message], currentMessage: message, now });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.REVIEW);
    assert.equal(result.metrics.optOut, true);
});

test('12. midia e links dominantes permanecem em REVISAR', () => {
    const messages = [
        inbound('l1', 'https://example.com/1', 2),
        inbound('l2', 'https://example.com/2', 1),
        inbound('m1', '[image]', 1, { type: 'image', hasMedia: true }),
        inbound('l3', 'https://example.com/3', 0),
        outbound('o1', 'ok', 1),
        outbound('o2', 'ok', 0)
    ];
    const result = classifyEcConversationSnapshot({ state: state(), messages, now });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.REVIEW);
    assert.equal(result.metrics.linkMediaDominant, true);
});

test('13. aprovacao manual segura permite AQUECIMENTO sem massa', () => {
    const approved = state({ metadata: { warmup: { allowed: true } }, tags: ['warmup:allowed'] });
    const messages = [inbound('a1', 'Hola, como esta?', 2), inbound('a2', 'Que hace hoy?', 0)];
    const result = classifyEcConversationSnapshot({ state: approved, messages, now });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.ENGAGEMENT);
    assert.equal(result.metrics.legacyManualAllowed, true);
});

test('14. contato protegido de QA nunca entra em AQUECIMENTO', () => {
    const qa = state({ phoneDigits: '5515998038637', chatId: '5515998038637@c.us' });
    const result = classifyEcConversationSnapshot({ state: qa, messages: safeDialogue(), now });
    assert.equal(result.bucket, EC_CONVERSATION_BUCKETS.REVIEW);
    assert.ok(result.hardExclusions.includes('protected_test_contact'));
});

test('15. emoji isolado e classificado sem resposta', () => {
    assert.equal(currentInboundKind(inbound('emoji', '👍', 0)), 'reaction_only');
});

test('16. imagem isolada e classificada sem resposta', () => {
    assert.equal(currentInboundKind(inbound('image', '[image]', 0, { type: 'image', hasMedia: true })), 'media_only');
});

test('17. link simples e classificado sem resposta', () => {
    assert.equal(currentInboundKind(inbound('link', 'https://example.com/x', 0)), 'link_only');
});

test('18. plano local nao responde a link simples', () => {
    const classification = classifyEcConversationSnapshot({ state: state(), messages: safeDialogue(), now });
    const plan = buildEcEngagementReplyPlan({ state: state(), classification, message: inbound('link-plan', 'https://example.com/x', 0), now });
    assert.equal(plan.send, false);
    assert.match(plan.reason, /local_no_reply/);
});

test('19. plano local responde somente a inbound elegivel com template', () => {
    const messages = safeDialogue();
    const message = inbound('hello-plan', 'Hola, como esta?', 0);
    const classification = classifyEcConversationSnapshot({ state: state(), messages, currentMessage: message, now });
    const plan = buildEcEngagementReplyPlan({ state: state(), classification, message, now });
    assert.equal(plan.send, true);
    assert.match(plan.templateKey, /^(?:greeting|wellbeing):\d$/);
    assert.ok(plan.text.includes('?'));
});

test('20. atividade humana recente impede atropelo automatico', () => {
    const humanState = state({ human: { mode: 'manual', lastManualAt: new Date(now.getTime() - 2 * 60 * 1000) } });
    const message = inbound('human-recent', 'Hola, como esta?', 0);
    const classification = classifyEcConversationSnapshot({ state: humanState, messages: safeDialogue(), currentMessage: message, now });
    const plan = buildEcEngagementReplyPlan({ state: humanState, classification, message, now });
    assert.equal(plan.send, false);
    assert.equal(plan.reason, 'recent_human_activity');
});

test('21. politica de custo usa zero chamadas de modelo', () => {
    const policy = ecEngagementReplyPolicy();
    assert.equal(policy.modelCallsPerDecision, 0);
    assert.equal(policy.estimatedCostUsdPerDecision, 0);
    assert.equal(policy.noOutboundInitiation, true);
    assert.equal(policy.noBulkDispatch, true);
});

test('22. painel contem quatro filas e seletor manual sem preview de mensagem', () => {
    const panel = fs.readFileSync(path.join(root, 'public', 'qr.html'), 'utf8');
    for (const value of ['attendance', 'engagement', 'orders', 'review']) {
        assert.match(panel, new RegExp(`data-operational-bucket="${value}"`));
    }
    assert.match(panel, /id="conversationBucketSelect"/);
    assert.doesNotMatch(panel, /chat-preview[\s\S]{0,500}lastMessage\.body/);
});

test('23. comandos internos, persistencia e roteamento nao enviam aquecimento ao funil comercial', () => {
    const routes = fs.readFileSync(path.join(root, 'src', 'routes', 'whatsapp.js'), 'utf8');
    const zapi = fs.readFileSync(path.join(root, 'src', 'routes', 'zapi.js'), 'utf8');
    const model = fs.readFileSync(path.join(root, 'src', 'models', 'ContactState.js'), 'utf8');
    assert.match(routes, /handled:\s*'warmup_panel_command'/);
    assert.match(routes, /setEcConversationBucketManually/);
    assert.match(model, /conversationBucket/);
    assert.match(model, /replyLockUntil/);
    assert.match(model, /replyHistory/);
    assert.match(zapi, /conversationBucket !== EC_CONVERSATION_BUCKETS\.ENGAGEMENT/);
    assert.match(zapi, /conversationBucket !== EC_CONVERSATION_BUCKETS\.REVIEW/);
});

test('24. projecao do painel preserva PEDIDOS como obrigacao independente', () => {
    const projected = conversationBucketPanelView(state({ conversationBucket: { value: 'engagement' } }), { hasOperationalOrder: true });
    assert.equal(projected.value, EC_CONVERSATION_BUCKETS.ORDERS);
});
