import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createVitPowerWebAgentV220, WEB_CHAT_TOOLS_V220, webChatPrivacyDecisionV220 } from '../src/services/vitPowerWebAgentV220Service.js';
import { createVitPowerWebStoreV220 } from '../src/services/vitPowerWebStoreV220Service.js';
import { createVitPowerWebChatHandlerV220 } from '../src/services/vitPowerWebChatV220Application.js';
const say = content => ({ role: 'assistant', content });
const call = (name, args = {}) => ({ role: 'assistant', content: null, tool_calls: [{ id: 'test_' + name, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
const fact = value => ({ ok: true, verified: true, source: 'official-fixture', ...value });
function fixture(script = [say('¿En qué puedo ayudarte?')], options = {}) {
  let calls = 0; const seen = [];
  const agent = createVitPowerWebAgentV220({ complete: async args => { calls++; seen.push(args); return script.shift(); },
    products: async () => fact({ products: [{ key: 'vit_power_ec', name: 'Vit Power' }] }),
    offer: async quantity => fact({ productKey: 'vit_power_ec', quantity, currency: 'USD', total: { 1: 39.99, 3: 95.99, 6: 167.99 }[quantity] }),
    productInformation: async topic => topic === 'ingredients' ? fact({ productKey: 'vit_power_ec', ingredients: ['borojó', 'maca'] }) : { ok: false },
    policy: async topic => topic === 'delivery' ? fact({ text: 'Entrega: domicilio o agencia Servientrega.' }) : { ok: false }, ...options });
  return { agent, seen, calls: () => calls };
}
test('web adapter has no order registration, preview or transport tool', () => {
  const names = WEB_CHAT_TOOLS_V220.map(t => t.function.name);
  assert(!names.includes('register_confirmed_order')); assert(!names.includes('prepare_order_summary')); assert(!names.includes('send_whatsapp'));
});
test('ingredients and price are answered in customer order from official facts', async () => {
  const f = fixture([say('No reemplaza los hechos.')]); const r = await f.agent.reply({ text: '¿Que contiene Vit Power? ¿Cuanto cuestan 3 frascos?' });
  assert(r.reply.indexOf('Composición') < r.reply.indexOf('Precio:')); assert.match(r.reply, /95\.99/); assert.equal(r.draft.quantity, undefined); assert.equal(r.handoff, false);
});
test('opposite order is preserved and shipment conditions are not invented', async () => {
  const f = fixture([say('Le ayudo.')]); const r = await f.agent.reply({ text: '¿Cuanto cuesta? ¿Como llega a domicilio?', draft: { quantity: 3, city: 'Quito' } });
  assert(r.reply.indexOf('Precio:') < r.reply.indexOf('Entrega:')); assert.equal(r.draft.city, 'Quito'); assert.doesNotMatch(r.reply, /gratis|24 horas|48 horas/);
});
test('unknown payment and stock refer to visitor action, without pretending transfer', async () => {
  const f = fixture([say('Le ayudo.')]); const r = await f.agent.reply({ text: '¿Como pago? ¿Hay stock? ¿Cuanto cuesta?' });
  assert.equal(r.handoff, true); assert.match(r.reply, /botón de abajo/); assert.doesNotMatch(r.reply, /pago contra entrega|ya.*transfer|hay existencias/i); assert.match(r.reply, /95\.99/);
});
test('quantity query alone cannot be turned into a package selection by the model', async () => {
  const f = fixture([call('capture_customer_detail', { field: 'quantity', value: 3, evidence: '3 frascos' }), say('Le ayudo.')]);
  const r = await f.agent.reply({ text: '¿Cuanto cuestan 3 frascos?' }); assert.equal(r.draft.quantity, undefined); assert.match(r.reply, /95\.99/);
});
test('explicit quantity and city are captured only into the anonymous web draft', async () => {
  const f = fixture([call('capture_customer_detail', { field: 'quantity', value: 3, evidence: 'Quiero 3 frascos' }), call('capture_customer_detail', { field: 'city', value: 'Quito', evidence: 'Quito' }), say('Le ayudo.')]);
  const r = await f.agent.reply({ text: 'Quiero 3 frascos en Quito. ¿Cuanto cuesta?' }); assert.equal(r.draft.quantity, 3); assert.equal(r.draft.city, 'Quito'); assert.match(r.reply, /95\.99/);
});
test('memory is supplied in the web context without a fake phone or WhatsApp identity', async () => {
  const f = fixture([say('Su ciudad guardada es Quito.')]); const r = await f.agent.reply({ text: '¿Cual es mi ciudad?', draft: { city: 'Quito' }, history: [{ role: 'user', content: 'Estoy en Quito' }] });
  assert.match(r.reply, /Quito/); assert(f.seen[0].messages.some(x => x.content?.includes('"city":"Quito"'))); assert(!JSON.stringify(f.seen).includes('inboundProvider":"zapi'));
});
test('invented commercial prices and order claims fail to the official continuation', async () => {
  for (const answer of ['Su pedido fue registrado.', 'Cuesta USD 1.00.']) {
    const f = fixture([say(answer)]), r = await f.agent.reply({ text: 'Ayudame a continuar' }); assert.equal(r.handoff, true); assert(!r.reply.includes(answer));
  }
});
test('unsupported tool and injected extra arguments are refused', async () => {
  for (const request of [call('register_confirmed_order'), call('consult_price', { quantity: 3, phone: 'foreign' })]) {
    const f = fixture([request]); await assert.rejects(() => f.agent.reply({ text: 'Ayudame' }), /tool_rejected/);
  }
});
test('health statements and payment secrets are not sent to the model', async () => {
  for (const text of ['Tengo diabetes', '¿Puedo tomar con medicamentos?', 'Mi tarjeta es 4111 1111 1111 1111', 'Mi codigo de verificacion es 123456']) {
    assert(webChatPrivacyDecisionV220(text)); const f = fixture(), r = await f.agent.reply({ text }); assert.equal(f.calls(), 0); assert.equal(r.redactedInput, true);
  }
});
test('a stalled completion is stopped within the turn deadline', async () => {
  const f = fixture([], { timeoutMs: 40, complete: () => new Promise(() => {}) }); await assert.rejects(() => f.agent.reply({ text: 'Hola' }), /deadline/);
});
async function withStore(run, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vitalismen-web-v220-test-'));
  try { await run(createVitPowerWebStoreV220({ directory, minFreeBytes: 0, ...options }), directory); }
  finally { assert(path.basename(directory).startsWith('vitalismen-web-v220-test-')); await fs.rm(directory, { recursive: true, force: true }); }
}
const result = { reply: 'Respuesta de prueba.', draft: {}, modelUsed: true };
test('two anonymous sessions do not share drafts or history', async () => withStore(async store => {
  const a = await store.open(''), b = await store.open(''); assert.notEqual(a.token, b.token);
  await store.transact(a.token, 'request_session_a_1', 'Quito', async () => ({ ...result, draft: { city: 'Quito' } }));
  assert.equal((await store.open(b.token)).value.history.length, 0); assert.equal((await store.open(a.token)).value.draft.city, 'Quito');
}));
test('durable request dedupe survives a store instance restart', async () => withStore(async (store, directory) => {
  const a = await store.open(''); let calls = 0;
  const run = async () => { calls++; return result; };
  await store.transact(a.token, 'request_durable_001', 'Hola', run);
  const next = createVitPowerWebStoreV220({ directory, minFreeBytes: 0 });
  assert.equal((await next.transact(a.token, 'request_durable_001', 'Hola', run)).duplicate, true); assert.equal(calls, 1);
  await assert.rejects(() => next.transact(a.token, 'request_durable_001', 'Diferente', run), /conflict/);
}));
test('failed or uncertain requests are terminal and are never repeated automatically', async () => withStore(async store => {
  const a = await store.open(''); let calls = 0; const run = async () => { calls++; throw Error('provider_unavailable'); };
  await assert.rejects(() => store.transact(a.token, 'request_uncertain_01', 'Hola', run));
  await assert.rejects(() => store.transact(a.token, 'request_uncertain_01', 'Hola', run), /previous_outcome/); assert.equal(calls, 1);
}));
test('concurrent requests on the same session do not start a second model turn', async () => withStore(async store => {
  const a = await store.open(''); let finish;
  const first = store.transact(a.token, 'request_concurrent_01', 'Hola', async () => new Promise(r => { finish = r; }));
  await new Promise(r => setTimeout(r, 30));
  await assert.rejects(() => store.transact(a.token, 'request_concurrent_02', 'Hola', async () => result), /busy/); finish(result); await first;
}));
test('quota and session limits fail closed while history remains bounded', async () => withStore(async store => {
  const a = await store.open('');
  for (let i = 0; i < 20; i++) await store.transact(a.token, 'request_bounded_' + i, 'Hola ' + i, async () => result);
  assert.equal((await store.open(a.token)).value.history.length, 40);
  await assert.rejects(() => store.transact(a.token, 'request_bounded_21', 'Hola', async () => result), /session_limit/);
}, { dailyTurns: 20 }));
test('redacted private input is not persisted as readable text', async () => withStore(async store => {
  const a = await store.open(''); await store.transact(a.token, 'request_privacy_001', 'private-secret-value', async () => ({ ...result, redactedInput: true }));
  assert(!JSON.stringify((await store.open(a.token)).value).includes('private-secret-value'));
}));
test('expired session is replaced and clearing one session preserves another', async () => {
  let time = Date.now(); await withStore(async store => {
    const a = await store.open(''), b = await store.open(''); await store.clear(a.token); assert.equal((await store.open(b.token)).fresh, false);
    time += 8 * 86400000; assert.equal((await store.open(b.token)).fresh, true);
  }, { now: () => time });
});
function req(body, headers = {}) { return { method: 'POST', originalUrl: '/api/web-chat/vitpower', headers: { 'content-length': '100', 'x-vitalismen-chat-ip': '192.0.2.1', ...headers }, body, is: type => type === 'application/json' }; }
function res() { return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } }; }
test('unauthorized public route never touches storage or model', async () => {
  const h = createVitPowerWebChatHandlerV220({ authority: () => ({ requestAllowed: () => false }), store: { open() { throw Error('must_not_call'); } } });
  const r = res(); await h(req({ action: 'start' }), r); assert.equal(r.statusCode, 403);
});
test('session cookie is Secure HttpOnly host-only, and injected fields are rejected', async () => {
  const h = createVitPowerWebChatHandlerV220({ authority: () => ({ requestAllowed: () => true }), store: { open: async () => ({ token: 'a'.repeat(64), value: { history: [], expiresAt: 1, turnCount: 0 } }) } });
  const r = res(); await h(req({ action: 'start' }), r); assert.equal(r.statusCode, 200); assert.match(r.headers['Set-Cookie'], /Secure; HttpOnly; SameSite=Lax/); assert.doesNotMatch(r.headers['Set-Cookie'], /Domain=/);
  const bad = res(); await h(req({ action: 'start', phone: 'foreign' }), bad); assert.equal(bad.statusCode, 400);
});
test('handler rate limit and invalid IP are independent of user-controlled body', async () => {
  const h = createVitPowerWebChatHandlerV220({ authority: () => ({ requestAllowed: () => true }), store: { open: async () => ({ token: 'b'.repeat(64), value: { history: [], expiresAt: 1, turnCount: 0 } }) } });
  const bad = res(); await h(req({ action: 'start' }, { 'x-vitalismen-chat-ip': 'not-an-ip' }), bad); assert.equal(bad.statusCode, 403);
  let last; for (let i = 0; i < 31; i++) { last = res(); await h(req({ action: 'start' }), last); } assert.equal(last.statusCode, 429);
});

test('parallel anonymous starts cannot exceed the session capacity', async () => {
 await withStore(async store => {
  const outcomes = await Promise.allSettled(Array.from({length: 12}, () => store.open('')));
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 2);
  assert(outcomes.filter(x => x.status === 'rejected').every(x => /capacity/.test(x.reason.message)));
 }, {maxSessions: 2});
});
test('two model slots are bounded globally and released after completion', async () => {
 let count=0, releases=[];
 const h=createVitPowerWebChatHandlerV220({authority:()=>({requestAllowed:()=>true}),agent:{reply:async()=>{count++;return new Promise(resolve=>releases.push(()=>resolve({reply:'Hola'})))}},store:{transact:async(t,i,m,run)=>run({})}});
 const r1=res(),r2=res(),r3=res();
 const a=h(req({action:'message',requestId:'concurrent_1234567',message:'Hola'}),r1),b=h(req({action:'message',requestId:'concurrent_1234568',message:'Hola'}),r2);
 await new Promise(resolve=>setImmediate(resolve));await h(req({action:'message',requestId:'concurrent_1234569',message:'Hola'}),r3);
 assert.equal(count,2);assert.equal(r3.statusCode,429);releases.splice(0).forEach(f=>f());await Promise.all([a,b]);
 const r4=res(),c=h(req({action:'message',requestId:'concurrent_1234570',message:'Hola'}),r4);await new Promise(resolve=>setImmediate(resolve));assert.equal(count,3);releases.splice(0).forEach(f=>f());await c;assert.equal(r4.statusCode,200);
});
test('IP rate map rejects excess distinct sources and accepts a new window', async () => {
 let time=Date.now();const h=createVitPowerWebChatHandlerV220({now:()=>time,authority:()=>({requestAllowed:()=>true}),store:{open:async()=>({token:'a'.repeat(64),value:{history:[],expiresAt:1,turnCount:0}})}});
 for(let i=0;i<3000;i++){const r=res();await h(req({action:'start'},{'x-vitalismen-chat-ip':'2001:db8::'+i.toString(16)}),r);assert.equal(r.statusCode,200)}
 const blocked=res();await h(req({action:'start'},{'x-vitalismen-chat-ip':'2001:db8::ffff'}),blocked);assert.equal(blocked.statusCode,429);
 time+=600001;const next=res();await h(req({action:'start'},{'x-vitalismen-chat-ip':'2001:db8::ffff'}),next);assert.equal(next.statusCode,200);
});

test('recalling an earlier price question answers the remembered quantity without listing all offers', async () => {
 const f=fixture([say('Me preguntaste por 3 frascos.')]);
 const r=await f.agent.reply({text:'¿De cuántos frascos te pregunté el precio?',history:[{role:'user',content:'¿Cuánto cuestan 3 frascos?'},{role:'assistant',content:'Precio: 3 frascos: USD 95.99.'}]});
 assert.equal(r.reply,'En tu consulta anterior mencionaste 3 frascos.');assert.equal(f.calls(),0);assert.equal(r.modelUsed,false);assert.equal(r.draft.quantity,undefined);assert.equal(r.handoff,false);
});

test('quantity recall uses customer history instead of the assistant price table', async () => {
 const f=fixture([say('must not run')]);const r=await f.agent.reply({text:'¿De cuántos frascos te pregunté el precio?',history:[{role:'user',content:'¿Cuánto cuestan tres frascos?'},{role:'assistant',content:'1 frasco USD 39.99, 3 frascos USD 95.99, 6 frascos USD 167.99'}]});assert.match(r.reply,/3 frascos/);assert.equal(r.modelUsed,false);assert.equal(f.calls(),0);assert.equal(r.draft.quantity,undefined);
});
test('ambiguous earlier quantities require clarification without choosing an order', async () => {
 const f=fixture();const r=await f.agent.reply({text:'¿De cuántos frascos te pregunté el precio?',history:[{role:'user',content:'precio de 3 o 6 frascos'}]});assert.match(r.reply,/inequívoca/);assert.equal(r.draft.quantity,undefined);assert.equal(f.calls(),0);
});
test('quantity recall without evidence asks only the missing quantity', async () => {
 const f=fixture();const r=await f.agent.reply({text:'¿Cuántos frascos dije que quiero?',history:[]});assert.match(r.reply,/Cuántos frascos/);assert.equal(r.modelUsed,false);assert.equal(f.calls(),0);
});
test('confirmed web draft quantity is preserved when an order choice is recalled', async () => {
 const f=fixture();const r=await f.agent.reply({text:'¿Cuántos frascos dije que quiero?',draft:{quantity:3,city:'Quito'},history:[{role:'user',content:'¿Y 6 frascos cuánto cuestan?'}]});assert.match(r.reply,/3 frascos/);assert.equal(r.draft.city,'Quito');assert.equal(r.draft.quantity,3);assert.equal(r.modelUsed,false);
});
test('quantity recall does not suppress other questions in the same message', async () => {
 const f=fixture([say('Le ayudo con la consulta completa.')]);await f.agent.reply({text:'¿De cuántos frascos te pregunté el precio? ¿Y la entrega?',history:[{role:'user',content:'3 frascos'}]});assert.equal(f.calls(),1);
});
