import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

const panel = await fs.readFile(new URL('../public/qr.html', import.meta.url), 'utf8');
const messageModel = await fs.readFile(new URL('../src/models/Message.js', import.meta.url), 'utf8');
const dedupeModel = await fs.readFile(new URL('../src/models/OutboundDedupe.js', import.meta.url), 'utf8');

test('módulo Conexões expõe control plane por channelId e mantém efeitos desabilitados', () => {
    for (const value of ['LEGACY_ZAPI_PRIMARY', 'WHATSAPP_WEB_DRAFT', 'channelId=', 'provider=', 'health=', 'priority=', 'weight=', 'draining=', 'session=']) {
        assert.match(panel, new RegExp(value));
    }
    for (const action of ['Health', 'Pause', 'Activate', 'Drain', 'Details', 'Pair']) {
        assert.match(panel, new RegExp(`['\"]${action}['\"]`));
    }
    assert.match(panel, /data-v152-channel-action=.*disabled/);
    assert.doesNotMatch(panel, /startConnectionSession[\s\S]{0,600}api\(`\/api\/whatsapp\/sessions/);
});

test('extensão de ledger preserva modelos existentes e cobre todos os tipos', () => {
    for (const field of ['logicalMessageId', 'channelId', 'providerMessageId', 'dedupeKey', 'queueStatus']) assert.match(messageModel, new RegExp(field));
    for (const kind of ['text', 'audio', 'image', 'video', 'document']) assert.match(dedupeModel, new RegExp(`'${kind}'`));
});

test('painel preserva módulos congelados e lista esquerda sem preview de mensagem', () => {
    for (const marker of ['id="chatList"', 'id="conversation"', 'Ficha do cliente', 'Leads Clientes', 'Dropi', 'Pos-venda']) assert.match(panel, new RegExp(marker, 'i'));
    assert.doesNotMatch(panel, /class="chat-preview meta"/);
});
