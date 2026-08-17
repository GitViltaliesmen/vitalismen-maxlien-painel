import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
    callAutoReplyEnabled,
    decideCallAutoReplyAction,
    normalizeCallReplyPhoneKey,
    zapiCallNotification
} from '../src/services/callAutoReplyPolicy.js';
import { normalizeEcuadorOrderFieldsForDropi } from '../src/services/dropiDataNormalizationService.js';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('resposta de chamada fica desligada por padrao e aceita ativacao explicita', () => {
    assert.equal(callAutoReplyEnabled({}), false);
    assert.equal(callAutoReplyEnabled({ WHATSAPP_AUTO_REJECT_CALLS: 'true' }), true);
    assert.equal(callAutoReplyEnabled({
        WHATSAPP_AUTO_REJECT_CALLS: 'true',
        WHATSAPP_CALL_AUTO_REPLY_ENABLED: 'false'
    }), false);
    assert.equal(callAutoReplyEnabled({ WHATSAPP_CALL_AUTO_REPLY_ENABLED: 'true' }), true);
});

test('telefone da chamada usa uma chave unica entre E164, local e JID', () => {
    assert.equal(normalizeCallReplyPhoneKey('+593 99 123 4567'), '991234567');
    assert.equal(normalizeCallReplyPhoneKey('0991234567@s.whatsapp.net'), '991234567');
});

test('politica de chamada permite um audio, no maximo um texto e ignora insistencia', () => {
    const now = new Date('2026-08-17T18:00:00.000Z');
    const first = decideCallAutoReplyAction({}, { callKey: 'zapi:call-1', now });
    assert.equal(first.action, 'audio');
    assert.equal(first.resetWindow, true);

    const duplicate = decideCallAutoReplyAction({
        windowStartedAt: now,
        handledCalls: [{ key: 'zapi:call-1', at: now }]
    }, { callKey: 'zapi:call-1', now: new Date(now.getTime() + 1000) });
    assert.deepEqual(duplicate, { action: 'none', reason: 'duplicate_call_event', resetWindow: false });

    const continued = decideCallAutoReplyAction({
        windowStartedAt: now,
        audioAttemptedAt: now,
        lastCallAt: now
    }, {
        callKey: 'zapi:call-2',
        now: new Date(now.getTime() + 5 * 60 * 1000),
        continuationMs: 15 * 60 * 1000
    });
    assert.equal(continued.reason, 'continued_call_ignored');

    const second = decideCallAutoReplyAction({
        windowStartedAt: now,
        audioAttemptedAt: now,
        lastCallAt: now
    }, {
        callKey: 'zapi:call-3',
        now: new Date(now.getTime() + 20 * 60 * 1000),
        continuationMs: 15 * 60 * 1000
    });
    assert.equal(second.action, 'text');

    const exhausted = decideCallAutoReplyAction({
        windowStartedAt: now,
        audioAttemptedAt: now,
        textAttemptedAt: new Date(now.getTime() + 20 * 60 * 1000),
        lastCallAt: new Date(now.getTime() + 20 * 60 * 1000)
    }, {
        callKey: 'zapi:call-4',
        now: new Date(now.getTime() + 40 * 60 * 1000),
        continuationMs: 15 * 60 * 1000
    });
    assert.equal(exhausted.reason, 'reply_limit_reached');
});

test('Z-API distingue chamada recebida dos estados posteriores da mesma chamada', () => {
    const received = zapiCallNotification({
        notification: 'CALL_RECEIVED',
        callId: 'CALL-123',
        phone: '593991234567',
        callDirection: 'incoming',
        fromMe: false
    });
    assert.equal(received.actionable, true);
    assert.equal(received.callId, 'CALL-123');
    assert.equal(zapiCallNotification({ notification: 'CALL_MISSED', callId: 'CALL-123' }).actionable, false);
    assert.equal(zapiCallNotification({ type: 'ReceivedCallback', text: { message: 'hola' } }), null);
});

test('estado anti-spam de chamadas e persistente e os dois transportes usam a mesma reserva', () => {
    const model = read('src/models/CallAutoReplyState.js');
    const service = read('src/services/callAutoReplySafetyService.js');
    const baileys = read('src/whatsapp/connection.js');
    const zapi = read('src/routes/zapi.js');
    assert.match(model, /phoneKey:[\s\S]*?unique: true/);
    assert.match(model, /audioAttemptedAt/);
    assert.match(model, /textAttemptedAt/);
    assert.match(model, /handledCalls/);
    assert.match(service, /findOneAndUpdate\([\s\S]*?lockUntil/);
    assert.match(baileys, /reserveCallAutoReply\(/);
    assert.match(zapi, /reserveCallAutoReply\(/);
    assert.ok(zapi.indexOf('handleZapiCallWebhook(payload)') < zapi.indexOf('classifyZapiGenericWebhookPayload(payload)'));
});

test('painel Tex Ultra oferece frasco manual, compacta alternativas e deixa nome por ultimo', () => {
    const panel = read('public/qr.html');
    const menuStart = panel.indexOf('<div class="sales-quick-funnel-menu"');
    const menuEnd = panel.indexOf('</details>\n                    <div id="composerQuickStatusBar"', menuStart);
    const menu = panel.slice(menuStart, menuEnd);
    assert.match(menu, /data-sales-quick-media="\/media\/sales\/ec\/tex_ultra\.png"/);
    assert.match(menu, />Enviar frasco</);
    assert.match(menu, /class="sales-quick-funnel-variants"/);
    assert.ok(menu.indexOf('<h4>Confirmar quantidade</h4>') < menu.indexOf('<h4>Cidade e provincia</h4>'));
    assert.ok(menu.indexOf('<h4>Cidade e provincia</h4>') < menu.indexOf('<h4>Agencia Servientrega</h4>'));
    assert.ok(menu.indexOf('<h4>Agencia Servientrega</h4>') < menu.indexOf('<h4>Nome</h4>'));
    assert.match(panel, /Enviar agora a imagem do frasco Tex Ultra/);
});

test('painel remove contexto tecnico extenso e restaura busca inteligente controlada', () => {
    const panel = read('public/qr.html');
    assert.doesNotMatch(panel, /customerCurrentContextV16|customer-current-context-v16/);
    assert.match(panel, /id="scanCustomerDataBtn"/);
    assert.match(panel, /Busca inteligente na conversa/);
    const functionStart = panel.indexOf('const syncDetectedCustomerDataFromMessages');
    const functionEnd = panel.indexOf('\n        async function readCustomerDataFromImage', functionStart);
    const functionBody = panel.slice(functionStart, functionEnd);
    assert.match(functionBody, /operatorRequested/);
    assert.match(functionBody, /Revise e salve a ficha/);
    assert.doesNotMatch(functionBody, /scheduleCustomerFieldAutoSave/);
});

test('payload Dropi final usa normalizador oficial de cidade, provincia e agencia', () => {
    const service = read('src/services/droppiEcuadorService.js');
    assert.match(service, /normalizeEcuadorOrderFieldsForDropi/);
    assert.match(service, /department: normalized\.province/);
    assert.match(service, /city: normalized\.city/);
    assert.match(service, /agencyValidated: normalized\.agencyValidated === true/);

    const panelCases = [
        {
            address: 'Servientrega Salcedo Principal - Vicente Leon 184 y Ana Paredes',
            city: 'Salcedo',
            province: 'Cotopaxi',
            agencyName: 'Salcedo Principal'
        },
        {
            address: 'Servientrega Virgen de Fatima Km 26 Av. Principal - Juan Montalvo y Av. Principal',
            city: 'Virgen de Fatima Km 26',
            expectedCity: 'Virgen de Fatima km 26',
            province: 'Guayas',
            agencyName: 'Virgen de Fatima km 26 Av. Principal'
        },
        {
            address: 'Servientrega Sigsig Maria Auxiliadora - Av. Maria Auxiliadora S/n a Una Cuadra Del Terminal Terrestre',
            city: 'Sigsig',
            province: 'Azuay',
            agencyName: 'Sigsig Maria Auxiliadora'
        },
        {
            address: 'Servientrega Santa Rosa (el Oro) 30 de Agosto - Sucre y 30 de Agosto Diagonal al Banco Del Austro',
            city: 'Santa Rosa (El Oro)',
            expectedCity: 'Santa Rosa (el Oro)',
            province: 'El Oro',
            agencyName: 'Santa Rosa (el Oro) 30 de Agosto'
        }
    ];
    for (const example of panelCases) {
        const normalized = normalizeEcuadorOrderFieldsForDropi({
            name: 'Cliente Prueba',
            phone: '+593991234567',
            address: example.address,
            city: example.city,
            province: example.province,
            quantity: 1,
            total: 35.99
        });
        assert.equal(normalized.city, example.expectedCity || example.city);
        assert.equal(normalized.province, example.province);
        assert.equal(normalized.agencyValidated, true);
        assert.equal(normalized.agencyName, example.agencyName);
        assert.equal(normalized.normalizedBy, 'servientrega_agency_catalog');
    }
});

test('scripts inline do painel continuam validos apos reorganizacao', () => {
    const panel = read('public/qr.html');
    const scripts = [...panel.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
        .map((match) => match[1])
        .filter((body) => body.trim());
    for (const body of scripts) Function(body);
});
