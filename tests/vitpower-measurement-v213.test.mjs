import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { SCOPE, normalizeCapture, buildEvent, deliverOnce, mongooseLedger, newReference, readReference } from '../src/services/vitPowerMeasurementV213Core.js';
import { metaTransport, createRuntime } from '../src/services/vitPowerMeasurementV213Runtime.js';

const now = new Date('2026-11-15T03:00:00Z');
const id = '12345678-1234-4234-8234-123456789abc';
const visitor = 'abcdef12-1234-4234-8234-123456789abc';
const context = { origin: SCOPE.origin, sourceUrl: SCOPE.url, privacyAllowed: true,
  trustedClientContext: true, ip: '198.51.100.25', userAgent: 'Synthetic offline browser', now };
const body = { consent: true, visitId: id, visitorId: visitor, fbclid: 'OFFLINE_CASE_SENSITIVE_Click',
  fbp: 'fb.1.1794711599000.123456', utm_source: 'facebook', ad_id: 'OFFLINE_AD' };
const makeVisit = () => normalizeCapture(body, context).visit;
const policy = { approved: true, credentialsVerified: true, collectionApproved: true,
  dataset: SCOPE.dataset, activatedAt: '2026-11-15T02:55:00Z', now };
const pageInput = { name: 'PageView', eventId: `vp213-page-${id}`, at: now, variant: 'mobile_vsl' };
function orderFixture() {
  const visit = makeVisit();
  visit.customerPhone = '593900000001'; visit.attributionClaimedAt = now;
  const order = { orderId: 'OFFLINE_ORDER_1', country: 'EC', productKey: SCOPE.product,
    customer: { phone: visit.customerPhone }, quantity: 3, total: 96, currency: 'USD',
    status: 'draft', createdAt: now, persisted: true };
  return { visit, order };
}

test('captures only whitelisted attribution and verified visitor transport', () => {
  const r = normalizeCapture({ ...body, ip: '203.0.113.99', client_user_agent: 'forged',
    email: 'EXCLUDED', message: 'EXCLUDED', health: 'EXCLUDED', token: 'EXCLUDED' }, context);
  assert.equal(r.ok, true); assert.equal(r.visit.tracking.ip, context.ip);
  assert.equal(r.visit.tracking.userAgent, context.userAgent);
  assert.equal(r.visit.tracking.fbc, `fb.1.${now.getTime()}.${body.fbclid}`);
  assert.equal(r.visit.tracking.ad_id, 'OFFLINE_AD');
  assert.doesNotMatch(JSON.stringify(r), /EXCLUDED|forged|203\.0\.113\.99/);
});

for (const [label, changeBody, changeContext] of [
  ['wrong host', {}, { origin: 'https://other.invalid' }],
  ['wrong path', {}, { sourceUrl: SCOPE.origin + '/other' }],
  ['missing trusted proxy proof', {}, { trustedClientContext: false }],
  ['missing client IP', {}, { ip: '' }], ['invalid IP', {}, { ip: 'not-an-ip' }],
  ['missing UA', {}, { userAgent: '' }], ['no consent', { consent: false }, {}],
  ['QA visit', { qa: true }, {}], ['invalid visitor', { visitorId: 'bad' }, {}],
]) test(`capture rejects ${label}`, () => assert.equal(normalizeCapture({ ...body, ...changeBody }, { ...context, ...changeContext }).ok, false));

test('does not invent fbc without real click id and preserves fbp', () => {
  const r = normalizeCapture({ ...body, fbclid: '', fbc: '' }, context);
  assert.equal(r.visit.tracking.fbc, undefined); assert.equal(r.visit.tracking.fbp, body.fbp);
});
test('new real click replaces older fbc while preserving case and milliseconds', () => {
  const r = normalizeCapture({ ...body, fbc: 'fb.1.1794711599000.OLD_CLICK' }, context);
  assert.equal(r.visit.tracking.fbc, `fb.1.${now.getTime()}.${body.fbclid}`);
});
for (const [name, prefix] of [['PageView', 'page'], ['ViewContent', 'content'], ['CtaClick', 'cta'], ['Contact', 'contact']])
  test(`browser and server share ${name} name, destination and ID`, () => {
    const r = buildEvent({ ...pageInput, name, eventId: `vp213-${prefix}-${id}` }, makeVisit(), policy);
    assert.equal(r.ok, true); assert.equal(r.dataset, SCOPE.dataset);
    assert.equal(r.event.event_name, name); assert.equal(r.event.event_id, `vp213-${prefix}-${id}`);
    assert.equal(r.event.user_data.client_ip_address, context.ip);
    assert.equal(r.event.user_data.client_user_agent, context.userAgent);
    assert.equal(r.event.user_data.fbp, body.fbp);
    assert.equal(r.event.custom_data.value, undefined);
  });
for (const [label, changedPolicy, changedInput, changedVisit] of [
  ['unapproved activation', { approved: false }, {}, {}],
  ['unverified credential', { credentialsVerified: false }, {}, {}],
  ['wrong dataset', { dataset: 'OTHER' }, {}, {}],
  ['historical event', {}, { at: '2026-11-14T00:00:00Z' }, {}],
  ['future event', {}, { at: '2026-11-16T00:00:00Z' }, {}],
  ['different visit event ID', {}, { eventId: 'vp213-page-' + visitor }, {}],
  ['foreign source', {}, {}, { sourceUrl: 'https://other.invalid' }],
  ['foreign product', {}, {}, { productKey: 'tex_ultra_ec' }],
]) test(`event rejects ${label}`, () => assert.equal(buildEvent({ ...pageInput, ...changedInput }, { ...makeVisit(), ...changedVisit }, { ...policy, ...changedPolicy }).ok, false));

test('checkout requires persisted structured order and purchase requires confirmation', () => {
  const { visit, order } = orderFixture();
  const checkout = buildEvent({ name: 'InitiateCheckout', at: now, order }, visit, policy);
  assert.equal(checkout.ok, true); assert.equal(checkout.event.custom_data.value, 96);
  assert.equal(buildEvent({ name: 'Purchase', at: now, order, previousStatus: 'draft' }, visit, policy).ok, false);
  const purchase = buildEvent({ name: 'Purchase', at: now, order: { ...order, status: 'confirmed' }, previousStatus: 'draft' }, visit, policy);
  assert.equal(purchase.ok, true); assert.equal(purchase.event.custom_data.currency, 'USD');
  assert.match(purchase.event.user_data.ph[0], /^[a-f0-9]{64}$/);
  assert.notEqual(checkout.event.event_id, purchase.event.event_id);
});
test('repurchase has distinct purchase identity; duplicate confirmation is rejected', () => {
  const { visit, order } = orderFixture(); order.status = 'confirmed';
  const a = buildEvent({ name: 'Purchase', at: now, order, previousStatus: 'draft' }, visit, policy);
  const b = buildEvent({ name: 'Purchase', at: now, order: { ...order, orderId: 'OFFLINE_ORDER_2' }, previousStatus: 'draft' }, visit, policy);
  assert.notEqual(a.event.event_id, b.event.event_id);
  assert.equal(buildEvent({ name: 'Purchase', at: now, order, previousStatus: 'confirmed' }, visit, policy).ok, false);
});
for (const [label, change, changeVisit] of [
  ['QA 8637', { customer: { phone: '5515998038637' } }, {}],
  ['other Brazil', { customer: { phone: '5511999999999' } }, {}],
  ['wrong customer', { customer: { phone: '593900000002' } }, {}],
  ['no persisted order', { persisted: false }, {}], ['missing amount', { total: 0 }, {}],
  ['unsupported quantity', { quantity: 5 }, {}], ['other currency', { currency: 'BRL' }, {}],
  ['historical order', { createdAt: '2026-11-14T00:00:00Z' }, {}],
  ['unclaimed visit', {}, { attributionClaimedAt: null }],
]) test(`conversion rejects ${label}`, () => {
  const { visit, order } = orderFixture();
  assert.equal(buildEvent({ name: 'InitiateCheckout', at: now, order: { ...order, ...change } }, { ...visit, ...changeVisit }, policy).ok, false);
});
test('opaque reference is unique, exact and rejects multiple references', () => {
  const a = newReference(), b = newReference(); assert.notEqual(a, b);
  assert.equal(readReference('Hola\nVisita: ' + a), a);
  assert.equal(readReference('Hola\nVisita: ' + a + '\nVisita: ' + b), '');
  assert.equal(readReference('Visita: VP-invalid'), '');
});
test('visit tracking marker never becomes a delivery reference in the official parser', () => {
  const source = readFileSync(new URL('../src/services/conversationEngine.js', import.meta.url), 'utf8');
  const start = source.indexOf('const extractReferenceFromText = ');
  const end = source.indexOf('\n};', start);
  assert.ok(start > 0 && end > start);
  const parser = vm.runInNewContext(source.slice(start, end + 3) + '\nextractReferenceFromText', { cleanFieldValue: x => String(x).trim() });
  const code = newReference();
  assert.equal(parser('Hola, vengo del video.\nVisita: ' + code), '');
  assert.equal(parser('Referencia: junto al parque'), 'junto al parque');
  assert.equal(readReference('Hola\nVisita: ' + code), code);
});

function memoryLedgerModel() {
  const records = new Map();
  return { records, async create(row) { if (records.has(row._id)) throw { code: 11000 }; records.set(row._id, { ...row }); },
    async updateOne(query, update) {
      const row = records.get(query._id);
      if (!row || row.state !== query.state || row.leaseToken !== query.leaseToken) return { matchedCount: 0 };
      Object.assign(row, update.$set); return { matchedCount: 1 };
    } };
}
test('50 simultaneous requests reserve one persisted event identity and send once', async () => {
  const model = memoryLedgerModel(); let calls = 0;
  const built = buildEvent(pageInput, makeVisit(), policy);
  const deps = { ledger: mongooseLedger(model), now, transport: async () => { calls++; return { http: 200, events_received: 1 }; } };
  const results = await Promise.all(Array.from({ length: 50 }, () => deliverOnce(built, deps)));
  assert.equal(calls, 1); assert.equal(results.filter(x => x.accepted).length, 1);
  assert.equal([...model.records.values()][0].state, 'accepted');
  assert.ok([...model.records.values()][0].sentAt);
});
for (const outcome of ['exception', 'rejected', 'zero_received']) test(`uncertain ${outcome} never automatically replays`, async () => {
  const model = memoryLedgerModel(); let calls = 0;
  const built = buildEvent(pageInput, makeVisit(), policy);
  const deps = { ledger: mongooseLedger(model), now, transport: async () => {
    calls++; if (outcome === 'exception') throw new Error('timeout');
    return { http: outcome === 'rejected' ? 400 : 200, events_received: 0 };
  } };
  const first = await deliverOnce(built, deps); const again = await deliverOnce(built, deps);
  assert.equal(first.uncertain, true); assert.equal(again.duplicateOrLocked, true);
  assert.equal(calls, 1); assert.equal([...model.records.values()][0].sentAt, null);
});
test('Meta transport pins dataset and keeps credential out of URL and response', async () => {
  let request;
  const transport = metaTransport({ tokenProvider: () => 'OFFLINE_SECRET_NOT_REAL', fetchImpl: async (url, options) => {
    request = { url, options }; return { status: 200, json: async () => ({ events_received: 1 }) };
  } });
  const result = await transport(buildEvent(pageInput, makeVisit(), policy));
  assert.equal(request.url, `https://graph.facebook.com/v22.0/${SCOPE.dataset}/events`);
  assert.doesNotMatch(request.url + JSON.stringify(result), /OFFLINE_SECRET/);
  assert.equal(request.options.headers.Authorization, 'Bearer OFFLINE_SECRET_NOT_REAL');
  await assert.rejects(() => transport({ ok: true, dataset: 'OTHER' }));
});
test('disabled runtime has no database or external effects', async () => {
  const never = new Proxy({}, { get() { throw new Error('unexpected_database_access'); } });
  const runtime = createRuntime({ VisitModel: never, EventModel: never, policyProvider: () => null,
    transport: async () => { throw new Error('unexpected_network'); }, now: () => now });
  assert.equal((await runtime.capture(body, context)).reason, 'measurement_not_activated');
  assert.equal((await runtime.orderSaved({ country: 'EC', customer: { phone: '593900000001' } }, 'draft')).reason, 'measurement_not_activated');
  assert.equal((await runtime.claim({ phone: '5515998038637', message: 'Hola', providerVerified: true })).reason, 'verified_ec_inbound_required');
});
