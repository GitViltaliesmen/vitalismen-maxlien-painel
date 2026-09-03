import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import {
    isPanelWarmupIsolationQaV118,
    panelWarmupManualEngagementBlockersV118,
    panelWarmupQaReplyAllowedV118,
    shouldPreservePanelWarmupManualEngagementV118
} from '../src/services/panelWarmupIsolationV118Service.js';

const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(
    fs.readFileSync('public/panel-intelligence/panel-warmup-isolation-v118.js', 'utf8'),
    sandbox,
    { filename: 'panel-warmup-isolation-v118.js' }
);
const policy = sandbox.VitalismenPanelWarmupIsolationV118;
const resolveBucket = (chat) => chat.conversationBucket?.value;

test('V118 mantém busca e filtros normais dentro da fila selecionada', () => {
    const warmup = { conversationBucket: { value: 'engagement' } };
    const buyer = { conversationBucket: { value: 'attendance' } };
    assert.equal(policy.isChatVisibleInOperationalView({
        chat: warmup,
        conversationBucketFilter: 'attendance',
        chatFilter: 'all',
        resolveConversationBucket: resolveBucket
    }), false);
    assert.equal(policy.isChatVisibleInOperationalView({
        chat: buyer,
        conversationBucketFilter: 'attendance',
        chatFilter: 'all',
        resolveConversationBucket: resolveBucket
    }), true);
});

test('V118 mostra AQUECIMENTO somente quando sua fila é escolhida', () => {
    const warmup = { conversationBucket: { value: 'engagement' } };
    assert.equal(policy.isChatVisibleInOperationalView({
        chat: warmup,
        conversationBucketFilter: 'engagement',
        chatFilter: 'all',
        resolveConversationBucket: resolveBucket
    }), true);
    assert.equal(policy.isChatVisibleInOperationalView({
        chat: warmup,
        conversationBucketFilter: '',
        chatFilter: 'unread',
        resolveConversationBucket: resolveBucket
    }), false);
});

test('V118 remove AQUECIMENTO de métricas e equipe comerciais', () => {
    const chats = [
        { id: 'buyer', conversationBucket: { value: 'attendance' } },
        { id: 'warmup', conversationBucket: { value: 'engagement' } },
        { id: 'order', conversationBucket: { value: 'orders' } }
    ];
    assert.deepEqual(
        policy.commercialChats(chats, resolveBucket).map((chat) => chat.id),
        ['buyer', 'order']
    );
});

test('V118 oculta lead de aquecimento e preserva obrigação operacional ativa', () => {
    assert.equal(policy.shouldHideLeadFromCommercialPanel({
        status: 'atendendo',
        _ops: { hideFromBuyerPanel: true }
    }), true);
    assert.equal(policy.shouldHideLeadFromCommercialPanel({
        status: 'confirmado',
        _ops: { hideFromBuyerPanel: true, currentOrderId: 'EC-20260903-1' }
    }), false);
});

test('V118 permite somente ao QA exato a seleção visual manual sem remover bloqueios críticos', () => {
    const qa = { phoneDigits: '5515998038637' };
    const other = { phoneDigits: '593999111222' };
    assert.equal(isPanelWarmupIsolationQaV118(qa), true);
    assert.deepEqual(panelWarmupManualEngagementBlockersV118({
        state: qa,
        hardExclusions: ['protected_test_contact', 'commercial_intent', 'support_intent']
    }), []);
    assert.deepEqual(panelWarmupManualEngagementBlockersV118({
        state: qa,
        hardExclusions: ['protected_test_contact', 'safety_risk', 'active_order_obligation']
    }), ['safety_risk', 'active_order_obligation']);
    assert.deepEqual(panelWarmupManualEngagementBlockersV118({
        state: other,
        hardExclusions: ['commercial_intent']
    }), ['commercial_intent']);
    assert.equal(panelWarmupQaReplyAllowedV118(qa), false);
});

test('V118 preserva o bucket manual do QA, mas não sua resposta automática', () => {
    const state = {
        phoneDigits: '5515998038637',
        conversationBucket: {
            value: 'engagement',
            manualSelectedAt: new Date('2026-09-03T20:00:00Z')
        }
    };
    assert.equal(shouldPreservePanelWarmupManualEngagementV118({
        state,
        hardExclusions: ['protected_test_contact']
    }), true);
    assert.equal(shouldPreservePanelWarmupManualEngagementV118({
        state,
        hardExclusions: ['protected_test_contact', 'opt_out']
    }), false);
    assert.equal(panelWarmupQaReplyAllowedV118(state), false);
});

test('V118 está integrada nos dois painéis e mantém a coluna esquerda sem mensagem', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const leads = fs.readFileSync('public/leads-window.html', 'utf8');
    const shipments = fs.readFileSync('src/routes/shipments.js', 'utf8');
    assert.match(panel, /panel-warmup-isolation-v118\.js/);
    assert.match(panel, /isChatVisibleInOperationalView/);
    assert.match(panel, /commercialTotalClients/);
    assert.match(leads, /shouldHideLeadFromCommercialPanel/);
    assert.match(shipments, /hideFromBuyerPanel = true/);
    assert.doesNotMatch(panel, /chat\.lastMessage\.body[\s\S]{0,120}class="chat-preview/);
});

test('V118 mantém a movimentação QA como comando explícito, único e sem envio', () => {
    const move = fs.readFileSync('scripts/move-qa-to-engagement-v118.mjs', 'utf8');
    assert.match(move, /REPORT_ONLY/);
    assert.match(move, /VITALISMEN_V118_QA_MOVE_APPROVED/);
    assert.match(move, /5515998038637_TO_ENGAGEMENT/);
    assert.match(move, /activeEcOrders/);
    assert.doesNotMatch(move, /sendText|sendAudio|sendImage|sendVideo|submitDroppi|sendPurchaseEvent/);
});
