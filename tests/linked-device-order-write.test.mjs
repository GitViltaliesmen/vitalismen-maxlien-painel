import assert from 'node:assert/strict';
import test from 'node:test';
import { linkedDeviceOrderWriteAllowed } from '../src/services/linkedDeviceOrderWritePolicy.js';

const context = (senderPhoneDigits = '593991234567') => ({
    profile: 'EC_BOT_CORE_OPERATIONAL', writeContext: true,
    method: 'SOCKET', path: '/internal/whatsapp/baileys-inbound',
    baileysInbound: { verified: true, sessionId: '5531971862958',
        ownerPhoneDigits: '553171862958', senderPhoneDigits, messageId: 'INBOUND-1' }
});

test('linked-device order persistence requires a verified EC customer inbound', () => {
    assert.equal(linkedDeviceOrderWriteAllowed({ context: context(), collection: 'orders', method: 'insertOne' }), true);
    assert.equal(linkedDeviceOrderWriteAllowed({ context: context(), collection: 'orders', method: 'updateOne' }), true);
    assert.equal(linkedDeviceOrderWriteAllowed({ context: context('5515998038637'), collection: 'orders', method: 'insertOne' }), false);
    assert.equal(linkedDeviceOrderWriteAllowed({ context: context(), collection: 'orders', method: 'deleteOne' }), false);
    assert.equal(linkedDeviceOrderWriteAllowed({ context: context(), collection: 'messages', method: 'insertOne' }), false);
    assert.equal(linkedDeviceOrderWriteAllowed({ context: { ...context(), writeContext: false }, collection: 'orders', method: 'insertOne' }), false);
});

test('order write follows the approved phone generation and excludes a pending replacement', () => {
    const binding = { version: 1, channelId: 'EC_PRIMARY', legacySessionId: '5531971862958',
        generation: 2, active: { ownerPhoneDigits: '593991111111', approvedAt: new Date().toISOString() },
        pending: { ownerPhoneDigits: '593992222222', stagedAt: new Date().toISOString() }, history: [] };
    const approved = context();
    approved.baileysInbound.ownerPhoneDigits = binding.active.ownerPhoneDigits;
    const staged = context();
    staged.baileysInbound.ownerPhoneDigits = binding.pending.ownerPhoneDigits;
    assert.equal(linkedDeviceOrderWriteAllowed({ context: approved, collection: 'orders', method: 'insertOne', binding }), true);
    assert.equal(linkedDeviceOrderWriteAllowed({ context: staged, collection: 'orders', method: 'insertOne', binding }), false);
    assert.equal(linkedDeviceOrderWriteAllowed({ context: context(), collection: 'orders', method: 'insertOne', binding }), false);
});
