import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { findServientregaEcuadorAgencies } from '../src/services/servientregaEcuadorAgencyService.js';

const root = process.cwd();
const chatId = '593999991183@c.us';
const now = new Date().toISOString();
const chat = {
    id: chatId,
    phone: '+593999991183',
    name: 'Cliente Teste V183',
    country: 'EC',
    city: 'Huaquillas',
    province: 'El Oro',
    deliveryMode: 'agency',
    address: '',
    reference: '',
    quantity: '1',
    total: '35.99',
    orderStatus: 'atendendo',
    lastMessageAt: now,
    conversationBucket: { value: 'attendance' },
    human: { mode: 'manual', assignedName: 'Operador' },
    customerDraft: {
        name: 'Cliente Teste V183',
        phone: '+593999991183',
        country: 'EC',
        city: 'Huaquillas',
        province: 'El Oro',
        deliveryMode: 'agency',
        address: '',
        reference: '',
        quantity: '1',
        total: '35.99',
        status: 'atendendo'
    }
};

const json = (route, body, status = 200) => route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const agencyRequests = [];
const sentMessages = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
page.on('pageerror', (error) => pageErrors.push(error.message));
await page.addInitScript(() => localStorage.setItem('vitalismen_admin_token', 'browser-v183-test'));
await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== 'panel.test') return route.abort();
    if (url.pathname === '/qr.html') {
        return route.fulfill({
            status: 200,
            contentType: 'text/html; charset=utf-8',
            body: fs.readFileSync(path.join(root, 'public/qr.html'), 'utf8')
        });
    }
    if (url.pathname.startsWith('/panel-intelligence/')) {
        return route.fulfill({
            status: 200,
            contentType: 'application/javascript; charset=utf-8',
            body: fs.readFileSync(path.join(root, 'public', url.pathname.replace(/^\//, '')), 'utf8')
        });
    }
    if (url.pathname === '/api/auth/me') return json(route, { user: { id: 'operator-v183', name: 'Operador V183', role: 'operator' } });
    if (url.pathname === '/api/zapi/status') return json(route, { ok: true, status: { connected: true, smartphoneConnected: true, session: true }, device: { phone: '5515991418416' } });
    if (url.pathname === '/api/zapi/device') return json(route, { ok: true, device: { phone: '5515991418416' } });
    if (url.pathname === '/api/whatsapp/chats') return json(route, [chat]);
    if (url.pathname.startsWith('/api/whatsapp/messages/')) return json(route, []);
    if (url.pathname.startsWith('/api/whatsapp/customer-profile/')) return json(route, { identities: [], events: [], continuity: {}, order: null, shipment: null });
    if (url.pathname === '/api/whatsapp/sessions') return json(route, { sessions: [] });
    if (url.pathname === '/api/whatsapp/connection-workload') return json(route, { sessions: [] });
    if (url.pathname === '/api/whatsapp/dashboard-metrics') return json(route, {});
    if (url.pathname === '/api/whatsapp/templates') return json(route, { templates: [] });
    if (url.pathname === '/api/automation/status') return json(route, {});
    if (url.pathname === '/api/orders') return json(route, { orders: [] });
    if (url.pathname === '/api/shipments/dispatch/history') return json(route, { history: [] });
    if (url.pathname === '/api/shipments/servientrega/ec/agencies') {
        const city = url.searchParams.get('city') || '';
        const province = url.searchParams.get('province') || '';
        const query = url.searchParams.get('q') || '';
        const strictCity = url.searchParams.get('strictCity') || '';
        agencyRequests.push({ city, province, query, strictCity });
        const agencies = findServientregaEcuadorAgencies({
            city,
            province,
            query,
            limit: 10,
            strictCityScope: strictCity === '1'
        });
        return json(route, { success: true, count: agencies.length, agencies });
    }
    if (url.pathname === '/api/whatsapp/send' && request.method() === 'POST') {
        const payload = request.postDataJSON();
        sentMessages.push(payload.message);
        return json(route, { success: true, messageId: `v183-${sentMessages.length}` });
    }
    if (url.pathname.endsWith('/resolve-customer-data') && request.method() === 'POST') {
        const payload = request.postDataJSON();
        return json(route, {
            customerDraft: payload.customerDraft,
            customerDataResolution: { version: 28, fields: {}, conflicts: [], orderDataReady: false }
        });
    }
    if (url.pathname.startsWith('/api/whatsapp/contact-state/') && request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        return json(route, {
            success: true,
            state: {
                metadata: { customerDraft: payload.customerDraft },
                customerDataResolution: { version: 28, fields: {}, conflicts: [], orderDataReady: false }
            }
        });
    }
    return json(route, {});
});

const waitForAgencyState = async (expected) => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const value = await page.locator('#agencySuggestionsState').textContent();
        if (expected.test(value || '')) return value;
        await delay(100);
    }
    throw new Error(`Estado de agencia nao atingiu ${expected}`);
};

try {
    await page.goto('http://panel.test/qr.html?v=browser-v183', { waitUntil: 'domcontentloaded' });
    await page.locator(`[data-chat-id="${chatId}"]`).waitFor();
    await page.locator(`[data-chat-id="${chatId}"]`).click();

    await page.locator('#customerCityInput').fill('Huaquillas');
    await page.locator('#customerProvinceInput').fill('El Oro');
    await waitForAgencyState(/1-2 de 2/);

    const initialText = await page.locator('#agencySuggestionList').innerText();
    assert.match(initialText, /Huaquillas av Republica/i);
    assert.match(initialText, /Huaquillas Principal/i);
    assert.doesNotMatch(initialText, /Arenillas|Balsas|Machala|el Guabo|el Cambio/i);
    assert.equal(await page.locator('#prevAgencyBatchBtn').isDisabled(), true);
    assert.equal(await page.locator('#nextAgencyBatchBtn').isDisabled(), true);

    await page.locator('#agencySearchInput').fill('Principal');
    await waitForAgencyState(/1-1 de 1/);
    const principalText = await page.locator('#agencySuggestionList').innerText();
    assert.match(principalText, /Huaquillas Principal/i);
    assert.doesNotMatch(principalText, /Arenillas|Balsas|Machala/i);

    await page.locator('#agencySearchInput').fill('Arenillas');
    await waitForAgencyState(/nenhuma encontrada/i);
    assert.match(await page.locator('#agencySuggestionList').innerText(), /Nenhuma agencia encontrada/i);

    await page.locator('#agencySearchInput').fill('');
    await waitForAgencyState(/1-2 de 2/);
    await page.locator('#sendAgencyListBtn').click();
    for (let attempt = 0; attempt < 50 && sentMessages.length < 3; attempt += 1) await delay(100);
    assert.equal(sentMessages.length, 3);
    const agencyMessages = sentMessages.slice(1);
    assert.equal(agencyMessages.length, 2);
    assert.ok(agencyMessages.every((message) => /Huaquillas/i.test(message)));
    assert.ok(agencyMessages.every((message) => !/Arenillas|Balsas|Machala/i.test(message)));

    assert.ok(agencyRequests.length >= 3);
    assert.ok(agencyRequests.every((request) => request.city === 'Huaquillas'));
    assert.ok(agencyRequests.every((request) => request.province === 'El Oro'));
    assert.ok(agencyRequests.every((request) => request.strictCity === '1'));
    assert.deepEqual(pageErrors, []);
    console.log('PANEL_AGENCY_CITY_SCOPE_BROWSER_V183=PASS');
    console.log('PANEL_ROUTE_OPT_IN=STRICT_CITY_1');
    console.log('HUAQUILLAS_VISIBLE=2');
    console.log('HUAQUILLAS_CROSS_CITY_VISIBLE=0');
    console.log('AGENCY_BATCH_SEND_MOCKED=2');
} finally {
    await browser.close();
}
