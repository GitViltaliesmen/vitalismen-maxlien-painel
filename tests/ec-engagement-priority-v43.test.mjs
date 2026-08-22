import assert from 'node:assert/strict';
import fs from 'node:fs';
import test, { after } from 'node:test';
import vm from 'node:vm';

import {
    countEcEngagementPassiveInbound
} from '../src/services/ecConversationBucketService.js';
import {
    buildEcEngagementReplyPlan,
    ecEngagementReplyPolicy,
    nextEcEngagementPassiveBatchState
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
    fs.readFileSync('public/panel-intelligence/ec-engagement-priority-v43.js', 'utf8'),
    sandbox
);
const panelPolicy = sandbox.VitalismenEngagementPriorityV43;

const manualState = (automation = {}) => ({
    _id: 'state-v43',
    chatId: '593986247702@c.us',
    phoneDigits: '593986247702',
    conversationBucket: {
        value: 'engagement',
        manualSelectedAt: '2026-08-22T19:00:00.000Z'
    },
    metadata: { warmup: { allowed: true, blocked: false, risk: false } },
    human: { mode: 'manual' },
    engagementAutomation: automation
});

const classification = (metrics = {}) => ({
    bucket: 'engagement',
    replyEligibleByHistory: true,
    hardExclusions: [],
    currentMessageId: 'inbound-v43',
    metrics: {
        risk: false,
        optOut: false,
        commercialIntent: false,
        supportIntent: false,
        ...metrics
    }
});

const inbound = (id = 'inbound-v43', body = 'gracias') => ({
    _id: id,
    body,
    type: 'chat',
    hasMedia: false,
    isFromMe: false,
    senderRole: 'client'
});

const planFor = (automation, metrics = {}) => buildEcEngagementReplyPlan({
    state: manualState(automation),
    classification: classification(metrics),
    message: inbound(),
    now: new Date('2026-08-22T20:00:00.000Z')
});

test('V43 abre o painel com Tudo como filtro principal', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    assert.equal(panelPolicy.DEFAULT_CHAT_FILTER, 'all');
    assert.match(panel, /<button class="active" data-chat-filter="all"/);
    assert.match(panel, /chatFilter:\s*'all'/);
    assert.doesNotMatch(panel, /id="newMessagesFilterBtn" class="active"/);
});

test('V43 exclui AQUECIMENTO de Novas e mantém seu próprio contador', () => {
    const attendance = { unreadCount: 2, conversationBucket: { value: 'attendance' } };
    const engagement = { unreadCount: 3, conversationBucket: { value: 'engagement' } };
    const resolve = (chat) => chat.conversationBucket.value;
    assert.equal(panelPolicy.isNewMessagesChat(attendance, { resolveConversationBucket: resolve }), true);
    assert.equal(panelPolicy.isNewMessagesChat(engagement, { resolveConversationBucket: resolve }), false);
    assert.deepEqual(
        { ...panelPolicy.bucketUnreadCounts([attendance, engagement], resolve) },
        { attendance: 1, engagement: 1, orders: 0, review: 0 }
    );
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    assert.match(panel, /bucketEngagementUnreadCount/);
    assert.match(panel, /isNewMessagesChatForPanel/);
});

test('V43 conta cada inbound aprovado uma única vez de forma persistível', () => {
    const first = countEcEngagementPassiveInbound({
        automation: {},
        messageId: 'message-1',
        eligible: true
    });
    assert.equal(first.passiveInboundCount, 1);
    assert.equal(first.passiveReplyTarget, 2);
    assert.equal(first.counted, true);
    const duplicate = countEcEngagementPassiveInbound({
        automation: first,
        messageId: 'message-1',
        eligible: true
    });
    assert.equal(duplicate.passiveInboundCount, 1);
    assert.equal(duplicate.counted, false);
    const second = countEcEngagementPassiveInbound({
        automation: duplicate,
        messageId: 'message-2',
        eligible: true
    });
    assert.equal(second.passiveInboundCount, 2);
});

test('V43 espera duas mensagens e então envia somente 👍 local, sem modelo', () => {
    const waiting = planFor({
        passiveInboundCount: 1,
        passiveReplyTarget: 2,
        passiveReplyCycle: 0,
        passiveLastCountedMessageId: 'inbound-v43'
    });
    assert.equal(waiting.send, false);
    assert.equal(waiting.reason, 'passive_batch_wait:1/2');
    assert.equal(waiting.modelCalls, 0);

    const ready = planFor({
        passiveInboundCount: 2,
        passiveReplyTarget: 2,
        passiveReplyCycle: 0,
        passiveLastCountedMessageId: 'inbound-v43'
    });
    assert.equal(ready.send, true);
    assert.equal(ready.text, '👍');
    assert.equal(ready.category, 'passive_thumbs_up');
    assert.equal(ready.localOnly, true);
    assert.equal(ready.modelCalls, 0);
});

test('V43 alterna o próximo lote de duas para três e depois volta a duas', () => {
    const afterTwo = nextEcEngagementPassiveBatchState({ passiveReplyCycle: 0 });
    assert.deepEqual(afterTwo, {
        passiveInboundCount: 0,
        passiveReplyCycle: 1,
        passiveReplyTarget: 3
    });
    const afterThree = nextEcEngagementPassiveBatchState(afterTwo);
    assert.deepEqual(afterThree, {
        passiveInboundCount: 0,
        passiveReplyCycle: 2,
        passiveReplyTarget: 2
    });
});

test('V43 mantém comercial, suporte, risco e opt-out acima do 👍', () => {
    for (const key of ['commercialIntent', 'supportIntent', 'risk', 'optOut']) {
        const plan = planFor({
            passiveInboundCount: 3,
            passiveReplyTarget: 3,
            passiveReplyCycle: 1,
            passiveLastCountedMessageId: 'inbound-v43'
        }, { [key]: true });
        assert.equal(plan.send, false);
        assert.equal(plan.reason, 'commercial_support_or_risk');
    }
});

test('V43 mantém lock, dedupe, limite diário, debounce e custo de IA zero', () => {
    const service = fs.readFileSync('src/services/ecEngagementReplyService.js', 'utf8');
    const policy = ecEngagementReplyPolicy();
    assert.match(service, /passiveLastCountedMessageId/);
    assert.match(service, /replyHistory\.inboundMessageId/);
    assert.match(service, /replyLockUntil/);
    assert.match(service, /newer_inbound_buffered/);
    assert.match(service, /daily_reply_limit/);
    assert.match(service, /antiSpamKey/);
    assert.deepEqual(policy.passiveBatchPattern, [2, 3]);
    assert.equal(policy.passiveBatchText, '👍');
    assert.equal(policy.modelCallsPerDecision, 0);
});
