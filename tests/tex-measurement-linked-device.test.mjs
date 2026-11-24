import test from 'node:test';
import assert from 'node:assert/strict';
import { createTexMeasurementV243 } from '../src/services/texUltraMeasurementV243Service.js';

const at = Date.parse('2026-11-23T20:41:00Z');
const reference = 'TX243-' + 'a'.repeat(64);
const body = `Hola, quiero el tratamiento Tex Ultra.\nReferencia: ${reference}`;
const owner = '553171862958';
const phone = '593999000001';

const fixture = () => {
  const records = new Map();
  const journalFactory = () => ({
    lock: async (_key, work) => work(),
    read: async (kind, key) => records.get(`${kind}:${key}`) || null,
    write: async (kind, key, value) => { records.set(`${kind}:${key}`, value); }
  });
  const state = { phoneDigits: phone, metadata: {}, updateOne: async () => {} };
  const input = { state, inboundText: body, sourceMessageId: 'socket-message-1',
    sessionId: 'default', provider: 'baileys', ownerPhoneDigits: owner, recovered: false };
  let scope = { method: 'SOCKET', path: '/internal/whatsapp/baileys-inbound', writeContext: true,
    baileysInbound: { verified: true, sessionId: 'default', messageId: input.sourceMessageId, ownerPhoneDigits: owner } };
  let row = { body, timestamp: at / 1000 };
  const selectors = [], proofs = [];
  const runtime = createTexMeasurementV243({ journalFactory, now: () => at,
    capability: () => ({ isCurrent: () => true, directory: 'memory-test', key: 'c'.repeat(64),
      ownerPhone: '5531971862958', officialPhone: owner, activatedAt: new Date(at - 60000).toISOString() }),
    context: async () => scope,
    findInbound: async selector => { selectors.push(selector); return row; },
    post: async proof => { proofs.push(proof); return { ok: true, verified: true, datasetId: '1100892582698669' }; }
  });
  return { runtime, input, state, selectors, proofs, setScope: value => { scope = value; }, setRow: value => { row = value; } };
};

test('verified linked-device message creates one Tex Lead and binds only the matching order', async () => {
  const f = fixture();
  assert.equal((await f.runtime.observe(f.input)).ok, true);
  assert.equal(f.proofs.length, 1);
  assert.equal(f.selectors[0].provider, 'baileys');
  assert.equal(f.selectors[0].ownerPhoneDigits, owner);
  assert.equal(f.state.metadata.texMeasurementV243.provider, 'baileys');
  assert.equal((await f.runtime.observe(f.input)).duplicate, true);
  assert.equal(f.proofs.length, 1);
  const order = { country: 'EC', tracking: { productKey: 'tex_ultra_ec' },
    customer: { phone }, entryAt: new Date(at + 1000) };
  assert.equal(await f.runtime.bindOrder(order, f.state), true);
  assert.equal(order.tracking.attributionConfidence, 'official_baileys_exact_message');
  assert.equal(order.tracking.measurementOwnerPhoneDigits, owner);
});

test('linked-device claim rejects missing socket proof, changed message and QA phone', async () => {
  const missing = fixture();
  missing.setScope({ path: '/internal/whatsapp/baileys-inbound', writeContext: true });
  assert.equal(await missing.runtime.observe(missing.input), null);
  assert.equal(missing.proofs.length, 0);
  const altered = fixture();
  altered.setRow({ body: 'other', timestamp: at / 1000 });
  assert.equal(await altered.runtime.observe(altered.input), null);
  assert.equal(altered.proofs.length, 0);
  const qa = fixture();
  assert.equal(await qa.runtime.observe({ ...qa.input, state: { phoneDigits: '5515998038637', metadata: { testOnly: true } } }), null);
  assert.equal(qa.proofs.length, 0);
});
