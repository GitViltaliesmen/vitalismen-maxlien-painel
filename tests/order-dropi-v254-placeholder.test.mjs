import test from 'node:test';
import assert from 'node:assert/strict';
import Order from '../src/models/Order.js';

test('pedido com marcador de revisao V254 pode ser validado antes do hook de save', async () => {
    const order = new Order({
        country: 'EC',
        currency: 'USD',
        customer: { name: 'Cliente Exemplo', phone: '+593900000001' },
        dropiDispatchV252: {
            version: 254,
            status: 'review',
            reason: 'awaiting_customer_data_v254',
            attempts: 0
        }
    });
    await assert.doesNotReject(order.validate());
});

test('marcador de despacho V252 continua valido', async () => {
    const order = new Order({
        country: 'EC',
        currency: 'USD',
        customer: { name: 'Cliente Exemplo', phone: '+593900000001' },
        dropiDispatchV252: { version: 252, status: 'pending', attempts: 0 }
    });
    await assert.doesNotReject(order.validate());
});
