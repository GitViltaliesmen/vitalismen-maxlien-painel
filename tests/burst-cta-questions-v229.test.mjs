import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questionPlanV219, allQuestionsMappedV219 } from '../src/services/freeflowQuestionPriorityV219Service.js';
const cta = 'Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?';
test('known CTA followed by price and composition retains the customer question order', () => {
  const text = cta + '\n¿Cuánto cuesta 1 frasco de Vit Power?\n¿Qué contiene Vit Power?';
  assert.deepEqual(questionPlanV219(text).map(x => x.topic), ['price','ingredients']);
  assert.equal(allQuestionsMappedV219(text), true);
});
test('reverse question order is preserved after the same introduction', () => {
  const text = cta + '\n¿Qué contiene Vit Power?\n¿Cuánto cuestan 3 frascos?';
  assert.deepEqual(questionPlanV219(text).map(x => x.topic), ['ingredients','price']);
  assert.equal(allQuestionsMappedV219(text), true);
});
test('unknown substantive follow-up stays unmapped', () => assert.equal(allQuestionsMappedV219(cta + '\n¿Cuánto cuesta 1 frasco?\n¿Quién fabrica el envase?'), false));
test('an edited introduction cannot use the exact CTA exception', () => assert.equal(allQuestionsMappedV219(cta.replace('Vit Power', 'otro producto') + '\n¿Cuánto cuesta 1 frasco?'), false));
test('standalone introduction and standalone questions retain the original classification', () => {
  assert.deepEqual(questionPlanV219(cta), []);
  assert.deepEqual(questionPlanV219('¿Cuánto cuesta 1 frasco?').map(x => x.topic), ['price']);
  assert.equal(allQuestionsMappedV219('¿Me ayudan?\n¿Cuánto cuesta?'), false);
});
