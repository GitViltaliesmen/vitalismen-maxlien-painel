import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/services/ecDirectProductInquiryService.js', import.meta.url), 'utf8');
const pure = source.slice(source.indexOf('const DIRECT_MEMORY_PATH'), source.indexOf('const recentOutboundHistoryHasText'))
    .replaceAll('export const ', 'const ')
    + '\nglobalThis.triage = { buildDirectProductReply, directEcuadorProductKeys, isGenericEcuadorProductRequest, shouldRouteDirectProductInbound };';
const sandbox = {
    getEcuadorProductInfoByKey: key => ({ tex_ultra_ec: { name: 'Tex Ultra Ecuador' },
        nitrix_ec: { name: 'Nitrix Oxide Ecuador' }, vit_power_ec: { name: 'Vit Power Ecuador' } })[key],
    getEcuadorOffer: () => null,
    currentProductRouteForState: state => ({ productKey: state?.metadata?.productRouteLock?.productKey
        || state?.metadata?.customerDraft?.productKey || state?.metadata?.productKey || '' })
};
vm.runInNewContext(pure, sandbox);
const { buildDirectProductReply, directEcuadorProductKeys, isGenericEcuadorProductRequest,
    shouldRouteDirectProductInbound } = sandbox.triage;

const unknown = { metadata: { customerDraft: {} } };

test('pedido genérico sem produto pede uma escolha sem preço nem produto presumido', () => {
    for (const text of ['Hola, quiero el tratamiento', 'Quiero información del producto', 'Me interesa el suplemento']) {
        assert.equal(isGenericEcuadorProductRequest(text), true);
        assert.equal(shouldRouteDirectProductInbound({ text, state: unknown }), true);
        const reply = buildDirectProductReply({ text });
        assert.equal(reply.responseKind, 'product_choice');
        assert.match(reply.text, /Tex Ultra, Nitrix Oxide o Vit Power/);
        assert.doesNotMatch(reply.text, /USD|frasco/);
    }
    assert.equal(shouldRouteDirectProductInbound({ text: 'Hola, gracias', state: unknown }), false);
});

test('menções explícitas e variantes apontam para um único produto oficial', () => {
    assert.deepEqual(Array.from(directEcuadorProductKeys('Quiero Text Ultra')), ['tex_ultra_ec']);
    assert.deepEqual(Array.from(directEcuadorProductKeys('Quiero Nitrix Oxide')), ['nitrix_ec']);
    assert.deepEqual(Array.from(directEcuadorProductKeys('Quiero NT Power')), ['vit_power_ec']);
    assert.equal(isGenericEcuadorProductRequest('Quiero Nitrix Oxide'), false);
});

test('produto da ficha e escolha do operador não recebem pergunta genérica', () => {
    const known = { metadata: { productKey: 'tex_ultra_ec', customerDraft: { productKey: 'tex_ultra_ec' } } };
    assert.equal(shouldRouteDirectProductInbound({ text: 'Quiero el tratamiento', state: known }), false);
    const operator = { metadata: { productRouteLock: { active: true, productKey: 'nitrix_ec', source: 'panel_customer_product_selection' } } };
    assert.equal(shouldRouteDirectProductInbound({ text: 'Quiero el tratamiento', state: operator }), false);
});
