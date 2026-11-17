import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createTexUltraLinkedEntryV242, texLinkCodeFromMessageV242, texExistingEntryV242, texLinkedContactHoldV242 } from '../src/services/texUltraLinkedEntryV242Service.js';
import { createTexUltraLinkedRuntimeV242, applyTexLinkedOwnerV242 } from '../src/services/texUltraLinkedRuntimeV242Service.js';
const PHONE = '593990000001', OTHER = '593990000002', SESSION = 'a'.repeat(64), SECOND = 'b'.repeat(64);
async function fixture(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tex242-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let time = Date.parse('2026-11-17T18:00:00Z');
  const config = { directory, officialPhone: '553171862958', now: () => time, minFreeBytes: 0, ...options };
  const store = createTexUltraLinkedEntryV242(config);
  const issue = (sessionId = SESSION, phone = PHONE) => store.issue({ sessionId, requestId: 'request_123456789', phone, firstName: 'Juan' });
  const code = response => texLinkCodeFromMessageV242(new URL(response.verificationUrl).searchParams.get('text'));
  const confirm = (value, phone = PHONE, extra = {}) => store.confirmFromOfficialInbound({ code: value, phone, inboundId: 'official_inbound_1', verifiedInbound: true, ...extra });
  return { directory, config, store, issue, code, confirm, advance: ms => time += ms };
}
test('typing a phone proves nothing; only same-session persisted official inbound verifies it', async t => {
  const f = await fixture(t), response = await f.issue(), code = f.code(response);
  assert.equal(response.verified, false); assert.ok(code);
  assert.equal(await f.store.identity(SESSION), null); assert.equal(await f.store.identity(SECOND), null);
  assert.equal((await f.confirm(code, OTHER)).confirmed, false);
  assert.equal((await f.confirm(code, PHONE, { verifiedInbound: false })).confirmed, false);
  assert.equal(await f.store.identity(SESSION), null);
  assert.equal((await f.confirm(code)).firstChannel, 'web');
  assert.equal((await f.store.identity(SESSION)).phone, PHONE);
  assert.equal(await f.store.identity(SECOND), null);
  assert.equal((await f.confirm(code)).duplicate, true);
});
test('web-first owns one entry across browsers and later WhatsApp; no message sender exists', async t => {
  const f = await fixture(t), response = await f.issue(); await f.confirm(f.code(response));
  assert.equal((await f.store.claimWebEntry(SESSION, 'entry_request_1')).allowed, true);
  assert.equal((await f.store.claimWebEntry(SESSION, 'entry_request_2')).allowed, false);
  assert.equal((await f.store.observeWhatsapp({ phone: PHONE, verifiedInbound: true })).firstChannel, 'web');
  const second = await f.issue(SECOND); await f.confirm(f.code(second));
  assert.equal((await f.store.claimWebEntry(SECOND, 'entry_request_3')).allowed, false);
  const restarted = createTexUltraLinkedEntryV242(f.config);
  assert.equal((await restarted.claimWebEntry(SESSION, 'entry_request_4')).allowed, false);
  assert.ok(!Object.keys(f.store).some(name => /send|retry|schedule/i.test(name)));
});
test('WhatsApp-first and existing manual entry never restart the block on the website', async t => {
  const f = await fixture(t);
  await f.store.observeWhatsapp({ phone: PHONE, verifiedInbound: true });
  const response = await f.issue(); await f.confirm(f.code(response));
  assert.equal((await f.store.identity(SESSION)).firstChannel, 'whatsapp');
  assert.equal((await f.store.claimWebEntry(SESSION, 'entry_request')).allowed, false);
  const legacy = await f.issue(SECOND, OTHER); await f.confirm(f.code(legacy), OTHER, { existingEntry: true });
  assert.equal((await f.store.identity(SECOND)).firstChannel, 'whatsapp');
  assert.equal((await f.store.claimWebEntry(SECOND, 'entry_request')).allowed, false);
});
test('expired, foreign-country, missing session and tampered confirmation never link', async t => {
  const f = await fixture(t), response = await f.issue(), code = f.code(response);
  assert.equal((await f.confirm(code.slice(0, -1) + (code.endsWith('a') ? 'b' : 'a'))).confirmed, false);
  f.advance(600001); assert.equal((await f.confirm(code)).confirmed, false);
  assert.equal(await f.store.identity(SESSION), null);
  await assert.rejects(f.issue(SECOND, '5515998038637'), /input_invalid/);
  await assert.rejects(f.store.issue({ sessionId: '../bad', phone: PHONE, requestId: 'request_123456789', firstName: 'Juan' }), /request_invalid/);
  await assert.rejects(f.store.claimWebEntry(SESSION, 'entry_request'), /verification_required/);
});
test('confirmation honors human and optout state without resetting it', async t => {
  const f = await fixture(t), response = await f.issue(); await f.confirm(f.code(response), PHONE, { blocked: true });
  assert.equal((await f.store.claimWebEntry(SESSION, 'entry_request')).allowed, false);
  for (const state of [{ metadata: { optOut: true } }, { metadata: { operatorNoAutoResend: true } }, { tags: ['manual:no_auto_resend'] }, { human: { mode: 'manual', lastManualBy: 'operator' } }]) assert.equal(texLinkedContactHoldV242(state), true);
  assert.equal(texLinkedContactHoldV242({ human: { mode: 'manual', lastManualBy: 'vsl_ec' } }), false);
  assert.equal(texExistingEntryV242({ metadata: { perAgentMemory: { tex_ultra_ec: { initialLayerCadence: { status: 'paused_restart' } } } } }), true);
});
test('one pending challenge is idempotent and bounded without outbound OTP retries', async t => {
  const f = await fixture(t), response = await f.issue(); assert.deepEqual(await f.issue(), response);
  for (let i = 0; i < 2; i++) { f.advance(600001); await f.issue(); }
  f.advance(600001); await assert.rejects(f.issue(), /limit/);
});
test('concurrent claims cannot both obtain the entry and a retained crash lock blocks replay', async t => {
  const f = await fixture(t), response = await f.issue(); await f.confirm(f.code(response));
  const results = await Promise.allSettled([f.store.claimWebEntry(SESSION, 'entry_1'), f.store.claimWebEntry(SESSION, 'entry_2')]);
  assert.equal(results.filter(x => x.status === 'fulfilled' && x.value.allowed).length, 1);
  assert.equal((await f.store.claimWebEntry(SESSION, 'entry_3')).allowed, false);
  assert.equal((await fs.readdir(path.join(f.directory, 'locks'))).length, 0);
});
test('runtime rejects wrong HTTP context, provider, owner, stale message and unauthenticated replay', async t => {
  const f = await fixture(t), cap = { isCurrent: () => true, directory: f.directory, officialPhone: '553171862958', ownerPhone: '5531971862958', activatedAt: '2026-11-17T17:59:00Z' };
  let scope = { method: 'POST', writeContext: true, path: '/api/zapi/webhook' }, row = { _id: 'inbound', timestamp: Date.parse('2026-11-17T18:00:00Z') / 1000 }, selected;
  const runtime = createTexUltraLinkedRuntimeV242({ capability: () => cap, context: () => scope,
    findInbound: async selector => { selected = selector; return row; }, now: f.config.now });
  const input = { state: { phoneDigits: PHONE }, sourceMessageId: 'inbound', sessionId: 'zapi' };
  assert.equal((await runtime.observe(input)).firstChannel, 'whatsapp');
  assert.deepEqual(selected, { _id: 'inbound', provider: 'zapi', sessionId: 'zapi', ownerPhoneDigits: cap.ownerPhone, isFromMe: false, peerPhone: PHONE });
  for (const invalid of [{ method: 'GET', writeContext: true, path: '/api/zapi/webhook' }, { method: 'POST', writeContext: false, path: '/api/zapi/webhook' }, { method: 'POST', writeContext: true, path: '/api/web-chat/vitpower' }]) {
    scope = invalid; assert.equal(await runtime.observe(input), null);
  }
  scope = { method: 'POST', writeContext: true, path: '/api/zapi/webhook' }; row = null; assert.equal(await runtime.observe(input), null);
  row = { timestamp: 1 }; assert.equal(await runtime.observe(input), null);
  row = { timestamp: Date.parse('2026-11-17T18:00:00Z') / 1000 };
  assert.equal(await runtime.observe({ ...input, recovered: true }), null);
  assert.equal(await runtime.observe({ ...input, sessionId: 'other' }), null);
});
test('a new human hold is checked after verification and unavailable state fails closed', async t => {
  let held = false;
  const f = await fixture(t, { currentContactHold: async () => held });
  const response = await f.issue(); await f.confirm(f.code(response));
  assert.equal((await f.store.identity(SESSION)).blocked, false);
  held = true; assert.equal((await f.store.identity(SESSION)).blocked, true);
  assert.equal((await f.store.claimWebEntry(SESSION, 'entry_request')).allowed, false);
  const closed = createTexUltraLinkedEntryV242({ ...f.config, currentContactHold: async () => { throw Error('source unavailable'); } });
  assert.equal((await closed.identity(SESSION)).blocked, true);
});
test('a process crash lock remains effective after creating a new store instance', async t => {
  const f = await fixture(t), response = await f.issue(); await f.confirm(f.code(response));
  const identity = await f.store.identity(SESSION);
  assert.equal(identity.entryAttempted, false);
  const id = createHash('sha256').update('phone:' + identity.journeyId).digest('hex');
  const target = path.join(f.directory, 'locks', id + '.json');
  await fs.writeFile(target, JSON.stringify({ token: 'crashed-process', startedAt: f.config.now() - 3600000 }), { flag: 'wx', mode: 0o600 });
  const restarted = createTexUltraLinkedEntryV242(f.config);
  await assert.rejects(restarted.claimWebEntry(SESSION, 'entry_request_after_crash'), /busy/);
  assert.equal((await fs.stat(target)).isFile(), true); assert.equal((await restarted.identity(SESSION)).entryAttempted, false);
});
test('link persistence writes only its own paths and never replaces order, human or existing stage fields', async () => {
  const writes = [], state = { _id: 'contact', metadata: { customerDraft: { name: 'Nombre existente', quantity: 3 }, perAgentMemory: { tex_ultra_ec: { stage: 'awaiting_confirmation' } } }, human: { mode: 'auto' },
    updateOne: async change => writes.push(change), constructor: { updateOne: async (...args) => writes.push(args) } };
  await applyTexLinkedOwnerV242(state, { id: 'journey', firstChannel: 'web' });
  assert.deepEqual(Object.keys(writes[0].$set), ['metadata.texUltraLinkedEntryV242', 'metadata.perAgentMemory.tex_ultra_ec.linkedWebEntryV242']);
  assert.equal(writes.length, 1); assert.equal(state.metadata.customerDraft.name, 'Nombre existente'); assert.equal(state.metadata.customerDraft.quantity, 3);
  assert.equal(state.metadata.perAgentMemory.tex_ultra_ec.stage, 'awaiting_confirmation'); assert.equal(state.human.mode, 'auto');
});
