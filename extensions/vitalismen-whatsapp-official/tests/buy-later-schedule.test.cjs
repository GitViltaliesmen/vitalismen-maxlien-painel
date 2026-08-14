const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'sidepanel.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'sidepanel.js'), 'utf8');

assert.equal(manifest.version, '0.13.5');
assert.match(html, /id="buyLaterSchedule"[\s\S]*id="draftBuyLaterFollowupAt" type="datetime-local"[\s\S]*id="addBuyLaterScheduleButton"[\s\S]*>Adicionar</);
assert.match(html, /<option value="BR">Brasil \(somente teste liberado\)<\/option>/);
assert.match(script, /const validateBuyLaterSchedule/);
assert.match(script, /draft\.status !== 'comprar_depois'/);
assert.match(script, /buyLaterFollowupAt:\s*elements\.draftStatus\.value === 'comprar_depois'/);
assert.match(script, /applyValue\(elements\.draftBuyLaterFollowupAt, dateTimeLocalValue\(draft\.buyLaterFollowupAt\)\)/);
assert.match(script, /Aguardando data de “Comprar depois”/);
assert.match(script, /elements\.draftBuyLaterFollowupAt\?\.focus\(\)/);
assert.match(script, /const BUY_LATER_MIN_LEAD_MS = 5 \* 60 \* 1000/);
assert.match(script, /elements\.draftBuyLaterFollowupAt\.min = buyLaterMinimumLocalValue\(\)/);
assert.match(script, /elements\.draftBuyLaterFollowupAt\.max = buyLaterMaximumLocalValue\(\)/);
assert.match(script, /enabled && !elements\.draftBuyLaterFollowupAt\.value/);
assert.match(script, /elements\.draftBuyLaterFollowupAt\.value = defaultBuyLaterLocalValue\(\)/);
assert.match(script, /parsed\.getFullYear\(\) !== new Date\(\)\.getFullYear\(\)/);
assert.match(script, /Escolha uma data dentro do ano atual/);
assert.match(script, /typeof value === 'string' && !value\.trim\(\)/);
assert.match(script, /performAutomaticDraftSave = async \(\{ force = false \} = \{\}\)/);
assert.match(script, /performAutomaticDraftSave\(\{ force: true \}\)/);
assert.match(script, /addBuyLaterScheduleButton\?\.addEventListener\('click'/);

console.log('buy later schedule form: ok');
