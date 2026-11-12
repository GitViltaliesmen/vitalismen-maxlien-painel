import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { fetchDroppiEcuadorOrdersApiReadOnly as read } from '../src/services/postSaleDropiReadOnlyV210Service.js';
import { classifyDropiTrackingResultV194, processDropiTrackingReconciliationV194 } from '../src/services/postSaleDropiTrackingReconcilerV194Service.js';
import { assertCanaryV75ExternalEffectBlocked } from '../src/services/canaryIsolationV75Service.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ec-tracking-v210-'));
const originalFetch = globalThis.fetch, originalFile = process.env.DROPPI_EC_STORAGE_STATE_PATH;
process.env.DROPPI_EC_STORAGE_STATE_PATH = path.join(dir, 'session.json');
const token = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url') + '.test';
const session = (overrides = {}) => {
    const login = { token, objects: { id: 123 }, countries: [{ code: 'ec' }], ...overrides };
    fs.writeFileSync(process.env.DROPPI_EC_STORAGE_STATE_PATH, JSON.stringify({ origins: [{ origin: 'https://app.dropi.ec', localStorage: [
        { name: 'DROPI_token', value: JSON.stringify(token) }, { name: 'DROPI_LoginResult', value: JSON.stringify(login) }
    ] }] }));
};
const raw = overrides => ({ id: 7928186, phone: '0986208350', name: 'Cliente QA', status: 'PENDIENTE',
    dir: 'SERVIENTREGA Agencia QA', products: [{ id: 103743, name: 'VIT POWERS 1000ML COMUNIDAD', quantity: 3 }], ...overrides });
const shipment = { productName: 'Vit Power Ecuador', client: { phone: '593986208350' }, logistics: {},
    raw: { latestDroppiPayload: { dropiOrderId: '7928186' } } };
let calls = [];
const mock = (objects, options = {}) => {
    calls = []; session();
    globalThis.fetch = async (target, init) => {
        calls.push({ target, init });
        return new Response(JSON.stringify({ is_successful: true, is_succesfull: true, data: { objects, count: objects.length }, ...options.body }),
            { status: options.status || 200, headers: { 'content-type': options.contentType || 'application/json' } });
    };
};
after(() => { globalThis.fetch = originalFetch; if (originalFile === undefined) delete process.env.DROPPI_EC_STORAGE_STATE_PATH;
    else process.env.DROPPI_EC_STORAGE_STATE_PATH = originalFile; fs.rmSync(dir, { recursive: true, force: true }); });

test('V210 lê somente GET exato, sem corpo e sem redirect; preserva sessão e classifica pedido sem guia', async () => {
    mock([raw()]); const before = fs.readFileSync(process.env.DROPPI_EC_STORAGE_STATE_PATH);
    const result = await read({ search: '7928186' });
    assert.equal(calls.length, 1); const { target, init } = calls[0], url = new URL(target);
    assert.equal(url.origin, 'https://api-v2.dropi.ec'); assert.equal(url.pathname, '/bff/orders/myorders/v2');
    assert.equal(url.searchParams.get('textToSearch'), '7928186'); assert.equal(url.searchParams.get('user_id'), '123');
    assert.equal(init.method, 'GET'); assert.equal(init.body, undefined); assert.equal(init.redirect, 'error');
    assert.deepEqual(fs.readFileSync(process.env.DROPPI_EC_STORAGE_STATE_PATH), before);
    assert.equal(result.rows.length, 1); assert.equal(result.rows[0].productKey, 'vit_power_ec');
    assert.equal(classifyDropiTrackingResultV194({ shipment, rows: result.rows }).state, 'DROPI_STILL_WITHOUT_TRACKING');
});
test('V210 rejeita busca ampla e ID malformado antes de qualquer rede', async () => {
    mock([]); for (const search of ['', '593986208350 OR 1=1', '../orders', '0', '-1']) {
        await assert.rejects(read({ search }), /EXACT_DROPI_ID_REQUIRED/);
    } assert.equal(calls.length, 0);
});
test('V210 rejeita sessão de outro país e token divergente antes de qualquer rede', async () => {
    mock([]); session({ countries: [{ code: 'co' }] }); await assert.rejects(read({ search: '7928186' }), /SESSION_INVALID/);
    session({ token: 'different' }); await assert.rejects(read({ search: '7928186' }), /SESSION_INVALID/); assert.equal(calls.length, 0);
});
test('V210 reconhece configuração ECUADOR da sessão oficial sem assumir país ausente', async () => {
    mock([raw()]); session({ countries: [], configurations: [{ country: 'ECUADOR' }] });
    assert.equal((await read({ search: '7928186' })).rows.length, 1);
    session({ countries: [], configurations: [] }); await assert.rejects(read({ search: '7928186' }), /SESSION_INVALID/);
});
test('V210 preserva negativas da resposta BFF e autenticação', async () => {
    mock([], { status: 401 }); await assert.rejects(read({ search: '7928186' }), /AUTH_FAILED/);
    mock([], { contentType: 'text/html' }); await assert.rejects(read({ search: '7928186' }), /RESPONSE_INVALID/);
    mock([], { body: { is_successful: false, is_succesfull: false } }); await assert.rejects(read({ search: '7928186' }), /RESPONSE_INVALID/);
});
test('V210 mantém associação exata e conflitos de telefone e produto do V194', async () => {
    mock([raw({ id: 9999999 })]); assert.equal((await read({ search: '7928186' })).rows.length, 0);
    mock([raw(), raw()]); assert.equal(classifyDropiTrackingResultV194({ shipment, rows: (await read({ search: '7928186' })).rows }).state, 'AMBIGUOUS_LINK');
    mock([raw({ phone: '0999111222' })]); assert.equal(classifyDropiTrackingResultV194({ shipment, rows: (await read({ search: '7928186' })).rows }).state, 'AMBIGUOUS_LINK');
    mock([raw({ products: [{ id: 110435, name: 'TEX ULTRA', quantity: 3 }] })]);
    const rows = (await read({ search: '7928186' })).rows;
    assert.notEqual(rows[0].productKey, 'vit_power_ec');
});
test('V210 não concede exceção ao guard V75 genérico de escrita Dropi', () => {
    assert.throws(() => assertCanaryV75ExternalEffectBlocked('dropi', { VITALISMEN_CANARY_V75_ENABLED: 'true' }), { code: 'CANARY_V75_EXTERNAL_EFFECT_BLOCKED' });
});
test('V210 mantém guia oficial e não interpreta telefone do cliente como guia', async () => {
    mock([raw({ sticker: 'GUIA-1897000123', status: 'GUIA_GENERADA' })]);
    let result = classifyDropiTrackingResultV194({ shipment, rows: (await read({ search: '7928186' })).rows });
    assert.equal(result.state, 'TRACKING_FOUND'); assert.equal(result.trackingNumber, '1897000123');
    mock([raw({ sticker: 'GUIA-0986208350' })]);
    result = classifyDropiTrackingResultV194({ shipment, rows: (await read({ search: '7928186' })).rows });
    assert.equal(result.state, 'DROPI_STILL_WITHOUT_TRACKING');
});
test('V210 reconciliador congelado usa leitor novo pela dependência restrita, sem injetar fetchRowsFn', async () => {
    mock([raw()]);
    const shipmentModel = { find: () => ({ sort() { return this; }, limit() {
        return [{ ...shipment, _id: 'qa-v210', country: 'EC', orderId: 'EC-QA-V210', createdAt: new Date() }];
    } }) };
    const report = await processDropiTrackingReconciliationV194({ shipmentModel, dryRun: true,
        forwardOnlySince: '2026-11-09T04:53:50.421Z' });
    assert.equal(report.applied, 0); assert.equal(calls.length, 1);
    assert.equal(report.items[0].state, 'DROPI_STILL_WITHOUT_TRACKING');
});
test('V210 falha sem contexto selado antes de ler credenciais', async () => {
    const file = fileURLToPath(new URL('../src/services/postSaleDropiReadOnlyV210Service.js', import.meta.url));
    const source = fs.readFileSync(file, 'utf8').replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '').replace(/export /g, '');
    const api = vm.runInNewContext(source + ';({read:fetchDroppiEcuadorOrdersApiReadOnly})', { Object, Error, String });
    await assert.rejects(api.read({ search: '7928186' }), /CONTEXT_REQUIRED/);
});
