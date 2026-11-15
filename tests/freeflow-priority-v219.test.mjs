import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture } from './principal-sdr-freeflow.test.mjs';
import { questionPlanV219, prioritizeFreeflowV219, formatQuestionAnswerV219, allQuestionsMappedV219 } from '../src/services/freeflowQuestionPriorityV219Service.js';
const say = content => ({ role: 'assistant', content });
const call = (name, args = {}, id = 'v219_call') => ({ role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
const message = (text, id = 'v219_question_01') => ({ phone: '593999000001', messageId: id, text });
const fact = x => ({ ok: true, verified: true, source: 'official-fixture/v219', ...x });
const price = q => ({ 1: 39.99, 2: 70, 3: 95.99, 6: 167.99 })[q];
const make = options => fixture({ questionPriorityEnabled: true, price, script: [say('Texto generado que no sustituye hechos oficiales.')], ...options });
test('V219 applies only to eligible Vit Power question turns', () => {
  for (const productKey of ['tex_ultra_ec', 'nitrix_ec', '']) assert.equal(prioritizeFreeflowV219({ productKey, enabled: true, text: '¿Cuanto cuesta?' }), false);
  assert.equal(prioritizeFreeflowV219({ productKey: 'vit_power_ec', enabled: false, text: '¿Cuanto cuesta?' }), false);
  for (const text of ['Hola', '3', 'Nombre: José\nCiudad: Quito\nCantidad: 3']) assert.deepEqual(questionPlanV219(text), []);
  assert.equal(prioritizeFreeflowV219({ productKey: 'vit_power_ec', enabled: true, text: '¿Cuanto cuesta?\nNombre: José' }), true);
});
test('question topics follow customer order and contraentrega is not an extra delivery question', () => {
  assert.deepEqual(questionPlanV219('¿Aceptan tarjeta? ¿Cual es el precio? ¿Que garantia tiene?').map(q => q.topic), ['payment', 'price', 'guarantee']);
  assert.deepEqual(questionPlanV219('¿Pago contra entrega?').map(q => q.topic), ['payment']);
  assert.equal(allQuestionsMappedV219('¿Cual es el precio? ¿Cual es mi ciudad guardada?'), false);
});
for (const [a, b] of [['payment', 'price'], ['price', 'payment'], ['stock', 'price'], ['guarantee', 'price'], ['price', 'guarantee']]) {
  test(`known answer and unavailable condition remain in asked order: ${a}/${b}`, async () => {
    const phrases = { payment: '¿Como pago?', price: '¿Cual es el precio?', stock: '¿Hay stock?', guarantee: '¿Que garantia tiene?' };
    const f = make(); const r = await f.send(message(phrases[a] + ' ' + phrases[b]));
    const labels = { payment: 'Forma de pago:', price: 'Precio:', stock: 'Disponibilidad:', guarantee: 'Garantía:' };
    assert(r.reply.indexOf(labels[a]) < r.reply.indexOf(labels[b]));
    assert.match(r.reply, /39\.99/); assert.match(r.reply, /95\.99/); assert.match(r.reply, /167\.99/);
    assert.equal(r.handoffRequested, true); assert.equal(f.effects.handoffs.length, 1); assert.equal(f.effects.orders.length, 0);
    assert.doesNotMatch(r.reply, /garantía de \d|hay existencias|pago contra entrega/i);
  });
}
test('explicit quantity is saved before question handling; only missing data is requested', async () => {
  const f = make({ context: { draft: { name: 'José', city: 'Quito', province: 'Pichincha' } } });
  const r = await f.send(message('Quiero 3 frascos. ¿Cuanto cuesta?'));
  assert.equal(f.data.draft.quantity, 3); assert.equal(f.effects.drafts.length, 1); assert.equal(r.priceOptionsPresented, false);
  assert.match(r.reply, /95\.99/); assert.doesNotMatch(r.reply, /39\.99|nombre|ciudad|provincia/i); assert.match(r.reply, /domicilio|agencia/);
});
test('a price inquiry alone never chooses a package for the customer', async () => {
  const f = make(); const r = await f.send(message('¿Cuanto cuestan 3 frascos?'));
  assert.match(r.reply, /95\.99/); assert.equal(f.data.draft.quantity, undefined); assert.equal(f.effects.drafts.length, 0); assert.equal(f.effects.orders.length, 0);
});
test('approved ingredients and price share one response without restarting presentation', async () => {
  const f = make({ productInformation: fact({ productKey: 'vit_power_ec', ingredients: ['borojó', 'maca'] }) });
  const r = await f.send(message('¿Que contiene? ¿Cual es el precio?'));
  assert(r.reply.indexOf('Composición') < r.reply.indexOf('Precio:')); assert.match(r.reply, /borojó, maca/); assert.equal(r.handoffRequested, false);
});
test('shipping cost is not invented from package price or delivery mode', async () => {
  const f = make(); const r = await f.send(message('¿Cuanto cuesta el envio?'));
  assert.match(r.reply, /Costo de envío:/); assert.doesNotMatch(r.reply, /USD/); assert.equal(r.handoffRequested, true);
});
test('questions prevent registration even if the model requests it', async () => {
  const f = make({ script: [call('register_confirmed_order'), say('Pedido registrado.')] });
  const r = await f.send(message('¿Cual es el precio?'));
  assert.equal(f.effects.orders.length, 0); assert.doesNotMatch(r.reply, /Pedido registrado/);
});
test('human mode, optout and active orders remain blocked before the model', async () => {
  for (const context of [{ humanMode: 'manual' }, { optedOut: true }, { orderLocked: true }]) {
    const f = make({ context }); const r = await f.send(message('¿Cual es el precio?'));
    assert.equal(r.send, false); assert.equal(f.effects.model.length, 0); assert.equal(f.effects.drafts.length, 0);
  }
});
test('duplicate inbound cannot send another response or mutate the draft again', async () => {
  const f = make(), m = message('Quiero 3 frascos. ¿Cuanto cuesta?'); await f.send(m); const r = await f.send(m);
  assert.equal(r.send, false); assert.equal(f.effects.drafts.length, 1); assert.equal(f.effects.orders.length, 0);
});
test('mixed memory and price questions retain generated answers instead of replacing them with only price options', async () => {
  const f = make({ context: { draft: { city: 'Quito' } }, script: [call('consult_price_options'), say('Las opciones son USD 39.99, USD 95.99 y USD 167.99. Su ciudad guardada es Quito.')] });
  const r = await f.send(message('¿Cual es el precio? ¿Cual es mi ciudad guardada?'));
  assert.match(r.reply, /Quito/); assert.equal(r.handoffRequested, false);
});
test('ordered renderer rejects malformed verified facts', () => {
  assert.throws(() => formatQuestionAnswerV219('price', fact({ offers: [fact({ productKey: 'tex_ultra_ec', quantity: 3, total: 80, currency: 'USD' })] })), /unverified_price/);
  assert.throws(() => formatQuestionAnswerV219('ingredients', fact({ productKey: 'nitrix_ec', ingredients: ['x'] })), /unverified_ingredients/);
});
test('engine retains B01 first, bypasses fixed FAQs only for approved question priority, and preserves order data', () => {
  const s = fs.readFileSync('src/services/conversationEngine.js', 'utf8');
  assert(s.indexOf('const entry = await handleVitPowerB01InboundV216') < s.indexOf('const questionPriorityEnabledV219'));
  assert.match(s, /directProductInquiry = questionPriorityV219 \? \{ handled: false \}/);
  assert.match(s, /ingredientsFaq = questionPriorityV219 \? \{ handled: false \}/);
  assert.match(s, /!structuredOrderData && !quantityOnly/);
});
