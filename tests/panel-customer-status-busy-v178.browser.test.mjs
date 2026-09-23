import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const chatId = '593999991178@c.us';
const now = new Date().toISOString();
const chat = {
    id: chatId,
    phone: '+593999991178',
    name: 'Cliente Teste V178',
    country: 'EC',
    city: 'Quito',
    province: 'Pichincha',
    deliveryMode: 'home',
    address: 'Direccion controlada V178',
    reference: 'Referencia controlada',
    quantity: '1',
    total: '35.99',
    orderStatus: 'novo',
    lastMessageAt: now,
    conversationBucket: { value: 'attendance' },
    human: { mode: 'manual', assignedName: 'Operador' },
    customerDraft: {
        name: 'Cliente Teste V178',
        phone: '+593999991178',
        country: 'EC',
        city: 'Quito',
        province: 'Pichincha',
        deliveryMode: 'home',
        address: 'Direccion controlada V178',
        reference: 'Referencia controlada',
        quantity: '1',
        total: '35.99',
        status: 'novo'
    }
};

const json = (route, body, status = 200) => route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
});
const patchBodies = [];
const pageErrors = [];
const mutationRequests = [];
let confirmations = 0;
let currentStatus = 'novo';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('dialog', async (dialog) => {
    confirmations += 1;
    await dialog.accept();
});
await page.addInitScript(() => localStorage.setItem('vitalismen_admin_token', 'browser-v178-test'));
await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== 'panel.test') return route.abort();
    if (['POST', 'PATCH'].includes(request.method())) mutationRequests.push(`${request.method()} ${url.pathname}`);
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
    if (url.pathname === '/api/auth/me') return json(route, { user: { id: 'operator-v178', name: 'Operador V178', role: 'operator' } });
    if (url.pathname === '/api/zapi/status') return json(route, { ok: true, status: { connected: true, smartphoneConnected: true, session: true }, device: { phone: '5515991418416' } });
    if (url.pathname === '/api/zapi/device') return json(route, { ok: true, device: { phone: '5515991418416' } });
    if (url.pathname === '/api/whatsapp/chats') return json(route, [{
        ...chat,
        orderStatus: currentStatus,
        customerDraft: { ...chat.customerDraft, status: currentStatus }
    }]);
    if (url.pathname.startsWith('/api/whatsapp/messages/')) return json(route, []);
    if (url.pathname.startsWith('/api/whatsapp/customer-profile/')) return json(route, { identities: [], events: [], continuity: {}, order: null, shipment: null });
    if (url.pathname === '/api/whatsapp/sessions') return json(route, { sessions: [] });
    if (url.pathname === '/api/whatsapp/connection-workload') return json(route, { sessions: [] });
    if (url.pathname === '/api/whatsapp/dashboard-metrics') return json(route, {});
    if (url.pathname === '/api/whatsapp/templates') return json(route, { templates: [] });
    if (url.pathname === '/api/automation/status') return json(route, {});
    if (url.pathname === '/api/orders') return json(route, { orders: [] });
    if (url.pathname === '/api/shipments/dispatch/history') return json(route, { history: [] });
    if (url.pathname === '/api/shipments/servientrega/ec/agencies') return json(route, { agencies: [] });
    if (url.pathname.endsWith('/resolve-customer-data') && request.method() === 'POST') {
        const payload = request.postDataJSON();
        return json(route, {
            customerDraft: payload.customerDraft,
            customerDataResolution: { version: 28, fields: {}, conflicts: [], orderDataReady: true }
        });
    }
    if (url.pathname.startsWith('/api/whatsapp/contact-state/') && request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        patchBodies.push(payload);
        currentStatus = payload.customerDraft?.status || currentStatus;
        return json(route, {
            success: true,
            ...(currentStatus === 'confirmado' ? {
                confirmedPersistence: {
                    persistenceVerified: true,
                    readAfterWriteVerified: true,
                    visibleInConfirmedQuery: true,
                    matchedCount: 1,
                    finalPersistedState: 'confirmado'
                }
            } : {}),
            state: {
                metadata: { customerDraft: payload.customerDraft },
                customerDataResolution: { version: 28, fields: {}, conflicts: [], orderDataReady: true }
            }
        });
    }
    return json(route, {});
});

try {
    await page.goto('http://panel.test/qr.html?v=browser-v178', { waitUntil: 'domcontentloaded' });
    await page.locator(`[data-chat-id="${chatId}"]`).waitFor();
    const statuses = [
        'atendendo', 'comprar_depois', 'confirmado', 'pedido_enviado', 'entregue',
        'recompra', 'cancelado', 'devolvido', 'novo'
    ];
    let formButtonDisabled = null;
    for (const targetStatus of statuses) {
        const previousPatchCount = patchBodies.length;
        const disabled = await page.evaluate(`(() => {
            selectChat(${JSON.stringify(chatId)}, { markRead: false });
            state.busy = true;
            updateCustomerPrimaryAction();
            const disabled = document.getElementById('confirmCustomerDataBtn').disabled;
            const status = document.getElementById('customerStatusInput');
            status.value = ${JSON.stringify(targetStatus)};
            if (${JSON.stringify(targetStatus)} === 'comprar_depois') {
                document.getElementById('customerBuyLaterDateInput').value = '2026-09-30';
            }
            markCustomerFormDirty();
            autoSaveCustomerStatusChange();
            return disabled;
        })()`);
        if (formButtonDisabled === null) formButtonDisabled = disabled;
        for (let attempt = 0; attempt < 50 && patchBodies.length === previousPatchCount; attempt += 1) {
            await page.waitForTimeout(100);
        }
        if (patchBodies.length === previousPatchCount) {
            const diagnostics = await page.evaluate(`({
                selectedStatus: document.getElementById('customerStatusInput')?.value,
                hint: document.getElementById('customerSyncHint')?.textContent,
                badge: document.getElementById('customerSyncBadge')?.textContent,
                globalBusy: state.busy,
                formSaveBusy: customerFormSaveBusy(),
                selectedChat: state.selectedChat?.id || ''
            })`);
            throw new Error(`status ${targetStatus} nao chegou ao PATCH: ${JSON.stringify({ diagnostics, confirmations, mutationRequests, pageErrors })}`);
        }
        assert.equal(patchBodies.at(-1)?.customerDraft?.status, targetStatus);
    }

    assert.equal(formButtonDisabled, false, 'busy global nao pode desabilitar a ficha');
    assert.deepEqual(patchBodies.map((payload) => payload.customerDraft?.status), statuses);
    assert.equal(confirmations, statuses.length, 'cada troca deve pedir uma unica confirmacao');
    assert.deepEqual(pageErrors, []);
    console.log('PANEL_CUSTOMER_STATUS_BUSY_BROWSER_V178=OK');
} finally {
    await browser.close();
}
