import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { assertEcPanelCustomerStateOnlyV124Manifest } from '../src/services/ecPanelCustomerStateOnlyV124Service.js';

const between = (source, startToken, endToken) => {
    const start = source.indexOf(startToken);
    const end = source.indexOf(endToken, start + startToken.length);
    assert.ok(start >= 0 && end > start, `${startToken} -> ${endToken}`);
    return source.slice(start, end);
};

test('salvamento comum da ficha não sincroniza pedido por padrão', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const save = between(panel, 'async function persistSelectedCustomerDataNow', 'async function persistSelectedCustomerData(options');
    assert.match(save, /synchronizeOrder = false/);
    assert.match(save, /if \(synchronizeOrder && chat\.orderId/);
    assert.match(save, /else if \(synchronizeOrder && \(!isAdminLeadOrder/);
    assert.ok(save.indexOf('if (synchronizeOrder && chat.orderId') < save.indexOf('await api(`/api/orders/'));
    assert.ok(save.indexOf('else if (synchronizeOrder && (!isAdminLeadOrder') < save.indexOf("await api('/api/orders'"));
});

test('status, confirmação e autosave usam o modo state-only', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    for (const [start, end] of [
        ['async function saveCustomerForm', 'async function resolveSelectedIdentityConflict'],
        ['async function confirmCustomerDataFromForm', 'const autoSaveCustomerStatusChange'],
        ['const autoSaveCustomerStatusChange', 'const scheduleCustomerFieldAutoSave'],
        ['const scheduleCustomerFieldAutoSave', 'const autoSaveCustomerFieldBlur']
    ]) {
        const flow = between(panel, start, end);
        assert.doesNotMatch(flow, /synchronizeOrder:\s*true/);
    }
});

test('somente ações explícitas de pedido solicitam sincronização', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const dropi = between(panel, 'async function sendSelectedDropiOrder', 'async function openSelectedCustomerInLeads');
    const leads = between(panel, 'async function openSelectedCustomerInLeads', 'async function processSelectedDropiOrders');
    assert.match(dropi, /persistSelectedCustomerData\(\{ silent: true, synchronizeOrder: true \}\)/);
    assert.match(leads, /persistSelectedCustomerData\(\{ silent: true, synchronizeOrder: true \}\)/);
});

test('V123 continua salvando ContactState antes da sincronização opcional do backend', () => {
    const routes = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const handler = between(routes, "router.patch('/contact-state/:phone'", "router.post('/contact-state/:phone/identity-conflict'");
    assert.ok(handler.indexOf('await state.save();') < handler.indexOf('operationalOrderSync = await ensureOperationalOrderForConfirmedDraft'));
    assert.match(handler, /customerStateSavedOrderSyncFailureV123\(error\)/);
});

test('V123 aceita overrides sucessores somente pela lista declarada', () => {
    const source = fs.readFileSync('src/services/ecPanelCustomerStatusPersistenceV123Service.js', 'utf8');
    assert.match(source, /modified\.has\(relativePath\) \|\| successorOverrides\.has\(relativePath\)/);
});

test('preload carrega V124 antes da V123 e fecha com o runtime guard V124', () => {
    const context = fs.readFileSync('scripts/lib/ec-runtime-successor-v97-context.mjs', 'utf8');
    const latest = context.indexOf('assertEcPanelCustomerStateOnlyV124Manifest()');
    const parent = context.indexOf('assertEcPanelCustomerStatusPersistenceV123Manifest()');
    const guard = context.indexOf('ecPanelCustomerStateOnlyFreezeRuntimeGuardV124.js');
    assert.ok(latest >= 0 && parent > latest && guard > parent);
});

test('V124 valida o manifesto sem ampliar superfícies externas', () => {
    const result = assertEcPanelCustomerStateOnlyV124Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.ordinaryCustomerSaveStateOnly, true);
    assert.equal(result.manifest.policy.explicitOrderActionRequired, true);
    assert.equal(result.manifest.policy.genericOrderRoutesAllowed, false);
    assert.equal(result.manifest.policy.whatsappOutboundChanged, false);
    assert.equal(result.manifest.policy.dropiChanged, false);
    assert.equal(result.manifest.policy.postSaleChanged, false);
    assert.equal(result.manifest.policy.metaChanged, false);
});
