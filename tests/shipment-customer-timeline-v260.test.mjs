import test from 'node:test';
import assert from 'node:assert/strict';
import { shipmentCustomerTimelineEvents } from '../src/services/shipmentCustomerTimelineService.js';

test('linha do tempo mostra somente mudanças logísticas persistidas do pedido', () => {
    const events = shipmentCustomerTimelineEvents([{
        orderId: 'EC-TESTE',
        events: [
            { kind: 'shipment_lifecycle_status_applied', at: '2026-11-22T10:00:00Z',
                payload: { canonicalStatus: 'GUIDE_CREATED', trackingNumber: 'GUIA-123' } },
            { kind: 'shipment_lifecycle_status_applied', at: '2026-11-22T11:00:00Z',
                payload: { canonicalStatus: 'IN_TRANSIT', trackingNumber: 'GUIA-123' } },
            { kind: 'shipment_dispatch_attempt', at: '2026-11-22T12:00:00Z',
                payload: { action: 'guide', success: false } },
            { kind: 'guia_notified', at: '2026-11-22T12:10:00Z',
                payload: { primaryTextSent: true, trackingNumber: 'GUIA-123' } },
            { kind: 'shipment_lifecycle_status_applied', at: '2026-11-22T13:00:00Z',
                payload: { canonicalStatus: 'UNKNOWN' } }
        ]
    }]);
    assert.equal(events.length, 3);
    assert.equal(events[0].label, 'Guia gerada · ainda não retirar');
    assert.match(events[0].detail, /EC-TESTE.*GUIA-123/);
    assert.equal(events[1].label, 'Em trânsito');
    assert.equal(events[2].label, 'Aviso de guia enviado pelo WhatsApp');
    assert.equal(events.some((event) => event.label === 'Aviso de guia enviado pelo WhatsApp'), true);
});

test('sem evento persistido não inventa movimentação nem aviso', () => {
    assert.deepEqual(shipmentCustomerTimelineEvents([{ orderId: 'EC-TESTE', logistics: { status: 'GUIA_GENERADA' } }]), []);
});
