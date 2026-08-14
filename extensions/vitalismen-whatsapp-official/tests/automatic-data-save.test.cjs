const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'sidepanel.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'sidepanel.js'), 'utf8');

assert.equal(manifest.version, '0.13.5');
assert.match(html, /id="autoSaveState"/);
assert.match(html, /conversation-data-extractor\.js/);
assert.match(script, /performAutomaticDraftSave/);
assert.match(script, /queueAutomaticDraftSave/);
assert.match(script, /Gravando dados automáticos/);
assert.match(script, /Dados do cliente salvos\. Pedido ainda não confirmado/);
assert.match(script, /customerDraft\.status === 'confirmado'/);
assert.match(script, /Confirmação exige clique humano/);
assert.match(script, /manualFieldIds/);
assert.match(
    script,
    /processing:\s*'pedido_enviado'[\s\S]*submitted:\s*'pedido_enviado'/,
    'status confirmado pela Dropi deve aparecer como pedido enviado'
);
assert.match(
    script,
    /setInterval\(\(\) => loadChats\(\{ quiet: true \}\), 3500\)/,
    'clientes devem ser sincronizados automaticamente sem atualizar a pagina'
);
assert.match(
    script,
    /const applyLiveOrderStatus[\s\S]*authoritativeStatuses[\s\S]*setInputValue\(elements\.draftStatus, nextStatus\)/,
    'a ficha aberta deve receber status autoritativo do backend em tempo real'
);

const automaticSaveBlock = script.slice(
    script.indexOf('const performAutomaticDraftSave'),
    script.indexOf('const queueAutomaticDraftSave')
);
assert.doesNotMatch(automaticSaveBlock, /mode:\s*'manual'/);
assert.doesNotMatch(automaticSaveBlock, /operationalOrderSync/);

console.log('automatic data save guard: ok');
