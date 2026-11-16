import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { customerInviteRecipientAllowedV232, withCustomerInviteDeliveryV232 } from '../src/services/customerInviteContextV232Service.js';
import { createVitPowerWebStoreV220 } from '../src/services/vitPowerWebStoreV220Service.js';
import { runCustomerInviteV232, inviteEligibilityV232, inviteKeyV232, buildChatInviteV232, PARTNER_FIRST_V232, PARTNER_SECOND_V232 } from '../src/services/customerInvitesV232Service.js';
const NOW = Date.parse('2026-11-16T15:00:00Z');
function fixture(changes = {}) {
  let now = NOW, last = -Infinity;
  const row = { _id: 'contact1', countryCode: 'EC', phoneDigits: '593999999991', officialInboundVerified: true, lastInboundAt: new Date(NOW - 13 * 3600000), lastOutboundAt: new Date(NOW - 13 * 3600000), human: { mode: 'auto' }, ...changes };
  const ledger = new Map(), sends = [], mirrors = [], sequence = [];
  const repository = {
    candidates: async () => [row], stopped: async () => false, entry: async key => ledger.get(key), historyHas: async () => false,
    refresh: async () => row,
    async claimGlobal({ now: at, gap }) { if (at - last < gap) return false; last = at; return true; },
    async reserve({ key, ...value }) { if (ledger.has(key)) return false; ledger.set(key, { ...value, state: 'reserved' }); sequence.push('reserved'); return true; },
    async markAttempt(key) { assert.equal(ledger.get(key).state, 'reserved'); ledger.get(key).state = 'attempted'; sequence.push('attempted'); },
    async finish(key, token, patch) { Object.assign(ledger.get(key), patch); }
  };
  const args = () => ({ repository, policy: { enabled: true }, now, clock: () => now, dryRun: false,
    grant: async () => ({ token: 'a'.repeat(64) }),
    send: async body => { sequence.push('provider'); sends.push(body); return { messageId: 'provider-' + sends.length }; },
    mirror: async value => { mirrors.push(value); row.lastOutboundAt = new Date(now); }
  });
  return { row, ledger, sends, mirrors, sequence, repository, args, advance: ms => { now += ms; }, run: patch => runCustomerInviteV232({ ...args(), ...patch }) };
}
test('inactive capability cannot enumerate or send', async () => { const f = fixture(); f.repository.candidates = () => { throw Error('should not read'); }; assert.equal((await f.run({ policy: { enabled: false } })).status, 'DISABLED'); });
for (const [label, patch] of [['Brazil QA', { phoneDigits: '5515998038637' }], ['foreign country', { countryCode: 'CO' }], ['unverified official inbox', { officialInboundVerified: false }], ['human claimed', { human: { mode: 'manual' } }], ['test data', { metadata: { testOnly: true } }], ['STOP', { lastInboundText: 'STOP' }], ['blocked', { tags: ['bloqueado'] }], ['operator no resend', { metadata: { operatorNoAutoResend: true } }], ['permanent manual tag', { tags: ['manual:no_auto_resend'] }], ['shipment review', { blockedAutomatically: true }]]) {
  test('excludes ' + label, async () => { const f = fixture(patch); assert.equal(inviteEligibilityV232(f.row, NOW), false); await f.run(); assert.equal(f.sends.length, 0); });
}
test('twelve hours absent enables only the first partner invitation, once', async () => { const f = fixture(); assert.equal((await f.run()).stage, 'PARTNER_1'); await f.run(); assert.equal(f.sends.length, 1); assert.deepEqual(f.sequence, ['reserved', 'attempted', 'provider']); });
test('active conversation without delivery is not marketed to', async () => { const f = fixture({ lastInboundAt: new Date(NOW - 60000) }); await f.run(); assert.equal(f.sends.length, 0); });
test('delivered customer qualifies without waiting for twelve hours', async () => { const f = fixture({ lastInboundAt: new Date(NOW - 60000), order: { status: 'delivered' } }); assert.equal((await f.run()).stage, 'PARTNER_1'); });
test('verified shipment pickup qualifies even when the order mirror still says shipped', async () => { const f = fixture({ deliveredVerified: true, lastInboundAt: new Date(NOW - 60000), order: { orderId: 'EC-PICKED-UP', status: 'shipped', productKey: 'vit_power_ec' } }); assert.equal((await f.run()).stage, 'PARTNER_1'); assert.doesNotMatch(f.sends[0].message, /#consulta-pedido/); });
test('returned order never receives partner invitations', async () => { const f = fixture({ returned: true, order: { status: 'returned' } }); await f.run(); assert.equal(f.sends.length, 0); });
test('second invitation waits at least twelve hours and is never repeated', async () => {
  const f = fixture(); const key = inviteKeyV232(f.row.phoneDigits, 'PARTNER_1');
  f.ledger.set(key, { state: 'sent', sentAt: new Date(NOW - 12 * 3600000 + 1) }); await f.run(); assert.equal(f.sends.length, 0);
  f.ledger.get(key).sentAt = new Date(NOW - 12 * 3600000); assert.equal((await f.run()).stage, 'PARTNER_2');
  f.advance(24 * 3600000); await f.run(); assert.equal(f.sends.length, 1);
});
test('ambiguous first send blocks repeats and second-stage scheduling', async () => { const f = fixture(); await f.run({ send: async () => { f.sends.push({}); throw Error('timeout'); } }); f.advance(24 * 3600000); await f.run(); assert.equal(f.sends.length, 1); assert.equal([...f.ledger.values()][0].state, 'ambiguous'); });
test('history match suppresses previous partner campaign', async () => { const f = fixture(); f.repository.historyHas = async () => true; await f.run(); assert.equal(f.sends.length, 0); assert.equal(f.ledger.size, 0); });
test('global reservation enforces ten minutes across different recipients', async () => { const f = fixture(); await f.run(); f.row.phoneDigits = '593999999992'; f.row.lastOutboundAt = new Date(NOW - 13 * 3600000); f.advance(599999); assert.equal((await f.run()).status, 'WAIT_TEN_MINUTE_SLOT'); f.advance(1); assert.equal((await f.run()).sent, 1); });
test('dry-run has no reservation, quota write, grant or provider call', async () => { const f = fixture(); f.repository.claimGlobal = () => { throw Error('mutation'); }; const r = await f.run({ dryRun: true }); assert.equal(r.status, 'PASS_DRY_RUN'); assert.equal(f.ledger.size, 0); assert.equal(f.sends.length, 0); });
test('chat invitation carries no credentials and points to the existing private status form', async () => { const f = fixture({ order: { orderId: 'EC-EXACT-ORDER', status: 'shipped', productKey: 'vit_power_ec', name: 'Maria Teste' } }); const r = await f.run(); assert.equal(r.stage, 'CHAT_ORDER'); assert.match(f.sends[0].message, /Hola, Maria\./); assert.match(f.sends[0].message, /#consulta-pedido/); assert.doesNotMatch(f.sends[0].message, /[a-f0-9]{64}/); assert.match(f.sends[0].message, /verificar tu identidad/); assert.equal(f.mirrors[0].orderId, 'EC-EXACT-ORDER'); });
test('recipient capability remains closed outside a validated persisted dispatch', async () => { assert.equal(customerInviteRecipientAllowedV232('593999999991'), false); await assert.rejects(withCustomerInviteDeliveryV232({ phone: '5515998038637', key: 'a'.repeat(64), lockToken: 'fake' }, () => assert.fail('must not authorize')), /not_authorized/); });
test('recipient eligibility is rechecked immediately before sending', async () => { const f = fixture(); f.repository.refresh = async () => ({ ...f.row, human: { mode: 'manual' } }); await f.run(); assert.equal(f.sends.length, 0); });
test('mirror failure does not downgrade a successful send or schedule a repeat', async () => { const f = fixture(); await f.run({ mirror: async () => { throw Error('db temporarily unavailable'); } }); assert.equal([...f.ledger.values()][0].state, 'sent'); await f.run(); assert.equal(f.sends.length, 1); });
test('invitation neutralizes name line breaks without embedding private data', () => { assert.match(buildChatInviteV232({ name: 'Ana\nInjected' }), /^Hola, Ana\./); assert.doesNotMatch(buildChatInviteV232({ name: 'Ana' }), /EC-EXACT|token=/); });
test('only the explicitly approved partner URLs are in the campaign copy', () => { assert.match(PARTNER_FIRST_V232, /https:\/\/gira21x\.com\//); assert.match(PARTNER_SECOND_V232, /https:\/\/youtu\.be\/xguISlUDFVM/); assert.match(PARTNER_FIRST_V232, /STOP/); });
test('the 101st browser can enter without raising model quotas or deleting existing history', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vitalismen-invite-admission-'));
  try {
    await fs.mkdir(path.join(root, 'sessions'));
    for (let n = 0; n < 100; n++) await fs.writeFile(path.join(root, 'sessions', n.toString(16).padStart(64, '0') + '.json'), JSON.stringify({ version: 220, expiresAt: NOW + 86400000, history: n ? [] : [{ role: 'user', content: 'preserve me' }], requests: {}, draft: {}, turnCount: 0 }));
    const store = createVitPowerWebStoreV220({ directory: root, now: () => NOW, minFreeBytes: 0 });
    assert.equal((await store.open()).fresh, true);
    assert.equal((await fs.readdir(path.join(root, 'sessions'))).length, 101);
    assert.match(await fs.readFile(path.join(root, 'sessions', '0'.repeat(64) + '.json'), 'utf8'), /preserve me/);
    await assert.rejects(fs.access(path.join(root, 'quota.json')));
  } finally { assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('vitalismen-invite-admission-')); await fs.rm(root, { recursive: true, force: true }); }
});
