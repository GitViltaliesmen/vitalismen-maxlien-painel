import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { projectPanelCustomerReadModel } from '../src/services/panelCustomerReadModelService.js';

const panel = fs.readFileSync(new URL('../public/qr.html', import.meta.url), 'utf8');
const whatsappRoute = fs.readFileSync(new URL('../src/routes/whatsapp.js', import.meta.url), 'utf8');

const customerState = () => ({
    countryCode: 'EC',
    phoneDigits: '593999999999',
    metadata: {
        customerDraft: {
            name: 'Cliente QA',
            phone: '+593999999999',
            country: 'EC',
            city: 'Quito',
            province: 'Pichincha',
            address: 'Calle QA 1',
            reference: 'Casa azul',
            deliveryMode: 'home',
            status: 'novo'
        }
    }
});

test('projecao detalhada continua calculando a qualidade da ficha por padrao', () => {
    const projected = projectPanelCustomerReadModel({
        contactState: customerState(),
        fallbackPhone: '593999999999'
    });

    assert.ok(projected.customerDataResolution);
    assert.equal(projected.customerDataResolution.country, 'EC');
    assert.equal(projected.customerDraft.name, 'Cliente QA');
});

test('resumo rapido preserva os dados operacionais sem recalcular a resolucao detalhada', () => {
    const projected = projectPanelCustomerReadModel({
        contactState: customerState(),
        fallbackPhone: '593999999999',
        includeCustomerDataResolution: false
    });

    assert.equal(projected.customerDataResolution, null);
    assert.equal(projected.customerDraft.name, 'Cliente QA');
    assert.equal(projected.customerDraft.city, 'Quito');
    assert.equal(projected.customerDraft.status, 'novo');
    assert.equal(projected.phoneDigits, '593999999999');
});

test('somente a lista fast desliga a resolucao detalhada; o perfil selecionado preserva o padrao', () => {
    const fastStart = whatsappRoute.indexOf('if (fastMode) {');
    const fastEnd = whatsappRoute.indexOf('// Enrich chats with Order data', fastStart);
    const fastBlock = whatsappRoute.slice(fastStart, fastEnd);
    const profileRoute = whatsappRoute.slice(whatsappRoute.indexOf("router.get('/customer-profile/:phone'"));

    assert.notEqual(fastStart, -1);
    assert.notEqual(fastEnd, -1);
    assert.match(fastBlock, /includeCustomerDataResolution:\s*false/);
    assert.doesNotMatch(profileRoute, /includeCustomerDataResolution:\s*false/);
});

test('polling periodico nao enfileira nova lista enquanto a consulta atual esta ativa', () => {
    const intervalMarker = 'setInterval(refreshLivePanel, 5000);';
    const start = panel.indexOf(intervalMarker);
    const end = panel.indexOf("}, 3500);", start);
    const polling = panel.slice(start, end + "}, 3500);".length);

    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    assert.match(polling, /!state\.chatsLoading/);
    assert.match(polling, /loadChats\(\)\.catch/);
});
