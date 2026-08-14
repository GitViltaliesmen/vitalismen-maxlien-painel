import test from 'node:test';
import assert from 'node:assert/strict';
import {
    selectEcuadorPanelProductInfo
} from '../src/services/ecuadorProductService.js';

test('seleciona automaticamente Tex Ultra gravado pela VSL', () => {
    const product = selectEcuadorPanelProductInfo({
        customerDraft: { productKey: 'tex_ultra_ec' },
        vslProductKey: 'tex_ultra_ec',
        latestTexts: ['cliente perguntou se tambem existe Nitrix']
    });
    assert.equal(product.key, 'tex_ultra_ec');
});

test('padroniza as tres origens de produto do Equador', () => {
    for (const productKey of ['vit_power_ec', 'nitrix_ec', 'tex_ultra_ec']) {
        const product = selectEcuadorPanelProductInfo({
            customerDraft: { productKey },
            vslProductKey: productKey
        });
        assert.equal(product.key, productKey);
    }
});

test('escolha manual salva na ficha prevalece sobre a origem anterior', () => {
    const product = selectEcuadorPanelProductInfo({
        customerDraft: { productKey: 'nitrix_ec' },
        vslProductKey: 'tex_ultra_ec'
    });
    assert.equal(product.key, 'nitrix_ec');
});

test('pedido estruturado prevalece quando a ficha ainda nao tem produto', () => {
    const product = selectEcuadorPanelProductInfo({
        customerDraft: {},
        order: { tracking: { productKey: 'vit_power_ec' } },
        vslProductKey: 'tex_ultra_ec'
    });
    assert.equal(product.key, 'vit_power_ec');
});
