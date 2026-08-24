import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const activation = fs.readFileSync(
    'docs/PANEL_MEDIA_PERSISTENCE_ACTIVATION_RESULT_V52_20260824.md',
    'utf8'
);

test('registro da ativação V52 contém release, rollback e validações oficiais', () => {
    assert.match(activation, /production-20260824-1bf5013/);
    assert.match(activation, /20260824T020500Z_production-20260824-1bf5013/);
    assert.match(activation, /20260824T001100Z_production-20260824-bab7bbb/);
    assert.match(activation, /317\/317/);
    assert.match(activation, /Chegou_01.*Chegou_02.*Chegou_03/s);
    assert.match(activation, /Agradecimento_Agencia_01/);
    assert.match(activation, /Nenhuma mensagem ou mídia foi enviada/);
});
