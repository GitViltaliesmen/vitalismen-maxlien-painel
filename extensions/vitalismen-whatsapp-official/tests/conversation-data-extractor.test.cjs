const assert = require('node:assert/strict');
const extractor = require('../conversation-data-extractor.js');

const result = extractor.extract([
    { isFromMe: true, body: 'Dígame sus datos para registrar.' },
    {
        isFromMe: false,
        body: 'Mi nombre es Luis Jiménez SERVIENTREGA QUININDE PRINCIPAL Dirección / Referencia: Av. 6 de Diciembre. Ciudad / Provincia: Quininde, Esmeraldas'
    },
    { isFromMe: false, body: 'Deseo 3 frascos de Tex Ultra por 80,99 dólares' }
]);

assert.equal(result.name, 'Luis Jiménez');
assert.equal(result.address, 'SERVIENTREGA QUININDE PRINCIPAL');
assert.equal(result.city, 'Quininde');
assert.equal(result.province, 'Esmeraldas');
assert.equal(result.reference, 'Av. 6 de Diciembre.');
assert.equal(result.quantity, '3');
assert.equal(result.total, '80.99');
assert.equal(result.productKey, 'tex_ultra_ec');

const outgoingIgnored = extractor.extract([
    { isFromMe: true, body: 'Mi nombre es Nombre do Atendente. Ciudad: Loja' },
    { isFromMe: false, body: 'Quiero dos frascos' }
]);
assert.equal(outgoingIgnored.name, undefined);
assert.equal(outgoingIgnored.city, undefined);
assert.equal(outgoingIgnored.quantity, '2');

console.log('conversation data extractor: ok');
