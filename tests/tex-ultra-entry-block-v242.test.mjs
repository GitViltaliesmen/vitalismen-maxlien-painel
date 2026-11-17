import test from 'node:test';
import assert from 'node:assert/strict';
import { texUltraPreferredNameV242, buildTexUltraEntryBlockV242, startTexUltraEntryV242, validateTexUltraEntryBlockV242, withTexModelContextV242 } from '../src/services/texUltraEntryBlockV242Service.js';

test('uses a preferred first name without creating or changing an order identity', () => {
  const draft = { quantity: 2, city: 'Quito', orderCustomerName: 'Dato existente' };
  const result = startTexUltraEntryV242({ firstName: '  Juan   Carlos  ', draft, date: new Date('2026-11-17T15:00:00Z') });
  assert.match(result.reply, /Hola, Juan, buenos días/);
  assert.equal(result.draft.name, 'Juan');
  assert.equal(result.draft.orderCustomerName, draft.orderCustomerName);
  assert.equal(result.draft.quantity, 2);
  assert.equal(result.draft.city, 'Quito');
  assert.equal(result.modelUsed, false);
  assert.deepEqual(draft, { quantity: 2, city: 'Quito', orderCustomerName: 'Dato existente' });
  const existing = startTexUltraEntryV242({ firstName: 'Juan', draft: { name: 'Nombre completo existente', quantity: 3 } });
  assert.equal(existing.draft.name, 'Nombre completo existente'); assert.equal(existing.draft.preferredFirstName, 'Juan');
});
test('retains accents and allows anonymous entry without greeting with a phone or placeholder', () => {
  assert.equal(texUltraPreferredNameV242('José Luis'), 'José');
  assert.equal(texUltraPreferredNameV242('María-José'), 'María-José');
  const result = startTexUltraEntryV242({ date: new Date('2026-11-17T20:00:00Z') });
  assert.match(result.reply, /Hola, buenas tardes/);
  assert.doesNotMatch(result.reply, /undefined|null|\[NOMBRE\]/);
  for (const name of ['593999999999', '<img src=x>', 'Cliente', 'A', 'a'.repeat(61), { name: 'Juan' }]) assert.throws(() => texUltraPreferredNameV242(name), /name_invalid/);
});
test('uses exactly the approved greeting, one universal audio, proof1, Tex bottle and promotional offer order', () => {
  const block = buildTexUltraEntryBlockV242({ date: new Date('2026-11-17T20:00:00Z') });
  assert.deepEqual(block.steps.map(x => x.key), ['greeting', 'intro', 'proof', 'bottle', 'offer']);
  assert.deepEqual(block.steps.map(x => x.type), ['text', 'audio', 'image', 'image', 'text']);
  assert.match(block.steps[0].text, /Soy Ana López/);
  assert.equal(block.steps[1].src, '/tex-assets/tex-entry-v242/intro.mp3');
  assert.equal(block.steps[2].src, '/tex-assets/tex-entry-v242/proof.jpeg');
  assert.match(block.steps[3].text, /Tex Ultra Ecuador/);
  for (const price of ['35.99', '70.00', '80.99', '147.99']) assert.ok(block.steps[4].text.includes(price));
  assert.doesNotMatch(JSON.stringify(block), /Vit Power|Nitrix|meses|wa\.me|checkout|Purchase/);
});
test('does not restart an entry or reset existing questions, optout, manual handoff or chosen quantity', () => {
  for (const draft of [{ texUltraEntryV242: { started: true } }, { texUltraStage: 'opted_out' }, { texUltraStage: 'human_requested' }, { texUltraStage: 'whatsapp_ready' }]) {
    const result = startTexUltraEntryV242({ firstName: 'Juan', draft });
    assert.equal(result.entryBlock, undefined);
    assert.deepEqual(result.draft, draft);
  }
  assert.equal(startTexUltraEntryV242({ history: [{ role: 'user', content: 'Precio?' }], draft: { quantity: 3 } }).entryBlock, undefined);
});
test('rejects swapped product/media/order and remote or executable URLs before persistence', () => {
  const original = buildTexUltraEntryBlockV242();
  for (const change of [b => b.productKey = 'vit_power_ec', b => b.steps.reverse(), b => b.steps[2].src = 'https://foreign.invalid/image', b => b.steps[1].src = 'javascript:alert(1)', b => b.steps[0].src = '/extra', b => b.steps[3].onclick = 'evil', b => b.steps.pop()]) {
    const value = structuredClone(original); change(value); assert.throws(() => validateTexUltraEntryBlockV242(value), /block_invalid/);
  }
  const copy = validateTexUltraEntryBlockV242(original); copy.steps[0].text = 'changed'; assert.notEqual(original.steps[0].text, 'changed');
});
test('verified phone and channel controls are never sent to the model and cannot be overwritten by it', async () => {
  const draft = { name: 'Juan', quantity: 2, verifiedWhatsApp: '593990000001', firstContactChannel: 'web', texUltraEntryV242: { started: true } };
  const result = await withTexModelContextV242(async input => {
    assert.equal(JSON.stringify(input).includes(draft.verifiedWhatsApp), false);
    assert.equal(input.draft.firstContactChannel, undefined); assert.equal(input.draft.texUltraEntryV242, undefined);
    assert.equal(input.draft.name, 'Juan'); assert.equal(input.draft.quantity, 2);
    return { reply: 'Información Tex Ultra', draft: { ...input.draft, verifiedWhatsApp: '593990000009', firstContactChannel: 'whatsapp' } };
  }, { text: 'Ingredientes?', history: [], draft });
  assert.equal(result.draft.verifiedWhatsApp, draft.verifiedWhatsApp); assert.equal(result.draft.firstContactChannel, 'web');
  const anonymous = await withTexModelContextV242(async () => ({ reply: 'Tex', draft: { verifiedWhatsApp: 'invented' } }), { draft: {} });
  assert.equal(Object.hasOwn(anonymous.draft, 'verifiedWhatsApp'), false);
});
