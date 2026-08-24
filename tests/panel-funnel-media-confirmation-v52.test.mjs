import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const panel = fs.readFileSync('public/qr.html', 'utf8');
const whatsapp = fs.readFileSync('src/routes/whatsapp.js', 'utf8');

const functionSource = (name, nextName) => panel.slice(
    panel.indexOf(`async function ${name}`),
    panel.indexOf(`async function ${nextName}`)
);

test('V52 áudio do funil usa identidade persistente e não some quando a API falha', () => {
    const source = functionSource('sendFunnelAudio', 'sendFooterMedia');
    assert.match(source, /clientGeneratedId:\s*pendingMessage\?\.clientGeneratedId/);
    assert.match(source, /confirmPendingLocalMessage\(pendingMessage\?\._id, result\)/);
    assert.match(source, /markPendingLocalMessageStatus\(pendingMessage\?\._id, 'unconfirmed'/);
    assert.doesNotMatch(source, /removePendingLocalMessage\(pendingMessage\?\._id\)/);
});

test('V52 mídia do funil usa a mesma confirmação persistente do áudio', () => {
    const source = functionSource('sendFooterMedia', 'sendCustomFunnelBlock');
    assert.match(source, /clientGeneratedId:\s*pendingMessage\?\.clientGeneratedId/);
    assert.match(source, /confirmPendingLocalMessage\(pendingMessage\?\._id, result\)/);
    assert.match(source, /markPendingLocalMessageStatus\(pendingMessage\?\._id, 'unconfirmed'/);
    assert.doesNotMatch(source, /removePendingLocalMessage\(pendingMessage\?\._id\)/);
});

test('V52 backend classifica retirada pelo helper sem usar agência como atalho', () => {
    assert.match(whatsapp, /isPickupStageAudioCandidate\(\{/);
    assert.doesNotMatch(whatsapp, /\(\?:chegou\|pickup\|retir\|agencia\|ready\)/i);
});
