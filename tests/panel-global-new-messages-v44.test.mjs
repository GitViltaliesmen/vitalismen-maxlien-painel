import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(
    fs.readFileSync('public/panel-intelligence/panel-global-new-messages-v44.js', 'utf8'),
    sandbox
);
const policy = sandbox.VitalismenGlobalNewMessagesV44;

test('V44 abre Novas como visão global sem fila operacional ativa', () => {
    assert.deepEqual(
        { ...policy.messageFilterState({ filter: 'unread', conversationBucketFilter: 'attendance' }) },
        { chatFilter: 'unread', conversationBucketFilter: '' }
    );
    assert.equal(policy.shouldApplyOperationalBucketFilter({
        searchActive: false,
        chatFilter: 'unread',
        conversationBucketFilter: 'attendance'
    }), false);
});

test('V44 restaura ATENDIMENTO ao sair da visão global para Tudo', () => {
    assert.deepEqual(
        { ...policy.messageFilterState({ filter: 'all', conversationBucketFilter: '' }) },
        { chatFilter: 'all', conversationBucketFilter: 'attendance' }
    );
});

test('V44 preserva a fila explicitamente escolhida nos filtros auxiliares', () => {
    assert.deepEqual(
        { ...policy.messageFilterState({ filter: 'favorites', conversationBucketFilter: 'orders' }) },
        { chatFilter: 'favorites', conversationBucketFilter: 'orders' }
    );
    assert.equal(policy.shouldApplyOperationalBucketFilter({
        searchActive: false,
        chatFilter: 'favorites',
        conversationBucketFilter: 'orders'
    }), true);
});

test('V44 mantém a busca de identidade acima das filas', () => {
    assert.equal(policy.shouldApplyOperationalBucketFilter({
        searchActive: true,
        chatFilter: 'all',
        conversationBucketFilter: 'review'
    }), false);
});

test('V44 alinha o clique e a renderização de Novas ao contador comercial global', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    assert.match(panel, /panel-global-new-messages-v44\.js/);
    assert.match(panel, /setPanelMessageFilter\(button\.dataset\.chatFilter\)/);
    assert.match(panel, /shouldApplyOperationalBucketFilter/);
    assert.match(panel, /const commercialNewChats = visibleChats\.filter\(isNewMessagesChatForPanel\)/);
    assert.match(panel, /state\.chatFilter === 'unread' && !isNewMessagesChatForPanel\(chat\)/);
    assert.match(panel, /applyOperationalBucketFilter && chatConversationBucket\(chat\)/);
    assert.doesNotMatch(panel, /!searchActive && state\.conversationBucketFilter && chatConversationBucket\(chat\)/);
});

test('V44 preserva AQUECIMENTO fora de Novas e sem preview na lista esquerda', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const priority = fs.readFileSync('public/panel-intelligence/ec-engagement-priority-v43.js', 'utf8');
    assert.match(priority, /if \(isEngagementChat\(chat, resolveConversationBucket\)\) return false/);
    assert.match(panel, /bucketEngagementUnreadCount/);
    assert.doesNotMatch(panel, /chat\.lastMessage\.body[\s\S]{0,120}class="chat-preview/);
});
