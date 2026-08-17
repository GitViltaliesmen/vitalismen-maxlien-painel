import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ECUADOR_PRODUCTS,
    ecuadorPackageLabel,
    ecuadorProductMetadata,
    resolveEcuadorProductInfo
} from '../src/services/ecuadorProductService.js';
import { buildPurchaseEventPayloadForOrder } from '../src/services/metaConversionsService.js';

test('dado ausente ou desconhecido nao vira Nitrix silenciosamente', () => {
    for (const value of [undefined, {}, 'produto desconhecido', { package: { label: 'Package 3' } }]) {
        const product = resolveEcuadorProductInfo(value);
        assert.equal(product.key, '');
        assert.notEqual(product.key, ECUADOR_PRODUCTS.nitrix.key);
        assert.deepEqual(ecuadorProductMetadata(product), {
            productKey: '',
            productName: '',
            contentName: '',
            contentIds: []
        });
    }
    assert.equal(ecuadorPackageLabel(resolveEcuadorProductInfo({}), 3), 'Produto EC nao configurado 3 frascos');
});

test('os tres produtos oficiais continuam resolvendo somente por sinal explicito', () => {
    assert.equal(resolveEcuadorProductInfo({ productKey: 'tex_ultra_ec' }).key, 'tex_ultra_ec');
    assert.equal(resolveEcuadorProductInfo({ productKey: 'nitrix_ec' }).key, 'nitrix_ec');
    assert.equal(resolveEcuadorProductInfo({ productKey: 'vit_power_ec' }).key, 'vit_power_ec');
});

test('Purchase EC sem produto explicito e bloqueado antes de qualquer envio', () => {
    const result = buildPurchaseEventPayloadForOrder({
        orderId: 'EC-TEST-UNKNOWN',
        country: 'EC',
        customer: { name: 'Cliente Teste', phone: '+593991234567' },
        package: { quantity: 3, id: 3 },
        total: 80.99,
        currency: 'USD',
        tracking: {}
    }, { eventTime: 1786900000 });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'META Purchase missing explicit EC product');
});
