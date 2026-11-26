import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const panelFile = process.env.V272_PANEL_FILE || path.join(root, 'public/qr.html');
const qr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YfY4ZsAAAAASUVORK5CYII=';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
await page.addInitScript(() => localStorage.setItem('vitalismen_admin_token', 'qr-v272-simulated'));
await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'panel.test') return route.abort();
    if (url.pathname === '/qr.html') return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: fs.readFileSync(panelFile, 'utf8')
    });
    if (url.pathname.startsWith('/panel-intelligence/')) return route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: fs.readFileSync(path.join(root, 'public', url.pathname.replace(/^\//, '')), 'utf8')
    });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});

try {
    await page.goto('http://panel.test/qr.html', { waitUntil: 'domcontentloaded' });
    const renderedQr = await page.evaluate(({ qrCode }) => {
        state.activeTransportMode = 'baileys_text';
        state.whatsappSessions = [{ sessionId: '5531971862958', status: 'scanning', isReady: false, qrCode }];
        renderConnections();
        return document.querySelector('#connectionList .connection-qr-image')?.getAttribute('src') || '';
    }, { qrCode: qr });
    assert.equal(renderedQr, qr, 'QR deve aparecer na aba Conexões');

    const connectedQr = await page.evaluate(({ qrCode }) => {
        state.whatsappSessions = [{ sessionId: '5531971862958', status: 'connected', isReady: true, qrCode }];
        renderConnections();
        return document.querySelector('#connectionList .connection-qr-image')?.getAttribute('src') || '';
    }, { qrCode: qr });
    assert.equal(connectedQr, '', 'QR deve desaparecer após conexão');

    const invalidQr = await page.evaluate(() => {
        state.whatsappSessions = [{ sessionId: '5531971862958', status: 'scanning', isReady: false, qrCode: 'javascript:alert(1)' }];
        renderConnections();
        return document.querySelector('#connectionList .connection-qr-image')?.getAttribute('src') || '';
    });
    assert.equal(invalidQr, '', 'URL de QR inválida não deve ser renderizada');
    assert.deepEqual(pageErrors, []);
    console.log(`PANEL_CONNECTION_QR_V272=OK file=${path.basename(panelFile)}`);
} finally {
    await browser.close();
}
