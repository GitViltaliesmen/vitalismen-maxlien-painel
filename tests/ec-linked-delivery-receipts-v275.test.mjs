import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { applyLinkedDeliveryReceipt } from '../src/whatsapp/linkedDeliveryReceipts.js';
import { saveLinkedRetryMessage, loadLinkedRetryMessage, pruneLinkedRetryMessages } from '../src/whatsapp/linkedRetryMessageStore.js';
import { ecTransportMode } from '../src/whatsapp/ecTransportMode.js';

const outbound = { id: 'provider-id-1', fromMe: true, remoteJid: '593991234567@s.whatsapp.net' };

test('recibos do dispositivo marcam aceito, entregue e lido sem confundir a escala Baileys', async () => {
    const saved = { provider: 'baileys', providerMessageId: outbound.id, isFromMe: true, ack: 0 };
    const model = {
        async updateMany(filter, update) {
            if (filter.providerMessageId !== saved.providerMessageId || saved.ack >= update.$set.ack) return { modifiedCount: 0 };
            Object.assign(saved, update.$set);
            return { modifiedCount: 1 };
        }
    };
    for (const [raw, expected] of [[2, 1], [3, 2], [4, 3]]) {
        const result = await applyLinkedDeliveryReceipt({ key: outbound, update: { status: raw } }, model);
        assert.equal(result.applied, true);
        assert.equal(saved.ack, expected);
    }
    assert.equal(saved.deliveryStatus, 'read');
    assert.ok(saved.deliveredAt instanceof Date);
    assert.ok(saved.readAt instanceof Date);
    assert.equal((await applyLinkedDeliveryReceipt({ key: outbound, update: { status: 3 } }, model)).applied, false);
});

test('recibos sem prova, inbound e grupos não alteram mensagens', async () => {
    const model = { updateMany() { throw new Error('não deve escrever'); } };
    assert.equal((await applyLinkedDeliveryReceipt({ key: { ...outbound, fromMe: false }, update: { status: 4 } }, model)).applied, false);
    assert.equal((await applyLinkedDeliveryReceipt({ key: { ...outbound, remoteJid: '123@g.us' }, update: { status: 4 } }, model)).applied, false);
    assert.equal((await applyLinkedDeliveryReceipt({ key: outbound, update: { status: 1 } }, model)).applied, false);
});

test('painel não confunde aceite com entrega e sinaliza erro ambíguo', () => {
    const sandbox = {};
    vm.runInNewContext(fs.readFileSync('public/panel-intelligence/delivery-status-v115.js', 'utf8'), sandbox);
    const classify = sandbox.VitalismenDeliveryStatusV115.classify;
    assert.equal(classify({ deliveryStatus: 'sent', providerStatus: 'sent', providerMessageId: outbound.id }).code, 'SENT');
    assert.equal(classify({ deliveryStatus: 'delivered', ack: 2 }).code, 'DELIVERED');
    assert.equal(classify({ deliveryStatus: 'read', ack: 3 }).code, 'READ');
    assert.equal(classify({ deliveryStatus: 'request_failed', providerMessageId: outbound.id }).code, 'UNCERTAIN');
    assert.equal(classify({ deliveryStatus: 'request_failed' }).code, 'REQUEST_FAILED');
    assert.doesNotMatch(classify({ deliveryStatus: 'local_only' }).detail, /z-?api/i);
});

test('produção só aceita o transporte do dispositivo vinculado', () => {
    assert.throws(() => ecTransportMode({ NODE_ENV: 'production' }), /ec_legacy_transport_disabled_in_production/);
    assert.throws(() => ecTransportMode({ NODE_ENV: 'production', EC_WHATSAPP_TRANSPORT: 'zapi' }), /ec_legacy_transport_disabled_in_production/);
    assert.equal(ecTransportMode({ NODE_ENV: 'production', EC_WHATSAPP_TRANSPORT: 'baileys_text' }), 'baileys_text');
});

test('repetição criptográfica recupera o conteúdo original pelo mesmo ID após nova leitura do armazenamento', async () => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ec-linked-retry-'));
    try {
        const response = { key: { id: 'wa-unique-id', fromMe: true }, message: { conversation: 'Teste local, sem envio' } };
        assert.equal(await saveLinkedRetryMessage(dir, response), true);
        const restored = await loadLinkedRetryMessage(dir, { id: response.key.id });
        assert.equal(restored?.conversation, response.message.conversation);
        assert.equal(await loadLinkedRetryMessage(dir, { id: 'outro-id' }), undefined);
        await pruneLinkedRetryMessages(dir);
        assert.equal((await loadLinkedRetryMessage(dir, { id: response.key.id }))?.conversation, response.message.conversation);
    } finally {
        await fs.promises.rm(dir, { recursive: true, force: true });
    }
});
