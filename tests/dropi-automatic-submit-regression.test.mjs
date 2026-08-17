import assert from 'node:assert/strict';
import test from 'node:test';

import {
    autocompleteTextAccepts,
    classifyDropiPageAuthState
} from '../src/services/droppiEcuadorBrowserService.js';

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
