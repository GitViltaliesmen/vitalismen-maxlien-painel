import assert from 'node:assert/strict';
import test from 'node:test';
import { ZapiWhatsAppTransport } from '../src/whatsapp/transports/ZapiWhatsAppTransport.js';
import { WhatsAppWebTransport } from '../src/whatsapp/transports/WhatsAppWebTransport.js';
import { MetaCloudTransportNoop } from '../src/whatsapp/transports/MetaCloudTransportNoop.js';
import { ProviderIndependentInboundOrchestrator } from '../src/whatsapp/core/ProviderIndependentInboundOrchestrator.js';

const businessEvent = Object.freeze({
    logicalMessageId: 'v152-c0-business-event-001',
    to: '+593 99 111 2233',
    type: 'document',
    payloadReference: 'fixture://safe-document',
    contentFingerprint: 'fixture-sha256-c0'
});

const businessProjection = ({ provider: _provider, channelId: _channelId, ...event }) => event;

test('provider swap mock mantém o mesmo contrato outbound sem rede', () => {
    const client = {
        getZapiStatus: async () => ({ connected: true }),
        getZapiDevice: async () => ({ phone: '553171862958' })
    };
    const transports = [
        new ZapiWhatsAppTransport({ channelId: 'MOCK_ZAPI', client, fixtureMode: true }),
        new WhatsAppWebTransport({ channelId: 'MOCK_WEB', fixtureClient: {} }),
        new MetaCloudTransportNoop({ channelId: 'MOCK_META' })
    ];
    const normalized = transports.map((transport) => transport.normalizeOutbound(businessEvent));
    assert.deepEqual(businessProjection(normalized[0]), businessProjection(normalized[1]));
    assert.deepEqual(businessProjection(normalized[1]), businessProjection(normalized[2]));
    assert.deepEqual(normalized.map((event) => event.provider), ['ZAPI', 'WHATSAPP_WEB', 'META_CLOUD']);
    assert.deepEqual(normalized.map((event) => event.channelId), ['MOCK_ZAPI', 'MOCK_WEB', 'MOCK_META']);
    assert.equal(transports[1].networkCalls, 0);
    assert.equal(transports[2].networkCalls, 0);
});

test('inbound Z-API e Web produz o mesmo contrato de negócio', async () => {
    const zapi = new ZapiWhatsAppTransport({ channelId: 'MOCK_ZAPI', client: {}, fixtureMode: true });
    const web = new WhatsAppWebTransport({ channelId: 'MOCK_WEB', fixtureClient: {} });
    const handlers = {
        product: async ({ phone, text, type }) => ({ phone, text, type }),
        vsl: async ({ phone, text, type }) => ({ phone, text, type })
    };
    const orchestrator = new ProviderIndependentInboundOrchestrator({ handlers });
    const zapiInput = zapi.normalizeInbound({ messageId: 'z-1', phone: '593991112233', type: 'text', body: 'fixture-c0' });
    const webInput = web.normalizeInbound({ id: 'w-1', phone: '593991112233', type: 'text', text: 'fixture-c0' });
    const [zapiResult, webResult] = await Promise.all([orchestrator.evaluate(zapiInput), orchestrator.evaluate(webInput)]);
    assert.deepEqual(zapiResult.result, webResult.result);
    assert.equal(zapiResult.phone, webResult.phone);
});

test('Meta Cloud permanece contract-only, sem token e com zero chamadas', async () => {
    const meta = new MetaCloudTransportNoop({ channelId: 'MOCK_META' });
    assert.deepEqual(await meta.connect(), { active: false, noop: true, networkCalls: 0 });
    await assert.rejects(meta.sendDocument(businessEvent), { code: 'META_CLOUD_NO_NETWORK' });
    assert.equal(meta.networkCalls, 0);
    assert.equal(Object.hasOwn(meta, 'token'), false);
});
