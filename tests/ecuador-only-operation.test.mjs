import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import Order from '../src/models/Order.js';
import { zapiPayloadCountry } from '../src/routes/zapi.js';
import { canSendOutbound } from '../src/whatsapp/outboundGuard.js';

const activeFiles = [
    '.env.example',
    'public/qr.html',
    'public/leads-window.html',
    'src/routes/leads.js',
    'src/routes/whatsapp.js',
    'src/routes/zapi.js',
    'src/services/adminPanelStatusService.js',
    'src/services/agentRouter.js',
    'src/services/sellerRotationService.js',
    'src/whatsapp/outboundGuard.js',
    'src/whatsapp/sessionRouter.js',
    'src/whatsapp/zapiOutboundRouting.js',
    'extensions/vitalismen-whatsapp-official/sidepanel.html',
    'extensions/vitalismen-whatsapp-official/sidepanel.js'
];

const foreignCountryCode = ['C', 'O'].join('');
const foreignPhonePrefix = ['5', '7'].join('');

test('painel e rotas ativas permanecem somente Ecuador', () => {
    for (const file of activeFiles) {
        const source = fs.readFileSync(file, 'utf8');
        assert.equal(new RegExp(`(^|[^A-Z0-9_])${foreignCountryCode}([^A-Z0-9_]|$)`, 'i').test(source), false, file);
        assert.equal(source.includes(`+${foreignPhonePrefix}`), false, file);
        assert.equal(source.includes(`startsWith('${foreignPhonePrefix}')`), false, file);
    }
});

test('modelo de pedido aceita somente Ecuador', () => {
    assert.deepEqual(Order.schema.path('country').enumValues, ['EC']);
});

test('webhook identifica Ecuador e isola origem externa', () => {
    assert.equal(zapiPayloadCountry({ from: '593997680147@c.us' }), 'EC');
    assert.equal(zapiPayloadCountry({ from: '50255501234@c.us' }), 'OTHER');
});

test('guarda de saida aceita cliente Ecuador e bloqueia destino externo', () => {
    const accepted = canSendOutbound({
        jid: '593997680147@s.whatsapp.net',
        recipientDigits: '593997680147',
        text: 'teste isolado',
        bypassDedupe: true,
        reserveDedupe: false
    });
    const blocked = canSendOutbound({
        jid: '50255501234@s.whatsapp.net',
        recipientDigits: '50255501234',
        text: 'teste isolado',
        bypassDedupe: true,
        reserveDedupe: false
    });
    assert.equal(accepted.allowed, true);
    assert.equal(blocked.allowed, false);
    assert.match(blocked.reason, /^non_ec_recipient:/);
});
