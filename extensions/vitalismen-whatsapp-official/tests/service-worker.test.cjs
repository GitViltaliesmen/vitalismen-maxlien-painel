const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
const sessionData = {};
const localData = {
    vitalismenSessionToken: 'persisted-token',
    vitalismenSessionUser: { name: 'Operador' }
};
let onMessage = null;

const area = (data) => ({
    get: async (keys) => Object.fromEntries(
        keys.filter((key) => Object.prototype.hasOwnProperty.call(data, key))
            .map((key) => [key, data[key]])
    ),
    set: async (values) => Object.assign(data, values),
    remove: async (keys) => keys.forEach((key) => delete data[key])
});

const chrome = {
    sidePanel: { setPanelBehavior: async () => {} },
    storage: {
        session: area(sessionData),
        local: {
            ...area(localData),
            setAccessLevel: async () => {}
        }
    },
    alarms: {
        create: () => {},
        onAlarm: { addListener: () => {} }
    },
    runtime: {
        getManifest: () => ({ version: '0.5.5' }),
        getURL: (value) => `chrome-extension://test/${value}`,
        reload: () => {},
        sendMessage: async () => {},
        onInstalled: { addListener: () => {} },
        onStartup: { addListener: () => {} },
        onMessage: { addListener: (listener) => { onMessage = listener; } }
    },
    tabs: {
        query: async () => [],
        update: async () => {},
        create: async () => {}
    },
    scripting: {
        executeScript: async () => []
    },
    windows: { update: async () => {} }
};

vm.runInNewContext(source, {
    chrome,
    URL,
    Date,
    console,
    fetch: async (url) => (
        String(url).includes('/api/auth/me')
            ? { ok: true, json: async () => ({ user: { name: 'Painel conectado' } }) }
            : { ok: true, json: async () => ({ version: '0.5.5' }) }
    ),
    setTimeout: () => 1,
    clearTimeout: () => {}
});

assert.equal(typeof onMessage, 'function');

const request = (message, senderUrl = 'https://web.whatsapp.com/') => new Promise((resolve, reject) => {
    const keepOpen = onMessage(message, { url: senderUrl }, (response) => {
        if (!response.ok) reject(new Error(response.error));
        else resolve(response.data);
    });
    assert.equal(keepOpen, true);
});

(async () => {
    const auth = await request({ action: 'authStatus' });
    assert.equal(auth.authenticated, true);
    assert.equal(auth.user.name, 'Operador');
    assert.equal(sessionData.vitalismenSessionToken, 'persisted-token');

    await request({ action: 'logout' });
    assert.equal(localData.vitalismenSessionToken, undefined);
    assert.equal(sessionData.vitalismenSessionToken, undefined);

    const panelToken = 'aaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.ccc';
    const imported = await request(
        { action: 'panelAuthCandidate', token: panelToken },
        'https://ec.maxlien.shop/qr.html'
    );
    assert.equal(imported.authenticated, true);
    assert.equal(localData.vitalismenSessionToken, panelToken);

    console.log('service-worker persistent session: ok');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
