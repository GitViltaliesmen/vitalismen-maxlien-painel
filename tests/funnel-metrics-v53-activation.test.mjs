import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const activation = fs.readFileSync(
    'docs/POST_SALE_HEALTH_RECOVERY_ACTIVATION_RESULT_V53_20260824.md',
    'utf8'
);

test('registro da ativação V53 contém release, rollback e validações do pós-venda', () => {
    assert.match(activation, /production-20260824-04b1e8e/);
    assert.match(activation, /20260824T025315Z_production-20260824-04b1e8e/);
    assert.match(activation, /20260824T020500Z_production-20260824-1bf5013/);
    assert.match(activation, /324\/324/);
    assert.match(activation, /24\/24 áudios físicos entregues/);
    assert.match(activation, /21 pendências antigas.*sem qualquer replay automático/s);
    assert.match(activation, /Falhas de deduplicação pendentes: zero/);
    assert.match(activation, /Nenhum cliente real foi usado como canário/);
});
