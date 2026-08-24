import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const report = fs.readFileSync(
    new URL('../docs/PICKUP_BONUS_DELIVERY_ACTIVATION_RESULT_V60_20260824.md', import.meta.url),
    'utf8'
);

test('V60 registra ativacao, entrega unica do bonus e antirrepeticao', () => {
    assert.match(report, /Commit oficial: `bdffb627fb82deb7378dd565a3a2440c53a34cd7`/);
    assert.match(report, /Tag anotada: `production-20260824-bdffb62`/);
    assert.match(report, /20260824T161720Z_production-20260824-bdffb62/);
    assert.match(report, /uma unica mensagem fisica do[\s\S]*?bonus pela Z-API/);
    assert.match(report, /callback `delivered`[\s\S]*?`ack=2`/);
    assert.match(report, /`OBRIGADO_PAGOU` permaneceu com contagem fisica `1`/);
    assert.match(report, /contagem de bonus entregue pendente passou de[\s\S]*?`1` para `0`/);
    assert.match(report, /Hash, historico, lock persistente, `OutboundDedupe`/);
    assert.match(report, /Nenhum replay historico em massa foi executado/);
    assert.match(report, /Z-API continua sendo o transporte oficial/);
});
