const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'whatsapp-main-bridge.js'), 'utf8');
const listeners = {};
const replies = [];
const sent = [];
const frameWindow = {
    postMessage: (message) => replies.push(message)
};
const frame = { contentWindow: frameWindow };
const window = {
    WPP: {
        loader: {
            isReady: true,
            onReady: (callback) => callback()
        },
        chat: {
            getActiveChat: () => ({ id: { _serialized: '593999111222@c.us' } }),
            sendTextMessage: async (chatId, text) => sent.push({ chatId, text }),
            sendFileMessage: async (chatId, file, options) => sent.push({ chatId, file, options })
        }
    },
    addEventListener: (type, listener) => {
        listeners[type] = listener;
    }
};
const document = {
    getElementById: () => ({
        shadowRoot: {
            querySelector: () => frame
        }
    })
};

vm.runInNewContext(source, {
    window,
    document,
    File,
    ArrayBuffer,
    Date,
    setTimeout,
    clearTimeout,
    console
});

assert.equal(typeof listeners.message, 'function');

(async () => {
    await listeners.message({
        source: frameWindow,
        data: {
            source: 'vitalismen-funnel-overlay',
            action: 'sendThroughWpp',
            requestId: 'text-1',
            kind: 'text',
            text: 'Hola'
        }
    });
    assert.equal(sent[0].chatId, '593999111222@c.us');
    assert.equal(sent[0].text, 'Hola');
    assert.equal(replies[0].ok, true);

    await listeners.message({
        source: frameWindow,
        data: {
            source: 'vitalismen-funnel-overlay',
            action: 'sendThroughWpp',
            requestId: 'audio-1',
            kind: 'audio',
            filename: 'entrada.ogg',
            mimeType: 'audio/ogg',
            buffer: new Uint8Array([1, 2, 3]).buffer
        }
    });
    assert.equal(sent[1].options.type, 'audio');
    assert.equal(sent[1].options.isPtt, true);
    assert.equal(sent[1].file.name, 'entrada.ogg');
    assert.equal(replies[1].ok, true);

    console.log('WA-JS main-world text and media bridge: ok');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
