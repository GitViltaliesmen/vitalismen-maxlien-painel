import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('painel publico nao contem credencial administrativa literal', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const formerVariable = ['local', 'Dev', 'Login'].join('');
    const formerEmail = ['teste', 'local.com'].join('@');
    const formerPassword = ['Teste', '1234'].join('');
    assert.equal(panel.includes(formerVariable), false);
    assert.doesNotMatch(panel, /password:\s*['"][^'"]+['"]/);
    assert.equal(panel.includes(formerEmail), false);
    assert.equal(panel.includes(formerPassword), false);
});
