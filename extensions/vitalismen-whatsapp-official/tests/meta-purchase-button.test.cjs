const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'sidepanel.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'sidepanel.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'sidepanel.css'), 'utf8');

assert.match(html, /id="markPurchaseButton"/);
assert.match(html, /id="metaPurchaseStatus"/);
assert.match(script, /persistCustomerDraft\(\{ markPurchase: true \}\)/);
assert.match(script, /customerDraft\.status !== 'confirmado'/);
assert.match(script, /purchase\.alreadySent === true/);
assert.match(script, /events_received/);
assert.match(script, /Nenhum evento foi duplicado/);
assert.match(css, /\.meta-purchase-action/);
assert.match(css, /background: #1877f2/);

console.log('meta purchase button: ok');
