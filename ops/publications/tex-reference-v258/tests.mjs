import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHmac, createHash, webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { texMeasurementDisplayCodeV258, texMeasurementReferenceV243 } from '../../../src/services/texUltraMeasurementV243Service.js';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('./tex-measurement-v243.js', import.meta.url), 'utf8');
const records = new Map();
const journal = {
  read: async (kind, key) => records.get(kind + ':' + key) || null,
  write: async (kind, key, value) => { records.set(kind + ':' + key, structuredClone(value)); },
  lock: async (_key, work) => work()
};
const hash = value => createHash('sha256').update(value).digest('hex');
const module = { exports: {} };
const now = Date.parse('2026-11-22T03:00:00Z');
vm.runInNewContext(source, {
  module, exports: module.exports, __dirname: '/opt/cloaker', URL, Date, Number, BigInt, Buffer,
  require: name => name === './lib/tex-measurement-journal-v243.cjs'
    ? { createJournal: () => journal, hash }
    : name === './vitpower-meta-server'
      ? { buildEvent: req => ({ event_source_url: req.body.event_source_url, user_data: {}, custom_data: {} }), sendToMeta: async () => ({ accepted: true, events_received: 1 }) }
      : require(name)
});
const key = 'a'.repeat(64);
const service = module.exports.createTexMeasurementV243({
  config: { pixel_id: '1100892582698669' }, key, enabled: () => true, now: () => now
});
const headers = { origin: 'https://plusmen.shop', 'sec-fetch-site': 'same-origin' };
const issued = await service.issue({ headers, body: { event_source_url: 'https://plusmen.shop/tex?fbclid=test' } });
assert.match(issued.reference, /^TX243-[a-f0-9]{64}$/);
assert.match(issued.displayCode, /^VID-[0-9A-HJKMNPQRSTVWXYZ]{8}$/);
const repeated = await service.issue({ headers, body: { reference: issued.reference, event_source_url: 'https://plusmen.shop/tex' } });
assert.equal(repeated.displayCode, issued.displayCode);
const body = { action: 'resolve', displayCode: issued.displayCode };
const timestamp = String(now);
const request = { headers: { 'x-tex-timestamp': timestamp, 'x-tex-signature': createHmac('sha256', key).update(timestamp + '.' + JSON.stringify(body)).digest('hex') }, body };
let status = 200, response;
await service.proofHandler(request, { set() {}, status(value) { status = value; return this; }, json(value) { response = value; } });
assert.equal(status, 200);
assert.equal(response.reference, issued.reference);
status = 200;
await service.proofHandler({ headers: { ...request.headers, 'x-tex-signature': '0'.repeat(64) }, body },
  { set() {}, status(value) { status = value; return this; }, json() {} });
assert.equal(status, 403);
const message = 'Hola, quiero el tratamiento Tex Ultra.\nVi Tex Ultra en el video y deseo el tratamiento.\nRef: ' + issued.displayCode;
assert.equal(texMeasurementDisplayCodeV258(message), issued.displayCode);
assert.equal(texMeasurementDisplayCodeV258(message + '\ncomprar'), '');
assert.equal(texMeasurementReferenceV243(message), '');

const meta = fs.readFileSync(new URL('./meta-tex-ultra.js', import.meta.url), 'utf8');
async function browserVisit({ denied = false } = {}) {
  const local = {}, session = {}, requests = [];
  const localStorage = new Proxy({ getItem: key => local[key] ?? null, setItem: (key, value) => { local[key] = value; }, removeItem: key => { delete local[key]; } },
    { ownKeys: () => Object.keys(local), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  const sessionStorage = { getItem: key => session[key] ?? null, setItem: (key, value) => { session[key] = value; } };
  const document = { cookie: '', readyState: 'complete', visibilityState: 'visible', head: { appendChild() {} },
    createElement: () => ({}), querySelector: () => ({}), addEventListener() {} };
  const visit = {
    location: new URL('https://plusmen.shop/tex'), crypto: webcrypto, metaTrackingConsent: !denied, fbq() {},
    fetch: (url, options) => {
      const requestBody = JSON.parse(options.body);
      requests.push({ url, body: requestBody });
      return Promise.resolve({ json: async () => requestBody.action === 'issue' ? issued : { ok: false } });
    }, setInterval() {}, addEventListener() {}
  };
  vm.runInNewContext(meta, { window: visit, document, navigator: {}, localStorage, sessionStorage, URL,
    Uint8Array, Uint32Array, TextEncoder, Blob, Date, Set, Promise });
  await new Promise(resolve => setTimeout(resolve, 0));
  return { visit, requests, session };
}
const browser = await browserVisit();
assert.equal(browser.visit.TexUltraMeasurementV243.displayCode(), issued.displayCode);
assert.equal(JSON.parse(browser.session.tex_measurement_v258).reference, issued.reference);
assert.equal(browser.requests.filter(item => item.body.action === 'issue').length, 1);
const deniedBrowser = await browserVisit({ denied: true });
assert.equal(deniedBrowser.visit.TexUltraMeasurementV243?.displayCode?.() || '', '');
assert.equal(deniedBrowser.requests.length, 0);

const whatsapp = fs.readFileSync(new URL('./whatsapp-tex-v243.js', import.meta.url), 'utf8').split('/* BEGIN TEX_CTA_CLEAR_V248 */')[0];
const handlers = {}, assigned = [], button = { nodeType: 1, id: 'preco_89', disabled: false, setAttribute() {} };
const window = {
  location: { hostname: 'plusmen.shop', pathname: '/tex', assign: url => assigned.push(url) },
  VitpowerMeta: { initiateCheckout: action => assert.equal(action, 'tex_cta_click_v256') },
  TexUltraMeasurementV243: { displayCode: () => issued.displayCode },
  addEventListener: (name, handler) => { handlers[name] = handler; }, removeEventListener() {}, setTimeout: () => 1, clearTimeout() {}
};
vm.runInNewContext(whatsapp, { window, document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }, encodeURIComponent });
handlers.click({ composedPath: () => [button], preventDefault() {}, stopImmediatePropagation() {} });
assert.equal(assigned.length, 1);
assert.equal(new URL(assigned[0]).searchParams.get('text'), message);
const fallbackHandlers = {}, fallbackAssigned = [];
const fallbackWindow = {
  location: { hostname: 'plusmen.shop', pathname: '/tex', assign: url => fallbackAssigned.push(url) },
  VitpowerMeta: { initiateCheckout: action => assert.equal(action, 'tex_cta_click_v256') },
  TexUltraMeasurementV243: { displayCode: () => '' },
  addEventListener: (name, handler) => { fallbackHandlers[name] = handler; }, removeEventListener() {},
  setTimeout: () => 1, clearTimeout() {}
};
vm.runInNewContext(whatsapp, { window: fallbackWindow, document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }, encodeURIComponent });
fallbackHandlers.click({ composedPath: () => [button], preventDefault() {}, stopImmediatePropagation() {} });
assert.equal(new URL(fallbackAssigned[0]).searchParams.get('text'), 'Hola, quiero el tratamiento Tex Ultra.');
console.log('PASS V258: alias curto, resolução assinada, parser exato e WhatsApp preservado');
