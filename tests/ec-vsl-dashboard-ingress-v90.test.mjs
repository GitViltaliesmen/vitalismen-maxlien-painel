import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { ecQaInboundPersistenceOnly } from '../src/routes/zapi.js';
import {
    EC_OFFICIAL_VSL_V78_URL,
    EC_OFFICIAL_VSL_V78_WHATSAPP,
    recognizeOfficialEcVslEntryV78
} from '../src/services/ecOfficialVslEntryV78Service.js';
import { claimEcQaInboundContextV78 } from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';
import { EC_QA_TEST_PHONE_V78 } from '../src/services/ecQaTestResetV78Service.js';

const officialMessage = [
    'Hola, quiero el tratamiento Tex Ultra.',
    'Nombre: Cliente VSL',
    'CIUDAD: Quito',
    'PROVINCIA: Pichincha'
].join('\n');

test('V90 reconhece somente o formulário estruturado da URL oficial /protocolo-g', () => {
    const recognized = recognizeOfficialEcVslEntryV78({
        text: officialMessage,
        destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP,
        sourceUrl: EC_OFFICIAL_VSL_V78_URL
    });
    assert.equal(EC_OFFICIAL_VSL_V78_URL, 'https://vilaliemen.shop/protocolo-g');
    assert.equal(recognized.recognized, true);
    for (const invalid of [
        { text: 'Hola, quiero el tratamiento', sourceUrl: EC_OFFICIAL_VSL_V78_URL },
        { text: officialMessage.replace('Nombre: Cliente VSL', 'DIRECCION: Calle 1'), sourceUrl: EC_OFFICIAL_VSL_V78_URL },
        { text: officialMessage, sourceUrl: 'https://vilaliemen.shop/protocolo' }
    ]) {
        assert.equal(recognizeOfficialEcVslEntryV78({
            ...invalid,
            destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP
        }).recognized, false);
    }
});

test('V90 grava a entrada oficial do QA sem armar o bot', async () => {
    const result = await claimEcQaInboundContextV78({
        payload: {
            phone: EC_QA_TEST_PHONE_V78,
            messageId: 'provider-v90-unarmed',
            text: { message: officialMessage }
        },
        model: { updateOne: async () => ({ modifiedCount: 0 }) }
    });
    assert.equal(result.allowed, false);
    assert.equal(result.persistenceAllowed, true);
    assert.equal(result.automationAllowed, false);
    assert.equal(result.reason, 'qa_dashboard_persistence_only');
    assert.equal(ecQaInboundPersistenceOnly({
        ecQaInboundPolicyV90: result
    }), true);
});

test('V90 mantém automação disponível somente quando o contexto QA já estava armado', async () => {
    const result = await claimEcQaInboundContextV78({
        payload: {
            phone: EC_QA_TEST_PHONE_V78,
            messageId: 'provider-v90-armed',
            text: { message: officialMessage }
        },
        model: { updateOne: async () => ({ modifiedCount: 1 }) }
    });
    assert.equal(result.allowed, true);
    assert.equal(result.persistenceAllowed, true);
    assert.equal(result.automationAllowed, true);
    assert.equal(ecQaInboundPersistenceOnly({ ecQaInboundPolicyV90: result }), false);
});

test('V90 suprime todos os caminhos automáticos nos dois webhooks e preserva a consulta do painel', () => {
    const zapi = fs.readFileSync(new URL('../src/routes/zapi.js', import.meta.url), 'utf8');
    const panel = fs.readFileSync(new URL('../src/routes/whatsapp.js', import.meta.url), 'utf8');
    assert.equal((zapi.match(/!qaPersistenceOnly && result\.routeToBot/g) || []).length, 2);
    assert.equal((zapi.match(/skip: qaPersistenceOnly \|\|/g) || []).length, 2);
    assert.match(panel, /router\.get\('\/chats'/);
    assert.match(panel, /isAllowedPanelPhoneForCountry/);
});
