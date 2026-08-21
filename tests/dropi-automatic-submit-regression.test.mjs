import assert from 'node:assert/strict';
import test from 'node:test';

import {
    autocompleteTextAccepts,
    classifyDropiPageAuthState,
    extractStatusFromPanelText
} from '../src/services/droppiEcuadorBrowserService.js';
import { normalizeDroppiEcuadorStatus } from '../src/services/droppiEcuadorService.js';

test('token antigo na tela de login nunca e tratado como sessao Dropi autenticada', () => {
    const state = classifyDropiPageAuthState({
        url: 'https://app.dropi.ec/auth/login',
        loginPrompt: true,
        sessionToken: true
    });

    assert.equal(state.loginScreen, true);
    assert.equal(state.authenticated, false);
});

test('dashboard sem prompt e com token continua autenticado', () => {
    const state = classifyDropiPageAuthState({
        url: 'https://app.dropi.ec/dashboard/orders',
        loginPrompt: false,
        sessionToken: true
    });

    assert.equal(state.loginScreen, false);
    assert.equal(state.authenticated, true);
});

test('Santa Elena exata nao aceita El Tambo Santa Elena', () => {
    assert.equal(autocompleteTextAccepts('Santa Elena', 'Santa Elena'), true);
    assert.equal(autocompleteTextAccepts('El Tambo Santa Elena', 'Santa Elena'), false);
});

test('qualificador posterior compativel permanece aceito', () => {
    assert.equal(
        autocompleteTextAccepts('Santo Domingo de los Tsachilas', 'Santo Domingo'),
        true
    );
});

test('ingressando em agencia continua em transito ate liberacao explicita', () => {
    for (const status of [
        'Ingresando en Agencia QUITO_GUAMANI',
        'Punto de retiro QUITO_GUAMANI',
        'En agencia'
    ]) {
        assert.equal(normalizeDroppiEcuadorStatus(status), 'EN_RUTA', status);
        assert.equal(extractStatusFromPanelText(status), 'EN_RUTA', status);
    }
});

test('somente texto explicito de retirada vira pronto para retirar', () => {
    for (const status of [
        'Listo para retiro',
        'Para retiro en agencia QUITO_GUAMANI',
        'Disponible para retiro'
    ]) {
        assert.equal(normalizeDroppiEcuadorStatus(status), 'READY_FOR_PICKUP', status);
        assert.equal(extractStatusFromPanelText(status), 'READY_FOR_PICKUP', status);
    }
});

test('scheduler despacha retirada imediatamente apos confirmacao da transportadora', async () => {
    const { readFile } = await import('node:fs/promises');
    const scheduler = await readFile(new URL('../src/services/schedulerService.js', import.meta.url), 'utf8');
    assert.match(scheduler, /item\.afterStatus === 'READY_FOR_PICKUP'/);
    assert.match(scheduler, /actions: \['ready_for_pickup'\]/);
    assert.match(scheduler, /PICKUP_URGENT_DISPATCH/);
});
