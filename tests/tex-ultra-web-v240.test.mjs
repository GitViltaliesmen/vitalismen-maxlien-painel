import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { TEX_ULTRA_WEB_V240, createTexUltraWebFunnelV240, texUltraWebQuantityV240 } from '../src/services/texUltraWebFunnelV240Service.js';
import { createVitPowerWebStoreV220 } from '../src/services/vitPowerWebStoreV220Service.js';
import { createWebDashboardReaderV222 } from '../src/services/vitPowerWebDashboardV222Service.js';
import { getEcuadorOffer } from '../src/services/ecuadorProductService.js';

const context = { productKey: 'tex_ultra_ec' };
const price = async quantity => ({ ...getEcuadorOffer({ productKey: 'tex_ultra_ec', quantity, priceCatalog: 'promotional' }), ok: true, verified: true, source: 'ecuadorProductService.promotional', currency: 'USD' });
const make = ({ offer = price, reply = async ({ draft }) => ({ reply: 'Respuesta oficial disponible.', draft: { ...draft }, handoff: false, modelUsed: true }) } = {}) => createTexUltraWebFunnelV240({ agent: { reply }, offer });
async function temporary(run) { const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vitalismen-tex-web-')); try { await run(directory); } finally { await fs.rm(directory, { recursive: true, force: true }); } }

test('Tex context has the exact approved site, product, offer and Ana identity', () => {
  assert.equal(TEX_ULTRA_WEB_V240.productKey, 'tex_ultra_ec'); assert.equal(TEX_ULTRA_WEB_V240.origin, 'https://plusmen.shop'); assert.equal(TEX_ULTRA_WEB_V240.sourcePath, '/tex'); assert.equal(TEX_ULTRA_WEB_V240.priceCatalog, 'promotional'); assert.deepEqual(TEX_ULTRA_WEB_V240.quantities, [1, 2, 3, 6]); assert.match(TEX_ULTRA_WEB_V240.welcome, /Ana Lopez.*Tex Ultra Ecuador/);
});
test('clear choices recognize all four approved quantities without selecting from a question or refusal', () => {
  for (const [text, q] of [['1', 1], ['dos frascos', 2], ['quiero 3 frascos', 3], ['deseo seis frascos', 6]]) assert.equal(texUltraWebQuantityV240(text), q);
  for (const text of ['¿Cuánto cuestan 3 frascos?', 'precio 2 frascos', 'no quiero 3 frascos', 'quiero 2 o 3', '7', 'tengo 3 preguntas']) assert.equal(texUltraWebQuantityV240(text), null);
});
test('greeting starts the Tex funnel without consulting the model or another product', async () => {
  const result = await make({ reply() { throw Error('model_should_not_run'); } }).reply({ text: 'Hola' }); assert.match(result.reply, /Tex Ultra/); assert.equal(result.draft.texUltraStage, 'discovery'); assert.equal(result.modelUsed, false); assert.equal(result.handoff, false);
});
test('the four choices use the real official promotional catalog without rewriting prices', async () => {
  for (const [q, total] of [[1, 35.99], [2, 70], [3, 80.99], [6, 147.99]]) { const r = await make().reply({ text: 'quiero ' + q + ' frascos' }); assert.equal(r.draft.quantity, q); assert.match(r.reply, new RegExp('USD ' + total.toFixed(2).replace('.', '\\.'))); assert.equal(r.draft.texUltraStage, 'quantity_selected'); }
});
test('a price question preserves the stage and never records a quantity as a purchase', async () => {
  let used = 0; const r = await make({ reply: async ({ text, draft }) => { used++; assert.match(text, /3/); return { reply: '3 frascos: USD 80.99.', draft, modelUsed: true }; } }).reply({ text: '¿Cuánto cuestan 3 frascos?', draft: { name: 'Carlos' } }); assert.equal(used, 1); assert.equal(r.draft.quantity, undefined); assert.equal(r.draft.name, 'Carlos'); assert.equal(r.draft.texUltraStage, 'discovery');
});
test('unverified or wrong-product offers fail closed with explicit human continuation', async () => {
  for (const row of [{ ok: false }, { ...(await price(3)), verified: false }, { ...(await price(3)), productKey: 'vit_power_ec' }, { ...(await price(3)), total: NaN }]) { const r = await make({ offer: async () => row }).reply({ text: '3 frascos' }); assert.equal(r.draft.quantity, undefined); assert.equal(r.handoff, true); assert.match(r.reply, /No puedo confirmar/); }
});
test('the recent same-session history prevents asking the same closing question again', async () => {
  const first = await make().reply({ text: '2 frascos' }); const next = await make().reply({ text: '2 frascos', draft: first.draft, history: [{ role: 'assistant', content: first.reply }] }); assert.doesNotMatch(next.reply, /¿Quieres continuar/); assert.equal(next.draft.quantity, 2);
});
test('confirmation requires an earlier choice and never claims an order or outbound message', async () => {
  const r = await make().reply({ text: 'sí', draft: { quantity: 3, texUltraStage: 'quantity_selected' } }); assert.equal(r.handoff, true); assert.equal(r.draft.texUltraStage, 'whatsapp_ready'); assert.match(r.reply, /Todavía no se ha registrado un pedido/); assert.doesNotMatch(r.reply, /https?:/);
  const noChoice = await make().reply({ text: 'sí' }); assert.equal(noChoice.handoff, false); assert.equal(noChoice.draft.quantity, undefined);
});
test('opt-out and explicit human requests retain data and do not restart the funnel', async () => {
  const r = await make().reply({ text: 'STOP', draft: { quantity: 6 } }); assert.equal(r.draft.quantity, 6); assert.equal(r.draft.texUltraStage, 'opted_out'); assert.equal(r.handoff, false);
  const human = await make().reply({ text: 'quiero hablar con una persona', draft: { quantity: 2 } }); assert.equal(human.draft.quantity, 2); assert.equal(human.draft.texUltraStage, 'human_requested'); assert.equal(human.handoff, true);
});
test('new Tex records carry immutable server identity and preserve legacy Vit Power session shape', () => temporary(async directory => {
  const store = createVitPowerWebStoreV220({ directory, minFreeBytes: 0 }); const vp = await store.open(''), tex = await store.open('', context); assert.equal(vp.value.productKey, undefined); assert.equal(tex.value.productKey, 'tex_ultra_ec'); assert.equal(tex.value.sourceOrigin, 'https://plusmen.shop'); assert.equal(tex.value.sourcePath, '/tex'); assert.notEqual(vp.token, tex.token);
}));
test('cookies/tokens cannot read, transact or clear a session from the other product', () => temporary(async directory => {
  const store = createVitPowerWebStoreV220({ directory, minFreeBytes: 0 }); const tex = await store.open('', context); const vp = await store.open(tex.token); assert.notEqual(vp.token, tex.token); assert.equal(vp.fresh, true);
  let reached = false; await assert.rejects(store.transact(tex.token, 'cross_product_0001', 'hola', async () => { reached = true; return { reply: 'no' }; }), /session_expired/); assert.equal(reached, false); await assert.rejects(store.clear(tex.token), /session_expired/); assert.equal((await store.open(tex.token, context)).fresh, false);
}));
test('all products share the existing daily quota instead of silently doubling capacity', () => temporary(async directory => {
  const store = createVitPowerWebStoreV220({ directory, minFreeBytes: 0, dailyTurns: 1 }); const vp = await store.open(''), tex = await store.open('', context); await store.transact(vp.token, 'vp_request_000001', 'hola', async () => ({ reply: 'Hola', draft: {} })); await assert.rejects(store.transact(tex.token, 'tex_request_00001', 'hola', async () => ({ reply: 'Hola' }), context), /daily_limit/);
}));
test('Tex requests retain idempotency and never retry an uncertain model outcome', () => temporary(async directory => {
  const store = createVitPowerWebStoreV220({ directory, minFreeBytes: 0 }); const tex = await store.open('', context); let calls = 0; const run = async () => { calls++; throw Error('model_uncertain'); }; await assert.rejects(store.transact(tex.token, 'tex_request_00002', 'hola', run, context), /model_uncertain/); await assert.rejects(store.transact(tex.token, 'tex_request_00002', 'hola', run, context), /previous_outcome_uncertain/); assert.equal(calls, 1);
}));
test('the existing dashboard reads and labels Tex records including two bottles', () => temporary(async directory => {
  const store = createVitPowerWebStoreV220({ directory, minFreeBytes: 0 }); const tex = await store.open('', context); await store.transact(tex.token, 'tex_dashboard_001', 'dos frascos', async () => ({ reply: '2 frascos de Tex Ultra: USD 70.00.', draft: { quantity: 2, texUltraStage: 'quantity_selected' } }), context);
  const reader = createWebDashboardReaderV222({ directory: path.join(directory, 'sessions') }); const list = await reader.list(); assert.equal(list.length, 1); assert.equal(list[0].productKey, 'tex_ultra_ec'); assert.equal(list[0].sourcePath, '/tex'); assert.equal(list[0].quantity, 2); assert.equal(list[0].funnelStage, 'quantity_selected'); const id = createHash('sha256').update(tex.token).digest('hex'); const detail = await reader.read(id); assert.equal(detail.history.length, 2); assert.equal(detail.productName, 'Tex Ultra Ecuador');
}));
test('legacy Vit Power dashboard data remains unlabelled and unchanged', () => temporary(async directory => {
  const store = createVitPowerWebStoreV220({ directory, minFreeBytes: 0 }); const vp = await store.open(''); await store.transact(vp.token, 'vp_dashboard_001', 'hola', async () => ({ reply: 'Hola', draft: { quantity: 3 } })); const reader = createWebDashboardReaderV222({ directory: path.join(directory, 'sessions') }); const list = await reader.list(); assert.equal(list.length, 1); assert.equal(list[0].productKey, undefined); assert.equal(list[0].quantity, 3);
}));

test('model draft cannot silently select quantity from a question or switch the product', async () => {
  const question = await make({ reply: async () => ({ reply: 'Consulta de precio.', draft: { quantity: 3 }, modelUsed: true }) }).reply({ text: 'Quiero saber cuánto cuestan 3 frascos' });
  assert.equal(question.draft.quantity, undefined);
  const held = await make({ reply: async () => ({ reply: 'Respuesta a la consulta.', draft: { quantity: 6 } }) }).reply({ text: '¿Y cómo se entrega?', draft: { quantity: 2, texUltraStage: 'quantity_selected' } }); assert.equal(held.draft.quantity, 2);
  const foreign = await make({ reply: async () => ({ reply: 'Vit Power tiene otra oferta.', draft: {}, modelUsed: true }) }).reply({ text: 'Dime otro producto' }); assert.equal(foreign.handoff, true); assert.match(foreign.reply, /Tex Ultra Ecuador/); assert.doesNotMatch(foreign.reply, /Vit Power/);
});
