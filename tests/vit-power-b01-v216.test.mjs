import test from 'node:test';
import assert from 'node:assert/strict';
import { createB01, B01_MEDIA, firstName, isB01GenericEntry, b01Greeting } from '../src/services/vitPowerB01CoreV216Service.js';
const CTA = 'Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?';
function fixture(options = {}) {
  let clock = +new Date('2026-11-15T15:00:00Z'), job = null, enabled = true;
  const attempts = [], tokens = new Set(), reserved = new Set();
  let blocked = '', history = false;
  const repo = {
    async get() { return job && structuredClone(job); },
    async eligible() { return { allowed: !options.old, reason: 'existing_contact' }; },
    async start(id, value) { if (job) return null; job = structuredClone(value); return structuredClone(job); },
    async interrupt(id, reason) { if (['pending', 'sending'].includes(job?.status)) { job.status = 'interrupted'; job.reason = reason; } },
    async due(now) { return job?.status === 'pending' && +job.nextAt <= +now ? ['c'] : []; },
    async claim(id, now, token) { if (job?.status !== 'pending') return null; job.status = 'sending'; job.lockToken = token; job.lockedUntil = new Date(+now + 120000); return structuredClone(job); },
    async check() { return { allowed: !blocked && job.status === 'sending', reason: blocked || 'interrupted' }; },
    async history() { return history; },
    async reserve(id, token, cursor, key) { if (reserved.has(key)) return false; reserved.add(key); job.steps[cursor].status = 'attempted'; return true; },
    async accept(id, token, cursor, messageId, now, nextAt) {
      job.steps[cursor].status = 'accepted'; job.steps[cursor].providerMessageId = messageId;
      if (job.status !== 'sending') return;
      job.cursor = cursor + 1; job.status = nextAt ? 'pending' : 'done'; job.nextAt = nextAt;
    },
    async stop(id, token, status, reason) { if (job?.status === 'sending') { job.status = status; job.reason = reason; } },
    async expire(now) { if (job?.status === 'sending' && +job.lockedUntil <= +now) { job.status = 'ambiguous'; job.reason = 'worker_interrupted_requires_review'; } }
  };
  const send = async (j, step, key) => {
    assert(!tokens.has(key), 'a transport attempt cannot repeat'); tokens.add(key);
    attempts.push({ at: clock, step: structuredClone(step) });
    if (options.onSend) await options.onSend(repo, j, step);
    if (options.failAt === attempts.length) return { ok: false, provider: 'zapi' };
    if (options.noIdAt === attempts.length) return { ok: true, provider: 'zapi' };
    if (options.throwAt === attempts.length) throw new Error('network timeout');
    return { ok: true, provider: 'zapi', providerMessageId: 'id-' + attempts.length };
  };
  const make = () => createB01({ repo, send, policy: () => ({ enabled, activatedAt: new Date(clock - 1000) }), now: () => new Date(clock), random: () => options.random ?? 0 });
  let core = make();
  const input = { contactId: 'c', phone: '593980000001', chatId: '593980000001@c.us', sessionId: 'zapi', productKey: 'vit_power_ec', inboundId: 'incoming-1', text: CTA + '\nNombre: José', origin: 'automatic' };
  return { repo, input, attempts, get job() { return job; }, get core() { return core; },
    advance: async ms => { clock += ms; await core.tick(); }, restart: () => { core = make(); },
    block: reason => { blocked = reason; }, history: () => { history = true; }, disable: () => { enabled = false; } };
}
test('generic CTA with name enters, specific questions and order data keep priority', () => {
  for (const s of [CTA, CTA + '\nNombre: José', 'Hola', 'Hola quiero informacion sobre Vit Power']) assert(isB01GenericEntry(s));
  for (const s of ['¿Cuánto cuesta?', 'Hola quiero 3 frascos', 'Nombre: Juan\nCiudad: Quito', '¿Puedo tomarlo con mis medicamentos?', 'No quiero', 'Si', 'precio Vit Power']) assert(!isB01GenericEntry(s), s);
});
test('first name accepts accents and rejects injected fields or URLs', () => {
  assert.equal(firstName('Nombre: María José'), 'María');
  assert.equal(firstName('Nombre: <script>'), '');
  assert.equal(firstName('Nombre: https://x.test'), '');
});
test('greeting uses Ecuador morning, afternoon and night, including midnight boundary', () => {
  assert.match(b01Greeting('Juan', new Date('2026-11-15T14:00:00Z')), /Buenos días, Juan/);
  assert.match(b01Greeting('Ana', new Date('2026-11-15T20:00:00Z')), /Buenas tardes, Ana/);
  assert.match(b01Greeting('', new Date('2026-11-16T02:00:00Z')), /Buenas noches!/);
  assert.match(b01Greeting('', new Date('2026-11-16T05:00:00Z')), /Buenas noches!/);
});
test('greeting then four original assets with persisted 18–30 second pauses', async () => {
  const f = fixture(); assert.equal((await f.core.start(f.input)).reason, 'queued');
  await f.advance(4999); assert.equal(f.attempts.length, 0);
  await f.advance(1); assert.equal(f.attempts.length, 1);
  assert.match(f.attempts[0].step.text, /José/);
  for (let i = 0; i < 4; i++) { await f.advance(17999); assert.equal(f.attempts.length, i + 1); await f.advance(1); }
  assert.deepEqual(f.attempts.slice(1).map(x => x.step.asset), B01_MEDIA.map(x => x.asset));
  assert.equal(f.job.status, 'done');
  await f.advance(900000); assert.equal(f.attempts.length, 5);
});
test('upper random bound is 30 seconds initial and 30 seconds between sends', async () => {
  const f = fixture({ random: .999999 }); await f.core.start(f.input);
  await f.advance(29999); assert.equal(f.attempts.length, 0); await f.advance(1);
  await f.advance(29999); assert.equal(f.attempts.length, 1); await f.advance(1); assert.equal(f.attempts.length, 2);
});
test('simultaneous starts, ticks and duplicate inbound cannot duplicate sends', async () => {
  const f = fixture(); await Promise.all([f.core.start(f.input), f.core.start(f.input)]);
  await f.advance(5000); await Promise.all([f.core.tick(), f.core.tick()]);
  assert.equal(f.attempts.length, 1);
  await f.core.start(f.input); await f.advance(18000); assert.equal(f.attempts.length, 2);
});
for (const kind of ['failAt', 'throwAt', 'noIdAt']) test(kind + ' at second audio stops and never repeats first audio', async () => {
  const f = fixture({ [kind]: 3 }); await f.core.start(f.input);
  await f.advance(5000); await f.advance(18000); await f.advance(18000);
  assert.equal(f.job.status, 'ambiguous'); assert.equal(f.attempts.length, 3);
  f.restart(); await f.advance(900000); await f.core.start({ ...f.input, origin: 'manual' });
  assert.equal(f.attempts.length, 3);
});
for (const reason of ['human_hold', 'new_inbound', 'active_order', 'product_changed', 'qa_window_closed']) test(reason + ' cancels unsent steps', async () => {
  const f = fixture(); await f.core.start(f.input); await f.advance(5000);
  f.block(reason); await f.advance(18000); assert.equal(f.job.status, 'interrupted'); assert.equal(f.attempts.length, 1);
});
test('new inbound interrupts while allowing conversational handler to process it', async () => {
  const f = fixture(); await f.core.start(f.input); await f.advance(5000);
  const result = await f.core.start({ ...f.input, inboundId: 'incoming-2', text: '3 frascos' });
  assert.equal(result.handled, false); assert.equal(f.job.status, 'interrupted');
  await f.advance(18000); assert.equal(f.attempts.length, 1);
});
test('interruption during transport preserves acceptance without restarting queue', async () => {
  const f = fixture({ onSend: repo => repo.interrupt('c', 'human_hold') }); await f.core.start(f.input); await f.advance(5000);
  assert.equal(f.job.steps[0].status, 'accepted'); assert.equal(f.job.status, 'interrupted');
});
test('closing tab or restarting worker resumes only the next unattempted item', async () => {
  const f = fixture(); await f.core.start(f.input); await f.advance(5000);
  f.restart(); await f.advance(18000); assert.equal(f.attempts.length, 2);
  assert.equal(f.attempts[1].step.asset, B01_MEDIA[0].asset);
});
test('crash after reservation becomes uncertain instead of retrying', async () => {
  const f = fixture(); await f.core.start(f.input);
  await f.repo.claim('c', new Date('2026-11-15T15:00:00Z'), 'crashed'); f.restart(); await f.advance(120001);
  assert.equal(f.job.status, 'ambiguous'); assert.equal(f.attempts.length, 0);
});
test('existing media history requires review instead of another send', async () => {
  const f = fixture(); await f.core.start(f.input); await f.advance(5000);
  f.history(); await f.advance(18000); assert.equal(f.job.status, 'review'); assert.equal(f.attempts.length, 1);
});
test('no retroactive automatic entry and no cross-product/session/country sends', async () => {
  const old = fixture({ old: true }); assert.equal((await old.core.start(old.input)).handled, false);
  for (const patch of [{ phone: '5511999999999' }, { phone: '573001234567' }, { sessionId: 'other' }, { productKey: 'tex_ultra_ec' }]) {
    const f = fixture(); assert.equal((await f.core.start({ ...f.input, ...patch })).handled, false);
  }
});
test('disabled policy does not queue or dispatch', async () => {
  const f = fixture(); f.disable(); assert.equal((await f.core.start(f.input)).handled, false);
  await f.advance(900000); assert.equal(f.attempts.length, 0);
});

for (const [random, ms] of [[0, 5000], [.5, 17500], [.999999, 30000]]) {
 test('initial greeting schedules within 5–30 seconds: ' + ms, async () => {
  const f = fixture({ random }); await f.core.start(f.input);
  assert.equal(+f.job.nextAt - +f.job.startedAt, ms);
  await f.advance(ms - 1); assert.equal(f.attempts.length, 0);
  await f.advance(1); assert.equal(f.attempts.length, 1);
 });
}
