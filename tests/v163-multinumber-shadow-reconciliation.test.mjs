import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('docs/freeze/ec-multinumber-shadow-reconciliation-v163-20260915.json'));

test('V163 keeps Web worker isolated while Z-API remains the production transport', () => {
    assert.equal(manifest.policy.workspaceOnly, true);
    assert.equal(manifest.policy.productionChanged, false);
    assert.equal(manifest.policy.webWorkerActivationExecuted, false);
    assert.equal(manifest.policy.webWorkerShadow, true);
    assert.equal(manifest.policy.webWorkerDraining, true);
    assert.equal(manifest.policy.webWorkerWeight, 0);
    assert.equal(manifest.policy.webWorkerCapacity, 0);
    assert.equal(manifest.policy.customerInboundRouting, false);
    assert.equal(manifest.policy.outboundQueueConsumption, false);
    assert.equal(manifest.policy.cutover, false);
    assert.equal(manifest.policy.zapiProductionProviderPreserved, true);
    assert.equal(manifest.policy.zapiShutdownExecuted, false);
    assert.equal(manifest.policy.zapiRemovalExecuted, false);
});

test('V163 preserves the paired identity without authorizing it as a new test target', () => {
    assert.equal(manifest.policy.newPairingRequired, false);
    assert.equal(manifest.policy.pairingExecuted, false);
    assert.equal(manifest.policy.existingSessionPhone, '5531983002800');
    assert.equal(manifest.policy.existingSessionOutboundAuthorized, false);
    assert.equal(manifest.policy.authorizedControlledTestPhone, '5515998038637');
});

test('V163 exposes sanitized shadow health without credentials or mutating controls', () => {
    const route = read('src/routes/whatsapp.js');
    const panel = read('public/qr.html');
    const worker = read('src/whatsapp/core/PersistentShadowWorkerV152ER4.js');
    const entrypoint = read('scripts/v152-e-r4-persistent-shadow-worker.mjs');

    assert.match(route, /readV152ER4PanelSession/);
    assert.match(route, /mergeV152ER4PanelSessions/);
    assert.doesNotMatch(route, /V152_E_R4_STATE_ROOT[\s\S]{0,500}(creds|authState|pairingCode)/i);
    assert.match(panel, /data-v152-e-r4-channel="V152_TEST_WEB_01"/);
    assert.match(worker, /shadowInboundCount/);
    assert.doesNotMatch(worker, /sendMessage|requestPairingCode|setupDispatcher|models\/Order/i);
    assert.match(entrypoint, /printQRInTerminal:\s*false/);
    assert.doesNotMatch(entrypoint, /sendMessage|requestPairingCode|QRCode|qrcode-terminal/i);
});

test('V163 bootstrap installs overrides before V162 and reconciles R4 after V153', () => {
    const bootstrap = read('scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs');
    const pre = bootstrap.indexOf("ec-runtime-successor-v163-multinumber-overrides-context.mjs");
    const v155 = bootstrap.indexOf("ec-runtime-successor-v155-context.mjs");
    const v153 = bootstrap.indexOf("ec-runtime-successor-v153-context.mjs");
    const v163 = bootstrap.indexOf("ec-runtime-successor-v163-multinumber-context.mjs");
    assert.ok(pre >= 0 && pre < v155);
    assert.ok(v153 >= 0 && v153 < v163);
    assert.doesNotMatch(bootstrap, /import '\.\/ec-runtime-successor-v152-e-r4-context\.mjs';/);
});
