const assert = require('node:assert/strict');
const batch = require('../agency-batch.js');

const agencies = Array.from({ length: 12 }, (_, index) => ({ name: `Agência ${index + 1}` }));
const formatOption = (agency, number) => `${number}. ${agency.name}`;

assert.deepEqual(
    batch.buildMessages({
        agencies: agencies.slice(0, 4),
        startNumber: 1,
        includeIntro: true,
        intro: 'Por favor, escolha uma agência:',
        formatOption
    }),
    [
        'Por favor, escolha uma agência:',
        '1. Agência 1',
        '2. Agência 2',
        '3. Agência 3',
        '4. Agência 4'
    ]
);

assert.deepEqual(
    batch.buildMessages({
        agencies: agencies.slice(4, 8),
        startNumber: 5,
        includeIntro: false,
        intro: 'Não deve repetir',
        formatOption
    }),
    ['5. Agência 5', '6. Agência 6', '7. Agência 7', '8. Agência 8']
);

assert.equal(batch.optionNumber(8, 0), 9);
assert.equal(batch.optionNumber(8, 3), 12);
console.log('continuous agency batches without repeated intro: ok');
