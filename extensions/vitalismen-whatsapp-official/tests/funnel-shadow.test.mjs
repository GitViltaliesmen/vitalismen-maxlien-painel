import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../funnel-shadow.js', import.meta.url), 'utf8');
const context = { Date, console };
context.globalThis = context;
vm.runInNewContext(source, context);

const { analyze } = context.VitalismenFunnelShadow;
const now = Date.parse('2026-07-25T20:00:00.000Z');
const inbound = {
    body: 'Quiero información',
    isFromMe: false,
    createdAt: '2026-07-25T19:58:00.000Z'
};
const outbound = {
    body: 'Claro',
    isFromMe: true,
    createdAt: '2026-07-25T19:50:00.000Z'
};

const newLead = analyze({ messages: [outbound, inbound], now });
assert.equal(newLead.stage, 'qualificando');
assert.equal(newLead.priority, 'P1 Agora');
assert.equal(newLead.unanswered, true);

const collecting = analyze({
    draft: {
        phone: '+593999999999',
        productKey: 'vit_power_ec',
        quantity: '3',
        name: '',
        city: '',
        province: '',
        address: ''
    },
    messages: [inbound],
    now
});
assert.equal(collecting.stage, 'coleta_dados');
assert.equal(collecting.nextAction, 'Coletar somente o próximo dado faltante');
assert.ok(collecting.missing.includes('cidade'));

const ready = analyze({
    draft: {
        phone: '+593999999999',
        productKey: 'vit_power_ec',
        quantity: '3',
        total: '95.99',
        name: 'Cliente Teste',
        city: 'Manta',
        province: 'Manabi',
        address: 'Servientrega Centro',
        reference: 'Ao lado do mercado'
    },
    messages: [outbound],
    now
});
assert.equal(ready.stage, 'aguardando_confirmacao');
assert.equal(ready.priority, 'P1 Agora');
assert.equal(ready.missing.length, 0);

const confirmed = analyze({
    draft: { status: 'confirmado' },
    profile: { activeOrder: { status: 'confirmed' } },
    now
});
assert.equal(confirmed.stage, 'confirmado');

const logistics = analyze({
    profile: { activeOrder: { status: 'pedido_enviado', dropiOrderId: 'D-1' } },
    now
});
assert.equal(logistics.stage, 'logistica');

const afterSale = analyze({
    profile: { activeOrder: { status: 'delivered' } },
    now
});
assert.equal(afterSale.stage, 'pos_venda');

const blocked = analyze({
    draft: { status: 'nao_contatar' },
    now
});
assert.equal(blocked.stage, 'nao_contatar');
assert.equal(blocked.priority, 'Bloqueado');

console.log('Funnel shadow scenarios: OK');
