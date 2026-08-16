const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ console });
for (const file of [
    'customer-data-normalizer.js',
    'conversation-data-extractor.js',
    'agency-catalog.js',
    'customer-form-intelligence.js'
]) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'panel-intelligence', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
}
const intelligence = context.VitalismenCustomerFormIntelligence;

const complete = intelligence.extractCustomerData([
    { isFromMe: true, body: 'Informe sus datos completos.' },
    {
        isFromMe: false,
        body: 'Mi nombre es Luis Jiménez SERVIENTREGA QUININDE PRINCIPAL Dirección / Referencia: Av. 6 de Diciembre. Ciudad / Provincia: Quininde, Esmeraldas'
    },
    { isFromMe: false, body: 'Deseo 3 frascos de Tex Ultra por 80,99 dólares' }
]);

assert.equal(complete.name, 'Luis Jiménez');
assert.equal(complete.name.includes('SERVIENTREGA'), false);
assert.equal(complete.city, 'Quininde');
assert.equal(complete.province, 'Esmeraldas');
assert.equal(complete.reference, 'Av. 6 de Diciembre.');
assert.equal(complete.quantity, '3');
assert.equal(complete.total, '80.99');
assert.equal(complete.productKey, 'tex_ultra_ec');

assert.equal(intelligence.confidentPersonName('Luis Jiménez'), 'Luis Jiménez');
assert.equal(intelligence.confidentPersonName('Luis Jiménez Servientrega'), '');
assert.equal(intelligence.confidentPersonName('Quiero 3 frascos'), '');
assert.equal(intelligence.confidentPersonName('0983709502'), '');

const outgoingIgnored = intelligence.extractCustomerData([
    { isFromMe: true, body: 'Nombre: Nombre del vendedor. Ciudad: Loja' },
    { isFromMe: false, body: 'Quiero dos frascos' }
]);
assert.equal(outgoingIgnored.name, undefined);
assert.equal(outgoingIgnored.city, undefined);
assert.equal(outgoingIgnored.quantity, '2');

const agencies = [
    { name: 'Cayambe Centro', address: 'Calle Sucre', city: 'CAYAMBE', province: 'PICHINCHA', sector: 'Centro' },
    { name: 'Cayambe Norte', address: 'Panamericana Norte', city: 'CAYAMBE', province: 'PICHINCHA', sector: 'Norte' },
    { name: 'Urdesa Central', address: 'Av. Víctor Emilio Estrada', city: 'GUAYAQUIL', province: 'GUAYAS', sector: 'Urdesa' },
    { name: 'Urdesa Norte', address: 'Las Monjas', city: 'GUAYAQUIL', province: 'GUAYAS', sector: 'Urdesa' }
];

const cayambeLocation = intelligence.resolveAgencyLocation(agencies, { city: 'cayambe' });
assert.equal(cayambeLocation.matched, true);
assert.equal(cayambeLocation.ambiguous, false);
assert.equal(cayambeLocation.city, 'Cayambe');
assert.equal(cayambeLocation.province, 'Pichincha');
assert.equal(cayambeLocation.inferredProvince, true);

const exactAgency = intelligence.selectAutomaticAgency(agencies, { query: 'Cayambe Centro' });
assert.equal(exactAgency.matched, true);
assert.equal(exactAgency.agency.name, 'Cayambe Centro');

const ambiguousReference = intelligence.selectAutomaticAgency(agencies, { query: 'Urdesa' });
assert.equal(ambiguousReference.matched, false);
assert.equal(ambiguousReference.ambiguous, true);

const noisyLocation = intelligence.resolveAgencyLocation([
    ...agencies,
    { name: 'Portoviejo Centro', city: 'PORTOVIEJO', province: 'MANABI' }
], { city: 'CIVO Portoviejo', province: 'EM MANAVI' });
assert.equal(noisyLocation.matched, true);
assert.equal(noisyLocation.city, 'Portoviejo');
assert.equal(noisyLocation.province, 'Manabi');

assert.equal(intelligence.approvedTotal({ productKey: 'tex_ultra_ec', quantity: '1' }), '35.99');
assert.equal(intelligence.approvedTotal({ productKey: 'tex_ultra_ec', quantity: '2' }), '70.00');
assert.equal(intelligence.approvedTotal({ productKey: 'tex_ultra_ec', quantity: '3' }), '80.99');
assert.equal(intelligence.approvedTotal({ productKey: 'tex_ultra_ec', quantity: '6' }), '147.99');
assert.equal(intelligence.approvedTotal({ productKey: 'vit_power_ec', quantity: '3' }), '');

const currentProtocolGLead = intelligence.extractCustomerData([{
    isFromMe: false,
    body: 'Hola, quiero el tratamiento. Nombre: Marcos Eduardo Teléfono: 0992439779'
}]);
assert.equal(currentProtocolGLead.name, 'Marcos Eduardo');
assert.equal(currentProtocolGLead.nameSource, 'explicit_label');

const requestedProtocolGLead = intelligence.extractCustomerData([{
    isFromMe: false,
    body: 'Hola, quiero el tratamiento.\nNombre: Marcos Eduardo\nCIUDAD: Portoviejo\nPROVINCIA: Manabi'
}]);
assert.equal(requestedProtocolGLead.name, 'Marcos Eduardo');
assert.equal(requestedProtocolGLead.city, 'Portoviejo');
assert.equal(requestedProtocolGLead.province, 'Manabi');

assert.equal(
    context.VitalismenCustomerDataNormalizer.shouldPreferExplicitPersonName({
        currentName: 'Marcoseduarvarelavaldiezo',
        detectedName: currentProtocolGLead.name,
        detectedSource: currentProtocolGLead.nameSource
    }),
    true
);
assert.equal(
    context.VitalismenCustomerDataNormalizer.shouldPreferExplicitPersonName({
        currentName: 'Nombre Editado Manualmente',
        detectedName: currentProtocolGLead.name,
        detectedSource: currentProtocolGLead.nameSource
    }),
    false
);

console.log('customer form intelligence: OK');
