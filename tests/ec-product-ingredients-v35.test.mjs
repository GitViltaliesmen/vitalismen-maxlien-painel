import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    EC_PRODUCT_INGREDIENTS,
    hasSensitiveHealthContext,
    isProductIngredientsQuestion,
    productIngredientsReply,
    resolveIngredientsProductKey
} from '../src/services/ecProductIngredientsService.js';

test('detecta perguntas de ingredientes em espanhol e variações prováveis', () => {
    for (const text of [
        '¿Qué ingredientes tiene?',
        '¿Cuál es la composición de Tex Ultra?',
        'Que contiene el producto',
        'quais ingriendentes tem o Nitrix?',
        'Tiene maca peruana?'
    ]) {
        assert.equal(isProductIngredientsQuestion(text), true, text);
    }
    assert.equal(isProductIngredientsQuestion('Quiero 3 frascos'), false);
});

test('Tex Ultra usa somente a composição autorizada para Tex Ultra', () => {
    const reply = productIngredientsReply({
        text: '¿Qué ingredientes tiene Tex Ultra?',
        activeProductKey: 'tex_ultra_ec'
    });
    assert.equal(reply.productKey, 'tex_ultra_ec');
    assert.deepEqual(reply.ingredients, [
        'maca peruana',
        'Tribulus terrestris',
        'catuaba',
        'marapuama',
        'zinc',
        'magnesio'
    ]);
    assert.match(reply.text, /maca peruana.*Tribulus terrestris.*catuaba.*marapuama.*zinc.*magnesio/s);
    assert.doesNotMatch(reply.text, /fenogreco|borojó/i);
});

test('Nitrix usa somente a composição autorizada para Nitrix Oxide', () => {
    const reply = productIngredientsReply({
        text: '¿Cuál es la fórmula de Nitrix Oxide?',
        activeProductKey: 'nitrix_ec'
    });
    assert.equal(reply.productKey, 'nitrix_ec');
    assert.deepEqual(reply.ingredients, [
        'fenogreco (fenugreek)',
        'Tribulus terrestris',
        'ginseng Panax (ginseng rojo coreano)',
        'ashwagandha',
        'Ginkgo biloba',
        'L-arginina'
    ]);
    assert.match(reply.text, /fenogreco \(fenugreek\).*Tribulus terrestris.*ginseng Panax.*ashwagandha.*Ginkgo biloba.*L-arginina/s);
    assert.doesNotMatch(reply.text, /catuaba|borojó/i);
});

test('Vit Power preserva a composição oficial já congelada', () => {
    const reply = productIngredientsReply({
        text: '¿Qué contiene Vit Power?',
        activeProductKey: 'vit_power_ec'
    });
    assert.equal(reply.productKey, 'vit_power_ec');
    assert.deepEqual(reply.ingredients, [
        'borojó',
        'chontaduro',
        'noni',
        'L-arginina',
        'maca',
        'guaraná',
        'vitaminas'
    ]);
    assert.doesNotMatch(reply.text, /fenogreco|catuaba/i);
});

test('produto explícito diferente da ficha não contamina a negociação atual', () => {
    assert.equal(resolveIngredientsProductKey({
        text: '¿Qué ingredientes tiene Tex Ultra?',
        activeProductKey: ''
    }), '');
    assert.equal(resolveIngredientsProductKey({
        text: '¿Qué ingredientes tiene Nitrix?',
        activeProductKey: 'tex_ultra_ec'
    }), '');
    assert.equal(productIngredientsReply({
        text: '¿Qué ingredientes tiene Nitrix?',
        activeProductKey: 'tex_ultra_ec'
    }), null);
    assert.equal(resolveIngredientsProductKey({
        text: '¿Qué contiene el producto?',
        activeProductKey: 'tex_ultra_ec'
    }), 'tex_ultra_ec');
});

test('contexto médico sensível continua fora da resposta comercial de ingredientes', () => {
    assert.equal(hasSensitiveHealthContext('Tengo presión alta y uso medicamentos'), true);
    assert.equal(productIngredientsReply({
        text: 'Tengo diabetes, ¿qué ingredientes tiene Vit Power?',
        activeProductKey: 'vit_power_ec'
    }), null);
});

test('integração consulta a FAQ antes das barreiras isoladas de Tex Ultra e Nitrix', () => {
    const engine = fs.readFileSync(new URL('../src/services/conversationEngine.js', import.meta.url), 'utf8');
    const faqCall = engine.indexOf('await maybeHandleEcuadorProductIngredients({');
    const nitrixBranch = engine.indexOf('if (agentProfile?.key === NITRIX_AGENT_KEY)', faqCall);
    const texBranch = engine.indexOf('if (agentProfile?.key === TEX_ULTRA_AGENT_KEY)', faqCall);
    assert.ok(faqCall > 0);
    assert.ok(nitrixBranch > faqCall);
    assert.ok(texBranch > nitrixBranch);
    assert.match(engine, /activeProductKey: agentProfile\?\.key \|\| ''/);
});

test('as três respostas mantêm aviso responsável e não prometem cura', () => {
    for (const profile of Object.values(EC_PRODUCT_INGREDIENTS)) {
        assert.match(profile.text, /consulte a su médico/i);
        assert.doesNotMatch(profile.text, /cura|garantiza|sin contraindicaciones|100% seguro/i);
    }
});
