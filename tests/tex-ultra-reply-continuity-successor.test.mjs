import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    mergeTexUltraVslPayloadDraft,
    texUltraInboundNeedsHuman,
    texUltraNextDataCollectionStep,
    texUltraSelectedQuantity,
    texUltraVslPayloadData
} from '../src/services/texUltraFunnelService.js';

const vslText = [
    'Hola, quiero el tratamiento.',
    'Nombre: Ana Prueba',
    'Ciudad: Quito',
    'Provincia: Pichincha'
].join('\n');

test('caracterização: CTA Protocolo G conserva dados Tex Ultra sem substituir correção humana', () => {
    const payload = texUltraVslPayloadData(vslText);
    assert.deepEqual(payload, { name: 'Ana Prueba', city: 'Quito', province: 'Pichincha' });
    const merged = mergeTexUltraVslPayloadDraft({ name: 'Nome Confirmado', city: '', province: 'Pichincha' }, payload);
    assert.equal(merged.name, 'Nome Confirmado');
    assert.equal(merged.city, 'Quito');
    assert.equal(merged.province, 'Pichincha');
});

test('caracterização: quantidade Tex Ultra mantém frascos e pergunta somente o próximo dado ausente', () => {
    assert.equal(texUltraSelectedQuantity('3 frascos'), 3);
    assert.equal(texUltraSelectedQuantity('6 frascos'), 6);
    const next = texUltraNextDataCollectionStep({ name: 'Ana Prueba', city: 'Quito', province: 'Pichincha', quantity: 3 });
    assert.equal(next.stage, 'awaiting_address');
    assert.doesNotMatch(next.text, /nombre completo|qué ciudad|que ciudad|provincia pertenece/i);
});

test('caracterização: pergunta fora da coleta pede intervenção humana', () => {
    assert.equal(texUltraInboundNeedsHuman('¿Tiene alguna contraindicación?'), true);
    assert.equal(texUltraInboundNeedsHuman('3 frascos'), false);
});

test('caracterização: seleção manual e bloqueio humano antecedem o funil Tex Ultra', () => {
    const source = fs.readFileSync(new URL('../src/services/texUltraFunnelService.js', import.meta.url), 'utf8');
    assert.match(source, /state\.metadata\?\.productKey !== AGENT_KEY && !explicitTex/);
    assert.match(source, /state\.human\?\.mode === 'manual'/);
    assert.match(source, /buildSourceScopedOutboundDedupeValue/);
});

test('melhoria: nome confirmado avança ao próximo dado ausente sem repetir cidade conhecida', () => {
    const draft = { name: 'Ana Confirmada', city: 'Quito', province: 'Pichincha', quantity: 3 };
    assert.equal(texUltraNextDataCollectionStep(draft).stage, 'awaiting_address');

    const source = fs.readFileSync(new URL('../src/services/texUltraFunnelService.js', import.meta.url), 'utf8');
    const awaitingName = source.split("if (memory.stage === 'awaiting_name') {")[1]
        ?.split("if (memory.stage === 'awaiting_city') {")[0] || '';
    assert.match(awaitingName, /const nextStep = texUltraNextDataCollectionStep\(draft\)/);
    assert.match(awaitingName, /stage: nextStep\.stage/);
    assert.doesNotMatch(awaitingName, /stage: 'awaiting_city'/);
});
