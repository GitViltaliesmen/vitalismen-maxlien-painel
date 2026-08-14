const assert = require('node:assert/strict');
const catalog = require('../tex-ultra-order-catalog.js');
const funnel = require('../product-funnel-library.js');
require('../product-funnels/vit-power-ec.js');
require('../product-funnels/nitrix-ec.js');
require('../product-funnels/tex-ultra-ec.js');

const productKeys = ['vit_power_ec', 'nitrix_ec', 'tex_ultra_ec'];
assert.deepEqual(Object.keys(funnel.PRODUCTS), productKeys);

for (const productKey of productKeys) {
    const items = funnel.LIBRARY[productKey];
    assert.equal(items.length, 6);
    assert.ok(items.every((item) => item.id.startsWith(`${productKey}:`)));
}

assert.notStrictEqual(funnel.LIBRARY.vit_power_ec, funnel.LIBRARY.nitrix_ec);
assert.notStrictEqual(funnel.LIBRARY.nitrix_ec, funnel.LIBRARY.tex_ultra_ec);
assert.notStrictEqual(funnel.LIBRARY.vit_power_ec, funnel.LIBRARY.tex_ultra_ec);

assert.equal(catalog.expectedPrice('vit_power_ec', '1'), '');
assert.equal(catalog.expectedPrice('nitrix_ec', '1'), '');
assert.equal(catalog.expectedPrice('tex_ultra_ec', '1'), '35.99');
assert.equal(catalog.isExpectedPrice('vit_power_ec', '1', '39.99'), true);
assert.equal(catalog.isExpectedPrice('nitrix_ec', '3', '95.99'), true);

const texOffer = funnel.LIBRARY.tex_ultra_ec.find((item) => item.code === 'P02').text;
const nitrixOffer = funnel.LIBRARY.nitrix_ec.find((item) => item.code === 'P02').text;
const vitOffer = funnel.LIBRARY.vit_power_ec.find((item) => item.code === 'P02').text;
assert.match(texOffer, /\$147,99/);
assert.doesNotMatch(nitrixOffer, /\$147,99/);
assert.doesNotMatch(vitOffer, /\$147,99/);

console.log('product funnel isolation: ok');
