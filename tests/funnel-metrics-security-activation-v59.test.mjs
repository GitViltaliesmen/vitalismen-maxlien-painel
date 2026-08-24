import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const report = fs.readFileSync(
    new URL('../docs/BAILEYS_LIBSIGNAL_SECURITY_ACTIVATION_RESULT_V59_20260824.md', import.meta.url),
    'utf8'
);

test('V59 registra release, auditoria zero e preservacao do transporte oficial', () => {
    assert.match(report, /Commit oficial: `c7061a14e2d329c88c2925c45b327737158ce593`/);
    assert.match(report, /Tag anotada: `production-20260824-c7061a1`/);
    assert.match(report, /20260824T131742Z_production-20260824-c7061a1/);
    assert.match(report, /zero vulnerabilidades `info`,[\s\S]*?`critical`/);
    assert.match(report, /Z-API continua sendo o transporte oficial/);
    assert.match(report, /Nenhum cliente real ou telefone QA recebeu envio de validacao/);
    assert.match(report, /Nenhum pedido, Shipment, Dropi, Meta\/CAPI ou Purchase foi criado ou repetido/);
});
