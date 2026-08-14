import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isOperationalChatStatusKey,
    resolveOperationalChatStatus
} from '../src/services/operationalChatStatusService.js';

test('ajuste manual tem prioridade sem alterar pedido ou envio', () => {
    const status = resolveOperationalChatStatus({
        contactState: {
            metadata: {
                whatsappLabelOverride: {
                    key: 'confirmado',
                    updatedAt: '2026-08-02T20:00:00.000Z',
                    updatedBy: 'operador@vitalismen.test'
                }
            }
        },
        order: { status: 'delivered' },
        shipment: { outcomes: { returned: true } }
    });
    assert.equal(status.key, 'confirmado');
    assert.equal(status.source, 'manual');
    assert.equal(status.manual, true);
});

test('logistica tem prioridade sobre pedido e ficha', () => {
    const status = resolveOperationalChatStatus({
        contactState: { metadata: { customerDraft: { status: 'confirmado' } } },
        order: { status: 'processing' },
        shipment: { logistics: { status: 'READY_FOR_PICKUP', trackingNumber: '123' } }
    });
    assert.equal(status.key, 'na_agencia');
    assert.equal(status.source, 'shipment');
});

test('terminais logisticos prevalecem e comprar depois vem da ficha', () => {
    assert.equal(resolveOperationalChatStatus({
        order: { status: 'confirmed' },
        shipment: { logistics: { status: 'DEVUELTO' } }
    }).key, 'devolvido');
    assert.equal(resolveOperationalChatStatus({
        contactState: { metadata: { customerDraft: { status: 'comprar_depois' } } }
    }).key, 'comprar_depois');
});

test('allowlist aceita somente status visuais aprovados', () => {
    assert.equal(isOperationalChatStatusKey('em_rota'), true);
    assert.equal(isOperationalChatStatusKey('na_agencia'), true);
    assert.equal(isOperationalChatStatusKey('dropi_submit'), false);
});
