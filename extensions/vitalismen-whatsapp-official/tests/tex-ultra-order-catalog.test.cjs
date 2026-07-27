const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../tex-ultra-order-catalog.js');

assert.equal(catalog.CURRENT_PRODUCT_KEY, 'tex_ultra_ec');
assert.equal(catalog.CURRENT_PRODUCT_NAME, 'Tex Ultra Ecuador');
assert.deepEqual(
    catalog.KITS.map(({ quantity, priceText }) => [quantity, priceText]),
    [
        ['1', '35.99'],
        ['2', '70.00'],
        ['3', '80.99'],
        ['6', '147.99']
    ]
);

for (const kit of catalog.KITS) {
    assert.equal(catalog.expectedPrice('tex_ultra_ec', kit.quantity), kit.priceText);
    assert.equal(catalog.isExpectedPrice('tex_ultra_ec', kit.quantity, kit.offerPrice), true);
}
assert.equal(catalog.isExpectedPrice('tex_ultra_ec', '3', '95.99'), false);

const completeDraft = {
    name: 'María López',
    phone: '+593999999999',
    address: 'Servientrega Centro',
    city: 'Quito',
    province: 'Pichincha',
    productKey: 'tex_ultra_ec',
    quantity: '3',
    total: '80.99',
    status: 'confirmado'
};
assert.deepEqual(catalog.validateForSave(completeDraft), { ok: true, issues: [] });

const invalidDraft = catalog.validateForSave({
    ...completeDraft,
    city: '',
    quantity: '3',
    total: '95.99'
});
assert.equal(invalidDraft.ok, false);
assert.ok(invalidDraft.issues.some((issue) => issue.includes('tabela aprovada')));
assert.ok(invalidDraft.issues.some((issue) => issue.includes('cidade')));

const offer = catalog.offerText();
assert.match(offer, /\$35,99/);
assert.match(offer, /\$70,00/);
assert.match(offer, /\$80,99/);
assert.match(offer, /\$147,99/);
assert.match(offer, /¿Cuántos frascos desea\?/);

const extensionRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(extensionRoot, 'sidepanel.html'), 'utf8');
const script = fs.readFileSync(path.join(extensionRoot, 'sidepanel.js'), 'utf8');
assert.match(html, /id="orderKitOptions"/);
assert.match(html, /id="orderReadiness"/);
assert.match(html, /Cadastro de pedido/);
assert.match(script, /Cadastrar pedido confirmado/);
assert.match(script, /operationalOrderSync/);

console.log('tex-ultra-order-catalog: ok');
