const assert = require('node:assert/strict');
const funnel = require('../product-funnel-library.js');

assert.deepEqual(Object.keys(funnel.PRODUCTS), [
    'vit_power_ec',
    'nitrix_ec',
    'tex_ultra_ec'
]);

for (const productKey of Object.keys(funnel.PRODUCTS)) {
    const items = funnel.list({ productKey });
    assert.equal(items.length, 6);
    assert.ok(items.every((item) => item.id.startsWith(`${productKey}:`)));
}

const recommended = funnel.list({
    productKey: 'nitrix_ec',
    stage: 'coleta_dados'
});
assert.equal(recommended[0].id, 'nitrix_ec:data');
assert.equal(recommended[0].recommended, true);

const onlyConfirmation = funnel.list({
    productKey: 'tex_ultra_ec',
    category: 'confirmacao'
});
assert.deepEqual(onlyConfirmation.map((item) => item.id), ['tex_ultra_ec:confirm']);

const texOffer = funnel.LIBRARY.tex_ultra_ec.find((item) => item.code === 'P02');
assert.match(texOffer.text, /\$35,99/);
assert.match(texOffer.text, /\$70,00/);
assert.match(texOffer.text, /\$80,99/);
assert.match(texOffer.text, /\$147,99/);
assert.match(texOffer.text, /¿Cuántos frascos desea\?/);

const searchResult = funnel.list({
    productKey: 'vit_power_ec',
    search: 'servientrega'
});
assert.deepEqual(searchResult.map((item) => item.id), ['vit_power_ec:data']);

const confirmation = funnel.LIBRARY.vit_power_ec.find((item) => item.code === 'P05');
const resolved = funnel.resolve(confirmation, {
    name: 'María López',
    quantity: 3,
    total: '80,99',
    address: 'Servientrega Centro',
    city: 'Quito',
    province: 'Pichincha'
});
assert.match(resolved, /Vit Power/);
assert.match(resolved, /María López/);
assert.match(resolved, /Cantidad: 3/);
assert.match(resolved, /USD 80,99/);
assert.match(resolved, /Quito \/ Pichincha/);
assert.doesNotMatch(resolved, /\{\{/);

const nitrixText = funnel.resolve(funnel.LIBRARY.nitrix_ec[0], { name: 'Carlos' });
assert.match(nitrixText, /Nitrix/);
assert.doesNotMatch(nitrixText, /Tex Ultra|Vit Power/);

console.log('product-funnel-library: ok');
