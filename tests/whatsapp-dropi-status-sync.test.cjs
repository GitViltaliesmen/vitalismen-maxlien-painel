const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const whatsappRoute = fs.readFileSync(path.join(root, 'src/routes/whatsapp.js'), 'utf8');
const dropiService = fs.readFileSync(
    path.join(root, 'src/services/droppiEcuadorBrowserService.js'),
    'utf8'
);

assert.match(
    whatsappRoute,
    /const statusMismatch = Boolean\(order\?\.status\)[\s\S]*productMismatch \|\| orderMismatch \|\| statusMismatch/,
    'a ficha persistida deve acompanhar o status autoritativo do pedido'
);
assert.match(
    whatsappRoute,
    /const preserveExistingOrderStatus = \[[\s\S]*'processing'[\s\S]*'delivered'[\s\S]*'returned'[\s\S]*status: preserveExistingOrderStatus \? order\.status : 'confirmed'/,
    'salvar uma ficha antiga como confirmado nao pode regredir pedido ja enviado'
);
assert.match(
    dropiService,
    /'metadata\.customerDraft\.status': 'pedido_enviado'/,
    'o envio Dropi confirmado deve atualizar imediatamente a ficha WhatsApp'
);

console.log('whatsapp-dropi-status-sync: ok');
