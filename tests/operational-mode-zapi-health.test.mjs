import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    evaluateOperationalWhatsappHealth,
    zapiConnectedFromStatus
} from '../src/routes/health.js';

const seniorGuardSource = fs.readFileSync(new URL('../scripts/senior-guard.mjs', import.meta.url), 'utf8');
const officialAuditSource = fs.readFileSync(new URL('../scripts/official-state-audit.mjs', import.meta.url), 'utf8');
const healthSource = fs.readFileSync(new URL('../src/routes/health.js', import.meta.url), 'utf8');

const objectLiteral = (source, name) => {
    const match = source.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`));
    assert.ok(match, `${name} nao localizado`);
    return Function(`"use strict"; return (${match[1]});`)();
};

const operationalFlags = objectLiteral(officialAuditSource, 'requiredOperationalEnv');
const observationFlags = objectLiteral(officialAuditSource, 'requiredObservationEnv');
const validateFlags = (actual, expected) => Object.entries(expected)
    .filter(([key, value]) => actual[key] !== value)
    .map(([key, value]) => ({ key, expected: value, actual: actual[key] }));

test('modo operacional aprovado e reconhecido pelo contrato versionado', () => {
    assert.equal(operationalFlags.VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED, 'true');
    assert.equal(operationalFlags.VIT_POWER_FUNNEL_ACTIVE, 'true');
    assert.equal(operationalFlags.ZAPI_ROUTE_INBOUND_TO_BOT, 'true');
    assert.match(seniorGuardSource, /if \(operationalAutomationApproved\)/);
});

test('combinacao completa de flags do modo operacional aprovado permanece valida', () => {
    assert.deepEqual(validateFlags({ ...operationalFlags }, operationalFlags), []);
});

test('WHATSAPP_FUNNEL_ENABLED true nao viola o modo operacional aprovado completo', () => {
    assert.equal(operationalFlags.WHATSAPP_FUNNEL_ENABLED, 'true');
    assert.match(seniorGuardSource, /operacao aprovada deve manter WHATSAPP_FUNNEL_ENABLED=true/);
    assert.deepEqual(validateFlags({ ...operationalFlags }, operationalFlags), []);
});

test('modo observacao continua exigindo funil, roteamento e scheduler bloqueados', () => {
    assert.equal(observationFlags.WHATSAPP_FUNNEL_ENABLED, 'false');
    assert.equal(observationFlags.ZAPI_ROUTE_INBOUND_TO_BOT, 'false');
    assert.equal(observationFlags.DISABLE_SCHEDULER, '1');
    assert.deepEqual(validateFlags({ ...observationFlags }, observationFlags), []);
});

test('combinacao parcial ou incoerente do modo operacional continua bloqueada', () => {
    const partial = {
        ...operationalFlags,
        WHATSAPP_FUNNEL_ENABLED: 'false'
    };
    delete partial.SHIPMENT_PICKUP_REMINDERS_ENABLED;
    assert.deepEqual(
        validateFlags(partial, operationalFlags).map(({ key }) => key).sort(),
        ['SHIPMENT_PICKUP_REMINDERS_ENABLED', 'WHATSAPP_FUNNEL_ENABLED']
    );
});

test('Z-API conectada mantem health operacional mesmo com Baileys scanning', () => {
    const result = evaluateOperationalWhatsappHealth({
        zapiConfigured: true,
        zapiConnected: true,
        whatsappConnectEnabled: true,
        connectedSessionCount: 0,
        loggedOutSessionCount: 0,
        pendingTasks: 0
    });
    assert.equal(result.officialTransport, 'zapi');
    assert.equal(result.ready, true);
    assert.equal(result.baileysRequired, false);
    assert.doesNotMatch(result.degradedReasons.join(','), /no_connected_whatsapp_session/);
    assert.deepEqual(result.degradedReasons, []);
});

test('Z-API desconectada sem outro transporte oficial pronto mantem health degradado', () => {
    const result = evaluateOperationalWhatsappHealth({
        zapiConfigured: true,
        zapiConnected: false,
        whatsappConnectEnabled: true,
        connectedSessionCount: 0
    });
    assert.equal(result.ready, false);
    assert.deepEqual(result.degradedReasons, ['zapi_not_connected']);
});

test('Baileys obrigatorio sem sessao pronta continua degradando seu proprio modo', () => {
    const result = evaluateOperationalWhatsappHealth({
        zapiConfigured: false,
        whatsappConnectEnabled: true,
        connectedSessionCount: 0
    });
    assert.equal(result.officialTransport, 'baileys');
    assert.equal(result.baileysRequired, true);
    assert.deepEqual(result.degradedReasons, ['no_connected_whatsapp_session']);
});

test('outros motivos legitimos de degradacao permanecem visiveis', () => {
    const result = evaluateOperationalWhatsappHealth({
        zapiConfigured: true,
        zapiConnected: false,
        whatsappConnectEnabled: true,
        connectedSessionCount: 0,
        pendingTasks: 51
    });
    assert.deepEqual(result.degradedReasons, ['zapi_not_connected', 'large_inbound_queue']);
});

test('normalizacao do status Z-API e pura e nao modifica o objeto recebido', () => {
    const status = Object.freeze({ connected: false, smartphoneConnected: true });
    assert.equal(zapiConnectedFromStatus(status), true);
    assert.equal(zapiConnectedFromStatus({ error: 'You are already connected.' }), true);
    assert.equal(zapiConnectedFromStatus({ connected: false, smartphoneConnected: false }), false);
    assert.deepEqual(status, { connected: false, smartphoneConnected: true });
});

test('health permanece GET/read-only e nao possui caminho de envio externo', () => {
    const forbiddenWrite = /\.(?:save|updateOne|updateMany|findOneAndUpdate|insertOne|create|deleteOne|deleteMany|bulkWrite)\s*\(/;
    const forbiddenSend = /\b(?:sendZapiText|sendText|sendAudio|sendImage|sendVideo|sendDocument)\b/;
    assert.doesNotMatch(healthSource, forbiddenWrite);
    assert.doesNotMatch(healthSource, forbiddenSend);
    assert.doesNotMatch(healthSource, /router\.(?:post|put|patch|delete)\s*\(/);
    assert.match(healthSource, /if \(zapi\.configured\.enabled\)/);
    assert.doesNotMatch(healthSource, /const zapiPrimary = !whatsappConnectEnabled/);
    assert.match(healthSource, /getZapiStatus\(\)/);
});
