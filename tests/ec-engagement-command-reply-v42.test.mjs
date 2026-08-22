import assert from 'node:assert/strict';
import fs from 'node:fs';
import test, { after } from 'node:test';
import vm from 'node:vm';

import {
    buildEcEngagementReplyPlan,
    ecEngagementReplyPolicy
} from '../src/services/ecEngagementReplyService.js';

const originalAutoReplyFlag = process.env.EC_ENGAGEMENT_AUTO_REPLY_ENABLED;
process.env.EC_ENGAGEMENT_AUTO_REPLY_ENABLED = 'true';
after(() => {
    if (originalAutoReplyFlag === undefined) delete process.env.EC_ENGAGEMENT_AUTO_REPLY_ENABLED;
    else process.env.EC_ENGAGEMENT_AUTO_REPLY_ENABLED = originalAutoReplyFlag;
});

const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(
    fs.readFileSync('public/panel-intelligence/ec-engagement-panel-v42.js', 'utf8'),
    sandbox
);
const panelPolicy = sandbox.VitalismenEngagementPanelV42;

const classification = (extra = {}) => ({
    bucket: 'engagement',
    replyEligibleByHistory: true,
    hardExclusions: [],
    currentMessageId: 'inbound-v42',
    metrics: {
        risk: false,
        optOut: false,
        commercialIntent: false,
        supportIntent: false,
        ...extra
    }
});

const manualEngagementState = (extra = {}) => ({
    _id: 'state-v42',
    chatId: '593986247702@c.us',
    phoneDigits: '593986247702',
    conversationBucket: {
        value: 'engagement',
        manualSelectedAt: '2026-08-22T18:35:12.766Z'
    },
    metadata: {
        warmup: {
            allowed: true,
            blocked: false,
            risk: false
        }
    },
    human: { mode: 'manual' },
    engagementAutomation: {
        passiveInboundCount: 2,
        passiveReplyTarget: 2,
        passiveReplyCycle: 0
    },
    ...extra
});

const inbound = (id, body, { type = 'chat', hasMedia = false } = {}) => ({
    _id: id,
    body,
    type,
    hasMedia,
    isFromMe: false,
    senderRole: 'client'
});

const planFor = (message, state = manualEngagementState()) => buildEcEngagementReplyPlan({
    state,
    classification: classification(),
    message,
    now: new Date('2026-08-22T19:00:00.000Z')
});

test('V42 respeita o bucket persistido e não transforma ficha administrativa antiga em PEDIDOS', () => {
    const chat = {
        orderId: 'EC-ADMIN-2856',
        orderStatus: 'atendendo',
        conversationBucket: { value: 'engagement', source: 'panel_command' },
        tags: ['warmup:allowed', 'conversation:engagement']
    };
    assert.equal(panelPolicy.resolveConversationBucket(chat), 'engagement');
});

test('V42 conserva PEDIDOS quando o backend projeta uma obrigação operacional real', () => {
    assert.equal(panelPolicy.resolveConversationBucket({
        orderId: 'EC-REAL-42',
        orderStatus: 'pending',
        conversationBucket: { value: 'orders', source: 'active_order_projection' }
    }), 'orders');
    assert.equal(panelPolicy.resolveConversationBucket({
        orderId: 'EC-LEGACY-42',
        orderStatus: 'pending'
    }), 'orders');
});

test('V42 reconhece estados fechados em inglês, espanhol e português no fallback legado', () => {
    for (const status of ['delivered', 'entregado', 'entregue', 'returned', 'devuelto', 'devolvido']) {
        assert.equal(panelPolicy.resolveConversationBucket({ orderId: 'EC-CLOSED-42', orderStatus: status }), 'attendance');
    }
});

test('V42 consolida etiquetas visuais AQUECE duplicadas sem apagar tags persistidas', () => {
    const labels = panelPolicy.dedupeVisibleLabels([
        { label: 'AQUECE', className: 'warmup', source: 'manual:aquecimento_liberado' },
        { label: 'AQUECE', className: 'warmup', source: 'warmup:allowed' },
        { label: 'VSL EC', className: 'auto' }
    ]);
    assert.equal(labels.length, 2);
    assert.equal(labels.filter((item) => item.label === 'AQUECE').length, 1);
});

test('V42 responde a gracias com template local curto e sem pergunta', () => {
    const plan = planFor(inbound('thanks-v42', 'gracias'));
    assert.equal(plan.send, true);
    assert.match(plan.templateKey, /^passive_thumbs_up:/);
    assert.equal(plan.text, '👍');
    assert.doesNotMatch(plan.text, /[?¿]/);
    assert.equal(plan.localOnly, true);
    assert.equal(plan.modelCalls, 0);
});

test('V42 responde a emoji isolado somente após aprovação manual #AQUECE', () => {
    const plan = planFor(inbound('emoji-v42', '🙏'));
    assert.equal(plan.send, true);
    assert.match(plan.templateKey, /^passive_thumbs_up:/);
    assert.equal(plan.text, '👍');
    assert.doesNotMatch(plan.text, /[?¿]/);
});

test('V42 reconhece imagem, sticker e link isolados sem inspecionar conteúdo nem usar IA', () => {
    for (const message of [
        inbound('image-v42', '[image]', { type: 'image', hasMedia: true }),
        inbound('sticker-v42', '[sticker]', { type: 'sticker', hasMedia: true }),
        inbound('link-v42', 'https://example.com/contenido')
    ]) {
        const plan = planFor(message);
        assert.equal(plan.send, true);
        assert.match(plan.templateKey, /^passive_thumbs_up:/);
        assert.equal(plan.text, '👍');
        assert.doesNotMatch(plan.text, /[?¿]/);
        assert.equal(plan.modelCalls, 0);
    }
});

test('V42 não libera resposta passiva para contato não aprovado manualmente', () => {
    const automaticState = manualEngagementState({
        conversationBucket: { value: 'engagement' },
        metadata: { warmup: { allowed: false } }
    });
    const plan = planFor(inbound('link-auto-v42', 'https://example.com/x'), automaticState);
    assert.equal(plan.send, false);
    assert.match(plan.reason, /local_no_reply:link_only/);
});

test('V42 mantém as travas de pergunta comercial, suporte, risco e opt-out', () => {
    for (const blockedMetric of ['commercialIntent', 'supportIntent', 'risk', 'optOut']) {
        const plan = buildEcEngagementReplyPlan({
            state: manualEngagementState(),
            classification: classification({ [blockedMetric]: true }),
            message: inbound(`blocked-${blockedMetric}`, 'gracias'),
            now: new Date('2026-08-22T19:00:00.000Z')
        });
        assert.equal(plan.send, false);
        assert.equal(plan.reason, 'commercial_support_or_risk');
    }
});

test('V42 mantém cooldown, teto diário, lock e debounce já existentes', () => {
    const service = fs.readFileSync('src/services/ecEngagementReplyService.js', 'utf8');
    assert.match(service, /reply_cooldown/);
    assert.match(service, /daily_reply_limit/);
    assert.match(service, /replyLockUntil/);
    assert.match(service, /newer_inbound_buffered/);
    assert.match(service, /antiSpamKey/);
});

test('V42 aceita #aquece sem hash final e nunca envia o código ao cliente', () => {
    const routes = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    assert.ok(routes.includes("const withoutTrailingHash = normalized.replace(/#+$/, '');"));
    assert.ok(routes.includes('plain ? `#${plain}#`'));
    assert.match(routes, /handled:\s*'warmup_panel_command'/);
    assert.match(routes, /sent:\s*false/);
});

test('V42 está ativada no painel e declara custo de IA zero', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const policy = ecEngagementReplyPolicy();
    assert.match(panel, /ec-engagement-panel-v42\.js/);
    assert.match(panel, /VitalismenEngagementPanelV42\?\.resolveConversationBucket/);
    assert.match(panel, /VitalismenEngagementPanelV42\?\.dedupeVisibleLabels/);
    assert.equal(policy.modelCallsPerDecision, 0);
    assert.equal(policy.estimatedCostUsdPerDecision, 0);
    assert.equal(policy.manualApprovedPassiveAcknowledgements, true);
    assert.equal(policy.manualPassiveTemplatesAskQuestions, false);
});
