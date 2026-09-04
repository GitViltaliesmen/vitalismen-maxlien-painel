import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    assertEcPanelStatusStateLayerV125Manifest,
    customerStateResponseV125
} from '../src/services/ecPanelStatusStateLayerV125Service.js';

const between = (source, startToken, endToken) => {
    const start = source.indexOf(startToken);
    const end = source.indexOf(endToken, start + startToken.length);
    assert.ok(start >= 0 && end > start, `${startToken} -> ${endToken}`);
    return source.slice(start, end);
};

test('status confirmado incompleto retorna ficha salva e pedido bloqueado', () => {
    const response = customerStateResponseV125({
        state: { metadata: { customerDraft: { status: 'confirmado' } } },
        unifiedSync: { ok: true, mode: 'updated' },
        operationalOrderSync: { ok: false, skipped: true, reason: 'customer_data_not_ready' },
        customerDataBlockedResponse: {
            error: 'customer_data_not_ready',
            customerDraft: { status: 'confirmado' },
            customerDataResolution: { orderDataReady: false }
        }
    });
    assert.equal(response.success, true);
    assert.equal(response.customerStateSaved, true);
    assert.equal(response.orderBlocked, true);
    assert.equal(response.warning, 'customer_data_not_ready');
    assert.equal(response.operationalOrderSync.reason, 'customer_data_not_ready');
});

test('resposta comum não anuncia bloqueio inexistente', () => {
    const response = customerStateResponseV125({
        state: {},
        unifiedSync: { ok: true },
        operationalOrderSync: { ok: false, skipped: true, reason: 'no_customer_draft' }
    });
    assert.equal(response.success, true);
    assert.equal(response.customerStateSaved, undefined);
    assert.equal(response.orderBlocked, undefined);
    assert.equal(response.warning, undefined);
});

test('salvar e autosalvar status permitem a camada parcial sem liberar pedido', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const manual = between(panel, 'async function saveCustomerForm', 'async function resolveSelectedIdentityConflict');
    const status = between(panel, 'const autoSaveCustomerStatusChange', 'const scheduleCustomerFieldAutoSave');
    const confirmation = between(panel, 'async function confirmCustomerDataFromForm', 'const autoSaveCustomerStatusChange');
    assert.match(manual, /allowPartialConfirmedSave: true/);
    assert.match(status, /allowPartialConfirmedSave: true/);
    assert.match(status, /result\?\.message/);
    assert.doesNotMatch(confirmation, /allowPartialConfirmedSave: true/);
});

test('backend salva estado, sincroniza ficha e responde sem 422', () => {
    const routes = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const handler = between(routes, "router.patch('/contact-state/:phone'", "router.post('/contact-state/:phone/identity-conflict'");
    assert.ok(handler.indexOf('await state.save();') < handler.indexOf('const unifiedSync'));
    assert.match(handler, /reason: 'customer_data_not_ready'/);
    assert.match(handler, /customerStateResponseV125/);
    assert.doesNotMatch(handler, /res\.status\(422\)/);
});

test('pedido operacional continua condicionado à qualidade completa', () => {
    const routes = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const handler = between(routes, "router.patch('/contact-state/:phone'", "router.post('/contact-state/:phone/identity-conflict'");
    assert.match(handler, /else if \(!customerDataBlockedResponse && shouldCreateOperationalOrderFromDraft/);
});

test('preload carrega V125 antes da V124 e fecha com o runtime guard V125', () => {
    const context = fs.readFileSync('scripts/lib/ec-runtime-successor-v97-context.mjs', 'utf8');
    const parentService = fs.readFileSync('src/services/ecPanelCustomerStateOnlyV124Service.js', 'utf8');
    const latest = context.indexOf('assertEcPanelStatusStateLayerV125Manifest()');
    const parent = context.indexOf('assertEcPanelCustomerStateOnlyV124Manifest()');
    const guard = context.indexOf('ecPanelStatusStateLayerFreezeRuntimeGuardV125.js');
    assert.ok(latest >= 0 && parent > latest && guard > parent);
    assert.match(parentService, /modified\.has\(relativePath\) \|\| successorOverrides\.has\(relativePath\)/);
});

test('V125 valida manifesto e preserva integrações externas', () => {
    const result = assertEcPanelStatusStateLayerV125Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.operatorStatusAlwaysPersists, true);
    assert.equal(result.manifest.policy.incompleteOrderRemainsBlocked, true);
    assert.equal(result.manifest.policy.genericOrderRoutesAllowed, false);
    assert.equal(result.manifest.policy.whatsappOutboundChanged, false);
    assert.equal(result.manifest.policy.dropiChanged, false);
    assert.equal(result.manifest.policy.postSaleChanged, false);
    assert.equal(result.manifest.policy.metaChanged, false);
});
