const assert = require('node:assert/strict');
const normalizer = require('../customer-data-normalizer.js');

assert.equal(
    normalizer.formatPersonName('  GERSON   LOURENÇO DA SILVA  '),
    'Gerson Lourenço da Silva'
);
assert.equal(
    normalizer.formatPersonName('maría del carmen pérez'),
    'María del Carmen Pérez'
);
assert.equal(normalizer.formatPersonName("ANA-MARÍA D'ÁVILA"), "Ana-María D'Ávila");
assert.equal(
    normalizer.formatLocationName('SANTO DOMINGO DE LOS TSÁCHILAS'),
    'Santo Domingo de los Tsáchilas'
);
assert.equal(
    normalizer.formatLocationName('SALINAS (SANTA ELENA)'),
    'Salinas (Santa Elena)'
);
assert.deepEqual(
    normalizer.normalizeCustomerData({
        name: 'ENRIQUE TAPIA',
        city: 'cayambe',
        province: 'PICHINCHA',
        reference: '  mercado   central  ',
        address: '  Calle   Vivar  '
    }),
    {
        name: 'Enrique Tapia',
        city: 'Cayambe',
        province: 'Pichincha',
        reference: 'mercado central',
        address: 'Calle Vivar'
    }
);
assert.equal(normalizer.isLikelyConcatenatedPersonName('Marcoseduarvarelavaldiezo'), true);
assert.equal(normalizer.isLikelyConcatenatedPersonName('Marcos Eduardo'), false);
assert.equal(normalizer.shouldPreferExplicitPersonName({
    currentName: 'Marcoseduarvarelavaldiezo',
    detectedName: 'Marcos Eduardo',
    detectedSource: 'explicit_label'
}), true);
assert.equal(normalizer.shouldPreferExplicitPersonName({
    currentName: 'Marcoseduarvarelavaldiezo',
    detectedName: 'Marcos Eduardo',
    detectedSource: 'explicit_label',
    manual: true
}), false);

console.log('customer data normalizer: ok');
