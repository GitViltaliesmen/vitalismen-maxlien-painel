import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const panel = read('public/qr.html');
const whatsapp = read('src/routes/whatsapp.js');
const shipmentMessages = read('src/services/shipmentMessageService.js');
const logistics = read('src/services/logisticsCommunicationV29.js');

assert.match(panel, /VitalismenCleanChatV29/);
assert.match(panel, /DETALHES TÉCNICOS/);
assert.match(panel, /PEDIDO AINDA NÃO ESTÁ LIBERADO PARA RETIRADA/);
assert.match(whatsapp, /providerIdentity/);
assert.match(whatsapp, /pickup_communication_blocked/);
assert.match(shipmentMessages, /blocked_until_ready_for_pickup_verified/);
assert.match(logistics, /SHIPPED/);
assert.match(logistics, /READY_FOR_PICKUP/);
assert.match(logistics, /pickupReadyVerified/);
assert.match(logistics, /allowGuideImage/);

console.log('LOGISTICS_CLEAN_CHAT_V29_GUARD=OK');
