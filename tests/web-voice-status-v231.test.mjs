import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createWebVoiceV231, createWebOrderAccessV231, ANA_LOPEZ_VOICE_V231 } from '../src/services/vitPowerWebVoiceStatusV231Service.js';
const sessionId = 'a'.repeat(64), otherSession = 'b'.repeat(64);
const record = () => ({ expiresAt: Date.now() + 60000, requests: { test_request_123: { status: 'done', response: { ok: true, reply: 'Precio: 3 frascos USD 95.99.' } } } });
const input = () => ({ sessionId, record: record(), requestId: 'test_request_123' });
const audioResponse = () => new Response(Buffer.alloc(256, 42), { headers: { 'content-type': 'audio/mpeg' } });
test('voice uses the authorized voice and only the saved owned answer', async () => {
  let sent;
  const speak = createWebVoiceV231({ apiKey: 'test-only', fetchImpl: async (url, options) => { sent = { url, options }; return audioResponse(); } });
  assert.equal((await speak(input())).length, 256);
  assert(sent.url.includes(ANA_LOPEZ_VOICE_V231)); assert.equal(JSON.parse(sent.options.body).text, 'Precio: 3 frascos USD 95.99.');
  assert.equal(sent.options.redirect, 'error'); assert.equal(sent.options.method, 'POST');
});
test('voice refuses foreign response IDs, expired sessions and missing key', async () => {
  const speak = createWebVoiceV231({ apiKey: 'test-only', fetchImpl: () => { throw Error('must_not_call'); } });
  await assert.rejects(speak({ ...input(), requestId: 'someone_elses_reply' }), /not_owned/);
  await assert.rejects(speak({ ...input(), record: { expiresAt: 1 } }), /session_expired/);
  await assert.rejects(createWebVoiceV231({})(input()), /voice_unavailable/);
});
test('voice refuses in-progress reply', async () => {
  const value = input(); value.record.requests.test_request_123.status = 'processing';
  await assert.rejects(createWebVoiceV231({ apiKey: 'test-only' })(value), /not_owned/);
});
test('repeated listening reuses cached audio without charging again', async () => {
  let calls = 0;
  const speak = createWebVoiceV231({ apiKey: 'test-only', fetchImpl: async () => { calls++; return audioResponse(); } });
  await speak(input()); await speak(input()); assert.equal(calls, 1);
});
test('simultaneous listening in one session shares the same upstream request', async () => {
  let calls = 0, release;
  const started = new Promise(resolve => { release = resolve; });
  const speak = createWebVoiceV231({ apiKey: 'test-only', fetchImpl: async () => { calls++; await started; return audioResponse(); } });
  const a = speak(input()), b = speak(input()); release(); await Promise.all([a, b]); assert.equal(calls, 1);
});
test('provider failure never substitutes another voice or performs an automatic retry', async () => {
  let calls = 0;
  const speak = createWebVoiceV231({ apiKey: 'test-only', fetchImpl: async () => { calls++; return new Response('{}', { status: 401 }); } });
  await assert.rejects(speak(input()), /voice_unavailable/); assert.equal(calls, 1);
});
test('JSON and oversized upstream responses are rejected', async () => {
  await assert.rejects(createWebVoiceV231({ apiKey: 'test-only', fetchImpl: async () => new Response('{}', { headers: { 'content-type': 'application/json' } }) })(input()), /voice_unavailable/);
  await assert.rejects(createWebVoiceV231({ apiKey: 'test-only', fetchImpl: async () => new Response('x', { headers: { 'content-type': 'audio/mpeg', 'content-length': '2097153' } }) })(input()), /voice_unavailable/);
});
test('voice quota bounds fresh generations per browser', async () => {
  const speak = createWebVoiceV231({ apiKey: 'test-only', fetchImpl: async () => audioResponse() });
  for (let n = 0; n < 6; n++) { const value = input(); value.record.requests.test_request_123.response.reply += n; await speak(value); }
  const seventh = input(); seventh.record.requests.test_request_123.response.reply += 'seventh'; await assert.rejects(speak(seventh), /voice_busy/);
});
const orderId = 'EC-QA-SIMULATED-231', phone = '593999999991';
async function fixture(t, changes = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vitalismen-v231-'));
  t.after(async () => { assert(path.basename(directory).startsWith('vitalismen-v231-')); await fs.rm(directory, { recursive: true, force: true }); });
  let clock = 1800000000000, calls = [];
  const row = { country: 'EC', orderId, phone, productKey: 'vit_power_ec', status: 'shipped', shippingStatus: 'EN_TRANSITO', updatedAt: new Date(clock).toISOString(), ...changes };
  const access = createWebOrderAccessV231({ directory, now: () => clock, lookup: async (id, number) => { calls.push({ id, number }); return row; } });
  return { directory, row, access, calls, advance: ms => { clock += ms; } };
}
test('exact EC order grants a private code, status and date without personal data', async t => {
  const f = await fixture(t), grant = await f.access.issue({ orderId, phone, administrator: 'admin-test' });
  assert.match(grant.token, /^[a-f0-9]{64}$/); assert.equal(grant.automaticSend, false);
  const result = await f.access.read({ token: grant.token, sessionId });
  assert.equal(result.status, 'shipped'); assert.match(result.reply, /Enviado/); assert.match(result.reply, /En tránsito/);
  assert(!JSON.stringify(result).includes(phone)); assert(!JSON.stringify(result).includes('admin-test'));
  assert(f.calls.every(call => call.id === orderId && call.number === phone));
});
test('code binds to the first browser and refuses a different browser', async t => {
  const f = await fixture(t), grant = await f.access.issue({ orderId, phone, administrator: 'admin-test' });
  await f.access.read({ token: grant.token, sessionId });
  await assert.rejects(f.access.read({ token: grant.token, sessionId: otherSession }), /order_access_unavailable/);
});
test('same browser can refresh and sees the newly persisted status', async t => {
  const f = await fixture(t), grant = await f.access.issue({ orderId, phone, administrator: 'admin-test' });
  await f.access.read({ token: grant.token, sessionId }); f.row.status = 'delivered'; f.row.shippingStatus = 'DELIVERED';
  assert.equal((await f.access.read({ token: grant.token, sessionId })).status, 'delivered');
});
test('expired code never returns a status', async t => {
  const f = await fixture(t), grant = await f.access.issue({ orderId, phone, administrator: 'admin-test' }); f.advance(86400001);
  await assert.rejects(f.access.read({ token: grant.token, sessionId }), /order_access_unavailable/);
});
test('Brazilian QA cannot receive an order grant', async t => {
  const f = await fixture(t); await assert.rejects(f.access.issue({ orderId, phone: '5515998038637', administrator: 'admin-test' }), /order_access_unavailable/); assert.equal(f.calls.length, 0);
});
for (const [name, changes] of Object.entries({ foreignCountry: { country: 'CO' }, foreignProduct: { productKey: 'tex_ultra_ec' }, otherPhone: { phone: '593999999992' }, otherOrder: { orderId: 'EC-OTHER-231' } })) {
  test('order access rejects ' + name, async t => { const f = await fixture(t, changes); await assert.rejects(f.access.issue({ orderId, phone, administrator: 'admin-test' }), /order_access_unavailable/); });
}
test('unauthenticated issuance and malformed identifiers are rejected before lookup', async t => {
  const f = await fixture(t); await assert.rejects(f.access.issue({ orderId, phone }), /order_access_unavailable/);
  await assert.rejects(f.access.issue({ orderId: '../elsewhere', phone, administrator: 'admin-test' }), /order_access_unavailable/); assert.equal(f.calls.length, 0);
});
test('unknown and tampered tokens fail without looking up orders', async t => {
  const f = await fixture(t); await assert.rejects(f.access.read({ token: 'd'.repeat(64), sessionId }), /order_access_unavailable/); assert.equal(f.calls.length, 0);
});
test('access files contain only a hashed bearer name and private permissions', async t => {
  const f = await fixture(t), grant = await f.access.issue({ orderId, phone, administrator: 'admin-test' });
  const digest = createHash('sha256').update(grant.token).digest('hex'), names = await fs.readdir(f.directory);
  assert.deepEqual(names, [digest + '.json']); assert(!names.some(name => name.includes(grant.token)));
  const body = await fs.readFile(path.join(f.directory, names[0]), 'utf8'); assert(!body.includes(grant.token));
});
test('changed ownership after issuance invalidates the code', async t => {
  const f = await fixture(t), grant = await f.access.issue({ orderId, phone, administrator: 'admin-test' }); f.row.phone = '593999999992';
  await assert.rejects(f.access.read({ token: grant.token, sessionId }), /order_access_unavailable/);
});
test('web voice uses its dedicated credential and preserves the existing shared credential', async () => {
  const { createVitPowerWebChatHandlerV220 } = await import('../src/services/vitPowerWebChatV220Application.js');
  const oldFetch = globalThis.fetch, shared = process.env.ELEVENLABS_API_KEY, web = process.env.VITALISMEN_WEB_ELEVENLABS_API_KEY;
  let upstreamKey, audio;
  try {
    process.env.ELEVENLABS_API_KEY = 'UNRELATED_EXISTING_SHARED_CREDENTIAL_FIXTURE';
    process.env.VITALISMEN_WEB_ELEVENLABS_API_KEY = 'DEDICATED_WEB_CREDENTIAL_FIXTURE';
    globalThis.fetch = async (url, options) => { upstreamKey = options.headers['xi-api-key']; return audioResponse(); };
    const handler = createVitPowerWebChatHandlerV220({ authority: () => ({ requestAllowed: () => true }), store: { open: async () => ({ fresh: false, value: record() }) } });
    const req = { headers: { cookie: '__Host-vpchat-v220=' + sessionId, 'x-vitalismen-chat-ip': '192.0.2.202' }, is: () => true, body: { action: 'voice', requestId: 'test_request_123' } };
    const res = { setHeader() {}, status(code) { throw Error('unexpected_http_' + code); }, send(value) { audio = value; return this; } };
    await handler(req, res);
    assert.equal(audio.length, 256); assert.equal(upstreamKey, 'DEDICATED_WEB_CREDENTIAL_FIXTURE');
    assert.equal(process.env.ELEVENLABS_API_KEY, 'UNRELATED_EXISTING_SHARED_CREDENTIAL_FIXTURE');
  } finally {
    globalThis.fetch = oldFetch;
    if (shared === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = shared;
    if (web === undefined) delete process.env.VITALISMEN_WEB_ELEVENLABS_API_KEY; else process.env.VITALISMEN_WEB_ELEVENLABS_API_KEY = web;
  }
});
