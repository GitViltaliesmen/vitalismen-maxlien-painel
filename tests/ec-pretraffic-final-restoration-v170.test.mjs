import '../scripts/lib/ec-runtime-successor-v170-context.mjs';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { projectPanelCustomerReadModel } from '../src/services/panelCustomerReadModelService.js';

const baseDraft = (status, extra = {}) => ({
    country: 'EC',
    name: 'Juan Pérez',
    phone: '0998038637',
    city: 'Ambato',
    province: 'Tungurahua',
    deliveryMode: 'home',
    address: 'Av. Cevallos 123',
    reference: 'Frente al parque',
    quantity: '1',
    total: '35.99',
    status,
    updatedAt: '2026-09-16T18:00:00.000Z',
    ...extra
});
const contactState = (draft) => ({
    countryCode: 'EC',
    phoneDigits: '593998038637',
    metadata: { customerDraft: draft },
    updatedAt: draft.updatedAt
});
const staleOrder = {
    orderId: 'EC-OLD-170',
    status: 'confirmed',
    customer: {
        name: 'Juan Pérez', phone: '0998038637', city: 'Ambato', province: 'Tungurahua',
        address: 'Dirección histórica', reference: 'Referencia histórica'
    },
    delivery: { mode: 'home' },
    package: { quantity: 1 },
    total: 35.99,
    updatedAt: '2026-09-15T18:00:00.000Z'
};

test('V170 persiste e recarrega os nove estados sem regressão por pedido histórico', () => {
    for (const status of [
        'novo', 'atendendo', 'comprar_depois', 'confirmado', 'pedido_enviado',
        'entregue', 'recompra', 'cancelado', 'devolvido'
    ]) {
        const projected = projectPanelCustomerReadModel({
            contactState: contactState(baseDraft(status)),
            orders: [staleOrder]
        });
        assert.equal(projected.orderStatus, status, status);
        assert.equal(projected.customerDraft.status, status, status);
    }
});

test('V170 permite somente Shipment comprovado avançar o estado atual', () => {
    const cases = [
        [{ logistics: { status: 'IN_TRANSIT', trackingNumber: 'GUIA-170' } }, 'pedido_enviado'],
        [{ logistics: { status: 'DELIVERED' }, outcomes: { delivered: true } }, 'entregue'],
        [{ logistics: { status: 'RETURNED' }, outcomes: { returned: true } }, 'devolvido']
    ];
    for (const [shipmentState, expected] of cases) {
        const shipment = {
            orderId: staleOrder.orderId,
            ...shipmentState,
            updatedAt: '2026-09-16T19:00:00.000Z'
        };
        const projected = projectPanelCustomerReadModel({
            contactState: contactState(baseDraft('atendendo')),
            orders: [staleOrder],
            shipments: [shipment]
        });
        assert.equal(projected.operationalStatus.source, 'shipment');
        assert.equal(projected.orderStatus, expected);
    }
});

test('V170 recalcula a qualidade com a ficha atual e respeita entrega em agência', () => {
    const home = projectPanelCustomerReadModel({
        contactState: contactState(baseDraft('confirmado')),
        orders: [staleOrder]
    });
    assert.equal(home.customerDataResolution.orderDataReady, true);
    assert.ok(home.customerDataResolution.qualityScore > 0);
    assert.notEqual(home.customerDataResolution.fields.name.validation_status, 'MISSING');

    const agency = projectPanelCustomerReadModel({
        contactState: contactState(baseDraft('confirmado', {
            deliveryMode: 'agency',
            agencyName: 'AMBATO_CASTILLO',
            address: '',
            reference: ''
        }))
    });
    assert.equal(agency.customerDataResolution.orderDataReady, true);
    assert.equal(agency.customerDataResolution.fields.address.validation_status, 'NOT_APPLICABLE');
    assert.equal(agency.customerDraft.address, '');
    assert.match(agency.customerDataResolution.fields.agency.agency_id, /^EC-SA-/);
});

test('V170 painel usa autoridade canônica e preserva os limites Dropi/Meta/Z-API', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const whatsapp = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const shipments = fs.readFileSync('src/routes/shipments.js', 'utf8');
    assert.match(panel, /authoritativePanelStatusForChat/);
    assert.match(panel, /setInputValue\('customerStatusInput', authoritativeStatus\)/);
    assert.match(whatsapp, /dataResolution: readModel\.customerDataResolution \|\| null/);
    assert.match(whatsapp, /awaiting_fresh_human_dropi_success_v144/);
    assert.match(shipments, /ensurePurchaseAfterHumanDropiSuccessV141/);
    assert.match(shipments, /sendPurchaseEventForOrder/);
    assert.doesNotMatch(whatsapp, /sendPurchaseEventForOrder\(order\)/);
});
