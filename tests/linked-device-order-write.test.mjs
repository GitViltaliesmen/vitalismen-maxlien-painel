import assert from 'node:assert/strict';
import test from 'node:test';
import { linkedDeviceOrderWriteAllowed } from '../src/services/linkedDeviceOrderWritePolicy.js';

const context = (senderPhoneDigits = '593991234567') => ({
    profile: 'EC_BOT_CORE_OPERATIONAL', writeContext: true,
    method: 'SOCKET', path: '/internal/whatsapp/baileys-inbound',
    baileysInbound: { verified: true, sessionId: '5531971862958',
        ownerPhoneDigits: '5531971862958', senderPhoneDigits, messageId: 'INBOUND-1' }
});

test('linked-device order persistence requires a verified EC customer inbound', () => {
    assert.equal(linkedDeviceOrderWriteAllowed({ context: context(), collection: 'orders', method: 'insertOne' }), true);
    assert.equal(linkedDeviceOrderWriteAllowed({ context: context(), collection: 'orders', method: 'updateOne' }), true);
    assert.equal(linkedDeviceOrderWriteAllowed({ context: context('5515998038637'), collection: 'orders', method: 'insertOne' }), false);
    assert.equal(linkedDeviceOrderWriteAllowed({ context: context(), collection: 'orders', method: 'deleteOne' }), false);
    assert.equal(linkedDeviceOrderWriteAllowed({ context: context(), collection: 'messages', method: 'insertOne' }), false);
    assert.equal(linkedDeviceOrderWriteAllowed({ context: { ...context(), writeContext: false }, collection: 'orders', method: 'insertOne' }), false);
});
