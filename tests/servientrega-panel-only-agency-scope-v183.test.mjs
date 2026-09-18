import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    findServientregaEcuadorAgencies,
    normalizeAgencyText
} from '../src/services/servientregaEcuadorAgencyService.js';

const strictFind = (overrides = {}) => findServientregaEcuadorAgencies({
    city: '',
    province: '',
    query: '',
    limit: 500,
    strictCityScope: true,
    ...overrides
});

const normalizedCities = (agencies) => [...new Set(agencies.map((agency) => normalizeAgencyText(agency.city)))];
const normalizedProvinces = (agencies) => [...new Set(agencies.map((agency) => normalizeAgencyText(agency.province)))];

test('V183 mantém default e strictCityScope false semanticamente idênticos', () => {
    const cases = [
        { city: 'Huaquillas', province: 'El Oro', query: '', limit: 10 },
        { city: 'Huaquillas', province: 'El Oro', query: 'Principal', limit: 10 },
        { city: 'Huaquillas', province: 'El Oro', query: 'Arenillas', limit: 10 },
        { city: 'Huaquilla', province: 'El Oro', query: '', limit: 10 },
        { city: '', province: 'El Oro', query: '', limit: 10 },
        { city: '', province: '', query: 'Huaquillas', limit: 10 }
    ];
    for (const input of cases) {
        assert.deepEqual(
            findServientregaEcuadorAgencies(input),
            findServientregaEcuadorAgencies({ ...input, strictCityScope: false }),
            JSON.stringify(input)
        );
    }
});

test('V183 opt-in aplica Huaquillas e El Oro como interseção exata', () => {
    const agencies = strictFind({ city: 'Huaquillas', province: 'El Oro' });
    assert.equal(agencies.length, 2);
    assert.deepEqual(agencies.map((agency) => agency.name), [
        'Huaquillas av Republica',
        'Huaquillas Principal'
    ]);
    assert.deepEqual(normalizedCities(agencies), ['HUAQUILLAS']);
    assert.deepEqual(normalizedProvinces(agencies), ['EL ORO']);
});

test('V183 opt-in mantém cidade como hard scope sem província', () => {
    const agencies = strictFind({ city: 'Huaquillas' });
    assert.equal(agencies.length, 2);
    assert.deepEqual(normalizedCities(agencies), ['HUAQUILLAS']);
});

test('V183 opt-in filtra query somente dentro da cidade', () => {
    const principal = strictFind({ city: 'Huaquillas', province: 'El Oro', query: 'Principal' });
    assert.deepEqual(principal.map((agency) => agency.name), ['Huaquillas Principal']);
    assert.deepEqual(strictFind({ city: 'Huaquillas', province: 'El Oro', query: 'Arenillas' }), []);
});

test('V183 opt-in preserva province-only da V179', () => {
    const input = { city: '', province: 'El Oro', query: '', limit: 20 };
    const baseline = findServientregaEcuadorAgencies(input);
    const strict = findServientregaEcuadorAgencies({ ...input, strictCityScope: true });
    assert.deepEqual(strict, baseline);
    assert.ok(normalizedCities(strict).length > 1);
    assert.deepEqual(normalizedProvinces(strict), ['EL ORO']);
});

test('V183 opt-in falha fechado para cidade desconhecida', () => {
    assert.deepEqual(strictFind({ city: 'Cidade Inexistente', province: 'El Oro' }), []);
});

test('V183 rota e painel ativam escopo estrito sem fallback nacional', () => {
    const route = fs.readFileSync(new URL('../src/routes/shipments.js', import.meta.url), 'utf8');
    const panel = fs.readFileSync(new URL('../public/qr.html', import.meta.url), 'utf8');
    assert.match(route, /strictCityScope:\s*String\(strictCity \|\| ''\) === '1'/);
    assert.match(panel, /strictCity=1/);
    assert.doesNotMatch(panel, /city=&province=&q=\$\{encodeURIComponent\(city\)\}/);
});
