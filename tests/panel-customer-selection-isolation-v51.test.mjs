import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const panelSource = fs.readFileSync('public/qr.html', 'utf8');
const helperSource = fs.readFileSync(
    'public/panel-intelligence/customer-selection-guard-v51.js',
    'utf8'
);
const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(helperSource, sandbox);
const guard = sandbox.VitalismenCustomerSelectionGuardV51;

test('V51 invalida trabalho antigo ao trocar de cliente', () => {
    const oldScope = guard.captureSelectionScope({
        epoch: 12,
        chatId: '593999992490@c.us',
        contactStateKey: '593999992490@c.us'
    });
    assert.equal(guard.isSelectionScopeCurrent({
        scope: oldScope,
        epoch: 13,
        selectedChatId: '593999991150@c.us',
        contactStateKey: '593999991150@c.us'
    }), false);
});

test('V51 invalida resposta antiga mesmo ao sair e voltar ao mesmo cliente', () => {
    const oldScope = guard.captureSelectionScope({
        epoch: 20,
        chatId: '593999991150@c.us',
        contactStateKey: '593999991150@c.us'
    });
    assert.equal(guard.isSelectionScopeCurrent({
        scope: oldScope,
        epoch: 22,
        selectedChatId: '593999991150@c.us',
        contactStateKey: '593999991150@c.us'
    }), false);
});

test('V51 não cria novo autosave quando a agência já está aplicada', () => {
    const agency = {
        agency_id: 'EC-SA-F9D9090453293FF9',
        name: 'Guayaquil Los Almendros',
        city: 'Guayaquil',
        province: 'Guayas',
        address: 'Cdla. Los Almendros mz o Solar 34'
    };
    assert.equal(guard.agencySuggestionChangesForm({
        agency,
        current: {
            city: 'guayaquil',
            province: 'GUAYAS',
            deliveryMode: 'agency',
            agencyId: 'EC-SA-F9D9090453293FF9',
            agencyName: 'Guayaquil Los Almendros',
            address: 'Servientrega Guayaquil Los Almendros - Cdla. Los Almendros mz o Solar 34 - Guayaquil, Guayas'
        }
    }), false);
    assert.equal(guard.agencySuggestionChangesForm({
        agency,
        current: {
            city: 'Mira',
            province: 'Carchi',
            deliveryMode: 'agency',
            agencyId: '',
            agencyName: 'Mira Principal',
            address: ''
        }
    }), true);
});

test('V51 integra geração da seleção em busca, autosave e fila', () => {
    assert.match(panelSource, /customer-selection-guard-v51\.js\?v=20260824/);
    assert.match(panelSource, /selectedChatEpoch:\s*0/);
    assert.match(panelSource, /agencyLookupSeq:\s*0/);
    assert.match(panelSource, /invalidateCustomerSelectionWork\(\);[\s\S]{0,100}state\.selectedChatEpoch \+= 1/);
    assert.match(panelSource, /if \(switchingCustomer\) blankCustomerFormForSelection\(\)/);
    assert.match(panelSource, /const selectionScope = captureCustomerSelectionScope\(\);[\s\S]{0,220}const lookupSeq = state\.agencyLookupSeq \+ 1/);
    assert.match(panelSource, /!isCustomerSelectionScopeCurrent\(selectionScope\)[\s\S]{0,120}state\.agencyLookupSeq !== lookupSeq/);
    assert.match(panelSource, /agencySuggestionChangesForm/);
    assert.match(panelSource, /reason: 'customer_selection_or_form_changed'/);
    assert.doesNotMatch(helperSource, /fetch\(|XMLHttpRequest|sendZapi|Dropi|Meta|setInterval/);
});
