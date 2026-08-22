import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    buildDeliveredRepurchaseOrderId,
    panelOrderLifecycle,
    repurchaseOrderCreationPolicy,
    terminalStatusFromShipment
} from '../src/services/ecDeliveredRepurchaseService.js';

const deliveredShipment = (overrides = {}) => ({
    orderId: 'EC-ANTERIOR-1956',
    logistics: {
        status: 'ENTREGADO',
        lastStatusAt: '2026-07-20T16:00:00.000Z'
    },
    outcomes: {
        delivered: true,
        pickedUp: true
    },
    ...overrides
});

const previousOrder = (overrides = {}) => ({
    orderId: 'EC-ANTERIOR-1956',
    country: 'EC',
    status: 'confirmed',
    customer: { phone: '+593997651956' },
    ...overrides
});

test('V45 trata Shipment ENTREGADO como histórico mesmo se o Order antigo ficou confirmed', () => {
    const lifecycle = panelOrderLifecycle({
        order: previousOrder(),
        shipment: deliveredShipment()
    });

    assert.equal(terminalStatusFromShipment(deliveredShipment()), 'delivered');
    assert.equal(lifecycle.effectiveStatus, 'delivered');
    assert.equal(lifecycle.historical, true);
    assert.equal(lifecycle.historicalOrderId, 'EC-ANTERIOR-1956');
    assert.equal(lifecycle.hasOperationalOrder, false);
    assert.equal(lifecycle.delivered, true);
});

test('V45 autoriza recompra somente com painel autenticado, mesmo telefone e entrega comprovada', () => {
    const allowed = repurchaseOrderCreationPolicy({
        authenticated: true,
        previousOrder: previousOrder(),
        previousShipment: deliveredShipment(),
        newCustomerPhone: '0997651956'
    });
    assert.equal(allowed.allowed, true);
    assert.equal(allowed.previousOrderId, 'EC-ANTERIOR-1956');
    assert.equal(allowed.entryReason, 'repeat_purchase_after_delivered');

    assert.equal(repurchaseOrderCreationPolicy({
        authenticated: false,
        previousOrder: previousOrder(),
        previousShipment: deliveredShipment(),
        newCustomerPhone: '+593997651956'
    }).reason, 'repurchase_requires_panel_auth');

    assert.equal(repurchaseOrderCreationPolicy({
        authenticated: true,
        previousOrder: previousOrder(),
        previousShipment: deliveredShipment(),
        newCustomerPhone: '+593999999999'
    }).reason, 'repurchase_customer_mismatch');

    assert.equal(repurchaseOrderCreationPolicy({
        authenticated: true,
        previousOrder: previousOrder(),
        previousShipment: { logistics: { status: 'EN_RUTA' } },
        newCustomerPhone: '+593997651956'
    }).reason, 'previous_order_not_delivered');
});

test('V45 gera identidade própria EC-RECOMPRA sem reaproveitar o pedido anterior', () => {
    const orderId = buildDeliveredRepurchaseOrderId(() => 1_777_000_000_000, () => 0.123456);
    assert.match(orderId, /^EC-RECOMPRA-[A-Z0-9]+-[A-Z0-9]{4}$/);
    assert.notEqual(orderId, 'EC-ANTERIOR-1956');
});

test('V45 integra projeção, painel, criação e sincronização sem autorizar Dropi', () => {
    const whatsapp = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const orders = fs.readFileSync('src/routes/orders.js', 'utf8');
    const admin = fs.readFileSync('src/services/adminPanelStatusService.js', 'utf8');

    assert.match(whatsapp, /panelOrderLifecycle\(\{/);
    assert.match(whatsapp, /historicalOrderId: orderLifecycle\.historicalOrderId/);
    assert.match(whatsapp, /hasOperationalOrder: orderLifecycle\.hasOperationalOrder/);
    assert.match(panel, /projectedHistoricalOrderId/);
    assert.match(panel, /orderPayload\.previousOrderId = historicalOrderId/);
    assert.match(orders, /repurchaseOrderCreationPolicy\(\{/);
    assert.match(orders, /orderId: repurchaseContext \? buildDeliveredRepurchaseOrderId\(\) : undefined/);
    assert.match(orders, /entryReason: repurchaseContext\?\.entryReason \|\| 'new_purchase'/);
    assert.match(orders, /previousDeliveredAt: repurchaseContext\?\.previousDeliveredAt \|\| null/);
    assert.match(admin, /repurchase_cycle/);
    assert.match(admin, /old in \{"entregue", "recompra"\} and new in \{"confirmado", "pedido_enviado", "enviado"\}/);

    const createStart = orders.indexOf("router.post('/', optionalPanelAuth");
    const createEnd = orders.indexOf('// GET /api/orders/:id', createStart);
    const createRoute = orders.slice(createStart, createEnd > createStart ? createEnd : undefined);
    assert.doesNotMatch(createRoute, /authorize-submit|dispatch\/run|submitToDroppi|sendDroppi/);
});

test('V45 preserva a V44: AQUECIMENTO fica fora de Novas e comercial continua prioritário', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const v44 = fs.readFileSync('docs/PANEL_GLOBAL_NEW_MESSAGES_FREEZE_V44_20260822.md', 'utf8');
    assert.match(panel, /chatConversationBucket\(chat\) !== 'engagement'/);
    assert.match(panel, /const commercialNewChats = visibleChats\.filter\(isNewMessagesChatForPanel\)/);
    assert.match(v44, /bucket `AQUECIMENTO` continua excluído de `Novas`/);
});
