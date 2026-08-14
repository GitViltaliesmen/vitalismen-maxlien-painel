const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../agency-catalog.js');

const rows = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '..', 'agencia_LISTA.json'),
    'utf8'
));

const quito = catalog.search(rows, {
    city: 'Quito',
    province: 'Pichincha',
    limit: 500
});

assert.ok(quito.length > 10, 'o catálogo local deve permitir lotes além das 10 primeiras agências');
assert.ok(quito.every((agency) => catalog.normalize(agency.city) === 'QUITO'));

const urdesa = catalog.search(rows, {
    city: 'Guayaquil',
    province: 'Guayas',
    query: 'Urdesa',
    limit: 100
});

assert.ok(urdesa.length > 4, 'a cidade deve continuar oferecendo várias opções');
assert.match(
    `${urdesa[0].name} ${urdesa[0].address}`.toUpperCase(),
    /URDESA/,
    'o ponto de referência deve priorizar a agência correspondente'
);

const cayambe = catalog.resolveLocation(rows, { city: 'cayambe' });
assert.deepEqual(cayambe, {
    matched: true,
    ambiguous: false,
    city: 'Cayambe',
    province: 'Pichincha',
    inferredProvince: true
});

const salinas = catalog.resolveLocation(rows, { city: 'salinas' });
assert.equal(salinas.matched, true);
assert.equal(salinas.city, 'Salinas (Santa Elena)');
assert.equal(salinas.province, 'Santa Elena');
assert.equal(salinas.inferredProvince, true);

const unknownCity = catalog.search(rows, {
    city: 'Cidade Inexistente',
    query: 'mercado central',
    limit: 100
});
assert.deepEqual(unknownCity, [], 'cidade desconhecida não pode sugerir agências de outro local');

const incompleteCity = catalog.resolveLocation(rows, { city: 'cay' });
assert.equal(incompleteCity.matched, false, 'cidade ainda incompleta não pode ser autocompletada durante a digitação');

console.log('local Servientrega agency catalog search: ok');
