import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const panelFile = process.env.V273_PANEL_FILE || path.join(root, 'public/qr.html');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'panel.test') return route.abort();
    if (url.pathname === '/qr.html') return route.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(panelFile, 'utf8') });
    if (url.pathname.startsWith('/panel-intelligence/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'public', url.pathname.replace(/^\//, '')), 'utf8') });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});

try {
    await page.goto('http://panel.test/qr.html', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(() => {
        const warning = document.getElementById('linkedConnectionWarning');
        const visible = () => !warning.classList.contains('hidden');
        updateLinkedConnectionWarning('connected');
        const afterConnected = visible();
        updateLinkedConnectionWarning('disconnected', { status: 'disconnected' });
        const afterOneFailure = visible();
        updateLinkedConnectionWarning('disconnected', { status: 'disconnected' });
        const afterTwoFailures = { visible: visible(), text: warning.textContent };
        updateLinkedConnectionWarning('connected');
        const afterRecovery = visible();
        updateLinkedConnectionWarning('unknown');
        updateLinkedConnectionWarning('unknown');
        const afterUnreadable = { visible: visible(), text: warning.textContent };
        return { afterConnected, afterOneFailure, afterTwoFailures, afterRecovery, afterUnreadable };
    });
    assert.equal(result.afterConnected, false);
    assert.equal(result.afterOneFailure, false, 'uma falha isolada não deve mostrar alarme');
    assert.equal(result.afterTwoFailures.visible, true);
    assert.match(result.afterTwoFailures.text, /WhatsApp desconectado/);
    assert.equal(result.afterRecovery, false);
    assert.equal(result.afterUnreadable.visible, true);
    assert.match(result.afterUnreadable.text, /Não foi possível verificar/);
    assert.deepEqual(errors, []);
    console.log(`PANEL_LINKED_CONNECTION_WARNING_V273=OK file=${path.basename(panelFile)}`);
} finally {
    await browser.close();
}
