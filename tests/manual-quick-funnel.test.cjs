const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const policyPath = path.join(projectRoot, 'public', 'panel-intelligence', 'manual-funnel-policy.js');
const orderPolicyPath = path.join(projectRoot, 'public', 'panel-intelligence', 'customer-order-policy.js');
const panelPath = path.join(projectRoot, 'public', 'qr.html');

const loadBrowserPolicy = (filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    const context = {
        module: { exports: {} },
        exports: {},
        globalThis: {}
    };
    vm.runInNewContext(source, context, { filename: filePath });
    return context.module.exports;
};

test('libera Funil Rapido para Angel e equivalentes somente depois de assumir atendimento manual EC', () => {
    const policy = loadBrowserPolicy(policyPath);
    assert.equal(policy.isAvailable({ hasSelectedChat: true, country: 'EC', humanMode: 'manual' }), true);
    assert.equal(policy.isAvailable({ hasSelectedChat: true, country: 'ec', humanMode: 'MANUAL' }), true);
    assert.equal(policy.titleFor({ hasSelectedChat: true, country: 'EC', humanMode: 'manual' }), 'Manual EC · Funil rapido Tex Ultra');
});

test('nao libera o atalho em automacao, sem cliente ou fora de EC', () => {
    const policy = loadBrowserPolicy(policyPath);
    assert.equal(policy.isAvailable({ hasSelectedChat: true, country: 'EC', humanMode: 'auto' }), false);
    assert.equal(policy.isAvailable({ hasSelectedChat: false, country: 'EC', humanMode: 'manual' }), false);
    assert.equal(policy.isAvailable({ hasSelectedChat: true, country: 'CO', humanMode: 'manual' }), false);
    assert.equal(policy.titleFor({ hasSelectedChat: true, country: 'EC', humanMode: 'auto' }), 'Assuma o atendimento para liberar');
});

test('painel preserva origem VSL e exige acao explicita para trocar produto atual', () => {
    const html = fs.readFileSync(panelPath, 'utf8');
    assert.match(html, /panel-intelligence\/manual-funnel-policy\.js/);
    assert.match(html, /const manualEcSalesQuickFunnelAvailable = \(\) =>/);
    assert.doesNotMatch(html, /const texUltraSalesQuickFunnelAvailable = \(\) =>/);
    assert.match(html, /VSL de origem:/);
    assert.match(html, /data-customer-product-key="tex_ultra_ec"/);
    assert.match(html, /data-customer-product-key="nitrix_ec"/);
    assert.match(html, /data-customer-product-key="vit_power_ec"/);

    const fillStart = html.indexOf('const fillSalesQuickTemplate = (key) =>');
    const fillEnd = html.indexOf('const buildDraftTemplate = (kind) =>', fillStart);
    const fillFunction = html.slice(fillStart, fillEnd);
    assert.ok(fillStart > 0 && fillEnd > fillStart);
    assert.doesNotMatch(fillFunction, /customerProductInput|persistSelectedCustomerData|scheduleCustomerFieldAutoSave/);
    assert.match(fillFunction, /messageInput/);
});

test('pedido antigo do Angel fica historico e um pedido novo fica ligado a negociacao atual', () => {
    const policy = loadBrowserPolicy(orderPolicyPath);
    const angel = {
        orderId: 'EC-ADMIN-3338',
        status: 'atendendo',
        tags: ['ANTIGO', 'CLIENTE ANTIGO'],
        currentNegotiationOrderId: ''
    };
    assert.equal(policy.historicalOrderId(angel), 'EC-ADMIN-3338');
    assert.equal(policy.historicalOrderId({
        ...angel,
        orderId: 'EC-NEW-1',
        status: 'confirmed',
        currentNegotiationOrderId: 'EC-NEW-1'
    }), '');
    assert.equal(policy.historicalOrderId({
        ...angel,
        orderId: 'EC-NEW-1',
        status: 'delivered',
        currentNegotiationOrderId: 'EC-NEW-1'
    }), 'EC-NEW-1');

    const html = fs.readFileSync(panelPath, 'utf8');
    assert.match(html, /customer-order-policy\.js/);
    assert.match(html, /chat\.orderId && !isAdminLeadOrder && !historicalOrderId && !shouldCreateNewConfirmedOrder/);
    assert.match(html, /reason: 'historical_order_preserved'/);
    assert.match(html, /orderPayload\.previousOrderId = historicalOrderId/);
    const ordersRoute = fs.readFileSync(path.join(projectRoot, 'src', 'routes', 'orders.js'), 'utf8');
    assert.match(ordersRoute, /previousOrderId: repurchaseContext\?\.previousOrderId \|\| ''/);
    assert.match(ordersRoute, /buildDeliveredRepurchaseOrderId\(\)/);
    assert.match(ordersRoute, /repurchase_requires_panel_auth/);
});

test('midia manual pode ser enviada no pos-venda sem desligar o guard automatico do Dropi', () => {
    for (const relativePath of [
        'src/whatsapp/sendAudio.js',
        'src/whatsapp/sendImage.js',
        'src/whatsapp/sendVideo.js'
    ]) {
        const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
        assert.match(source, /const sendMode = options\.sendMode \|\| '';/, `${relativePath} deve identificar o envio manual`);
        assert.match(
            source,
            /allowExistingDropiOrder: options\.allowExistingDropiOrder === true \|\| sendMode === 'manual_panel'/,
            `${relativePath} deve liberar pedido Dropi existente somente para o operador manual`
        );
        assert.match(source, /checkDropiOrderBeforeOutbound\s*\(/, `${relativePath} deve preservar o guard Dropi`);
        assert.match(source, /if \(!dropiGuard\.allowed\)/, `${relativePath} deve continuar bloqueando automacao nao autorizada`);
    }
});

test('rota manual continua declarando o modo manual para audio, imagem e video', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'src', 'routes', 'whatsapp.js'), 'utf8');
    const mediaDispatcher = source.slice(source.indexOf('const sendWhatsAppMessage = async'));
    assert.match(mediaDispatcher, /const sendMode = options\.sendMode === 'manual_panel' \? 'manual_panel' : '';/);
    assert.match(mediaDispatcher, /sendAudio\([\s\S]*?sendMode,/);
    assert.match(mediaDispatcher, /sendImage\([\s\S]*?sendMode,/);
    assert.match(mediaDispatcher, /sendVideo\([\s\S]*?sendMode,/);
});
