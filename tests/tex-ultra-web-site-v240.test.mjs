import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
const source = fs.readFileSync(new URL('../ops/publications/tex-ultra-web-v240/chat-tex-ultra.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture({ hostname = 'plusmen.shop', pathname = '/tex', hasPlayer = true, wrongIdentity = false } = {}) {
  const nodes = [], calls = [], plays = [], queue = [], windowListeners = {}; let ctaVisible = false;
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.attributes = {}; this.dataset = {}; this.hidden = false; this.value = ''; this.textContent = ''; nodes.push(this); }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
    after(node) { this.parentElement?.append(node); }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    addEventListener(name, run) { this.listeners[name] = run; }
    async fire(name, event = {}) { return this.listeners[name]?.({ preventDefault() {}, ...event }); }
    closest() { return wrapper; }
    querySelector() { return null; }
    getClientRects() { return this === cta && !ctaVisible ? [] : [{}]; }
    checkVisibility() { return this !== cta || ctaVisible; }
    scrollIntoView() { this.scrolled = true; }
    focus() { this.focused = true; }
  }
  const body = new Node('body'), wrapper = new Node('div'), player = new Node('vturb-smartplayer'), cta = new Node('button'); cta.id = 'preco_89'; body.append(wrapper); wrapper.append(player);
  const document = { body, createElement: tag => new Node(tag), querySelector: () => hasPlayer ? player : null, getElementById: id => nodes.find(node => node.id === id), addEventListener() {} };
  const context = { window: { addEventListener(name, handler) { windowListeners[name] = handler; } }, document, location: { hostname, pathname }, crypto: { randomUUID }, AbortController, Blob, URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    MutationObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: fn => fn(), getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    Audio: class { constructor(url) { this.url = url; } async play() { plays.push(this.url); } pause() {} },
    fetch: async (url, options) => { const payload = JSON.parse(options.body); calls.push({ url, options, payload }); if (queue.length) return queue.shift()(payload);
      const data = payload.action === 'start' ? { ok: true, identity: { productKey: wrongIdentity ? 'vit_power_ec' : 'tex_ultra_ec', origin: 'https://plusmen.shop', sourcePath: '/tex' }, welcome: 'Ana · Tex Ultra', history: [] }
        : { ok: true, reply: '<img src=x onerror=alert(1)> Tex Ultra', handoff: true };
      return { ok: true, headers: { get: key => payload.action === 'voice' && key === 'content-type' ? 'audio/mpeg' : 'application/json' }, json: async () => data, arrayBuffer: async () => new Uint8Array(160).buffer };
    } };
  vm.runInNewContext(source, context);
  return { nodes, calls, plays, queue, context, fireWindow: (name, event = {}) => windowListeners[name]?.(event), visible: value => { ctaVisible = value; }, cta, get: id => nodes.find(node => node.id === id), find: text => nodes.find(node => node.textContent === text) };
}
test('the chat starts only on the exact Tex page/player and never starts requests or voice on page load', () => {
  for (const options of [{ hostname: 'ec.maxlien.shop' }, { pathname: '/exutra' }, { hasPlayer: false }]) { const f = fixture(options); assert.equal(f.calls.length, 0); assert.equal(f.find('Habla con Ana · Tex Ultra'), undefined); }
  const f = fixture(); assert(f.find('Habla con Ana · Tex Ultra')); assert.equal(f.get('texUltraChatV240').hidden, true); assert.equal(f.calls.length, 0); assert.equal(f.plays.length, 0);
  assert.deepEqual(f.context.document.body.children.map(node => node.tagName), ['div', 'button', 'section']);
});
test('opening requires server Tex identity and renders content as text without auto voice', async () => {
  const denied = fixture({ wrongIdentity: true }); await denied.find('Habla con Ana · Tex Ultra').fire('click'); await flush(); assert.equal(denied.find('Enviar').disabled, true); assert.equal(denied.calls.length, 1);
  const f = fixture(); await f.find('Habla con Ana · Tex Ultra').fire('click'); await flush(); assert.equal(f.find('Enviar').disabled, false); assert.equal(f.plays.length, 0);
  f.get('texUltraChatInputV240').value = 'hola'; await f.nodes.find(node => node.tagName === 'form').fire('submit');
  const literal = f.find('<img src=x onerror=alert(1)> Tex Ultra'); assert(literal); assert.equal(literal.tagName, 'p'); assert.equal(f.nodes.some(node => node.tagName === 'img'), false);
  assert.equal(f.calls[1].url, '/api/public/tex-ultra-chat'); assert.equal(f.calls[1].options.credentials, 'same-origin');
  assert.equal(f.find('Ir al botón WhatsApp del video').hidden, true); f.visible(true); await f.find('Ir al botón WhatsApp del video').fire('click'); assert.equal(f.cta.scrolled, true); assert.equal(f.cta.focused, true); assert.equal(f.calls.length, 2);
  await f.find('Escuchar a Ana').fire('click'); assert.equal(f.calls[2].payload.action, 'voice'); assert.equal(f.plays.length, 1);
});
test('a double submission starts one request and an ambiguous failure is not automatically retried', async () => {
  const f = fixture(); await f.find('Habla con Ana · Tex Ultra').fire('click'); await flush();
  let finish; f.queue.push(() => new Promise(resolve => { finish = resolve; }));
  const form = f.nodes.find(node => node.tagName === 'form'), input = f.get('texUltraChatInputV240'); input.value = '2 frascos'; const pending = form.fire('submit'); input.value = '2 frascos'; await form.fire('submit'); assert.equal(f.calls.length, 2);
  finish({ ok: false, status: 503 }); await pending; await flush(); assert.equal(f.calls.length, 2); assert.equal(f.find('Enviar').disabled, true);
});
test('returning through browser cache reloads owned history and never repeats an interrupted message', async () => {
  const f = fixture(); await f.find('Habla con Ana · Tex Ultra').fire('click'); await flush();
  let finish; f.queue.push(() => new Promise(resolve => { finish = resolve; })); f.get('texUltraChatInputV240').value = 'mi consulta'; const pending = f.nodes.find(node => node.tagName === 'form').fire('submit');
  f.fireWindow('pagehide'); assert.equal(f.find('Enviar').disabled, true); f.fireWindow('pageshow', { persisted: true }); await flush();
  assert.deepEqual(f.calls.map(row => row.payload.action), ['start', 'message', 'start']); assert.equal(f.find('Enviar').disabled, false);
  finish({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ ok: true, reply: 'Respuesta anterior tardía' }) }); await pending;
  assert.equal(f.find('Respuesta anterior tardía'), undefined); assert.equal(f.plays.length, 0);
});
