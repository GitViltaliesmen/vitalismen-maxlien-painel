import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    deliveredRepurchaseRegistrationDecision
} from '../src/services/ecDeliveredRepurchaseService.js';

const previousOrder = {
    orderId: 'EC-DROPI-ANTERIOR',
    country: 'EC',
    status: 'delivered',
    customer: { phone: '+593990000001' },
    updatedAt: '2026-08-20T12:00:00.000Z'
};

test('V99 cria identidade EC-RECOMPRA sem reutilizar o pedido entregue', () => {
    const decision = deliveredRepurchaseRegistrationDecision({
        authenticated: true,
        currentOrder: previousOrder,
        currentShipment: {
            logistics: { status: 'ENTREGADO' },
            outcomes: { delivered: true }
        },
        newCustomerPhone: '0990000001',
        now: () => 1_777_000_000_000,
        random: () => 0.123456
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.repurchase, true);
    assert.equal(decision.reused, false);
    assert.match(decision.orderId, /^EC-RECOMPRA-/);
    assert.notEqual(decision.orderId, previousOrder.orderId);
    assert.equal(decision.previousOrderId, previousOrder.orderId);
    assert.equal(decision.entryReason, 'repeat_purchase_after_delivered');
});

test('V99 reaproveita somente a recompra ativa do mesmo ciclo', () => {
    const decision = deliveredRepurchaseRegistrationDecision({
        authenticated: true,
        currentOrder: previousOrder,
        currentShipment: { logistics: { status: 'ENTREGADO' } },
        activeRepurchase: {
            orderId: 'EC-RECOMPRA-JA-REGISTRADA',
            previousOrderId: previousOrder.orderId,
            entryReason: 'repeat_purchase_after_delivered'
        },
        newCustomerPhone: '+593990000001'
    });

    assert.equal(decision.reused, true);
    assert.equal(decision.orderId, 'EC-RECOMPRA-JA-REGISTRADA');
});

test('V99 mantém autenticação e identidade do cliente como travas', () => {
    assert.equal(deliveredRepurchaseRegistrationDecision({
        authenticated: false,
        currentOrder: previousOrder,
        currentShipment: { logistics: { status: 'ENTREGADO' } },
        newCustomerPhone: '+593990000001'
    }).reason, 'repurchase_requires_panel_auth');

    assert.equal(deliveredRepurchaseRegistrationDecision({
        authenticated: true,
        currentOrder: previousOrder,
        currentShipment: { logistics: { status: 'ENTREGADO' } },
        newCustomerPhone: '+593999999999'
    }).reason, 'repurchase_customer_mismatch');
});

test('V99 liga a rota ausente, atualiza a ficha e não autoriza nem envia Dropi', () => {
    const shipments = fs.readFileSync('src/routes/shipments.js', 'utf8');
    const whatsapp = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const routeStart = shipments.indexOf("router.post('/droppi/ec/admin-leads/:leadId/stage-confirmed'");
    const routeEnd = shipments.indexOf("router.post('/droppi/ec/admin-leads/:leadId/configure-order'", routeStart);
    const stageRoute = shipments.slice(routeStart, routeEnd);
    const helperStart = shipments.indexOf('const stageConfirmedAdminLeadOrder = async');
    const helperEnd = shipments.indexOf('\nconst appendAuditNote', helperStart);
    const stageHelper = shipments.slice(helperStart, helperEnd);

    assert.ok(routeStart >= 0, 'rota stage-confirmed deve existir');
    assert.match(stageRoute, /authorizationRequired: true/);
    assert.match(stageRoute, /dropiAuthorized: false/);
    assert.match(stageRoute, /dropiSubmitted: false/);
    assert.doesNotMatch(stageRoute, /submitDroppiEcuadorOrder|authorize-submit|dispatch\/run/);
    assert.match(stageHelper, /previousOrderId: decision\.previousOrderId/);
    assert.match(stageHelper, /currentNegotiationOrderId: order\.orderId/);
    assert.doesNotMatch(stageHelper, /dropiSubmitAuthorizedAt|submittedToDroppiAt|submitDroppiEcuadorOrder/);

    const syncStart = whatsapp.indexOf('const ensureOperationalOrderForConfirmedDraft = async');
    const syncEnd = whatsapp.indexOf('\nconst scopedContactQuery', syncStart);
    const sync = whatsapp.slice(syncStart, syncEnd);
    assert.match(sync, /if \(lifecycle\.delivered\)/);
    assert.match(sync, /new Order\(\{[\s\S]*orderId: repurchaseDecision\.orderId/);
    assert.match(whatsapp, /if \(operationalOrderSync\.repurchase\)[\s\S]*currentNegotiationOrderId = operationalOrderSync\.orderId/);
    assert.doesNotMatch(`${shipments}\n${whatsapp}`, /990086509/);
});
