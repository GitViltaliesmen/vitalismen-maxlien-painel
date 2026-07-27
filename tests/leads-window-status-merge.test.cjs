const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'leads-window.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
assert.ok(scripts.length, 'leads-window.html precisa conter script');
for (const source of scripts) {
    assert.doesNotThrow(() => new Function(source), 'script inline de leads-window.html deve ser válido');
}

assert.match(html, /const mergedOperationalStatus = \(existing = \{\}, operational = \{\}\) =>/);
assert.match(html, /operationalStatus === 'confirmado' && authoritativeLeadStatuses\.has\(currentStatus\)/);
assert.match(html, /'atendendo',[\s\S]*'pedido_enviado',[\s\S]*'entregue'/);
assert.match(html, /status: mergedStatus,[\s\S]*_opsStatus: mergedStatus/);

console.log('leads-window operational status precedence: ok');
