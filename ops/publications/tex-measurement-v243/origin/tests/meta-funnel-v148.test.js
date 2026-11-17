const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const browser = require('../public/assets/js/meta-ec-protocolo-g-bridge');
const { historicalFixture, activeFixture: fixture, expectedPixelId } = require('./fixtures/meta-funnel-v150-r5-profile');

const previousPixelId = process.env.META_PIXEL_ID_PROTOCOLO_G;
process.env.META_PIXEL_ID_PROTOCOLO_G = expectedPixelId;
const server = require('../routes/metaEcProtocoloGBridge')._internals;
test.after(() => {
  if (previousPixelId === undefined) delete process.env.META_PIXEL_ID_PROTOCOLO_G;
  else process.env.META_PIXEL_ID_PROTOCOLO_G = previousPixelId;
});

function root(sales = true) {
  const records = [];
  const storage = new Map();
  let salesPlayerPresent = sales;
  const r = {
    location: new URL(fixture.event_source_url),
    navigator: { userAgent: '', sendBeacon: () => true },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: {
      cookie: `ext_id=${fixture.external_id}; _fbp=${fixture.fbp}; _fbc=${fixture.fbc}`,
      referrer: '',
      documentElement: {},
      querySelector: selector => selector === 'video' ? null : salesPlayerPresent ? {} : null,
      querySelectorAll: () => [],
      getElementById: () => null
    },
    fetch: async (url, options) => {
      records.push({ url, options });
      return { ok: true, json: async () => ({ forwarded: true }), clone: () => ({ json: async () => ({ pixelId: expectedPixelId, pixelIds: [expectedPixelId] }) }) };
    },
    MutationObserver: class { constructor(callback) { this.cb = callback; } observe() {} },
    addEventListener: () => {},
    setInterval: () => 1,
    setTimeout: () => 1,
    records,
    setSalesPlayerPresent: value => { salesPlayerPresent = Boolean(value); }
  };
  return r;
}

test('V148 same path informational branch installs no observer and emits no commercial event', () => {
  const r = root(false);
  assert.equal(browser.install(r), false);
  assert.equal(browser.salesBranchIdentity(r), false);
  assert.equal(browser.sendBridgePayload(r, fixture), false);
  assert.equal(r.records.length, 0);
});

test('V148 actual SALES template preserves load, active profile pixel and Lead context', async t => {
  t.mock.method(Date, 'now', () => fixture.attribution_captured_at);
  const r = root();
  assert.equal(browser.install(r), true);
  assert.equal(r.records.length, 1);
  assert.equal(r.__META_EC_PG_STAGES_INSTALLED__, true);
  assert.equal(typeof r.__META_EC_PG_SEND_STAGE__, 'function');
  assert.equal(JSON.parse(r.records[0].options.body).stage, 'landing');
  assert.equal(JSON.parse(r.records[0].options.body).skipMeta, true);
  assert.ok(r.__META_EC_PG_FORM_OBSERVER__ instanceof r.MutationObserver);
  await r.fetch('/api/public/meta-pixel?page=protocolo-g');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(r.__META_EC_PG_BROWSER_PIXEL_ID__, expectedPixelId);
  await r.fetch('/api/public/track', { method: 'POST', body: JSON.stringify({ type: 'Lead', meta: { event_id: fixture.sessionId, external_id: fixture.external_id } }) });
  assert.equal(r.__META_EC_PG_LEAD_EVENT_ID__, fixture.sessionId);
  r.__META_EC_PG_OBSERVER__.cb([{ target: { getAttribute: () => fixture.message } }]);
  const bridgeCall = r.records.find(call => call.url === browser.BRIDGE_URL);
  assert.ok(bridgeCall);
  const forwarded = server.buildVitalismenPayload(JSON.parse(bridgeCall.options.body), { now: fixture.attribution_captured_at });
  assert.equal(forwarded.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(forwarded.payload)), fixture);
  r.__META_EC_PG_OBSERVER__.cb([{ target: { getAttribute: () => fixture.message } }]);
  assert.equal(r.records.filter(call => call.url === browser.BRIDGE_URL).length, 1);
  assert.equal(r.records.filter(call => call.url === '/api/public/track').length, 1);
  assert.equal(r.records.some(call => /graph.facebook|InitiateCheckout|Purchase/.test(JSON.stringify(call))), false);
});

test('V148 A1 preserves verified SALES identity after VTurb replaces the bootstrap player id', async t => {
  t.mock.method(Date, 'now', () => fixture.attribution_captured_at);
  const r = root();
  assert.equal(browser.install(r), true);
  await r.fetch('/api/public/meta-pixel?page=protocolo-g');
  await new Promise(resolve => setImmediate(resolve));
  await r.fetch('/api/public/track', { method: 'POST', body: JSON.stringify({ type: 'Lead', meta: { event_id: fixture.sessionId, external_id: fixture.external_id } }) });
  r.setSalesPlayerPresent(false);
  assert.equal(browser.salesBranchIdentity(r), false);
  r.__META_EC_PG_OBSERVER__.cb([{ target: { getAttribute: () => fixture.message } }]);
  const calls = r.records.filter(call => call.url === browser.BRIDGE_URL);
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].options.body).rendered_branch, 'SALES');
});

test('V148 rejects missing Lead identity, informational branch and divergent profile pixel', () => {
  for (const patch of [{ sessionId: '' }, { rendered_branch: 'INFORMATIONAL' }, { browser_pixel_id: `${expectedPixelId}9` }]) {
    assert.equal(server.buildVitalismenPayload({ ...fixture, ...patch }, { now: fixture.attribution_captured_at }).ok, false);
  }
});

test('V148 organic collection contains no fabricated ad fields and independent browsers do not share attribution', () => {
  const a = root();
  const b = root();
  b.location = new URL('https://vilaliemen.shop/protocolo-g');
  b.document.cookie = 'ext_id=ORGANIC_B';
  const setIdentity = (r, id) => {
    r.__META_EC_PG_BROWSER_PIXEL_ID__ = expectedPixelId;
    r.__META_EC_PG_LEAD_EVENT_ID__ = id;
  };
  setIdentity(a, 'A');
  setIdentity(b, 'B');
  const pa = browser.buildBridgePayload(a, fixture.message);
  const pb = browser.buildBridgePayload(b, fixture.message);
  assert.equal(pa.ad_id, 'A_TEST');
  for (const key of ['campaign_id', 'adset_id', 'ad_id', 'fbclid', 'placement', 'fbc', 'fbp']) assert.equal(pb[key], undefined);
  assert.equal(pb.external_id, 'ORGANIC_B');
});

test('V148 historical fixture remains immutable while V152 preserves the active pixel', () => {
  assert.notEqual(historicalFixture.browser_pixel_id, expectedPixelId);
  assert.equal(fixture.browser_pixel_id, expectedPixelId);
  const base = path.resolve(__dirname, '..');
  for (const [file, hash] of Object.entries({
    'server.js': require('../scripts/lib/tex-measurement-maintenance-v243.cjs').validate(base).protectedFiles['server.js'],
    'public/verdevibe/dist/index.html': 'ddf1a65ff3696a10ce7105523397592a85566cb837447210eecb100d3953cf27',
    'public/assets/js/pixel.js': require('../config/protocolo-g-certification-20260926-freeze.json').protectedFiles['public/assets/js/pixel.js'],
    'public/assets/js/tracking-protocolo-g-formulario-20260815.js': '5f41be56c4bcda1f2d71e3405ca79fda0babb0e0005c3332a227afa75ca7c5df'
  })) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(base, file))).digest('hex'), hash, file);
  const html = fs.readFileSync(path.join(base, 'private/vsl/protocolo-g.html'), 'utf8');
  assert.match(html, /vturb-smartplayer id="ab-6a6023ffd403aabb02392eb9"/);
  assert.match(html, /\/assets\/js\/pixel\.js/);
  assert.match(html, /\/assets\/js\/meta-ec-protocolo-g-bridge\.js/);
  assert.doesNotMatch(html, /tracking-protocolo-g-formulario-20260815\.js/);
});
