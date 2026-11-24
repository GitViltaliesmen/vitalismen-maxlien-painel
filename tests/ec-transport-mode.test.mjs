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

test('linked device permits media only from the authenticated EC manual panel with current authority', () => {
    const env = { EC_WHATSAPP_TRANSPORT: 'baileys_text' };
    const previous = globalThis.__VITALISMEN_EC_BAILEYS_INGRESS_V265;
    try {
        globalThis.__VITALISMEN_EC_BAILEYS_INGRESS_V265 = { isCurrent: () => true };
        const manual = { sendMode: 'manual_panel', manualPanelMediaAuthorized: true, country: 'EC' };
        assert.equal(ecMediaAllowedForTransport(env, manual), true);
        assert.equal(ecMediaAllowedForTransport(env, { ...manual, manualPanelMediaAuthorized: false }), false);
        assert.equal(ecMediaAllowedForTransport(env, { ...manual, sendMode: 'automation' }), false);
        assert.equal(ecMediaAllowedForTransport(env, { ...manual, country: 'CO' }), false);
        globalThis.__VITALISMEN_EC_BAILEYS_INGRESS_V265 = { isCurrent: () => false };
        assert.equal(ecMediaAllowedForTransport(env, manual), false);
    } finally {
        globalThis.__VITALISMEN_EC_BAILEYS_INGRESS_V265 = previous;
    }
});
