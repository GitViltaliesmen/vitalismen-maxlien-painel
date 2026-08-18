import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    texUltraInboundNeedsHuman,
    texUltraInterruptedInboundRoute,
    texUltraSelectedQuantity,
    texUltraStrongPurchaseIntent
} from '../src/services/texUltraFunnelService.js';

const funnel = fs.readFileSync(new URL('../src/services/texUltraFunnelService.js', import.meta.url), 'utf8');

test('frase observada no teste vira intencao forte de compra', () => {
    const text = 'Hola, quiero el tratamiento.';
    assert.equal(texUltraStrongPurchaseIntent(text), true);
    assert.equal(texUltraInterruptedInboundRoute(text), 'purchase');
    assert.equal(texUltraInboundNeedsHuman(text), false);
});

test('variantes fortes seguem para quantidade sem confundir pedido de informacao', () => {
    for (const text of [
        'Deseo el tratamiento',
        'Quiero comprarlo',
        'Lo quiero',
        'Me interesa el producto'
    ]) {
        assert.equal(texUltraInterruptedInboundRoute(text), 'purchase', text);
    }
    assert.equal(texUltraInterruptedInboundRoute('Hola, quiero información de Tex Ultra'), 'human');
    assert.equal(texUltraInboundNeedsHuman('Hola, quiero información de Tex Ultra'), false);
});

test('quantidade contextual tem prioridade e aceita os quatro pacotes oficiais', () => {
    assert.equal(texUltraSelectedQuantity('Quiero 1 frasco'), 1);
    assert.equal(texUltraSelectedQuantity('Deseo 2 frascos'), 2);
    assert.equal(texUltraSelectedQuantity('Quiero el tratamiento de 3 frascos'), 3);
    assert.equal(texUltraSelectedQuantity('Me interesan 6 botellas'), 6);
    assert.equal(texUltraInterruptedInboundRoute('Quiero 3 frascos'), 'quantity');
});

test('pergunta livre vai ao humano mesmo depois da oferta', () => {
    const text = '¿Puedo tomarlo con otro medicamento?';
    assert.equal(texUltraInterruptedInboundRoute(text), 'human');
    assert.equal(texUltraInboundNeedsHuman(text), true);
    assert.match(funnel, /interruptedInboundRoute === 'human'[\s\S]{0,180}texUltraInboundNeedsHuman\(inboundText\)/);
    assert.match(funnel, /return holdInterruptedTexUltraQuestionForHuman\(\{ state, inboundText, draft \}\);/);
});

test('entrada inicial preserva a cadencia e compra posterior pede quantidade', () => {
    const startCadence = funnel.indexOf('if (!memory.presentationSentAt)');
    const afterOfferPurchase = funnel.indexOf("interruptedInboundRoute === 'purchase'", startCadence);
    assert.ok(startCadence > 0 && afterOfferPurchase > startCadence);
    assert.match(funnel, /tex_ultra_purchase_intent_after_interrupt/);
    assert.match(funnel, /tex_ultra_purchase_intent_after_offer/);
    assert.match(funnel, /qué opción desea reservar: 1, 2, 3 o 6 frascos/);
});

test('resposta de compra nao colide com a categoria historica da oferta', () => {
    const purchasePrompt = '¡Perfecto! Para continuar con su pedido de Tex Ultra, ¿qué opción desea reservar: 1, 2, 3 o 6 frascos?'
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const broadQuantityHistoryKey = /(cuantos frascos|indiqueme cuantos frascos|elige la cantidad|escoja la cantidad|1\s*3\s*o\s*6|1\s*,\s*3\s*o\s*6)/;
    assert.equal(broadQuantityHistoryKey.test(purchasePrompt), false);
});

test('fallback corrigido inclui dois frascos e espanhol correto', () => {
    assert.match(funnel, /Sigo con usted\. Para avanzar, indíqueme cuántos frascos desea: 1, 2, 3 o 6\./);
    assert.doesNotMatch(funnel, /Sigo com usted/);
});
