const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'sidepanel.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'sidepanel.js'), 'utf8');

assert.equal(manifest.version, '0.12.6');
assert.match(html, /id="buyLaterSchedule"[\s\S]*id="draftBuyLaterFollowupAt" type="datetime-local"/);
assert.match(html, /<option value="BR">Brasil \(somente teste liberado\)<\/option>/);
assert.match(script, /const validateBuyLaterSchedule/);
assert.match(script, /draft\.status !== 'comprar_depois'/);
assert.match(script, /buyLaterFollowupAt:\s*elements\.draftStatus\.value === 'comprar_depois'/);
assert.match(script, /applyValue\(elements\.draftBuyLaterFollowupAt, dateTimeLocalValue\(draft\.buyLaterFollowupAt\)\)/);
assert.match(script, /Aguardando data de “Comprar depois”/);
assert.match(script, /elements\.draftBuyLaterFollowupAt\?\.focus\(\)/);

console.log('buy later schedule form: ok');
