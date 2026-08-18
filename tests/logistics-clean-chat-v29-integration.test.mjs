import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(file, 'utf8');
const panel = read('public/qr.html');
const whatsapp = read('src/routes/whatsapp.js');
const shipments = read('src/routes/shipments.js');
const shipmentMessages = read('src/services/shipmentMessageService.js');
const guideDispatcher = read('src/services/guidePrintDispatcherService.js');
const messageModel = read('src/models/Message.js');
const shipmentModel = read('src/models/Shipment.js');

test('V29 painel usa clean presentation sem apagar histórico', () => {
    assert.match(panel, /clean-chat-v29\.js/);
    assert.match(panel, /presentMessages\(visibleMessages\)/);
    assert.match(panel, /DETALHES TÉCNICOS/);
    assert.doesNotMatch(whatsapp, /deleteMany\([^)]*providerMessageId/);
});

test('V29 registro manual enriquece espelho do provider e carrega client id', () => {
    assert.match(whatsapp, /Message\.findOne\(\{[\s\S]*providerIdentity/);
    assert.match(whatsapp, /clientGeneratedId/);
    assert.match(messageModel, /senderRole/);
    assert.match(messageModel, /attendantId/);
});

test('V29 gate manual falha fechado quando não existe shipment verificável', () => {
    assert.match(whatsapp, /evaluateLogisticsOutbound\(activeShipment \|\| \{\}/);
    assert.match(whatsapp, /PEDIDO AINDA NÃO ESTÁ LIBERADO PARA RETIRADA/);
});

test('V29 painel tem avatars com fallback e identidades distintas', () => {
    assert.match(panel, /messageAvatarHtml/);
    assert.match(panel, /onerror="this\.remove\(\)"/);
    assert.match(panel, /senderRole === 'bot'/);
    assert.match(panel, /profilePictureUrl/);
});

test('V29 backend bloqueia retirada e guia visual antes do READY verificado', () => {
    const guideGeneratedFunction = shipmentMessages.match(/export const notifyShipmentGuideGenerated[\s\S]*?(?=\nexport const notifyReadyForPickup)/)?.[0] || '';
    assert.match(shipments, /pickup_ready_verification_required/);
    assert.match(shipments, /PEDIDO AINDA NÃO ESTÁ LIBERADO PARA RETIRADA/);
    assert.match(shipmentMessages, /blocked_until_ready_for_pickup_verified/);
    assert.doesNotMatch(guideGeneratedFunction, /invoiceResult/);
    assert.match(guideDispatcher, /'logistics\.pickupReadyVerified': true/);
    assert.match(shipmentModel, /pickupReadyVerified/);
    assert.match(shipmentModel, /notificationLedger/);
});

test('V29 preserva garantias V28 no wiring oficial', () => {
    assert.match(whatsapp, /resolveCustomerDataDraft/);
    assert.match(whatsapp, /assertCustomerOrderDataReady/);
    assert.match(read('src/routes/orders.js'), /customer_data_not_ready/);
    assert.match(read('package.json'), /customer-data-resolution-v28/);
});
