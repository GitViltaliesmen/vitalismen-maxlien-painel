import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    EC_ALL_PRODUCTS_INGREDIENTS_TEXT,
    isAllProductsIngredientsQuestion,
    productIngredientsReply
} from '../src/services/ecProductIngredientsService.js';

test('V36 reconhece pedido de todos, plural, comparação e dois produtos explícitos', () => {
    for (const text of [
        '¿Qué ingredientes tienen todos los productos?',
        '¿Qué contienen los productos?',
        '¿Cuál es la diferencia entre los tres productos?',
        'Compare Tex Ultra y Nitrix',
        'Ingredientes de Tex Ultra, Nitrix y Vit Power',
        'todos os ingredientes dos diversos produtos'
    ]) {
        assert.equal(isAllProductsIngredientsQuestion(text), true, text);
    }
    assert.equal(isAllProductsIngredientsQuestion('¿Qué ingredientes tiene Tex Ultra?'), false);
    assert.equal(isAllProductsIngredientsQuestion('Quiero 3 frascos'), false);
});

test('V36 envia uma lista única com três seções e fórmulas separadas', () => {
    const reply = productIngredientsReply({
        text: '¿Qué ingredientes tienen todos los productos?',
        activeProductKey: 'tex_ultra_ec'
    });

    assert.equal(reply.productKey, 'tex_ultra_ec');
    assert.equal(reply.scope, 'all_products');
    assert.equal(reply.memoryField, 'productIngredientsFaqAllProducts');
    assert.equal(reply.text, EC_ALL_PRODUCTS_INGREDIENTS_TEXT);
    assert.match(reply.text, /🔵 \*Tex Ultra\*[\s\S]+maca peruana[\s\S]+Tribulus terrestris[\s\S]+catuaba[\s\S]+marapuama[\s\S]+zinc[\s\S]+magnesio/);
    assert.match(reply.text, /🟠 \*Nitrix Oxide\*[\s\S]+fenogreco \(fenugreek\)[\s\S]+ginseng Panax[\s\S]+ashwagandha[\s\S]+Ginkgo biloba[\s\S]+L-arginina/);
    assert.match(reply.text, /🟢 \*Vit Power\*[\s\S]+borojó[\s\S]+chontaduro[\s\S]+noni[\s\S]+L-arginina[\s\S]+maca[\s\S]+guaraná[\s\S]+vitaminas/);
    assert.match(reply.text, /Cada producto tiene una fórmula diferente/i);
    assert.match(reply.text, /no deben confundirse con los de los demás/i);
    assert.match(reply.text, /consulte a su médico/i);
    assert.match(reply.text, /¿Sobre cuál de los tres productos desea recibir más información/i);
});

test('V36 preserva a resposta individual quando a pergunta cita somente um produto', () => {
    const tex = productIngredientsReply({
        text: '¿Qué ingredientes tiene Tex Ultra?',
        activeProductKey: 'tex_ultra_ec'
    });
    assert.equal(tex.scope, 'single_product');
    assert.equal(tex.memoryField, 'productIngredientsFaq');
    assert.doesNotMatch(tex.text, /Nitrix|Vit Power/);

    const nitrix = productIngredientsReply({
        text: '¿Qué ingredientes tiene Nitrix?',
        activeProductKey: 'nitrix_ec'
    });
    assert.equal(nitrix.scope, 'single_product');
    assert.doesNotMatch(nitrix.text, /Tex Ultra|Vit Power/);
});

test('V36 exige ficha ativa e não troca o produto ao responder a comparação', () => {
    assert.equal(productIngredientsReply({
        text: '¿Qué contienen todos los productos?',
        activeProductKey: ''
    }), null);

    const reply = productIngredientsReply({
        text: 'Compare Tex Ultra, Nitrix y Vit Power',
        activeProductKey: 'vit_power_ec'
    });
    assert.equal(reply.productKey, 'vit_power_ec');
    assert.equal(reply.scope, 'all_products');
});

test('V36 mantém contexto médico fora da resposta comercial consolidada', () => {
    assert.equal(productIngredientsReply({
        text: 'Tengo diabetes y uso medicamentos, ¿qué contienen todos los productos?',
        activeProductKey: 'vit_power_ec'
    }), null);
});

test('V36 usa memória e anti-spam separados sem alterar ficha ou funil', () => {
    const service = fs.readFileSync(new URL('../src/services/ecProductIngredientsService.js', import.meta.url), 'utf8');
    assert.match(service, /memoryField: 'productIngredientsFaqAllProducts'/);
    assert.match(service, /antiSpamScope = reply\.scope === 'all_products' \? 'all_products' : reply\.productKey/);
    assert.match(service, /const memoryPath = `metadata\.perAgentMemory\.\$\{reply\.productKey\}\.\$\{reply\.memoryField\}`/);
    assert.doesNotMatch(service, /assignedAgent\s*:/);
    assert.doesNotMatch(service, /metadata\.productKey['"]?\s*:/);
    assert.doesNotMatch(service, /customerDraft\.productKey['"]?\s*:/);
});

test('V36 não adiciona preço, promessa de cura ou garantia ao texto consolidado', () => {
    assert.doesNotMatch(EC_ALL_PRODUCTS_INGREDIENTS_TEXT, /\$|USD|precio|35\.99|70\.00|80\.99|147\.99/i);
    assert.doesNotMatch(EC_ALL_PRODUCTS_INGREDIENTS_TEXT, /cura|garantiza|sin contraindicaciones|100% seguro/i);
});
