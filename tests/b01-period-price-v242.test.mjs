import test from 'node:test';
import assert from 'node:assert/strict';
import { b01PeriodV242, b01MediaForPeriodV242, b01Greeting, b01PriceTextV242 } from '../src/services/vitPowerB01CoreV216Service.js';
import { getEcuadorOffer } from '../src/services/ecuadorProductService.js';

for (const [at, period, filename, greeting] of [
  ['2026-11-17T05:00:00Z','night','01_A_buenas_noches.ogg','Buenas noches'],
  ['2026-11-17T09:59:59Z','night','01_A_buenas_noches.ogg','Buenas noches'],
  ['2026-11-17T10:00:00Z','morning','01_B_Buenos_dias.ogg','Buenos días'],
  ['2026-11-17T16:59:59Z','morning','01_B_Buenos_dias.ogg','Buenos días'],
  ['2026-11-17T17:00:00Z','afternoon','01_C_Buenos_tardes.ogg','Buenas tardes'],
  ['2026-11-17T23:59:59Z','afternoon','01_C_Buenos_tardes.ogg','Buenas tardes'],
  ['2026-11-18T00:00:00Z','night','01_A_buenas_noches.ogg','Buenas noches'],
]) test('Ecuador period, text and only one greeting audio agree at ' + at, () => {
  const date = new Date(at), media = b01MediaForPeriodV242(date);
  assert.equal(b01PeriodV242(date), period);
  assert.equal(media.filter(item => item.kind === 'audio').length, 1);
  assert.equal(media[0].asset.split('/').at(-1), filename);
  assert.equal(media.length, 3);
  assert.deepEqual(media.slice(1).map(item => item.asset), ['/media/sales/shared/social_01.jpeg','/media/sales/ec/vit_power.jpeg']);
  assert(b01Greeting('Gerson', date).includes(greeting + ', Gerson'));
});
test('price table uses official normal Vit Power offers and the requested readable layout', () => {
  const calls = [];
  const text = b01PriceTextV242(input => { calls.push(input); return getEcuadorOffer(input); });
  assert.deepEqual(calls.map(x => x.quantity), [1,2,3,6]);
  assert(calls.every(x => x.productKey === 'vit_power_ec' && x.priceCatalog === 'normal'));
  assert.equal(text, 'Estos son los valores normales de Vit Power:\n\n• 1 frasco: USD 39.99\n• 2 frascos: USD 70.00\n• 3 frascos: USD 95.99\n• 6 frascos: USD 167.99\n\n¿Cuántos frascos desea?');
  assert(!/regalo|garant|recomendad|tratamiento/i.test(text));
});
for (const [name, change] of Object.entries({missing:()=>null, foreign:x=>({...x,productKey:'tex_ultra_ec'}), wrongQuantity:x=>({...x,quantity:99}), promotional:x=>({...x,priceCatalog:'promotional'}), invalid:x=>({...x,total:NaN}), zero:x=>({...x,total:0})})) {
  test('invalid commercial source cannot silently produce a table: ' + name, () => {
    assert.throws(() => b01PriceTextV242(input => change(getEcuadorOffer(input))), /b01_official_price_unavailable/);
  });
}
