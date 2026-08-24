import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const oldId = '593999992490@c.us';
const newId = '593999991150@c.us';
const now = new Date().toISOString();
const oldChat = {
    id: oldId,
    phone: '+593999992490',
    name: 'Cliente Mira',
    country: 'EC',
    city: 'Mira',
    province: 'Carchi',
    deliveryMode: 'agency',
    agencyId: 'EC-SA-MIRA',
    agencyName: 'Mira Principal',
    address: 'Servientrega Mira Principal - Mira, Carchi',
    reference: '',
    quantity: '1',
    total: '35.99',
    orderStatus: 'atendendo',
    lastMessageAt: now,
    conversationBucket: { value: 'attendance' },
    human: { mode: 'manual', assignedName: 'Operador' },
    customerDraft: {
        phone: '+593999992490', city: 'Mira', province: 'Carchi',
        deliveryMode: 'agency', agencyId: 'EC-SA-MIRA', agencyName: 'Mira Principal',
        address: 'Servientrega Mira Principal - Mira, Carchi', quantity: '1', total: '35.99'
    }
};
const newChat = {
    id: newId,
    phone: '+593999991150',
    name: 'Cliente Guayaquil',
    country: 'EC',
    city: 'Guayaquil',
    province: 'Guayas',
    deliveryMode: '',
    agencyId: '',
    agencyName: '',
    address: '',
    reference: '',
    quantity: '3',
    total: '80.99',
    orderStatus: 'atendendo',
    lastMessageAt: now,
    conversationBucket: { value: 'attendance' },
    human: { mode: 'manual', assignedName: 'Operador' },
    customerDraft: {
        phone: '+593999991150', city: 'Guayaquil', province: 'Guayas',
        deliveryMode: '', agencyId: '', agencyName: '', address: '',
        quantity: '3', total: '80.99'
    }
};
const miraAgency = {
    agency_id: 'EC-SA-MIRA',
    name: 'Mira Principal',
    city: 'Mira',
    province: 'Carchi',
    address: 'Jose Joaquin Olmedo S/n y Bolivar'
};
const guayaquilAgency = {
    agency_id: 'EC-SA-F9D9090453293FF9',
    name: 'Guayaquil Los Almendros',
    city: 'Guayaquil',
    province: 'Guayas',
    address: 'Cdla. Los Almendros mz o Solar 34'
};

const json = (route, body, status = 200) => route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const patchBodies = [];
const pageErrors = [];
let oldAgencyRequestStarted;
const oldAgencyRequest = new Promise((resolve) => { oldAgencyRequestStarted = resolve; });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1866, height: 1012 } });
page.on('pageerror', (error) => pageErrors.push(error.message));
await page.addInitScript(() => localStorage.setItem('vitalismen_admin_token', 'browser-v51-test'));
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
        const relative = url.pathname.replace(/^\//, '');
        return route.fulfill({
            status: 200,
            contentType: 'application/javascript; charset=utf-8',
            body: fs.readFileSync(path.join(root, 'public', relative), 'utf8')
        });
    }
    if (url.pathname === '/api/auth/me') {
        return json(route, { user: { id: 'operator-v51', name: 'Operador V51', role: 'operator' } });
    }
    if (url.pathname === '/api/zapi/status') {
        return json(route, {
            ok: true,
            status: { connected: true, smartphoneConnected: true, session: true, phone: '5515991418416' },
            device: { phone: '5515991418416', name: 'Z-API' }
        });
    }
    if (url.pathname === '/api/zapi/device') return json(route, { ok: true, device: { phone: '5515991418416' } });
    if (url.pathname === '/api/whatsapp/chats') return json(route, [oldChat, newChat]);
    if (url.pathname.startsWith('/api/whatsapp/messages/')) return json(route, []);
    if (url.pathname.startsWith('/api/whatsapp/customer-profile/')) {
        return json(route, { identities: [], events: [], continuity: {}, order: null, shipment: null });
    }
    if (url.pathname === '/api/whatsapp/sessions') return json(route, { sessions: [] });
    if (url.pathname === '/api/whatsapp/connection-workload') return json(route, { sessions: [] });
    if (url.pathname === '/api/whatsapp/dashboard-metrics') return json(route, {});
    if (url.pathname === '/api/whatsapp/templates') return json(route, { templates: [] });
    if (url.pathname === '/api/automation/status') return json(route, {});
    if (url.pathname === '/api/orders') return json(route, { orders: [] });
    if (url.pathname === '/api/shipments/dispatch/history') return json(route, { history: [] });
    if (url.pathname === '/api/shipments/servientrega/ec/agencies') {
        const query = `${url.searchParams.get('city') || ''} ${url.searchParams.get('q') || ''}`.toLowerCase();
        if (query.includes('mira')) {
            oldAgencyRequestStarted();
            await delay(1200);
            return json(route, { agencies: [miraAgency], location: { cityMatched: true, city: 'Mira', province: 'Carchi' } });
        }
        return json(route, { agencies: [guayaquilAgency], location: { cityMatched: true, city: 'Guayaquil', province: 'Guayas' } });
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
        patchBodies.push({ path: url.pathname, payload });
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

try {
    await page.goto('http://panel.test/qr.html?v=browser-v51', { waitUntil: 'domcontentloaded' });
    await page.locator(`[data-chat-id="${oldId}"]`).waitFor();
    await page.locator(`[data-chat-id="${oldId}"]`).click();
    await page.locator('#customerReferenceInput').fill('Mira Principal');
    await oldAgencyRequest;
    await page.locator(`[data-chat-id="${newId}"]`).click();
    await delay(1600);

    assert.equal(await page.locator('#customerNameInput').inputValue(), 'Cliente Guayaquil');
    assert.equal(await page.locator('#customerPhoneInput').inputValue(), '+593999991150');
    assert.equal(await page.locator('#customerCityInput').inputValue(), 'Guayaquil');
    assert.equal(await page.locator('#customerProvinceInput').inputValue(), 'Guayas');
    assert.notEqual(await page.locator('#customerAgencyNameInput').inputValue(), 'Mira Principal');
    assert.equal(
        patchBodies.some(({ path: requestPath, payload }) => (
            requestPath.includes(encodeURIComponent(newId))
            && payload.customerDraft?.city === 'Mira'
        )),
        false
    );

    await page.locator('#customerReferenceInput').fill('Los almendro');
    await delay(5000);
    const newClientSaves = patchBodies.filter(({ path: requestPath }) => requestPath.includes(encodeURIComponent(newId)));
    assert.equal(newClientSaves.length, 1, 'a mesma agência não deve iniciar ciclo de autosave');
    assert.equal(newClientSaves[0].payload.customerDraft.city, 'Guayaquil');
    assert.equal(newClientSaves[0].payload.customerDraft.province, 'Guayas');
    assert.equal(newClientSaves[0].payload.customerDraft.agencyName.toLowerCase(), 'guayaquil los almendros');
    assert.deepEqual(pageErrors, []);
    console.log('PANEL_CUSTOMER_SELECTION_BROWSER_V51=OK');
} finally {
    await browser.close();
}
