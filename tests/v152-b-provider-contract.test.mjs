import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { assertWhatsAppTransport, WHATSAPP_TRANSPORT_METHODS } from '../src/whatsapp/core/WhatsAppTransport.js';
import { ShadowModeGate } from '../src/whatsapp/core/ShadowModeGate.js';
import { ZapiWhatsAppTransport } from '../src/whatsapp/transports/ZapiWhatsAppTransport.js';
import { WhatsAppWebTransport } from '../src/whatsapp/transports/WhatsAppWebTransport.js';
import { MetaCloudTransportNoop } from '../src/whatsapp/transports/MetaCloudTransportNoop.js';
import { provePhoneIdentityEquivalence } from '../src/whatsapp/core/phoneIdentity.js';

const fixtures = JSON.parse(await fs.readFile(new URL('./fixtures/v152-b-provider-parity.json', import.meta.url), 'utf8'));

test('todos os transportes implementam o contrato canônico', () => {
    const client = {
        getZapiStatus: async () => ({ connected: true }),
        getZapiDevice: async () => ({ phone: '553171862958' }),
        sendZapiText: async () => ({ messageId: 'fixture' }),
        sendZapiAudio: async () => ({ messageId: 'fixture' }),
        sendZapiImage: async () => ({ messageId: 'fixture' }),
        sendZapiVideo: async () => ({ messageId: 'fixture' }),
        sendZapiDocument: async () => ({ messageId: 'fixture' })
    };
    const transports = [
        new ZapiWhatsAppTransport({ client, fixtureMode: true }),
        new WhatsAppWebTransport({ channelId: 'WA_WEB_FIXTURE', fixtureClient: {} }),
        new MetaCloudTransportNoop()
    ];
    for (const transport of transports) {
        assert.equal(assertWhatsAppTransport(transport), transport);
        for (const method of WHATSAPP_TRANSPORT_METHODS) assert.equal(typeof transport[method], 'function');
    }
    assert.equal(transports[1].library.version, '6.7.24');
});

test('gate shadow bloqueia todos os efeitos reais', async () => {
    const gate = new ShadowModeGate();
    for (const operation of ['pairing', 'outbound', 'handoff', 'provider_switch', 'routing']) {
        assert.throws(() => gate.assert(operation), { code: 'V152_B_REAL_EFFECT_BLOCKED' });
    }
    assert.deepEqual(gate.status(), {
        phase: 'V152_B', shadow: true, realPairing: false, realOutbound: false,
        realCustomerRouting: false, realHandoff: false, providerSwitch: false
    });
    const web = new WhatsAppWebTransport({ channelId: 'WA_WEB_SHADOW', gate });
    await assert.rejects(web.connect(), { code: 'V152_B_REAL_EFFECT_BLOCKED' });
    await assert.rejects(web.sendText({ phone: '1', message: 'x' }), { code: 'V152_B_REAL_EFFECT_BLOCKED' });
});

test('Meta Cloud noop nunca faz rede nem aceita envio', async () => {
    const transport = new MetaCloudTransportNoop();
    assert.equal((await transport.getHealth()).networkCalls, 0);
    await assert.rejects(transport.sendText({}), { code: 'META_CLOUD_NO_NETWORK' });
    assert.equal(transport.networkCalls, 0);
});

test('equivalência do telefone é provada por regra numérica e evidência congelada', () => {
    const proof = provePhoneIdentityEquivalence(fixtures.phoneIdentity);
    assert.equal(proof.status, 'PROVEN');
    assert.equal(proof.method, 'BR_NINTH_DIGIT_WITH_OPERATIONAL_EVIDENCE');
    assert.equal(provePhoneIdentityEquivalence({ ...fixtures.phoneIdentity, evidence: {} }).status, 'UNPROVEN');
});
