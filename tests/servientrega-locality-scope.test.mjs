import assert from 'node:assert/strict';
import test from 'node:test';
import {
    findKnownServientregaEcuadorLocation,
    findServientregaEcuadorAgencies
} from '../src/services/servientregaEcuadorAgencyService.js';
import { resolveAuthorizedAgency } from '../src/services/customerDataResolutionService.js';

const cities = (query, limit = 5) => findServientregaEcuadorAgencies({ query, limit })
    .map((agency) => agency.city.toUpperCase());

test('confirmação curta não é transformada em agência para Tex Ultra', () => {
    for (const query of ['Si', 'No', 'Ok', 'Pal', 'Pale']) {
        assert.deepEqual(cities(query), [], query);
    }
    const agency = resolveAuthorizedAgency({ agencyRaw: 'Si', deliveryMode: 'agency' });
    assert.equal(agency.validation_status, 'INVALID');
    assert.deepEqual(agency.candidates, []);
});

test('cidade canônica restringe opções à própria cidade, inclusive no resolvedor Tex Ultra', () => {
    const direct = findServientregaEcuadorAgencies({ query: 'Ciudad paltas, loja', limit: 5 });
    assert.deepEqual(direct.map((agency) => agency.name), ['Paltas Domingo Celi']);
    assert.ok(direct.every((agency) => agency.city.toUpperCase() === 'PALTAS' && agency.province.toUpperCase() === 'LOJA'));

    const resolved = resolveAuthorizedAgency({ deliveryMode: 'agency', city: 'Paltas', province: 'Loja' });
    assert.ok(resolved.candidates.length >= 1);
    assert.ok(resolved.candidates.every((agency) => agency.city.toUpperCase() === 'PALTAS'));
});

test('correção natural e alias resolvem La Libertad sem buscar outras cidades', () => {
    const query = 'No, es ESA. Es en la liberdad';
    const location = findKnownServientregaEcuadorLocation({ text: query });
    assert.equal(location.city, 'LA LIBERTAD');
    assert.equal(location.province, 'SANTA ELENA');
    const agencies = findServientregaEcuadorAgencies({ query, limit: 5 });
    assert.ok(agencies.length >= 1);
    assert.ok(agencies.every((agency) => agency.city.toUpperCase() === 'LA LIBERTAD'
        && agency.province.toUpperCase() === 'SANTA ELENA'));
});

test('acentos, caixa, texto adicional e aliases existentes preservam localidades válidas', () => {
    for (const query of ['SIGSIG', 'sigsig', 'Sígsig', 'ciudad Sigsig, provincia Azuay', 'Quiero retirar en Sigsig']) {
        assert.deepEqual(cities(query), ['SIGSIG'], query);
    }
    const santoDomingo = cities('Santo Domigo');
    assert.ok(santoDomingo.length > 0 && santoDomingo.every((city) => city === 'SANTO DOMINGO'));
    assert.deepEqual(cities('Palenda'), ['PALANDA']);
    const guayaquil = cities('GYE');
    assert.ok(guayaquil.length > 0 && guayaquil.every((city) => city === 'GUAYAQUIL'));
    assert.deepEqual(cities('No, es Palenque'), ['PALENQUE']);
});

test('localidade inexistente e nomes parcialmente semelhantes não geram falsos positivos', () => {
    for (const query of ['Atlantis', 'Ciudad Atlantis, provincia Narnia', 'foo bar baz']) {
        assert.deepEqual(cities(query), [], query);
    }
    assert.deepEqual(cities('Palenque'), ['PALENQUE']);
    assert.deepEqual(cities('Palestina'), ['PALESTINA']);
    assert.deepEqual(cities('Palanda'), ['PALANDA']);
    assert.equal(findKnownServientregaEcuadorLocation({ text: 'Pichincha' }).province.toUpperCase(), 'MANABI');
    const pichincha = cities('Pichincha');
    assert.ok(pichincha.length > 0 && pichincha.every((city) => city === 'PICHINCHA'));
    const urdesa = cities('Urdesa central');
    assert.ok(urdesa.length > 0 && urdesa.every((city) => city === 'GUAYAQUIL'));
});
