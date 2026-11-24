import test from 'node:test';
import assert from 'node:assert/strict';
import { ecTransportMode, ecBaileysTextMode, ecMediaAllowedForTransport } from '../src/whatsapp/ecTransportMode.js';

test('legacy transport stays selected until an explicit cutover', () => {
    assert.equal(ecTransportMode({}), 'zapi');
    assert.equal(ecBaileysTextMode({}), false);
    assert.equal(ecMediaAllowedForTransport({}), true);
});

test('text-only linked device mode requires an exact flag', () => {
    assert.equal(ecTransportMode({ EC_WHATSAPP_TRANSPORT: 'baileys_text' }), 'baileys_text');
    assert.equal(ecBaileysTextMode({ EC_WHATSAPP_TRANSPORT: 'baileys_text' }), true);
    assert.equal(ecMediaAllowedForTransport({ EC_WHATSAPP_TRANSPORT: 'baileys_text' }), false);
    assert.throws(() => ecTransportMode({ EC_WHATSAPP_TRANSPORT: 'baileys' }), /ec_whatsapp_transport_invalid/);
});
