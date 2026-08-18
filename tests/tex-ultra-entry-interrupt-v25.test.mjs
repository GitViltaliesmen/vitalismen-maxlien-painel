import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    buildTexUltraEntryGreeting,
    TEX_ULTRA_GREETING_EMOJIS,
    texUltraGreetingEmojiAt
} from '../src/services/texUltraEntryGreetingService.js';
import { texUltraInterruptedInboundRoute } from '../src/services/texUltraFunnelService.js';
import {
    buildTexUltraInitialSteps,
    TEX_ULTRA_INITIAL_CADENCE
} from '../src/services/texUltraInitialLayerService.js';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('frase aprovada permanece identica depois do emoji inicial', () => {
    const expectedPhrase = 'Hola, Gerdon, buenos días. Soy Ana López, asistente de la Dra. María Fernandes. Vi su mensaje y será un gusto atenderle personalmente. Estoy aquí para ayudarle. ¿En qué puedo ayudarle?';
    for (const emoji of TEX_ULTRA_GREETING_EMOJIS) {
        const greeting = buildTexUltraEntryGreeting({
            name: 'Gerdon',
            date: new Date('2026-08-18T14:30:00.000Z'),
            emoji
        });
        assert.equal(greeting, `${emoji} ${expectedPhrase}`);
        assert.equal(greeting.slice(emoji.length + 1), expectedPhrase);
    }
});

test('rodizio tem cinco inicios discretos e nunca repete o anterior', () => {
    const cycle = Array.from({ length: 15 }, (_, index) => texUltraGreetingEmojiAt(index));
    assert.equal(new Set(TEX_ULTRA_GREETING_EMOJIS).size, 5);
    cycle.slice(1).forEach((emoji, index) => assert.notEqual(emoji, cycle[index]));
});

test('cadencia aprovada continua entre 90 e 112 segundos no total', () => {
    const anchor = new Date('2026-08-18T00:00:00.000Z');
    const minimum = buildTexUltraInitialSteps({ anchor, randomBetweenFn: (min) => min });
    const maximum = buildTexUltraInitialSteps({ anchor, randomBetweenFn: (_min, max) => max });
    const offsets = (steps) => TEX_ULTRA_INITIAL_CADENCE.map(({ key }) => (
        new Date(steps[key].dueAt).getTime() - anchor.getTime()
    ));
    assert.deepEqual(offsets(minimum), [2000, 6000, 27000, 55000, 90000]);
    assert.deepEqual(offsets(maximum), [6000, 14000, 39000, 72000, 112000]);
});

test('interrupcao responde intents conhecidas e entrega duvida livre ao humano', () => {
    assert.equal(texUltraInterruptedInboundRoute('¿Cuál es el precio?'), 'price');
    assert.equal(texUltraInterruptedInboundRoute('3 frascos'), 'quantity');
    assert.equal(texUltraInterruptedInboundRoute('¿Cómo se toma?'), 'usage');
    assert.equal(texUltraInterruptedInboundRoute('¿Puedo tomarlo con otro medicamento?'), 'human');

    const funnel = read('src/services/texUltraFunnelService.js');
    assert.match(funnel, /const initialLayerInbound = await interruptTexUltraInitialLayerOnInbound/);
    assert.match(funnel, /memory = memoryOf\(state\);/);
    assert.match(funnel, /lastManualBy: 'tex_ultra_customer_question'/);
    assert.match(funnel, /'AGUARDANDO_ATENDIMENTO', 'TEX_ULTRA_DUVIDA_CLIENTE'/);
    assert.match(funnel, /Detuve los demás mensajes para atender primero su duda/);
});

test('cancelamento e conferido antes do timer e novamente antes do envio enfileirado', () => {
    const layer = read('src/services/texUltraInitialLayerService.js');
    const timerCheck = layer.indexOf('if (inboundAfterFlowStarted(state, flow))');
    const sendQueue = layer.indexOf('const outcome = await withLayerSendQueue');
    const queuedCheck = layer.indexOf('if (inboundAfterFlowStarted(freshState, freshFlow))', sendQueue);
    const actualSend = layer.indexOf('return { cancelled: false, sent: await sendStep', queuedCheck);
    assert.ok(timerCheck > 0 && timerCheck < sendQueue);
    assert.ok(queuedCheck > sendQueue && queuedCheck < actualSend);
});

test('painel manual usa o mesmo rodizio e uma unica frase aprovada', () => {
    const panel = read('public/qr.html');
    assert.match(panel, /TEX_ULTRA_ENTRY_GREETING_EMOJIS = Object\.freeze\(\['👋', '😊', '🙂', '🙏', '✅'\]\)/);
    assert.match(panel, /nextTexUltraPanelGreetingEmoji\(\)/);
    assert.match(panel, /Soy Ana López, asistente de la Dra\. María Fernandes/);
});
