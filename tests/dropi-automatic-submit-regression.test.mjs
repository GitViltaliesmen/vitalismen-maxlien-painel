import assert from 'node:assert/strict';
import test from 'node:test';

import {
    autocompleteTextAccepts,
    classifyDropiPageAuthState,
    extractStatusFromPanelText
} from '../src/services/droppiEcuadorBrowserService.js';
import { normalizeDroppiEcuadorStatus } from '../src/services/droppiEcuadorService.js';
import {
    isExpandedCustomerPickupConfirmation,
    isExplicitDropiPickupReleaseStatus,
    normalizeExpandedCustomerPickupConfirmation,
    shipmentHistoryRepeatKey
} from '../src/services/postSalePickupReconciliationPolicy.js';

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

test('Dropi explicito de retirada vira evidencia verificada sem aceitar simples ingresso na agencia', () => {
    assert.equal(isExplicitDropiPickupReleaseStatus('PARA RETIRO EN AGENCIA SERVIENTREGA'), true);
    assert.equal(isExplicitDropiPickupReleaseStatus('Listo para retiro'), true);
    assert.equal(isExplicitDropiPickupReleaseStatus('Ingresando en Agencia PUYO_CENTRO'), false);
    assert.equal(isExplicitDropiPickupReleaseStatus('En agencia'), false);
});

test('aviso de guia e espera nao bloqueia o aviso posterior de retirada da mesma guia', () => {
    const guide = '189375473';
    const shipped = `Su numero de guia para seguimiento es ${guide}. Por favor, no vaya todavia a la agencia. Le avisaremos apenas este disponible para retiro.`;
    const legacyGuide = `Su guia es ${guide}. Apenas aparezca disponible en agencia, le aviso por aqui para que pueda retirarlo tranquilo.`;
    const ready = `Pedido PARA RETIRO EN AGENCIA SERVIENTREGA. GUIA**${guide}`;

    assert.equal(shipmentHistoryRepeatKey(shipped), `logistics_guide:${guide}`);
    assert.equal(shipmentHistoryRepeatKey(legacyGuide), `logistics_guide:${guide}`);
    assert.equal(shipmentHistoryRepeatKey(ready), `logistics_ready_for_pickup:${guide}`);
});

test('confirmacao passiva do cliente encerra retirada sem confundir pergunta futura', () => {
    const jose = 'Ya fue retirado el producto de la Agencia Servientrega. Gracias';
    assert.equal(isExpandedCustomerPickupConfirmation(jose), true);
    assert.equal(normalizeExpandedCustomerPickupConfirmation(jose), 'Ya retire mi pedido.');
    assert.equal(isExpandedCustomerPickupConfirmation('Cuando puedo retirar el producto?'), false);
});

test('microcamada urgente roda depois do Dropi e reconcilia depois da transportadora', async () => {
    const { readFile } = await import('node:fs/promises');
    const scheduler = await readFile(new URL('../src/services/schedulerService.js', import.meta.url), 'utf8');
    const zapi = await readFile(new URL('../src/routes/zapi.js', import.meta.url), 'utf8');
    const reconciliation = await readFile(new URL('../src/services/postSalePickupReconciliationService.js', import.meta.url), 'utf8');

    assert.match(scheduler, /processExplicitDropiPickupReleaseQueue/);
    assert.match(scheduler, /DROPI_PICKUP_RELEASE_AFTER_CARRIER/);
    assert.match(scheduler, /processExpandedPickupConfirmationSweep/);
    assert.match(zapi, /handleZapiPickupConfirmation/);
    assert.match(zapi, /handleExpandedPickupConfirmationInbound/);
    assert.match(reconciliation, /automation\.readyForPickupNotifiedAt/);
    assert.match(reconciliation, /automation\.dispatchLockedUntil/);
    assert.match(reconciliation, /findExistingPickupNotice/);
    assert.match(reconciliation, /notificationLedger/);
});
