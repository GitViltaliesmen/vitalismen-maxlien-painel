import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const policySource = fs.readFileSync('public/panel-intelligence/panel-new-dropi-persistence-v142.js', 'utf8');
const sandbox = { console };
sandbox.globalThis = sandbox;
vm.runInNewContext(policySource, sandbox);
const policy = sandbox.VitalismenPanelNewDropiPersistenceV142;

const lucianoDraft = {
    orderId: 'EC-ADMIN-3503',
    status: 'confirmado',
    country: 'EC',
    name: 'LUCIANO ZABALA',
    phone: '+593962393633',
    city: 'Lago Agrio',
    province: 'Sucumbios',
    address: 'Servientrega Lago Agrio Principal - Av. Eloy Alfaro 317 y 12 de Febrero - Lago Agrio, Sucumbios',
    deliveryMode: 'agency',
    agencyId: 'EC-SA-7CBB7FD24D125AEE',
    agencyName: 'Lago Agrio Principal',
    quantity: '3',
    total: '80.99',
    productKey: 'tex_ultra_ec'
};

test('V142 mantém contato manual em Novas depois de salvar e encerra somente após leitura posterior', () => {
    assert.equal(policy.isManualNewContactPending({
        manuallyCreatedAt: '2026-09-08T02:27:04.356Z',
        updatedAt: '2026-09-08T02:30:00.000Z'
    }), true);
    assert.equal(policy.isManualNewContactPending({
        manuallyCreatedAt: '2026-09-08T02:27:04.356Z',
        panelLastReadAt: '2026-09-08T02:28:00.000Z'
    }), false);
    assert.equal(policy.isManualNewContactPending({ unreadCount: 1 }), false);
});

test('V142 prepara o caso real 3503 pela rota canônica e não autoriza nem envia', () => {
    const decision = policy.buildConfirmedAdminLeadPreparation({
        chat: { orderId: 'EC-ADMIN-3503' },
        draft: lucianoDraft,
        customerDataResolution: { version: 28, orderDataReady: true }
    });
    assert.equal(decision.ready, true);
    assert.equal(decision.endpoint, '/api/shipments/droppi/ec/admin-leads/3503/configure-order');
    assert.deepEqual({ ...decision.body }, {
        orderId: 'EC-ADMIN-3503',
        productKey: 'tex_ultra_ec',
        priceCatalog: 'promotional',
        quantity: 3
    });
    assert.doesNotMatch(decision.endpoint, /authorize-submit|\/submit$/);
});

test('V142 não prepara ficha incompleta, não confirmada ou bloqueada pela qualidade', () => {
    assert.equal(policy.buildConfirmedAdminLeadPreparation({
        chat: { orderId: 'EC-ADMIN-3503' },
        draft: { ...lucianoDraft, status: 'atendendo' },
        customerDataResolution: { version: 28, orderDataReady: true }
    }).reason, 'not_confirmed');
    assert.equal(policy.buildConfirmedAdminLeadPreparation({
        chat: { orderId: 'EC-ADMIN-3503' },
        draft: { ...lucianoDraft, agencyName: '' },
        customerDataResolution: { version: 28, orderDataReady: true }
    }).reason, 'confirmed_order_incomplete_or_price_unknown');
    assert.equal(policy.buildConfirmedAdminLeadPreparation({
        chat: { orderId: 'EC-ADMIN-3503' },
        draft: lucianoDraft,
        customerDataResolution: { version: 28, orderDataReady: false }
    }).reason, 'customer_data_not_ready');
});

test('V142 não reconfigura pedido idêntico e preserva autorização existente', () => {
    const existingOrder = {
        orderId: 'EC-ADMIN-3503',
        tracking: { productKey: 'tex_ultra_ec' },
        package: { quantity: 3 },
        total: 80.99,
        customer: {
            name: lucianoDraft.name,
            phone: lucianoDraft.phone,
            city: lucianoDraft.city,
            province: lucianoDraft.province,
            address: lucianoDraft.address
        },
        delivery: {
            mode: lucianoDraft.deliveryMode,
            agencyId: lucianoDraft.agencyId,
            agencyName: lucianoDraft.agencyName
        }
    };
    const decision = policy.buildConfirmedAdminLeadPreparation({
        chat: { orderId: 'EC-ADMIN-3503' },
        draft: lucianoDraft,
        customerDataResolution: { version: 28, orderDataReady: true },
        existingOrder
    });
    assert.equal(decision.ready, false);
    assert.equal(decision.reason, 'already_prepared');
});

test('V142 integra Novas e preparação manual sem inserir envio automático', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const whatsapp = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    assert.match(panel, /panel-new-dropi-persistence-v142\.js/);
    assert.match(panel, /isManualNewContactPending\?\.\(chat\)/);
    assert.equal((whatsapp.match(/manuallyCreatedAt: contactState\?\.metadata\?\.manuallyCreatedAt/g) || []).length, 2);
    assert.equal((whatsapp.match(/panelLastReadAt: contactState\?\.metadata\?\.panelLastReadAt/g) || []).length, 2);
    assert.match(whatsapp, /manuallyCreatedAt: state\.metadata\?\.manuallyCreatedAt \|\| new Date\(\)\.toISOString\(\)/);

    const helperStart = panel.indexOf('const prepareConfirmedAdminLeadForDropi = async');
    const helperEnd = panel.indexOf('const applyLeadStatusUpdateLocally', helperStart);
    const helper = panel.slice(helperStart, helperEnd);
    assert.ok(helperStart > 0 && helperEnd > helperStart);
    assert.match(helper, /buildConfirmedAdminLeadPreparation/);
    assert.match(helper, /contactSave\?\.unifiedSync\?\.lead_id/);
    assert.match(helper, /`EC-ADMIN-\$\{syncedLeadId\}`/);
    assert.match(helper, /api\(decision\.endpoint/);
    assert.match(helper, /dropiAuthorized: false/);
    assert.match(helper, /dropiSubmitted: false/);
    assert.doesNotMatch(helper, /authorizeDropiOrder|submitDropiOrder|authorize-submit|orders\/.*\/submit/);

    const saveStart = panel.indexOf('async function saveCustomerForm');
    const saveEnd = panel.indexOf('async function resolveSelectedIdentityConflict', saveStart);
    assert.match(panel.slice(saveStart, saveEnd), /prepareConfirmedAdminLeadForDropi/);
    const confirmStart = panel.indexOf('async function confirmCustomerDataFromForm');
    const confirmEnd = panel.indexOf('const autoSaveCustomerStatusChange', confirmStart);
    assert.match(panel.slice(confirmStart, confirmEnd), /prepareConfirmedAdminLeadForDropi/);
    const autoStart = confirmEnd;
    const autoEnd = panel.indexOf('async function resolveSelectedIdentityConflict', autoStart + 1);
    assert.doesNotMatch(panel.slice(autoStart, autoEnd > autoStart ? autoEnd : autoStart + 5000), /prepareConfirmedAdminLeadForDropi/);
});
