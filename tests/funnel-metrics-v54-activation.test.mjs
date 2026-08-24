import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const activation = fs.readFileSync(
    'docs/TEX_ULTRA_DELIVERY_CLOSURE_ACTIVATION_RESULT_V54_20260824.md',
    'utf8'
);

test('registro da ativação V54 contém release, rollback e reparo sem reenvio', () => {
    assert.match(activation, /production-20260824-8801624/);
    assert.match(activation, /20260824T040419Z_production-20260824-8801624/);
    assert.match(activation, /20260824T025315Z_production-20260824-04b1e8e/);
    assert.match(activation, /EC-MT6MPQ4G-BAF7/);
    assert.match(activation, /EC-SA-A61F62FBBFE7E2B0/);
    assert.match(activation, /Pedido Dropi já existente preservado: `6674859`/);
    assert.match(activation, /Evento Meta Purchase preservado/);
    assert.match(activation, /Mensagens de saída criadas após o reparo: `0`/);
    assert.match(activation, /Guard V54: `44\/44`/);
    assert.match(activation, /senior:check` em produção: `338\/338`/);
    assert.match(activation, /Nenhum canário real foi enviado/);
});
