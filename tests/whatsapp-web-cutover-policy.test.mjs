import test from 'node:test';
import assert from 'node:assert/strict';
import {
    OFFICIAL_EC_WHATSAPP_E164,
    assessWhatsAppWebCutoverReadiness,
    whatsappWebCutoverPolicy
} from '../src/services/whatsappWebCutoverPolicy.js';

const connectedOfficial = [{
    sessionId: OFFICIAL_EC_WHATSAPP_E164,
    ownPhoneDigits: OFFICIAL_EC_WHATSAPP_E164,
    isReady: true,
    status: 'connected'
}];

test('padrao preserva Z-API e bloqueia processamento Web', () => {
    const policy = whatsappWebCutoverPolicy({});
    assert.equal(policy.mode, 'hold_current');
    assert.equal(policy.canProcessWebInbound('593991234567', connectedOfficial), false);
    assert.equal(policy.canProcessZapiInbound('593991234567', connectedOfficial), true);
});

test('web_test transfere somente o telefone exato quando a sessao oficial esta pronta', () => {
    const policy = whatsappWebCutoverPolicy({
        WHATSAPP_WEB_CUTOVER_MODE: 'web_test',
        WHATSAPP_WEB_TEST_RECIPIENTS: '593991234567'
    });
    assert.equal(policy.canProcessWebInbound('593991234567', connectedOfficial), true);
    assert.equal(policy.canProcessZapiInbound('593991234567', connectedOfficial), false);
    assert.equal(policy.canProcessWebInbound('593991234568', connectedOfficial), false);
    assert.equal(policy.canProcessZapiInbound('593991234568', connectedOfficial), true);
});

test('falta de sessao Web pronta faz fallback para Z-API sem perder o teste', () => {
    const policy = whatsappWebCutoverPolicy({
        WHATSAPP_WEB_CUTOVER_MODE: 'web_test',
        WHATSAPP_WEB_TEST_RECIPIENTS: '593991234567'
    });
    assert.equal(policy.canProcessWebInbound('593991234567', []), false);
    assert.equal(policy.canProcessZapiInbound('593991234567', []), true);
});

test('web_primary exige aprovacao EC literal', () => {
    const blocked = whatsappWebCutoverPolicy({ WHATSAPP_WEB_CUTOVER_MODE: 'web_primary' });
    assert.equal(blocked.mode, 'hold_current');
    const approved = whatsappWebCutoverPolicy({
        WHATSAPP_WEB_CUTOVER_MODE: 'web_primary',
        WHATSAPP_WEB_CUTOVER_APPROVAL: 'AUTHORIZE_EC_WEB_PRIMARY'
    });
    assert.equal(approved.mode, 'web_primary');
    assert.equal(approved.canProcessWebInbound('593991234567', connectedOfficial), true);
    assert.equal(approved.canProcessWebInbound('573001234567', connectedOfficial), false);
});

test('readiness exige allowlist e sessao oficial no web_test', () => {
    const env = {
        WHATSAPP_CONNECT_ENABLED: 'true',
        WHATSAPP_WEB_CUTOVER_MODE: 'web_test',
        WHATSAPP_WEB_TEST_RECIPIENTS: '593991234567'
    };
    assert.equal(assessWhatsAppWebCutoverReadiness({ env, statuses: [], zapiConnected: true }).ready, false);
    assert.equal(assessWhatsAppWebCutoverReadiness({ env, statuses: connectedOfficial, zapiConnected: true }).ready, true);
});
