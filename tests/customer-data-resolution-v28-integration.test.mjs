import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

test('V28 persiste resolucao explicita em contato e pedido', () => {
    const contact = source('../src/models/ContactState.js');
    const order = source('../src/models/Order.js');
    assert.match(contact, /customerDataResolutionSchema/);
    assert.match(contact, /orderDataReady:\s*\{\s*type:\s*Boolean/);
    assert.match(order, /delivery:\s*\{/);
    assert.match(order, /customerDataResolution:\s*\{/);
});

test('V28 duplica gate no painel e antes de qualquer Purchase de pedido', () => {
    const whatsapp = source('../src/routes/whatsapp.js');
    const orders = source('../src/routes/orders.js');
    assert.match(whatsapp, /resolve-customer-data/);
    assert.match(whatsapp, /customer_data_not_ready/);
    assert.match(whatsapp, /assertCustomerOrderDataReady\(customerDataResolution\)/);
    const purchaseGuard = orders.indexOf('assertCustomerOrderDataReady(order.customerDataResolution');
    const purchaseSend = orders.indexOf('sendPurchaseEventForOrder(order)');
    assert.ok(purchaseGuard > 0 && purchaseSend > purchaseGuard);
    assert.match(orders, /sendCustomerDataResolutionError/);
});

test('V28 painel faz preflight antes de escrever pedido e exibe qualidade', () => {
    const panel = source('../public/qr.html');
    const persist = panel.indexOf('async function persistSelectedCustomerData');
    const preview = panel.indexOf('/resolve-customer-data', persist);
    const orderPatch = panel.indexOf('/api/orders/', persist);
    assert.ok(preview > persist && orderPatch > preview);
    for (const id of [
        'customerDeliveryModeInput',
        'customerAgencyNameInput',
        'customerDataQualityScore',
        'customerDataQualityList',
        'customerDataQualityBlockers',
        'confirmCustomerNameBtn'
    ]) assert.match(panel, new RegExp(`id="${id}"`));
    assert.match(panel, /customerCorrectedFields/);
    assert.match(panel, /Corrigir separacao e confirmar nome/);
});

test('V28 transporta source_message_id do inbound ate o resolvedor Tex Ultra', () => {
    const engine = source('../src/services/conversationEngine.js');
    const funnel = source('../src/services/texUltraFunnelService.js');
    assert.match(engine, /sourceMessageId:\s*msg\.id \|\| ''/);
    assert.match(funnel, /sourceMessageId = ''/);
    assert.match(funnel, /source:\s*'explicit_label',\s*sourceMessageId/);
});
