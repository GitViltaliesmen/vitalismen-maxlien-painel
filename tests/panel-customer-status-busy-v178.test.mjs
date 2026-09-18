import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const panel = fs.readFileSync(new URL('../public/qr.html', import.meta.url), 'utf8');

const between = (source, startMarker, endMarker) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `marcador inicial ausente: ${startMarker}`);
    assert.notEqual(end, -1, `marcador final ausente: ${endMarker}`);
    return source.slice(start, end);
};

test('ficha usa trava propria e nao fica bloqueada pelo busy global', () => {
    assert.match(panel, /customerFormSaveInFlight:\s*false/);
    assert.match(panel, /const customerFormSaveBusy = \(\) => Boolean\([\s\S]{0,180}customerFormSaveInFlight[\s\S]{0,180}customerFieldAutoSaveInFlight/);
    assert.doesNotMatch(
        between(panel, 'const customerFormSaveBusy =', 'const customerDraftFromForm ='),
        /state\.busy/
    );
});

test('edicao da ficha preserva o cliente selecionado', () => {
    const applyDraft = between(panel, 'const applyCustomerDraftToChat =', 'const mergeSavedCustomerDraftIntoChat =');
    assert.match(applyDraft, /const merged = \{/);
    assert.match(applyDraft, /return merged;/);
});

test('salvar ficha nao le nem altera a trava global do painel', () => {
    const saveForm = between(panel, 'async function saveCustomerForm', 'async function resolveSelectedIdentityConflict');
    assert.match(saveForm, /customerFormSaveBusy\(\)/);
    assert.match(saveForm, /state\.customerFormSaveInFlight = true/);
    assert.match(saveForm, /state\.customerFormSaveInFlight = false/);
    assert.doesNotMatch(saveForm, /state\.busy/);
});

test('autosave de status espera a fila da ficha sem repetir confirmacao', () => {
    const statusSave = between(panel, 'const autoSaveCustomerStatusChange =', 'const scheduleCustomerFieldAutoSave =');
    assert.match(statusSave, /const persistConfirmedStatusChange = async \(\) =>/);
    assert.match(statusSave, /state\.statusAutoSaveTimer = window\.setTimeout\(persistConfirmedStatusChange, 350\)/);
    assert.doesNotMatch(statusSave, /if \(state\.busy\)/);
    assert.doesNotMatch(statusSave, /autoSaveCustomerStatusChange\(\);/);
    assert.equal((statusSave.match(/window\.confirm\(/g) || []).length, 1);
});

test('todos os nove status operacionais continuam disponiveis', () => {
    const select = between(panel, '<select id="customerStatusInput"', '</select>');
    const statuses = [...select.matchAll(/<option value="([^"]+)">/g)].map((match) => match[1]);
    assert.deepEqual(statuses, [
        'novo',
        'atendendo',
        'comprar_depois',
        'confirmado',
        'pedido_enviado',
        'entregue',
        'recompra',
        'cancelado',
        'devolvido'
    ]);
});
