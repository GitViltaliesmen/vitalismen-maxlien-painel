import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedDeviceCanaryRecipientAllowed as allowed,
    linkedDeviceAutoReplyAllowed } from '../src/services/linkedDeviceCanaryPolicy.js';

test('linked-device canary scope admits only EC conversation text with current authority', () => {
    const base = { phoneOrJid: '593991234567@s.whatsapp.net',
        surface: 'agent_router_inbound', transport: 'baileys_text', authorityCurrent: true };
    assert.equal(allowed(base), true);
    assert.equal(allowed({ ...base, surface: 'baileys_dispatcher_inbound' }), true);
    assert.equal(allowed({ ...base, surface: 'outbound_guard_text' }), true);
    assert.equal(allowed({ ...base, surface: 'outbound_guard_audio' }), false);
    assert.equal(allowed({ ...base, surface: 'automation_recipient' }), false);
    assert.equal(allowed({ ...base, phoneOrJid: '5515998038637' }), false);
    assert.equal(allowed({ ...base, phoneOrJid: '573001234567' }), false);
    assert.equal(allowed({ ...base, transport: 'zapi' }), false);
    assert.equal(allowed({ ...base, authorityCurrent: false }), false);
});

test('automatic reply requires the same verified EC sender and exact socket context', () => {
    const base = { identifiers: ['593991234567@s.whatsapp.net'], transport: 'baileys_text',
        authorityCurrent: true, context: { method: 'SOCKET',
            path: '/internal/whatsapp/baileys-inbound',
            baileysInbound: { verified: true, senderPhoneDigits: '593991234567' } } };
    assert.equal(linkedDeviceAutoReplyAllowed(base), true);
    assert.equal(linkedDeviceAutoReplyAllowed({ ...base, identifiers: ['593991234568'] }), false);
    assert.equal(linkedDeviceAutoReplyAllowed({ ...base, authorityCurrent: false }), false);
    assert.equal(linkedDeviceAutoReplyAllowed({ ...base, transport: 'zapi' }), false);
    assert.equal(linkedDeviceAutoReplyAllowed({ ...base,
        context: { ...base.context, baileysInbound: { ...base.context.baileysInbound,
            senderPhoneDigits: '5515998038637' } } }), false);
});
