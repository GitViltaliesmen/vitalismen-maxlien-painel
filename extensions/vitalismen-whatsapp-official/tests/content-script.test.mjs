import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../content-script.js', import.meta.url), 'utf8');

const runScenario = ({ href, titles, headerText, clickedRow = null }) => {
    const messages = [];
    let clickHandler = null;
    const header = {
        innerText: headerText,
        querySelectorAll: () => titles.map((title) => ({
            getAttribute: () => title
        }))
    };
    const pane = {};
    const row = clickedRow ? {
        nodeType: 1,
        innerText: clickedRow.text,
        parentElement: pane,
        attributes: clickedRow.attributes || [],
        closest: (selector) => selector === '#pane-side' ? pane : null,
        querySelectorAll: () => (clickedRow.titles || []).map((title) => ({
            getAttribute: () => title
        }))
    } : null;
    const context = {
        URL,
        Date,
        console,
        window: {
            location: { href },
            addEventListener: () => {}
        },
        document: {
            body: {},
            querySelector: () => header,
            querySelectorAll: () => [header],
            addEventListener: (name, handler) => {
                if (name === 'click') clickHandler = handler;
            }
        },
        MutationObserver: class {
            observe() {}
        },
        chrome: {
            runtime: {
                sendMessage: async (message) => {
                    messages.push(message);
                }
            }
        },
        clearTimeout: () => {},
        setTimeout: (callback) => {
            callback();
            return 1;
        }
    };
    vm.runInNewContext(source, context);
    if (row && clickHandler) {
        clickHandler({
            target: row
        });
    }
    return messages;
};

const fromUrl = runScenario({
    href: 'https://web.whatsapp.com/send?phone=593999461947',
    titles: ['Cliente Vitalismen'],
    headerText: 'Cliente Vitalismen'
})[0];
assert.equal(fromUrl.action, 'activeWhatsAppChat');
assert.equal(fromUrl.selection.phone, '593999461947');
assert.equal(fromUrl.selection.name, 'Cliente Vitalismen');
assert.equal(fromUrl.selection.source, 'url');

const fromVisibleHeader = runScenario({
    href: 'https://web.whatsapp.com/',
    titles: ['+593 99 946 1947'],
    headerText: '+593 99 946 1947'
})[0];
assert.equal(fromVisibleHeader.selection.phone, '593999461947');
assert.equal(fromVisibleHeader.selection.source, 'visible_header');

const clickMessages = runScenario({
    href: 'https://web.whatsapp.com/',
    titles: ['+593 98 430 2981'],
    headerText: '+593 98 430 2981',
    clickedRow: {
        text: '+593 98 765 4321\nÚltima mensagem',
        titles: ['+593 98 765 4321']
    }
});
const pending = clickMessages.find((message) => message.action === 'whatsAppChatSwitchStarted');
const clicked = clickMessages.find((message) => (
    message.action === 'activeWhatsAppChat' && message.selection.source === 'list_click'
));
assert.equal(pending.selection.phone, '593987654321');
assert.equal(clicked.selection.phone, '593987654321');
const pendingIndex = clickMessages.indexOf(pending);
assert.equal(
    clickMessages.slice(pendingIndex + 1).some((message) => (
        message.action === 'activeWhatsAppChat'
        && message.selection.phone === '593984302981'
    )),
    false
);

const attributeMessages = runScenario({
    href: 'https://web.whatsapp.com/',
    titles: ['Contato anterior'],
    headerText: 'Contato anterior',
    clickedRow: {
        text: 'María Cliente\nNueva conversación',
        titles: ['María Cliente'],
        attributes: [{ name: 'data-id', value: '593991234567@c.us' }]
    }
});
const attributeSelection = attributeMessages.find((message) => (
    message.action === 'activeWhatsAppChat'
    && message.selection.source === 'list_click'
));
assert.equal(attributeSelection.selection.phone, '593991234567');

console.log('Content script click-to-contact synchronization: OK');
