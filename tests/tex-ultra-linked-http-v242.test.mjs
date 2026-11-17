import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = process.env.TEX_TEST_RELEASE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert(root.startsWith('/opt/vitalismen-automacao/'));
const load = name => import(pathToFileURL(path.join(root, 'src/services', name)));
const { createVitPowerWebChatHandlerV220 } = await load('vitPowerWebChatV220Application.js');
const { createVitPowerWebStoreV220 } = await load('vitPowerWebStoreV220Service.js');
const { createTexUltraLinkedRuntimeV242 } = await load('texUltraLinkedRuntimeV242Service.js');
const { texLinkCodeFromMessageV242 } = await load('texUltraLinkedEntryV242Service.js');

test('actual HTTP actions require verified same-session ownership and share one entry owner with the official-inbound adapter', async () => {
  assert.notEqual(await fs.readlink('/proc/self/ns/net'), await fs.readlink('/proc/1/ns/net'));
  assert.notEqual(await fs.readlink('/proc/self/ns/mnt'), await fs.readlink('/proc/1/ns/mnt'));
  const liveCapability = globalThis.__VITALISMEN_EC_TEX_LINKED_ENTRY_V242;
  assert.equal(liveCapability.isStoreCurrent(), true); assert.equal(liveCapability.isCurrent(), false);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tex242-http-'));
  const store = createVitPowerWebStoreV220({ directory, minFreeBytes: 0 });
  const handler = createVitPowerWebChatHandlerV220({ store, authority: () => ({
    requestAllowed: req => req.headers['x-test-authorized'] === 'yes',
    productForRequest: req => req.headers['x-test-product'] || 'tex_ultra_ec', entryV242Allowed: () => true
  }), agent: { reply: async () => ({ reply: 'Legacy Vit Power', draft: {} }) } });
  let validContext = true, observedSelector;
  const clock = Date.now;
  const runtime = createTexUltraLinkedRuntimeV242({ capability: () => ({ ...liveCapability, isCurrent: () => true, activatedAt: new Date(Date.now() - 60000).toISOString() }),
    context: () => ({ method: 'POST', path: validContext ? '/api/zapi/webhook' : '/api/web-chat/vitpower', writeContext: true }),
    findInbound: async selector => { observedSelector = selector; return { _id: selector._id, timestamp: Math.floor(Date.now() / 1000) }; }, now: clock });
  const server = http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk); req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      req.is = value => req.headers['content-type'] === value;
      res.status = value => { res.statusCode = value; return res; }; res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); }; res.send = value => res.end(value);
      await handler(req, res);
    } catch (error) { res.statusCode = 500; res.end(error.message); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = 'http://127.0.0.1:' + server.address().port + '/api/web-chat/vitpower'; let count = 0;
  async function request(body, cookie = '', product = 'tex_ultra_ec') {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-authorized': 'yes', 'x-test-product': product,
      'x-vitalismen-chat-ip': '192.0.2.' + (++count), Cookie: cookie }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] || cookie };
  }
  const entry = (cookie, id) => request({ action: 'tex_entry', requestId: id }, cookie);
  const issue = (cookie, phone) => request({ action: 'link_start', requestId: 'link_request_12345', firstName: 'Juan Carlos', phone }, cookie);
  async function confirmation(challenge, phone, state = {}) {
    const text = new URL(challenge.data.verificationUrl).searchParams.get('text'); assert.ok(texLinkCodeFromMessageV242(text));
    return runtime.confirmation({ state: { ...state, phoneDigits: phone }, inboundText: text, sourceMessageId: 'fixture_authenticated_inbound_123', sessionId: 'zapi' });
  }
  try {
    const start = await request({ action: 'start' }); assert.equal(start.data.linkedEntryVersion, 242);
    const cookie = start.cookie; assert.ok(cookie.startsWith('__Host-texchat-v240='));
    assert.equal((await entry(cookie, 'entry_request_before_verify')).status, 403);
    const pending = await issue(cookie, '593990000001'); assert.equal(pending.data.verified, false);
    assert.equal(new URL(pending.data.verificationUrl).pathname, '/553171862958');
    assert.equal((await request({ action: 'link_status' }, cookie)).data.verified, false);
    assert.equal((await request({ action: 'link_start', requestId: 'link_request_fake', firstName: 'Juan', phone: '593990000001', verified: true }, cookie)).status, 400);
    assert.equal((await request({ action: 'link_confirm', message: texLinkCodeFromMessageV242(new URL(pending.data.verificationUrl).searchParams.get('text')) }, cookie)).status, 400);
    assert.equal((await confirmation(pending, '593990000002')).confirmed, false);
    validContext = false; assert.equal((await confirmation(pending, '593990000001')).confirmed, false); validContext = true;
    assert.equal((await confirmation(pending, '593990000001')).confirmed, true);
    assert.equal(observedSelector.ownerPhoneDigits, '5531971862958'); assert.equal(observedSelector.provider, 'zapi');
    const status = await request({ action: 'link_status' }, cookie); assert.equal(status.data.verified, true); assert.equal(status.data.firstChannel, 'web');
    assert.equal(Object.hasOwn(status.data, 'phone'), false);
    const result = await entry(cookie, 'entry_request_verified_1'); assert.equal(result.status, 200);
    assert.deepEqual(result.data.entryBlock.steps.map(x => x.key), ['greeting', 'intro', 'proof', 'bottle', 'offer']);
    assert.match(result.data.reply, /Hola, Juan,/); assert.doesNotMatch(result.data.reply, /Carlos/);
    assert.equal((await entry(cookie, 'entry_request_verified_1')).data.duplicate, true);
    assert.equal((await entry(cookie, 'entry_request_verified_2')).data.entryBlock, undefined);
    const reopened = await request({ action: 'start' }, cookie); assert.equal(reopened.data.entryLinked, true);
    assert.equal(reopened.data.history.filter(x => x.entryBlock).length, 1);
    const second = await request({ action: 'start' }); assert.equal((await request({ action: 'link_status' }, second.cookie)).data.verified, false);
    const secondPending = await issue(second.cookie, '593990000001'); await confirmation(secondPending, '593990000001');
    assert.equal((await entry(second.cookie, 'entry_request_second_browser')).data.entryBlock, undefined);
    await runtime.observe({ state: { phoneDigits: '593990000003' }, sourceMessageId: 'fixture_wa_first', sessionId: 'zapi' });
    const third = await request({ action: 'start' }), thirdPending = await issue(third.cookie, '593990000003'); await confirmation(thirdPending, '593990000003');
    assert.equal((await request({ action: 'link_status' }, third.cookie)).data.firstChannel, 'whatsapp');
    assert.equal((await entry(third.cookie, 'entry_request_whatsapp_first')).data.entryBlock, undefined);
    const legacy = await request({ action: 'start' }, '', 'vit_power_ec');
    assert.equal(legacy.data.linkedEntryVersion, undefined); assert.ok(legacy.cookie.startsWith('__Host-vpchat-v220='));
    assert.equal((await request({ action: 'link_start', firstName: 'Juan', phone: '593990000001' }, legacy.cookie, 'vit_power_ec')).status, 400);
    const token = cookie.split('=')[1], record = await store.open(token, { productKey: 'tex_ultra_ec' });
    assert.equal(record.value.draft.verifiedWhatsApp, '593990000001'); assert.equal(record.value.draft.firstContactChannel, 'web');
    assert.equal(record.value.history.filter(x => x.entryBlock).length, 1);
    assert.equal(record.value.draft.quantity, undefined); assert.equal(record.value.draft.orderId, undefined);
    const fourth = await request({ action: 'start' });
    const fourthToken = fourth.cookie.split('=')[1];
    await store.transact(fourthToken, 'existing_name_request_1', 'Una consulta previa', async () => ({ reply: 'Consulta guardada', draft: { name: 'Nombre completo existente', quantity: 3 } }), { productKey: 'tex_ultra_ec' });
    const fourthPending = await issue(fourth.cookie, '593990000004'); await confirmation(fourthPending, '593990000004');
    assert.equal((await entry(fourth.cookie, 'entry_existing_customer')).data.entryBlock, undefined);
    const fourthRecord = await store.open(fourthToken, { productKey: 'tex_ultra_ec' });
    assert.equal(fourthRecord.value.draft.name, 'Nombre completo existente'); assert.equal(fourthRecord.value.draft.preferredFirstName, 'Juan'); assert.equal(fourthRecord.value.draft.quantity, 3);
    const fifth = await request({ action: 'start' }), fifthPending = await issue(fifth.cookie, '593990000005');
    await confirmation(fifthPending, '593990000005', { human: { mode: 'manual', lastManualBy: 'operator' } });
    assert.equal((await entry(fifth.cookie, 'entry_human_hold_request')).data.entryBlock, undefined);
    const held = await request({ action: 'message', requestId: 'message_human_hold_123', message: 'Precio?' }, fifth.cookie);
    assert.equal(held.data.modelUsed, false); assert.equal(held.data.handoff, true); assert.match(held.data.reply, /persona del equipo/);
  } finally { await new Promise(resolve => server.close(resolve)); await fs.rm(directory, { recursive: true, force: true }); }
});
