import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { authorizedVslTestRecipient } from '../src/routes/zapi.js';
import { shouldUseZapiForOutbound } from '../src/whatsapp/zapiOutboundRouting.js';

const OFFICIAL_PHONE = '5515991418416';
const TEST_PHONE = '5515998038637';
const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');

test('V32 fixa um único número oficial válido em VSL, painel e configuração', () => {
    assert.match(OFFICIAL_PHONE, /^55\d{11}$/);

    const vsl = read('public/n/index.html');
    const panel = read('public/qr.html');
    const envExample = read('.env.example');

    assert.match(vsl, new RegExp(`OFFICIAL_ZAPI_SELLER_E164 = "${OFFICIAL_PHONE}"`));
    assert.match(vsl, new RegExp(`phone: "${OFFICIAL_PHONE}"`));
    assert.match(panel, new RegExp(`sessionId: '${OFFICIAL_PHONE}'`));

    for (const key of [
        'WHATSAPP_DEFAULT_SESSION_ID',
        'WHATSAPP_SESSION_IDS',
        'WHATSAPP_DEFAULT_SESSION_ID_EC',
        'WHATSAPP_SESSION_IDS_EC',
        'WHATSAPP_ALLOWED_OUTBOUND_SESSION_IDS',
        'WHATSAPP_SELLER_ROTATION_SEQUENCE_EC',
        'WHATSAPP_SELLER_POOL_EC',
        'WHATSAPP_SELLER_POOL',
        'WHATSAPP_SELLER_E164'
    ]) {
        assert.match(envExample, new RegExp(`^${key}=${OFFICIAL_PHONE}$`, 'm'));
    }
});

test('V32 autoriza somente o telefone brasileiro de QA na entrada e saída Z-API', () => {
    const env = {
        WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS: TEST_PHONE,
        WHATSAPP_TEST_ALLOWED_RECIPIENTS: TEST_PHONE
    };
    assert.equal(authorizedVslTestRecipient(TEST_PHONE, env), true);
    assert.equal(authorizedVslTestRecipient(OFFICIAL_PHONE, env), false);
    assert.equal(authorizedVslTestRecipient('5511999999999', env), false);

    const previous = {
        instanceId: process.env.ZAPI_INSTANCE_ID,
        instanceToken: process.env.ZAPI_INSTANCE_TOKEN,
        clientToken: process.env.ZAPI_CLIENT_TOKEN,
        testRecipients: process.env.WHATSAPP_TEST_ALLOWED_RECIPIENTS
    };
    process.env.ZAPI_INSTANCE_ID = 'test-instance';
    process.env.ZAPI_INSTANCE_TOKEN = 'test-token';
    process.env.ZAPI_CLIENT_TOKEN = 'test-client-token';
    process.env.WHATSAPP_TEST_ALLOWED_RECIPIENTS = TEST_PHONE;
    try {
        assert.equal(shouldUseZapiForOutbound({
            recipientDigits: TEST_PHONE,
            options: { provider: 'zapi', sendMode: 'manual_panel' }
        }), true);
        assert.equal(shouldUseZapiForOutbound({
            recipientDigits: '5511999999999',
            options: { provider: 'zapi', sendMode: 'manual_panel' }
        }), false);
    } finally {
        const restore = (key, value) => {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        };
        restore('ZAPI_INSTANCE_ID', previous.instanceId);
        restore('ZAPI_INSTANCE_TOKEN', previous.instanceToken);
        restore('ZAPI_CLIENT_TOKEN', previous.clientToken);
        restore('WHATSAPP_TEST_ALLOWED_RECIPIENTS', previous.testRecipients);
    }
});

test('V32 remove overrides brasileiros adicionais dos caminhos ativos', () => {
    const files = [
        'FREEZE_LOCK_EC.json',
        'public/n/index.html',
        'public/qr.html',
        'src/routes/whatsapp.js',
        'scripts/apply-historical-client-consolidation.mjs',
        'scripts/audit-historical-client-consolidation.mjs',
        'scripts/send-opt-in-rescue-bonus.mjs',
        'scripts/reconcile-whatsapp-to-unified-panel.mjs',
        'scripts/plan-2800-failover-rescue.mjs'
    ];
    const retiredOperationalPhones = [
        new RegExp(['55318', '300', '2800'].join('')),
        new RegExp(['55317', '186', '2958'].join('')),
        new RegExp(['55319', '7186', '2958'].join(''))
    ];
    for (const file of files) {
        for (const phonePattern of retiredOperationalPhones) {
            assert.doesNotMatch(read(file), phonePattern, `${file} ainda contém telefone operacional desativado`);
        }
    }

    const vsl = read('public/n/index.html');
    const route = read('src/routes/whatsapp.js');
    assert.match(vsl, /const TEST_PHONE_OVERRIDES = \{\s*"8637":/);
    assert.doesNotMatch(vsl, /"2958"\s*:/);
    assert.match(route, /const PUBLIC_VSL_TEST_PHONE_OVERRIDES = \{\s*8637: '5515998038637'/);
});

test('telefone QA permanece visível e protegido contra pedido e Dropi', () => {
    const panel = read('public/qr.html');
    const conversation = read('src/services/conversationEngine.js');
    const dropiGuard = read('src/services/dropiOutboundOrderGuardService.js');
    const envExample = read('.env.example');

    assert.match(panel, new RegExp(`allowedBrazilTestPhones = new Set\\(\\['${OFFICIAL_PHONE}', '${TEST_PHONE}'\\]\\)`));
    assert.match(conversation, new RegExp(TEST_PHONE));
    assert.match(dropiGuard, new RegExp(TEST_PHONE));
    for (const key of [
        'WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS',
        'WHATSAPP_TEST_ALLOWED_RECIPIENTS',
        'WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS',
        'WHATSAPP_PRIORITY_TEST_PHONES'
    ]) {
        assert.match(envExample, new RegExp(`^${key}=${TEST_PHONE}$`, 'm'));
    }
    assert.match(envExample, new RegExp(`^WHATSAPP_PANEL_OPERATIONAL_NUMBERS=${OFFICIAL_PHONE}$`, 'm'));
    assert.match(envExample, /^WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS=$/m);
});
