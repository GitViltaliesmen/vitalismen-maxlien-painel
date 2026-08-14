const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'extensions/vitalismen-whatsapp-official/sidepanel.js'),
    'utf8'
);
const block = source.match(/const productNameForKey[\s\S]*?(?=const quantityFromWord)/)?.[0] || '';

const executeSelection = (input) => vm.runInNewContext(
    `
    const normalizedText = (value) => String(value || '').toLowerCase();
    ${block}
    authoritativeProductFromChat(${JSON.stringify(input)});
    `,
    {}
);

test('extensao abre Tex Ultra automaticamente a partir da ficha criada pela VSL', () => {
    assert.ok(block, 'seletor autoritativo de produto deve existir na extensao');
    const selected = executeSelection({
        chat: { vslProductKey: 'tex_ultra_ec', vslProductName: 'Tex Ultra Ecuador' },
        draft: { productKey: 'tex_ultra_ec', productName: 'Tex Ultra Ecuador' }
    });
    assert.equal(selected.productKey, 'tex_ultra_ec');
});

test('extensao preserva uma selecao manual salva depois da origem da VSL', () => {
    const selected = executeSelection({
        chat: { vslProductKey: 'tex_ultra_ec', vslProductName: 'Tex Ultra Ecuador' },
        draft: { productKey: 'nitrix_ec', productName: 'Nitrix Oxide Ecuador' }
    });
    assert.equal(selected.productKey, 'nitrix_ec');
});
