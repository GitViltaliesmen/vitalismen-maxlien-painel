import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
const source = readFileSync(new URL('../ops/browser/vitpower-2026g-cta-v213.js', import.meta.url), 'utf8');
const message = 'Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?';
const reference = 'VP-' + 'A'.repeat(36);

function browser({ consent = undefined, qa = false, mobile = true, fail = false, noReply = false, dnt = false,
  storage = new Map(), cookieJar = new Map(), search, slowEvents = false, desktopMetadata = true } = {}) {
  const listeners = {}, calls = [], requests = [], urls = [], cookies = cookieJar, timers = [];
  let intersection;
  const attributes = { 'data-product': 'vit_power_ec', 'data-vsl-source': 'https://taviazen.shop/vitpower_2026g', 'data-whatsapp-phone': desktopMetadata ? '553171862958' : 'OTHER' };
  const button = { id: mobile ? 'preco_89' : '', tagName: 'A', getAttribute(k) { return attributes[k]; },
    removeAttribute(k) { delete attributes[k]; }, setAttribute(k,v) { attributes[k]=v; } };
  const hero = {};
  const doc = { scripts: [], visibilityState: 'visible', prerendering: false, documentElement: {},
    head: { appendChild(s) { doc.scripts.push(s); } }, createElement() { return {}; },
    querySelector(s) { if (s === 'vturb-smartplayer') return mobile ? {} : null; if (s.startsWith('a[')) return desktopMetadata ? button : null; return hero; },
    getElementById() { return mobile ? button : null; }, addEventListener(name, callback) { listeners[name] = callback; },
    get cookie() { return [...cookies].map(([k, v]) => k + '=' + encodeURIComponent(v)).join('; '); },
    set cookie(value) { const [pair] = value.split(';'); const p = pair.indexOf('='); cookies.set(pair.slice(0, p), decodeURIComponent(pair.slice(p + 1))); },
  };
  const win = { location: { hostname: 'taviazen.shop', pathname: '/vitpower_2026g',
    search: search ?? ('?fbclid=OFFLINE_CLICK_CASE&utm_source=facebook&ad_id=OFFLINE_AD' + (qa ? '&vp_qa=1' : '')),
    assign(url) { urls.push(url); } }, crypto: webcrypto, navigator: { doNotTrack: dnt ? '1' : '0' },
    vitalismenMarketingConsent: consent, fbq(...args) { calls.push(args); },
    localStorage: { getItem(k) { return storage.get(k); }, setItem(k, value) { storage.set(k, value); } },
    setTimeout(callback, ms) { timers.push({ callback, ms }); return timers.length; },
    addEventListener(name, callback) { listeners[name] = callback; },
    IntersectionObserver: class { constructor(callback) { intersection = callback; } observe() {} disconnect() {} },
    async fetch(url, options) { requests.push({ url, body: JSON.parse(options.body) });
      if (slowEvents && JSON.parse(options.body).events.length > 0) return new Promise(() => {});
      if (noReply) return new Promise(() => {}); if (fail) throw new Error('offline failure');
      return { ok: true, json: async () => ({ ok: true, reference }) };
    },
  };
  const context = vm.createContext({ window: win, document: doc, URLSearchParams, Uint8Array, DataView,
    MutationObserver: class { observe() {} }, Promise, Date, Array, encodeURIComponent, decodeURIComponent });
  const run = () => vm.runInContext(source, context);
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const click = () => listeners.click({ target: button, isTrusted: true, button: 0,
    composedPath: () => [button], preventDefault() {}, stopImmediatePropagation() {} });
  run(); return { win, doc, listeners, calls, requests, urls, cookies, storage, timers, run, settle, click,
    showContent: () => intersection?.([{ isIntersecting: true }]) };
}

test('browser captures cookies/UTMs and emits PV VC click/contact sharing CAPI IDs', async () => {
  const b = browser(); await b.settle(); b.showContent(); b.click(); await b.settle();
  const events = b.calls.filter(x => /^trackSingle/.test(x[0]));
  assert.deepEqual(events.map(x => x[2]), ['PageView', 'ViewContent', 'CtaClick', 'Contact']);
  assert.ok(events.every(x => x[1] === '28298613626504767'));
  for (const row of events) assert.ok(b.requests.some(r => r.body.events.some(e => e.name === row[2] && e.id === row[4].eventID)));
  assert.equal(b.requests[0].body.ad_id, 'OFFLINE_AD');
  assert.equal(b.requests[0].body.utm_source, 'facebook');
  assert.match(b.requests[0].body.fbc, /^fb\.1\.\d{13}\.OFFLINE_CLICK_CASE$/);
  assert.match(b.requests[0].body.fbp, /^fb\.1\.\d{13}\.\d+$/);
  const destination = new URL(b.urls[0]);
  assert.equal(destination.pathname, '/553171862958');
  assert.equal(destination.searchParams.get('text'), message);
  assert.deepEqual([...destination.searchParams.keys()], ['text']);
  assert.doesNotMatch(destination.href, /OFFLINE_CLICK_CASE|OFFLINE_AD|utm_source|_fbp/);
});
test('repeated visibility, content observations and script installation do not duplicate events', async () => {
  const b = browser(); b.run(); b.showContent(); b.showContent(); b.listeners.visibilitychange(); await b.settle();
  assert.deepEqual(b.calls.filter(x => /^trackSingle/.test(x[0])).map(x => x[2]), ['PageView', 'ViewContent']);
});
for (const [label, options] of [['denied consent', { consent: false }], ['DNT', { dnt: true }], ['QA', { qa: true }]])
  test(`${label} leaves CTA usable with zero cookies, Pixel events or CAPI requests`, async () => {
    const b = browser(options); b.click(); await b.settle();
    assert.equal(b.cookies.size, 0); assert.equal(b.calls.length, 0); assert.equal(b.requests.length, 0);
    assert.equal(new URL(b.urls[0]).searchParams.get('text'), message);
  });
test('failed tracking request does not block the existing WhatsApp CTA', async () => {
  const b = browser({ fail: true }); b.click(); await b.settle();
  assert.equal(new URL(b.urls[0]).searchParams.get('text'), message);
});
test('slow tracking times out at 900ms without blocking the commercial click', async () => {
  const b = browser({ noReply: true }); b.click(); await b.settle(); assert.equal(b.urls.length, 0);
  b.timers.find(t => t.ms === 900).callback(); await b.settle(); assert.equal(b.urls.length, 1);
});
test('double click navigates once and never invents checkout or purchase', async () => {
  const b = browser({ mobile: false }); b.click(); b.click(); await b.settle();
  assert.equal(b.urls.length, 1);
  const events = b.calls.filter(x => /^trackSingle/.test(x[0]));
  assert.ok(events.every(x => !['InitiateCheckout', 'Purchase'].includes(x[2])));
  assert.equal(events[0][3].page_variant, 'desktop');
});
test('return without URL parameters preserves visitor, click and campaign attribution', async () => {
  const first = browser(); await first.settle();
  const second = browser({ search: '', storage: first.storage, cookieJar: first.cookies }); await second.settle();
  assert.equal(second.requests[0].body.visitorId, first.requests[0].body.visitorId);
  assert.notEqual(second.requests[0].body.visitId, first.requests[0].body.visitId);
  assert.equal(second.requests[0].body.fbclid, 'OFFLINE_CLICK_CASE');
  assert.equal(second.requests[0].body.ad_id, 'OFFLINE_AD');
  assert.equal(second.requests[0].body.fbc, first.requests[0].body.fbc);
});
test('new campaign does not inherit unrelated old campaign fields', async () => {
  const first = browser(); await first.settle();
  const second = browser({ search: '?fbclid=NEW_OFFLINE_CLICK&utm_source=facebook&utm_campaign=NEW',
    storage: first.storage, cookieJar: first.cookies }); await second.settle();
  assert.equal(second.requests[0].body.fbclid, 'NEW_OFFLINE_CLICK');
  assert.equal(second.requests[0].body.utm_campaign, 'NEW');
  assert.equal(second.requests[0].body.ad_id, undefined);
  assert.match(second.requests[0].body.fbc, /\.NEW_OFFLINE_CLICK$/);
});
test('direct visit does not fabricate a Meta click identifier', async () => {
  const b = browser({ search: '' }); await b.settle();
  assert.equal(b.requests[0].body.fbc, ''); assert.equal(b.requests[0].body.fbclid, '');
  assert.ok(b.requests[0].body.fbp);
});
test('expired stored attribution is not reused', async () => {
  const storage = new Map([['_vp_attribution_v213', JSON.stringify({ capturedAt: Date.now() - 31 * 86400000,
    fbclid: 'EXPIRED_CLICK', utm_campaign: 'EXPIRED_CAMPAIGN' })]]);
  const b = browser({ search: '', storage }); await b.settle();
  assert.equal(b.requests[0].body.fbclid, ''); assert.equal(b.requests[0].body.utm_campaign, undefined);
});
test('visit reference stays internal and clean CTA works before Meta replies', async () => {
  const b = browser({ slowEvents: true }); await b.settle(); b.click(); await b.settle();
  b.timers.find(t => t.ms === 900).callback(); await b.settle();
  assert.equal(new URL(b.urls[0]).searchParams.get('text'), message);
  assert.equal(b.requests[0].body.events.length, 0);
});

test('real desktop CTA without mobile id uses clean message and tracks one click', async () => {
  const b=browser({mobile:false}); await b.settle(); b.click(); await b.settle();
  assert.deepEqual(b.calls.filter(x=>/^trackSingle/.test(x[0])).map(x=>x[2]),['PageView','CtaClick','Contact']);
  assert.equal(new URL(b.urls[0]).searchParams.get('text'),message);
});
test('desktop link with foreign phone is never intercepted or counted',async()=>{
 const b=browser({mobile:false,desktopMetadata:false}); await b.settle(); b.click(); await b.settle();
 assert.equal(b.urls.length,0); assert.equal(b.calls.filter(x=>x[2]==='CtaClick'||x[2]==='Contact').length,0);
});

test('all mobile and desktop destinations contain only the approved commercial message',async()=>{for(const mobile of [true,false]){const b=browser({mobile});await b.settle();b.click();await b.settle();const u=new URL(b.urls[0]);assert.equal(u.searchParams.get('text'),message);assert.equal(u.searchParams.get('text').split('\n').length,3);assert.doesNotMatch(u.href,/VP-|Visita|utm_|fbclid|_fbp/);}});
