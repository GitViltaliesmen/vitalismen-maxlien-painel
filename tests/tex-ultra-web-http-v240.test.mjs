import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = process.env.TEX_TEST_RELEASE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert(root?.startsWith('/opt/vitalismen-automacao/')); 
const load = name => import(pathToFileURL(path.join(root, 'src/services', name)));
process.env.VITALISMEN_WEB_ELEVENLABS_API_KEY = 'ISOLATED_VOICE_FIXTURE';
process.env.OPENAI_API_KEY = 'OFFLINE_NO_NETWORK';
process.env.OPENAI_MODEL = 'isolated-no-network-model';
const { createVitPowerWebChatHandlerV220 } = await load('vitPowerWebChatV220Application.js');
const { createVitPowerWebStoreV220 } = await load('vitPowerWebStoreV220Service.js');
const { createVitPowerWebAgentV220 } = await load('vitPowerWebAgentV220Service.js');
const { getEcuadorOffer } = await load('ecuadorProductService.js');
const { TEX_ULTRA_WEB_V240 } = await load('texUltraWebFunnelV240Service.js');

test('actual HTTP handler: trusted identity, isolated cookies, idempotency, voice ownership and legacy behavior', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tex-v240-http-'));
  const originalFetch = globalThis.fetch; let voiceCalls = 0;
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/qHkrJuifPpn95wK3rm2A\?/);
    const body = JSON.parse(options.body); assert.equal(body.language_code, 'es'); assert.equal(body.model_id, 'eleven_multilingual_v2');
    assert.match(body.text, /Tex Ultra/); assert.doesNotMatch(body.text, /Vit Power/); voiceCalls++;
    return new Response(Buffer.alloc(160, 1), { headers: { 'content-type': 'audio/mpeg' } });
  };
  const store = createVitPowerWebStoreV220({ directory, minFreeBytes: 0 });
  const handler = createVitPowerWebChatHandlerV220({ store, authority: () => ({ requestAllowed: req => req.headers['x-test-authorized'] === 'yes', productForRequest: req => req.headers['x-test-product'] || 'vit_power_ec' }), agent: { reply: async () => ({ reply: 'Legacy Vit Power', draft: {} }) } });
  const server = http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk); req.body = JSON.parse(Buffer.concat(chunks) || '{}');
      req.is = value => req.headers['content-type'] === value;
      res.status = value => { res.statusCode = value; return res; }; res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); }; res.send = value => res.end(value);
      await handler(req, res);
    } catch (error) { res.statusCode = 500; res.end(error.message); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = 'http://127.0.0.1:' + server.address().port + '/api/web-chat/vitpower';
  let n = 10;
  async function request(body, { product = 'tex_ultra_ec', cookie = '', authorized = true, type = 'application/json' } = {}) {
    const response = await originalFetch(endpoint, { method: 'POST', headers: { 'content-type': type, 'x-test-authorized': authorized ? 'yes' : 'no', 'x-test-product': product, 'x-vitalismen-chat-ip': '192.0.2.' + n++, cookie }, body: JSON.stringify(body) });
    return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers, body: response.headers.get('content-type')?.startsWith('audio/') ? Buffer.from(await response.arrayBuffer()) : await response.json() };
  }
  try {
    assert.equal((await request({ action: 'start' }, { authorized: false })).status, 403);
    assert.equal((await request({ action: 'start' }, { product: 'foreign' })).status, 403);
    assert.equal((await request({ action: 'start', productKey: 'vit_power_ec' })).status, 400);
    assert.equal((await request({ action: 'start' }, { type: 'text/plain' })).status, 415);
    const tex = await request({ action: 'start' }), vp = await request({ action: 'start' }, { product: 'vit_power_ec' });
    assert.equal(tex.body.identity.productKey, 'tex_ultra_ec'); assert.equal(tex.body.identity.sourcePath, '/tex'); assert.match(tex.cookie, /^__Host-texchat-v240=/);
    assert.match(tex.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Lax/); assert.equal(tex.headers.get('cache-control'), 'no-store');
    assert.match(vp.cookie, /^__Host-vpchat-v220=/); assert.equal(vp.body.identity, undefined);
    const choice = { action: 'message', requestId: 'http_tex_quantity_001', message: 'dos frascos' };
    const first = await request(choice, { cookie: tex.cookie }); assert.equal(first.body.ok, true); assert.match(first.body.reply, /2 frascos.*Tex Ultra Ecuador: USD 70.00/);
    const duplicate = await request(choice, { cookie: tex.cookie }); assert.equal(duplicate.body.duplicate, true); assert.equal(duplicate.body.reply, first.body.reply);
    assert.equal((await request({ ...choice, message: '3 frascos' }, { cookie: tex.cookie })).status, 409);
    const other = await request({ action: 'start' });
    assert.equal((await request({ action: 'voice', requestId: choice.requestId }, { cookie: other.cookie })).status, 503);
    assert.equal(voiceCalls, 0);
    const welcomeVoice = await request({ action: 'voice', requestId: 'welcome_ana_lopez_v231' }, { cookie: tex.cookie }); assert.equal(welcomeVoice.status, 200); assert.equal(welcomeVoice.body.length, 160); assert.equal(voiceCalls, 1);
    assert.equal((await request({ action: 'voice', requestId: 'welcome_ana_lopez_v231' }, { cookie: tex.cookie })).status, 200); assert.equal(voiceCalls, 1);
    const swappedCookie = tex.cookie.replace('__Host-texchat-v240', '__Host-vpchat-v220');
    const reopenedVp = await request({ action: 'start' }, { cookie: swappedCookie, product: 'vit_power_ec' }); assert.deepEqual(reopenedVp.body.history, []); assert.notEqual(reopenedVp.cookie, swappedCookie);
    const legacy = await request({ action: 'message', requestId: 'http_vp_legacy_001', message: 'hola' }, { cookie: vp.cookie, product: 'vit_power_ec' }); assert.equal(legacy.body.reply, 'Legacy Vit Power');
    const resumed = await request({ action: 'start' }, { cookie: tex.cookie }); assert.equal(resumed.body.history.length, 2); assert.match(resumed.body.history[1].content, /Tex Ultra/);
    const order = await request({ action: 'order_status', requestId: 'http_order_001' }, { cookie: tex.cookie }); assert.equal(order.status, 403);
    const close = await request({ action: 'message', requestId: 'http_tex_yes_001', message: 'sí' }, { cookie: tex.cookie }); assert.equal(close.body.handoff, true); assert.match(close.body.reply, /Todavía no se ha registrado un pedido/);
  } finally {
    globalThis.fetch = originalFetch; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(directory, { recursive: true, force: true });
  }
});

test('a general Tex price question reads all four official offers without selecting quantity or importing the Vit Power prompt', async () => {
  let modelCalls = 0; const quantities = [];
  const agent = createVitPowerWebAgentV220({ productKey: 'tex_ultra_ec', productName: 'Tex Ultra Ecuador', quantities: [1, 2, 3, 6], productPrompt: TEX_ULTRA_WEB_V240.prompt,
    complete: async ({ messages }) => { modelCalls++; assert.equal(messages[0].content, TEX_ULTRA_WEB_V240.prompt); return { role: 'assistant', content: 'Consultaré los precios oficiales.' }; },
    products: async () => ({ ok: true }), offer: async quantity => { quantities.push(quantity); return { ...getEcuadorOffer({ productKey: 'tex_ultra_ec', quantity, priceCatalog: 'promotional' }), ok: true, verified: true, source: 'ecuadorProductService.promotional', currency: 'USD' }; }, productInformation: async () => ({ ok: false }), policy: async () => ({ ok: false }) });
  const result = await agent.reply({ text: '¿Cuánto cuesta?' });
  assert.equal(modelCalls, 1); assert.deepEqual(quantities, [1, 2, 3, 6]); assert.equal(result.draft.quantity, undefined);
  for (const price of ['35.99', '70.00', '80.99', '147.99']) assert(result.reply.includes(price), result.reply);
  assert.doesNotMatch(result.reply, /Vit Power/);
});
