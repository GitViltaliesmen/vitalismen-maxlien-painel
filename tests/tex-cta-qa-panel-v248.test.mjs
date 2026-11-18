import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const base = new URL('../ops/publications/tex-cta-qa-panel-v248/', import.meta.url);
const stage = new URL('../ops/candidates/tex-cta-qa-panel-v248-20261118/', import.meta.url);
const read = (path, root = base) => fs.readFileSync(new URL(path, root), 'utf8');
const addon = read('cta-label.js'), qa = read('qa-panel.js');
const manifest = JSON.parse(read('manifest.json', stage));
const sha = b => createHash('sha256').update(b).digest('hex');

function ctaFixture({ host = 'plusmen.shop', route = '/tex', shadow = false, disabled = false, hidden = false } = {}) {
  let observerCallback, frame, interval;
  const attrs = new Map(), nav = [], events = {}, timers = new Map();
  const button = { tagName: 'BUTTON', nodeType: 1, id: 'preco_89', disabled, hidden,
    textContent: 'QUIERO TENER LA VERGA DURA', getAttribute: key => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value) };
  const styles = [];
  const root = { querySelectorAll: s => s === '#preco_89' ? [button] : [],
    querySelector: s => styles.find(x => '#' + x.id === s), appendChild: x => styles.push(x) };
  const doc = { ...root, readyState: 'complete', head: { appendChild: x => styles.push(x) },
    createElement: tagName => ({ tagName }), visibilityState: 'visible',
    addEventListener: (n, fn) => { events[n] = fn; }, removeEventListener: () => {} };
  if (shadow) { doc.querySelectorAll = s => s === '*' ? [{ shadowRoot: root }] : []; }
  const window = { location: { hostname: host, pathname: route, assign: x => nav.push(x) },
    addEventListener: (n, fn) => { events[n] = fn; }, removeEventListener: () => {},
    setInterval: fn => { interval = fn; }, setTimeout: fn => { timers.set(1, fn); return 1; }, clearTimeout: key => timers.delete(key),
    VitpowerMeta: { initiateCheckout: () => { window.checkouts = (window.checkouts || 0) + 1; } } };
  const context = vm.createContext({ window, document: doc, location: window.location,
    MutationObserver: class { constructor(fn) { observerCallback = fn; } observe() {} },
    requestAnimationFrame: fn => { frame = fn; }, Set });
  vm.runInContext(read('built/whatsapp-tex-v243.js', stage), context);
  const click = (target = button) => events.click({ target: { closest: selector => selector === '#preco_89' && target.id === 'preco_89' ? target : null }, composedPath: () => [target], preventDefault() {}, stopImmediatePropagation() {} });
  return { button, attrs, nav, events, timers, styles, window, click,
    mutate: () => { observerCallback?.(); frame?.(); }, tick: () => { interval?.(); frame?.(); } };
}

test('CTA: copy explicitly names product and WhatsApp', () => {
  const f = ctaFixture(); assert.equal(f.button.textContent, manifest.cta.label);
  assert.equal(f.attrs.get('aria-label'), manifest.cta.label); assert.equal(f.styles.length, 1);
});
test('CTA: shadow-root button receives same copy and style', () => {
  const f = ctaFixture({ shadow: true }); assert.equal(f.button.textContent, manifest.cta.label); assert.equal(f.styles.length, 1);
});
test('CTA: hidden and disabled states remain intact', () => {
  const f = ctaFixture({ hidden: true, disabled: true }); assert.equal(f.button.hidden, true); assert.equal(f.button.disabled, true); f.click(); assert.equal(f.nav.length, 0);
});
test('CTA: exact message/phone, native app and duplicate click protection', () => {
  const f = ctaFixture(); f.click(); f.click(); assert.equal(f.nav.length, 1);
  const u = new URL(f.nav[0]); assert.equal(u.protocol, 'whatsapp:'); assert.equal(u.searchParams.get('phone'), manifest.cta.phone); assert.equal(u.searchParams.get('text'), manifest.cta.message); assert.equal(f.window.checkouts, 1);
});
test('CTA: same wa.me fallback when app remains unavailable', () => {
  const f = ctaFixture(); f.click(); f.timers.get(1)(); const u = new URL(f.nav.at(-1));
  assert.equal(u.origin, 'https://wa.me'); assert.equal(u.pathname, '/' + manifest.cta.phone); assert.equal(u.searchParams.get('text'), manifest.cta.message);
});
test('CTA: leaving page cancels fallback', () => {
  const f = ctaFixture(); f.click(); f.events.pagehide(); assert.equal(f.timers.size, 0);
});
test('CTA: wrong host and wrong route remain untouched', () => {
  for (const options of [{ host: 'example.com' }, { route: '/another-product' }]) {
    const f = ctaFixture(options); assert.equal(f.styles.length, 0); assert.notEqual(f.button.textContent, manifest.cta.label); assert.equal(f.events.click, undefined);
  }
});
test('CTA: repeated DOM updates do not duplicate button/style or send', () => {
  const f = ctaFixture(); f.mutate(); f.tick(); f.mutate(); assert.equal(f.styles.length, 1); assert.equal(f.nav.length, 0);
});
test('CTA: unrelated clicks do not open WhatsApp', () => {
  const f = ctaFixture(); f.click({ nodeType: 1, id: 'elsewhere' }); assert.equal(f.nav.length, 0);
});

function qaFixture({ record, apiError = false, deferred = false } = {}) {
  let chat = { phone: '5515998038637' }, scope = 'a', time = 200000, refreshes = 0, calls = 0, resolve;
  const context = vm.createContext({}); vm.runInContext(qa, context);
  const ui = context.createQaPanelUiV248({ getChat: () => chat, getScope: () => scope, now: () => time,
    refresh: () => refreshes++, api: async () => { calls++; if (apiError) throw Error('offline'); if (deferred) await new Promise(r => { resolve = r; }); return record; } });
  return { ui, chat: () => chat, calls: () => calls, refreshes: () => refreshes,
    switch: () => { chat = { phone: '593969190899' }; scope = 'b'; }, expire: () => { time = 400000; }, resolve: () => resolve?.() };
}
const record = (expiresAt = 300000) => ({ phoneDigits: '5515998038637', metadata: { testOnly: true,
  qaTestContextV78: { version: 78, phone: '5515998038637', status: 'armed', expiresAt: new Date(expiresAt).toISOString() } } });
test('QA: before server read never claims online/active permit', () => {
  const f = qaFixture(); assert.equal(f.ui.status(f.chat()).kind, 'loading'); assert.match(f.ui.emptyHtml(f.chat()), /Consultando/);
});
test('QA: expired permit shows ended window and next operational step', async () => {
  const f = qaFixture({ record: record(100000) }); await f.ui.load(); assert.equal(f.ui.status(f.chat()).kind, 'closed'); assert.match(f.ui.emptyHtml(f.chat()), /Controle do Bot/); assert.doesNotMatch(f.ui.emptyHtml(f.chat()), /BOT ONLINE/);
});
test('QA: valid native permit shows active and expires without renewal', async () => {
  const f = qaFixture({ record: record() }); await f.ui.load(); assert.equal(f.ui.status(f.chat()).kind, 'active'); f.expire(); assert.equal(f.ui.status(f.chat()).kind, 'closed'); assert.equal(f.calls(), 1);
});
test('QA: missing/wrong/cancelled permit cannot claim active', async () => {
  for (const permit of [null, { ...record().metadata.qaTestContextV78, phone: '5515998038638' }, { ...record().metadata.qaTestContextV78, status: 'revoked' }]) {
    const value = record(); value.metadata.qaTestContextV78 = permit;
    const f = qaFixture({ record: value }); await f.ui.load(); assert.equal(f.ui.status(f.chat()).kind, 'closed');
  }
});
test('QA: API failure and identity mismatch show unavailable', async () => {
  for (const options of [{ apiError: true }, { record: { ...record(), phoneDigits: '593969190899' } }]) {
    const f = qaFixture(options); await f.ui.load(); assert.equal(f.ui.status(f.chat()).kind, 'error');
  }
});
test('QA: ordinary customers keep original empty-state and status', async () => {
  const f = qaFixture({ record: record() }); f.switch(); await f.ui.load(); assert.equal(f.calls(), 0); assert.equal(f.ui.status(f.chat()), null); assert.equal(f.ui.emptyHtml(f.chat()), '<div class="empty">Sem mensagens salvas para este cliente.</div>');
});
test('QA: late response cannot change another selected customer', async () => {
  const f = qaFixture({ record: record(), deferred: true }); const p = f.ui.load(); f.switch(); f.resolve(); await p; assert.equal(f.refreshes(), 0);
});
test('QA: repeated refresh shares pending read and respects TTL', async () => {
  const f = qaFixture({ record: record(), deferred: true }); const p = f.ui.load(); await f.ui.load(); assert.equal(f.calls(), 1); f.resolve(); await p; await f.ui.load(); assert.equal(f.calls(), 1);
});
test('QA: Brazilian suffix/another number never receives QA behavior', () => {
  const f = qaFixture(); assert.equal(f.ui.status({ phone: '15515998038637' }), null); assert.equal(f.ui.status({ phone: '5515998038638' }), null);
});
test('QA: helper has only read API and contains no message, state, permit writes', () => {
  assert.equal((qa.match(/await api\(/g) || []).length, 1); assert.doesNotMatch(qa, /POST|PATCH|DELETE|localStorage|sessionStorage|sendText|routeIncomingMessage|\.save\(/);
});
test('integrity: native WhatsApp handler remains exactly the approved prefix', () => {
  const b = Buffer.from(read('built/whatsapp-tex-v243.js', stage)); const suffix = Buffer.from(manifest.cta.addonBase64, 'base64');
  assert.equal(sha(b), manifest.cta.sha256); assert.equal(sha(suffix), manifest.cta.addonSha256); assert.equal(sha(b.subarray(0, -suffix.length)), manifest.cta.beforeSha256);
});
test('integrity: exact inverse restores every byte of official panel', () => {
  let panel = Buffer.from(read('built/qr.html', stage)); assert.equal(sha(panel), manifest.panel.sha256);
  for (const p of [...manifest.panel.patches].reverse()) {
    const before = Buffer.from(p.beforeBase64, 'base64'), after = Buffer.from(p.afterBase64, 'base64');
    const n = panel.indexOf(after); assert.ok(n >= 0); assert.equal(panel.indexOf(after, n + 1), -1);
    panel = Buffer.concat([panel.subarray(0, n), before, panel.subarray(n + after.length)]);
  }
  assert.equal(sha(panel), manifest.panel.beforeSha256);
});
test('syntax: every executable inline script in entire published panel compiles', () => {
  const html = read('built/qr.html', stage); let count = 0;
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc=/.test(m[1]) || /type=["']application\//.test(m[1])) continue;
    new vm.Script(m[2]); count++;
  }
  const original = read('official/qr.html', stage);
  const originalCount = [...original.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(m => !/\bsrc=/.test(m[1]) && !/type=["']application\//.test(m[1])).length;
  assert.ok(count > 0); assert.equal(count, originalCount);
});
test('actual panel command badge preserves global-off and human precedence', async () => {
  const f = qaFixture({ record: record(100000) }); await f.ui.load();
  const html = read('built/qr.html', stage);
  const source = html.slice(html.indexOf('        const setAttendancePulse = (chat) => {'), html.indexOf('        const customerDraftFromForm = () => {'));
  const nodes = new Map(['claimBtn','manualStatus','commandStatusBtn'].map(id => [id,{classList:{remove(){},add(){}},textContent:'',disabled:false}]));
  let active = true;
  const ctx = vm.createContext({ qaPanelUiV248:f.ui, el:id=>nodes.get(id), autoReplyGloballyActive:()=>active, automationOffLabel:()=> 'BOT DESLIGADO - OBSERVADOR ATIVO' });
  vm.runInContext(source,ctx);
  ctx.chat={phone:'5515998038637',human:{mode:'auto'}};vm.runInContext('setAttendancePulse(chat)',ctx);assert.equal(nodes.get('commandStatusBtn').textContent,'TESTE: JANELA ENCERRADA');
  ctx.chat.human.mode='manual';vm.runInContext('setAttendancePulse(chat)',ctx);assert.equal(nodes.get('commandStatusBtn').textContent,'HUMANO NO COMANDO');
  active=false;vm.runInContext('setAttendancePulse(chat)',ctx);assert.equal(nodes.get('commandStatusBtn').textContent,'BOT DESLIGADO - OBSERVADOR ATIVO');
  active=true;ctx.chat={phone:'593969190899',human:{mode:'auto'}};vm.runInContext('setAttendancePulse(chat)',ctx);assert.equal(nodes.get('commandStatusBtn').textContent,'BOT ONLINE');
});
test('guard rejects forged phone/hash, altered addon and expanded panel patch', () => {
  const script = fileURL('../scripts/guard-tex-cta-qa-panel-v248.mjs');
  for (const mutate of [m=>{m.cta.phone='5515991418416';m.cta.sha256='a'.repeat(64);},m=>{m.cta.addonBase64=Buffer.from('unapproved').toString('base64');},m=>{m.panel.patches.push(m.panel.patches[0]);}]) {
    const value=structuredClone(manifest);mutate(value);const filename=path.join(os.tmpdir(),'vitalismen-v248-negative-'+crypto.randomUUID()+'.json');
    try {fs.writeFileSync(filename,JSON.stringify(value),{flag:'wx'});const r=spawnSync(process.execPath,[script,'--manifest',filename],{encoding:'utf8',windowsHide:true});assert.notEqual(r.status,0);}
    finally {fs.unlinkSync(filename);}
  }
});
function fileURL(relative){return new URL(relative,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1').replace(/%20/g,' ');}
