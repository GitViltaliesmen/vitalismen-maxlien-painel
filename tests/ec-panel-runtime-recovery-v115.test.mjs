import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

import {
    assertEcPanelManualSendV115,
    assertEcPanelRuntimeRecoveryV115Manifest,
    ecPanelRuntimeRecoveryV115RouteDecision,
    resolveEcPanelRuntimeRecoveryV115Configuration
} from '../src/services/ecPanelRuntimeRecoveryV115Service.js';
import {
    assertZapiProviderAccepted,
    zapiProviderReceiptId
} from '../src/services/zapiClient.js';

const operationalEnv = Object.freeze({
    VITALISMEN_EC_BOT_CORE_OPERATIONAL: 'true',
    PANEL_AUTH_DISABLED: 'false'
});

test('V115 libera somente as três superfícies autenticadas necessárias ao painel', () => {
    for (const path of [
        '/api/whatsapp/send',
        '/api/whatsapp/contact-state/593991234567/claim',
        '/api/whatsapp/contact-state/593991234567/release'
    ]) {
        assert.deepEqual(
            ecPanelRuntimeRecoveryV115RouteDecision({ method: 'POST', path, env: operationalEnv }),
            { enforced: true, allowed: true, reason: 'ec_panel_v115_route_allowed' }
        );
    }
    for (const [method, path] of [
        ['GET', '/api/whatsapp/send'],
        ['POST', '/api/whatsapp/contact-state/593991234567'],
        ['POST', '/api/whatsapp/contact-state/593991234567/delete'],
        ['POST', '/api/whatsapp/anything-else'],
        ['POST', '/api/orders']
    ]) {
        assert.equal(
            ecPanelRuntimeRecoveryV115RouteDecision({ method, path, env: operationalEnv }).allowed,
            false,
            `${method} ${path}`
        );
    }
});

test('V115 falha fechado quando autenticação do painel não está obrigatória', () => {
    const invalidEnv = { ...operationalEnv, PANEL_AUTH_DISABLED: 'true' };
    assert.deepEqual(resolveEcPanelRuntimeRecoveryV115Configuration(invalidEnv), {
        enabled: true,
        ready: false,
        mode: 'EC_PANEL_AUTHENTICATED_MUTATIONS',
        failures: ['PANEL_AUTH_DISABLED_must_be_false']
    });
    assert.equal(ecPanelRuntimeRecoveryV115RouteDecision({
        method: 'POST',
        path: '/api/whatsapp/send',
        env: invalidEnv
    }).reason, 'ec_panel_v115_invalid_fail_closed');
});

test('V115 exige sendMode manual_panel dentro do handler autenticado', () => {
    assert.equal(assertEcPanelManualSendV115({ sendMode: 'manual_panel', env: operationalEnv }), true);
    assert.throws(
        () => assertEcPanelManualSendV115({ sendMode: '', env: operationalEnv }),
        /ec_panel_manual_send_mode_required/
    );
});

test('rotas de assumir, liberar e enviar permanecem depois da barreira auth do router', () => {
    const source = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const authIndex = source.indexOf('router.use(authMiddleware)');
    assert.ok(authIndex >= 0);
    for (const token of [
        "router.post('/contact-state/:phone/claim'",
        "router.post('/contact-state/:phone/release'",
        "router.post('/send'"
    ]) {
        assert.ok(source.indexOf(token) > authIndex, `${token} deve executar após authMiddleware`);
    }
    const sendStart = source.indexOf("router.post('/send'");
    const sendEnd = source.indexOf("router.get('/debug-chat", sendStart);
    const handler = source.slice(sendStart, sendEnd);
    assert.match(handler, /assertEcPanelManualSendV115\(\{ sendMode \}\)/);
});

test('Z-API só é considerada aceita quando retorna ID real', () => {
    assert.equal(zapiProviderReceiptId({ messageId: 'wamid.1' }), 'wamid.1');
    assert.equal(zapiProviderReceiptId({ zaapId: 'zaap-1' }), 'zaap-1');
    assert.equal(assertZapiProviderAccepted({ id: 'provider-1' }).id, 'provider-1');
    assert.throws(() => assertZapiProviderAccepted({ success: true }), /zapi_provider_id_missing/);
});

test('painel distingue falha HTTP, aceitação, sent, delivered e read sem promover clique', () => {
    const sandbox = {};
    vm.runInNewContext(
        fs.readFileSync('public/panel-intelligence/delivery-status-v115.js', 'utf8'),
        sandbox,
        { filename: 'delivery-status-v115.js' }
    );
    const classify = sandbox.VitalismenDeliveryStatusV115.classify;
    assert.equal(classify({ deliveryStatus: 'request_failed' }).code, 'REQUEST_FAILED');
    assert.equal(classify({ deliveryStatus: 'unconfirmed' }).code, 'REQUEST_FAILED');
    assert.equal(classify({ deliveryStatus: 'provider_accepted' }).code, 'REQUEST_FAILED');
    assert.equal(classify({ deliveryStatus: 'provider_accepted', providerMessageId: 'wamid.2' }).code, 'PROVIDER_ACCEPTED');
    assert.equal(classify({ deliveryStatus: 'sent', providerMessageId: 'wamid.2' }).code, 'UNKNOWN');
    assert.equal(classify({ deliveryStatus: 'sent', providerMessageId: 'wamid.2', ack: 1 }).code, 'SENT');
    assert.equal(classify({ deliveryStatus: 'delivered', ack: 2 }).code, 'DELIVERED');
    assert.equal(classify({ deliveryStatus: 'read', ack: 3 }).code, 'READ');
    assert.equal(classify({ deliveryStatus: 'failed', ack: -1 }).code, 'FAILED');
});

test('painel não usa unconfirmed/pending_confirmation como sinônimo de enviado', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const helperStart = panel.indexOf('const messageDeliveryStatusHtml');
    const helperEnd = panel.indexOf('const renderMessages', helperStart);
    const helper = panel.slice(helperStart, helperEnd);
    assert.match(panel, /delivery-status-v115\.js/);
    assert.doesNotMatch(helper, /pendingConfirmation/);
    assert.doesNotMatch(helper, /\['sent', 'pending_confirmation'\]/);
    assert.match(panel, /markPendingLocalMessageStatus\(pending\?\._id, 'request_failed', error\.message\)/);
});

test('V115 valida sua sucessão congelada e mantém módulos comerciais fora do escopo', () => {
    const result = assertEcPanelRuntimeRecoveryV115Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.allowedPostRouteCount, 3);
    assert.equal(result.manifest.policy.wildcardWhatsappMutationAllowed, false);
    assert.equal(result.manifest.policy.dropiChanged, false);
    assert.equal(result.manifest.policy.postSaleChanged, false);
    assert.equal(result.manifest.policy.metaChanged, false);
});
