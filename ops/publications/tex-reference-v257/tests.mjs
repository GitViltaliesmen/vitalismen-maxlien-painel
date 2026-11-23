import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./whatsapp-tex-v243.js', import.meta.url), 'utf8')
  .split('/* BEGIN TEX_CTA_CLEAR_V248 */')[0];
const validReference = 'TX243-' + 'a'.repeat(64);
const prefix = 'Hola, quiero el tratamiento Tex Ultra.';

function session(reference, { hostname = 'plusmen.shop', pathname = '/tex' } = {}) {
  const assigned = [], attributes = {}, listeners = {}, timers = [];
  const button = { nodeType: 1, id: 'preco_89', disabled: false,
    setAttribute(name, value) { attributes[name] = value; } };
  const window = {
    location: { hostname, pathname, assign(url) { assigned.push(url); } },
    VitpowerMeta: { initiateCheckout(action) { assert.equal(action, 'tex_cta_click_v256'); } },
    TexUltraMeasurementV243: reference === undefined ? undefined : { reference },
    addEventListener(name, fn) { listeners[name] = fn; }, removeEventListener() {},
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {}
  };
  const document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  vm.runInNewContext(source, { window, document, encodeURIComponent });
  const click = () => listeners.click?.({ composedPath: () => [button],
    preventDefault() {}, stopImmediatePropagation() {} });
  return { assigned, attributes, listeners, timers, click, document };
}

const linked = session(() => validReference);
linked.click();
assert.equal(linked.assigned.length, 1);
const linkedUrl = new URL(linked.assigned[0].replace('whatsapp://', 'https://'));
assert.equal(linkedUrl.searchParams.get('phone'), '553171862958');
assert.equal(linkedUrl.searchParams.get('text'), `${prefix}\nReferencia: ${validReference}`);
assert.equal(linked.attributes['data-whatsapp-message'], `${prefix}\nReferencia: ${validReference}`);
linked.click();
assert.equal(linked.assigned.length, 1, 'repeat click cannot open a second composer');
linked.timers[0]();
assert.equal(linked.assigned.length, 2);
assert.equal(new URL(linked.assigned[1]).searchParams.get('text'), `${prefix}\nReferencia: ${validReference}`);

for (const reference of [undefined, () => '', () => 'TX243-invalid', () => { throw Error('unavailable'); }]) {
  const unlinked = session(reference);
  unlinked.click();
  assert.equal(new URL(unlinked.assigned[0].replace('whatsapp://', 'https://')).searchParams.get('text'), prefix);
  assert.equal(unlinked.attributes['data-whatsapp-message'], prefix);
}

for (const where of [{ hostname: 'other.example' }, { pathname: '/exutra' }]) {
  const outside = session(() => validReference, where);
  assert.equal(outside.listeners.click, undefined);
  assert.equal(outside.assigned.length, 0);
}

console.log('PASS: referência válida, mensagem aprovada, fallback, clique único e isolamento da rota');
