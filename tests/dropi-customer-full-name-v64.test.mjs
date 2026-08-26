import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildDroppiEcuadorOrderPayload,
    validateEcuadorDropiCustomerName
} from '../src/services/droppiEcuadorService.js';

const buildOrder = (name) => ({
    orderId: 'EC-NAME-GUARD-TEST',
    country: 'EC',
    customer: {
        name,
        phone: '+593969253940',
        address: 'Servientrega Naranjal Centro',
        city: 'Naranjal',
        province: 'Guayas'
    },
    package: { id: 1, quantity: 1 },
    total: 35.99,
    productKey: 'tex_ultra_ec',
    productName: 'Tex Ultra Ecuador'
});

test('aceita nome e sobrenome humanos com acentos, hifen e particulas', () => {
    for (const name of [
        'JULIO GARCIA',
        'Danilo Tinoco',
        'María-José de la Cruz',
        "Juan D'Angelo"
    ]) {
        assert.deepEqual(validateEcuadorDropiCustomerName(name).ok, true, name);
    }
});

test('bloqueia usuario tecnico, nome concatenado, digitos e nome sem sobrenome', () => {
    const invalidNames = new Map([
        ['garciajul96', 'customer_name_contains_digits'],
        ['garcia_jul', 'technical_customer_name_not_allowed'],
        ['miguelarellanoperalta', 'customer_surname_required'],
        ['JULIO', 'customer_surname_required'],
        ['julio@ventas', 'technical_customer_name_not_allowed']
    ]);

    for (const [name, reason] of invalidNames) {
        const validation = validateEcuadorDropiCustomerName(name);
        assert.equal(validation.ok, false, name);
        assert.equal(validation.reason, reason, name);
    }
});

test('payload Dropi usa um unico nome oficial completo e separa o sobrenome', () => {
    const payload = buildDroppiEcuadorOrderPayload({ order: buildOrder('JULIO GARCIA') });

    assert.equal(payload.firstName, 'JULIO');
    assert.equal(payload.lastName, 'GARCIA');
    assert.equal(payload.phone, '969253940');
    assert.equal(payload.productKey, 'tex_ultra_ec');
});

test('ultimo ponto comum do payload impede qualquer caminho de enviar nome invalido', () => {
    assert.throws(
        () => buildDroppiEcuadorOrderPayload({ order: buildOrder('garciajul96') }),
        (error) => (
            error?.code === 'DROPI_CUSTOMER_FULL_NAME_REQUIRED'
            && error?.statusCode === 409
            && error?.reason === 'customer_name_contains_digits'
        )
    );
});

test('rotas de autorizacao, envio automatico e preparo manual aplicam a mesma trava', async () => {
    const { readFile } = await import('node:fs/promises');
    const routes = await readFile(new URL('../src/routes/shipments.js', import.meta.url), 'utf8');

    assert.match(routes, /router\.post\('\/droppi\/ec\/orders\/:orderId\/submit'/);
    assert.match(routes, /router\.get\('\/droppi\/ec\/orders\/:orderId\/manual-link'/);
    assert.match(routes, /router\.post\('\/droppi\/ec\/orders\/:orderId\/authorize-submit'/);
    assert.equal(
        (routes.match(/return dropiCustomerNameBlockedResponse\(res, order, shipment\)/g) || []).length,
        3
    );
    assert.match(routes, /if \(!hasValidEcuadorDropiCustomerName\(order\)\) continue;/);
});
