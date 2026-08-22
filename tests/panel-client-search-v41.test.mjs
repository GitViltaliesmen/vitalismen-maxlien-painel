import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import './ec-engagement-command-reply-v42.test.mjs';
import './ec-engagement-priority-v43.test.mjs';
import './panel-global-new-messages-v44.test.mjs';
import './ec-delivered-repurchase-v45.test.mjs';
import './ec-repurchase-sync-preservation-v46.test.mjs';
import './ec-repurchase-sqlite-serialization-v47.test.mjs';

const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync('public/panel-intelligence/chat-search-v41.js', 'utf8'), sandbox);
const search = sandbox.VitalismenChatSearchV41;

const target = {
    id: '593999123272@c.us',
    phone: '+593 999 123 272',
    name: 'José Cliente',
    customerDraft: { name: 'José Cliente', phone: '+593999123272' },
    lastMessage: { body: 'Hola' },
    orderId: 'EC-SYNTHETIC-41',
    tags: ['manual:atendimento_iniciado']
};

const unrelated = {
    id: '593999888111@c.us',
    phone: '+593999888111',
    name: 'Outra Pessoa',
    lastMessage: { body: 'O código citado foi 3272' },
    orderId: 'EC-3272',
    tags: ['manual:3272']
};

test('V41 encontra cliente pelo final do telefone e exclui coincidências de mensagem/pedido', () => {
    assert.equal(search.matchesChat(target, '3272'), true);
    assert.equal(search.matchesChat(unrelated, '3272'), false);
});

test('V41 encontra telefone completo com formatação internacional', () => {
    assert.equal(search.matchesChat(target, '+593 999 123 272'), true);
    assert.equal(search.matchesChat(unrelated, '+593 999 123 272'), false);
});

test('V41 reconhece formato local e internacional do mesmo telefone EC', () => {
    assert.equal(search.matchesChat(target, '0999123272'), true);
    assert.equal(search.matchesChat(target, '999123272'), true);
});

test('V41 encontra nome sem depender de maiúsculas ou acentos', () => {
    assert.equal(search.matchesChat(target, 'jose cliente'), true);
    assert.equal(search.matchesChat(unrelated, 'jose cliente'), false);
});

test('V41 não procura nome no texto da última mensagem', () => {
    assert.equal(search.matchesChat({ ...unrelated, lastMessage: { body: 'José Cliente' } }, 'jose cliente'), false);
});

test('V41 evita lista ampla com apenas um ou dois dígitos', () => {
    assert.equal(search.queryDescriptor('27').kind, 'phone_too_short');
    assert.equal(search.matchesChat(target, '27'), false);
    assert.match(search.emptyStateMessage('27'), /pelo menos 3 dígitos/);
});

test('V41 considera busca ativa para o painel ignorar filtros de fila e não lidas', () => {
    assert.equal(search.isSearchActive('3272'), true);
    assert.equal(search.isSearchActive('José'), true);
    assert.equal(search.isSearchActive('   '), false);
});

test('V41 painel usa somente busca de identidade e preserva lista sem mensagem', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    assert.match(panel, /chat-search-v41\.js/);
    assert.match(panel, /VitalismenChatSearchV41\?\.matchesChat/);
    assert.match(panel, /shouldApplyOperationalBucketFilter/);
    assert.match(panel, /applyOperationalBucketFilter && chatConversationBucket\(chat\)/);
    assert.match(panel, /!searchActive && state\.chatFilter === 'unread'/);
    assert.doesNotMatch(panel, /const haystack = \[[\s\S]{0,300}chat\.lastMessage\?\.body/);
    assert.doesNotMatch(panel, /chat\.lastMessage\.body[\s\S]{0,120}class="chat-preview/);
});
