import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('manual linked-device media needs a provider ID before the panel says sent', () => {
    const sandbox = {};
    vm.runInNewContext(fs.readFileSync('public/panel-intelligence/delivery-status-v115.js', 'utf8'), sandbox);
    const classify = sandbox.VitalismenDeliveryStatusV115.classify;
    assert.equal(classify({ deliveryStatus: 'sent', providerStatus: 'sent', providerMessageId: 'wa-1' }).code, 'SENT');
    assert.equal(classify({ deliveryStatus: 'sent', providerStatus: 'sent' }).code, 'UNKNOWN');
    assert.equal(classify({ deliveryStatus: 'unconfirmed', providerStatus: 'ambiguous' }).code, 'UNCERTAIN');
    assert.equal(classify({ deliveryStatus: 'request_failed' }).code, 'REQUEST_FAILED');
});

test('linked-device inbound media stays outside the sealed release and retains its public URL', () => {
    const dispatcher = fs.readFileSync('src/whatsapp/dispatcher.js', 'utf8');
    const app = fs.readFileSync('src/index.js', 'utf8');
    assert.match(dispatcher, /const uploadsDir = manualUploadsDirV129\(\)/);
    assert.doesNotMatch(dispatcher, /path\.join\(process\.cwd\(\), 'public', 'media', 'inbound'\)/);
    assert.match(dispatcher, /return `\/media\/inbound\/\$\{filename\}`/);
    assert.ok(app.indexOf("app.use('/media/inbound', express.static(manualUploadsDirV129()") < app.indexOf("app.use('/media', express.static('public/media'"));
});
