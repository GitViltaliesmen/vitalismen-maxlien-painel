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

console.log('local Servientrega agency catalog search: ok');
