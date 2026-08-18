import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    mergeTexUltraVslPayloadDraft,
    texUltraInterruptedInboundRoute,
    texUltraNextDataCollectionStep,
    texUltraVslPayloadData
} from '../src/services/texUltraFunnelService.js';

const screenshotPayload = [
    'Hola, quiero el tratamiento.',
    'Nombre: Luis Zapata',
    'CIUDAD: Salcedo',
    'PROVINCIA: Cotopaxi'
].join('\n');

test('payload real da VSL conserva intencao e extrai os tres dados rotulados', () => {
    assert.equal(texUltraInterruptedInboundRoute(screenshotPayload), 'purchase');
    assert.deepEqual(texUltraVslPayloadData(screenshotPayload), {
        name: 'Luis Zapata',
        city: 'Salcedo',
        province: 'Cotopaxi'
    });
});

test('extracao exige CTA oficial na primeira linha e ignora campos livres perigosos', () => {
    assert.equal(texUltraVslPayloadData('Nombre: Luis Zapata\nCIUDAD: Salcedo\nPROVINCIA: Cotopaxi'), null);
    assert.deepEqual(texUltraVslPayloadData([
        'Hola, quiero el tratamiento.',
        'Nombre: Luis Zapata',
        'CIUDAD: Salcedo',
        'PROVINCIA: Cotopaxi',
        'DIRECCION: no debe entrar',
        'Cantidad: 6'
    ].join('\n')), {
        name: 'Luis Zapata',
        city: 'Salcedo',
        province: 'Cotopaxi'
    });
});

test('dados da VSL preenchem apenas lacunas e nunca sobrescrevem correcao existente', () => {
    const merged = mergeTexUltraVslPayloadDraft({
        name: 'Nombre Corregido',
        city: '',
        province: 'Pichincha'
    }, texUltraVslPayloadData(screenshotPayload), '2026-08-18T15:00:00.000Z');
    assert.equal(merged.name, 'Nombre Corregido');
    assert.equal(merged.city, 'Salcedo');
    assert.equal(merged.province, 'Pichincha');
    assert.deepEqual(merged.vslPayloadFields, ['city']);
    assert.equal(merged.vslPayloadSource, 'official_multiline_cta');
});

test('apos escolher quantidade o funil aproveita nome cidade e provincia e pede entrega', () => {
    const draft = {
        ...mergeTexUltraVslPayloadDraft({}, texUltraVslPayloadData(screenshotPayload)),
        quantity: 3,
        total: 80.99
    };
    const next = texUltraNextDataCollectionStep(draft);
    assert.equal(next.stage, 'awaiting_address');
    assert.match(next.text, /Ya tengo su nombre, ciudad y provincia/);
    assert.doesNotMatch(next.text, /nombre completo/);
});

test('camada grava o payload antes de iniciar a cadencia e mantém o funil oficial', () => {
    const source = fs.readFileSync(new URL('../src/services/texUltraFunnelService.js', import.meta.url), 'utf8');
    const capture = source.indexOf('const vslPayload = texUltraVslPayloadData(inboundText)');
    const start = source.indexOf('startTexUltraInitialLayer({ state })');
    assert.ok(capture > 0 && start > capture);
    assert.match(source, /memory = await saveState\(state, \{ memory, draft, stage: memory\.stage \|\| 'presentation' \}\)/);
    assert.match(source, /texUltraNextDataCollectionStep\(draft\)/);
});
