import test from 'node:test';
import assert from 'node:assert/strict';
import {
    adminStatusForLogisticsStatus,
    orderStatusForLogisticsStatus
} from '../src/services/shipmentLifecycleStatusService.js';

test('NOVEDAD continua enviado no painel e permanece shipped no pedido', () => {
    assert.equal(orderStatusForLogisticsStatus('NOVEDAD'), 'shipped');
    assert.equal(adminStatusForLogisticsStatus('NOVEDAD'), 'shipped');
});

test('demais estados finais preservam o mapeamento existente', () => {
    assert.equal(adminStatusForLogisticsStatus('ENTREGADO'), 'delivered');
    assert.equal(adminStatusForLogisticsStatus('DEVUELTO'), 'returned');
});
