import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
    assessWhatsAppWebCutoverReadiness,
    OFFICIAL_VSL_WHATSAPP_E164,
    whatsappWebCutoverPolicy
} from '../src/services/whatsappWebCutoverPolicy.js';

const approved = 'AUTHORIZE_WEB_CUTOVER';
const ecPhone = '593999000111';
const coPhone = '573001112233';

test('hold_current preserva Z-API e mantém WhatsApp Web sem consumo inbound', () => {
    const policy = whatsappWebCutoverPolicy({});
    assert.equal(policy.mode, 'hold_current');
    assert.equal(policy.canProcessWebInbound(ecPhone, 'EC'), false);
    assert.equal(policy.canProcessZapiInbound(ecPhone, 'EC'), true);
    assert.equal(policy.shouldUseZapiOutbound({ phone: ecPhone, country: 'EC', legacyEligible: true }), true);
    assert.equal(policy.canAutoFailoverToZapi(ecPhone, 'EC'), true);
});

test('modo inválido e produção sem aprovação voltam para hold_current', () => {
    assert.equal(whatsappWebCutoverPolicy({ WHATSAPP_WEB_CUTOVER_MODE: 'desconhecido' }).mode, 'hold_current');
    const unapproved = whatsappWebCutoverPolicy({ WHATSAPP_WEB_CUTOVER_MODE: 'web_primary' });
    assert.equal(unapproved.requestedMode, 'web_primary');
    assert.equal(unapproved.mode, 'hold_current');
    assert.equal(unapproved.productionApproved, false);
});

test('web_test isola somente o destinatário de teste com comparação exata', () => {
    const policy = whatsappWebCutoverPolicy({
        WHATSAPP_WEB_CUTOVER_MODE: 'web_test',
        WHATSAPP_WEB_TEST_RECIPIENTS: `+${ecPhone}, ${coPhone}`
    });
    assert.equal(policy.canProcessWebInbound(ecPhone, 'EC'), true);
    assert.equal(policy.canProcessZapiInbound(ecPhone, 'EC'), false);
    assert.equal(policy.shouldUseZapiOutbound({ phone: ecPhone, country: 'EC', legacyEligible: true }), false);
    assert.equal(policy.canAutoFailoverToZapi(ecPhone, 'EC'), false);
    assert.equal(policy.isTestRecipient(ecPhone.slice(1)), false);
    assert.equal(policy.canProcessWebInbound('593999000999', 'EC'), false);
    assert.equal(policy.canProcessZapiInbound('593999000999', 'EC'), true);
});

test('web_primary move somente EC e preserva CO na Z-API', () => {
    const policy = whatsappWebCutoverPolicy({
        WHATSAPP_WEB_CUTOVER_MODE: 'web_primary',
        WHATSAPP_WEB_CUTOVER_APPROVAL: approved
    });
    assert.equal(policy.canProcessWebInbound(ecPhone, 'EC'), true);
    assert.equal(policy.canProcessZapiInbound(ecPhone, 'EC'), false);
    assert.equal(policy.shouldUseZapiOutbound({ phone: ecPhone, country: 'EC', legacyEligible: true }), false);
    assert.equal(policy.canAutoFailoverToZapi(ecPhone, 'EC'), false);
    assert.equal(policy.canProcessWebInbound(coPhone, 'CO'), false);
    assert.equal(policy.canProcessZapiInbound(coPhone, 'CO'), true);
    assert.equal(policy.shouldUseZapiOutbound({ phone: coPhone, country: 'CO', legacyEligible: true }), true);
    assert.equal(policy.canAutoFailoverToZapi(coPhone, 'CO'), true);
    assert.equal(policy.canProcessZapiInbound('999000111', ''), false);
    assert.equal(policy.shouldUseZapiOutbound({ phone: '999000111', legacyEligible: true }), false);
});

test('web_only encerra uso da Z-API e zapi_rollback restaura o comportamento anterior', () => {
    const webOnly = whatsappWebCutoverPolicy({
        WHATSAPP_WEB_CUTOVER_MODE: 'web_only',
        WHATSAPP_WEB_CUTOVER_APPROVAL: approved,
        WHATSAPP_WEB_CO_ENABLED: 'true'
    });
    assert.equal(webOnly.canProcessWebInbound(ecPhone, 'EC'), true);
    assert.equal(webOnly.canProcessWebInbound(coPhone, 'CO'), true);
    assert.equal(webOnly.canProcessZapiInbound(ecPhone, 'EC'), false);
    assert.equal(webOnly.shouldUseZapiOutbound({ phone: ecPhone, country: 'EC', legacyEligible: true }), false);
    assert.equal(webOnly.canAutoFailoverToZapi(coPhone, 'CO'), false);

    const rollback = whatsappWebCutoverPolicy({ WHATSAPP_WEB_CUTOVER_MODE: 'zapi_rollback' });
    assert.equal(rollback.canProcessWebInbound(ecPhone, 'EC'), false);
    assert.equal(rollback.canProcessZapiInbound(ecPhone, 'EC'), true);
    assert.equal(rollback.shouldUseZapiOutbound({ phone: ecPhone, country: 'EC', legacyEligible: true }), true);
});

test('web_only sem migração CO autorizada permanece em web_primary', () => {
    const policy = whatsappWebCutoverPolicy({
        WHATSAPP_WEB_CUTOVER_MODE: 'web_only',
        WHATSAPP_WEB_CUTOVER_APPROVAL: approved
    });
    assert.equal(policy.mode, 'web_primary');
    assert.equal(policy.webOnlyBlocked, true);
    assert.equal(policy.canProcessZapiInbound(coPhone, 'CO'), true);
    const readiness = assessWhatsAppWebCutoverReadiness({
        env: {
            WHATSAPP_WEB_CUTOVER_MODE: 'web_only',
            WHATSAPP_WEB_CUTOVER_APPROVAL: approved,
            WHATSAPP_CONNECT_ENABLED: 'true'
        },
        statuses: [{
            ownPhoneDigits: OFFICIAL_VSL_WHATSAPP_E164,
            status: 'connected',
            isReady: true
        }],
        zapiConnected: true
    });
    assert.equal(readiness.ready, false);
    assert.equal(readiness.checks.colombiaWebMigrationApproved, false);
});

test('readiness exige sessão oficial conectada e allowlist antes do web_test', () => {
    const env = {
        WHATSAPP_WEB_CUTOVER_MODE: 'web_test',
        WHATSAPP_WEB_TEST_RECIPIENTS: ecPhone,
        WHATSAPP_CONNECT_ENABLED: 'true'
    };
    const disconnected = assessWhatsAppWebCutoverReadiness({ env, statuses: [], zapiConnected: true });
    assert.equal(disconnected.ready, false);
    assert.equal(disconnected.checks.officialSessionConnected, false);

    const connected = assessWhatsAppWebCutoverReadiness({
        env,
        statuses: [{
            sessionId: 'official-ec',
            ownPhoneDigits: OFFICIAL_VSL_WHATSAPP_E164,
            status: 'connected',
            isReady: true
        }],
        zapiConnected: true
    });
    assert.equal(connected.ready, true);
    assert.equal(connected.officialDestination, '5515991418416');
    assert.equal(connected.testRecipientCount, 1);
});

test('as quatro fronteiras usam a mesma política e o health não expõe conteúdo de cliente', () => {
    const root = process.cwd();
    const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
    const dispatcher = read('src/whatsapp/dispatcher.js');
    const zapi = read('src/routes/zapi.js');
    const outbound = read('src/whatsapp/zapiOutboundRouting.js');
    const sendText = read('src/whatsapp/sendText.js');
    const sendAudio = read('src/whatsapp/sendAudio.js');
    const health = read('src/routes/health.js');

    assert.match(dispatcher, /canProcessWebInbound/);
    assert.match(zapi, /canProcessZapiInbound/);
    assert.match(zapi, /reason: 'cutover_policy'/);
    assert.match(outbound, /shouldUseZapiOutbound/);
    assert.match(sendText, /shouldUseZapiForOutbound/);
    assert.match(sendAudio, /options: \{ \.\.\.options, provider: 'zapi' \}/);
    assert.doesNotMatch(sendAudio, /looksLikeZapiFailoverPhone/);
    assert.doesNotMatch(health, /\.select\('chatId peerPhone body createdAt sessionId'\)/);
    assert.doesNotMatch(health, /preview: String\(lastInbound\.body/);
    assert.doesNotMatch(health, /chatId: lastInbound\.chatId/);
    assert.doesNotMatch(health, /peerPhone: lastInbound\.peerPhone/);
});
