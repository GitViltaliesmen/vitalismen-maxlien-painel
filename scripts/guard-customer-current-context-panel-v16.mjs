import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const panel = read('public/panel-intelligence/customer-current-context-v16.js');
const styles = read('public/panel-intelligence/customer-current-context-v16.css');
const qr = read('public/qr.html');
const route = read('src/routes/customerContext.js');

const forbiddenSideEffects = /\b(?:autosave|persistSelectedCustomerData|panelProductContextForChat|WhatsApp|Dropi|Meta|OpenAI)\b|Z-API|Order\.save|ContactState\.save/i;
const forbiddenEditableElements = /<(?:input|select|textarea|button|form)\b/i;
const forbiddenMethods = /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i;

assert.doesNotMatch(panel, forbiddenSideEffects);
assert.doesNotMatch(panel, forbiddenEditableElements);
assert.doesNotMatch(panel, forbiddenMethods);
assert.doesNotMatch(panel, /\bfetch\s*\(/);
assert.match(panel, /method:\s*'GET'/);
assert.match(panel, /\/api\/customer-context\/\$\{encodeURIComponent\(phone\)\}/);
assert.match(panel, /AbortController/);
assert.match(panel, /requestSequence !== sequence \|\| phone !== activePhone/);
assert.match(panel, /v16\.customer-current-context\.readonly\.1/);
assert.match(panel, /applicationAllowed !== false/);

for (const block of ['IDENTIDADE', 'LOCALIZAÇÃO', 'PRODUTO ATUAL', 'ORIGEM / VSL', 'PEDIDO ATUAL', 'HISTÓRICO', 'FUNIL', 'CONFLITOS']) {
    assert.match(panel, new RegExp(block.replace('/', '\\/')));
}

for (const state of ['SEM CLIENTE SELECIONADO', 'CARREGANDO CONTEXTO', 'CONTEXTO DISPONÍVEL', 'CONTEXTO AMBÍGUO', 'ERRO AO CARREGAR', 'SEM DADOS SUFICIENTES', 'VERSÃO INCOMPATÍVEL']) {
    assert.ok(panel.includes(state), `Estado visual ausente: ${state}`);
}

assert.match(qr, /customer-current-context-v16\.css/);
assert.match(qr, /id="customerCurrentContextV16"/);
assert.match(qr, /customer-current-context-v16\.js/);
assert.match(qr, /VitalismenCustomerCurrentContextV16\?\.mount/);
assert.match(qr, /customerCurrentContextPanel\?\.selectPhone\(currentChatPhone\(\), \{ force: true \}\)/);
assert.match(qr, /customerCurrentContextPanel\?\.clear\(\)/);
assert.match(route, /router\.get\('\/:phone', authMiddleware,/);
assert.match(styles, /\.customer-current-context-v16/);
assert.doesNotMatch(styles, /position\s*:\s*fixed/i);

console.log('[CUSTOMER-CURRENT-CONTEXT-PANEL-V16] OK: interface somente leitura, GET único e proteção contra resposta obsoleta.');
