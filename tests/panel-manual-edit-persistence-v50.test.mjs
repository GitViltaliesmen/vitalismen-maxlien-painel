import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {
    applyVerifiedCustomerName,
    resolveCustomerDisplayName
} from '../src/services/customerNameResolutionService.js';
import { resolveCustomerDataDraft } from '../src/services/customerDataResolutionService.js';

const panelSource = fs.readFileSync('public/qr.html', 'utf8');
const helperSource = fs.readFileSync('public/panel-intelligence/customer-edit-guard-v50.js', 'utf8');
const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(helperSource, sandbox);
const guard = sandbox.VitalismenCustomerEditGuardV50;

test('V50 preserva a edição manual durante atualização periódica do mesmo cliente', () => {
    assert.equal(guard.shouldPreserveManualEdit({
        dirty: true,
        dirtyChatId: '593999000111@c.us',
        selectedChatId: '593999000111@c.us'
    }), true);
    assert.equal(guard.shouldPreserveManualEdit({
        dirty: true,
        dirtyChatId: '593999000111@c.us',
        selectedChatId: '593999000222@c.us'
    }), false);
});

test('V50 invalida resposta antiga quando o operador continua digitando ou troca de cliente', () => {
    const snapshot = guard.captureSaveSnapshot({
        chatId: '593999000111@c.us',
        contactStateKey: '593999000111@c.us',
        editRevision: 7,
        correctedFields: ['name', 'name', 'city']
    });
    assert.deepEqual([...snapshot.correctedFields], ['name', 'city']);
    assert.equal(guard.isSaveSnapshotCurrent({
        snapshot,
        selectedChatId: '593999000111@c.us',
        editRevision: 7
    }), true);
    assert.equal(guard.isSaveSnapshotCurrent({
        snapshot,
        selectedChatId: '593999000111@c.us',
        editRevision: 8
    }), false);
    assert.equal(guard.isSaveSnapshotCurrent({
        snapshot,
        selectedChatId: '593999000222@c.us',
        editRevision: 7
    }), false);
});

test('V50 serializa salvamentos e continua a fila mesmo após uma falha', async () => {
    const events = [];
    const first = guard.queueSave(Promise.resolve(), async () => {
        events.push('primeiro-inicio');
        await new Promise((resolve) => setTimeout(resolve, 15));
        events.push('primeiro-fim');
        throw new Error('falha simulada');
    });
    const second = guard.queueSave(first, async () => {
        events.push('segundo-inicio');
        events.push('segundo-fim');
        return 'ok';
    });
    await assert.rejects(first, /falha simulada/);
    assert.equal(await second, 'ok');
    assert.deepEqual(events, ['primeiro-inicio', 'primeiro-fim', 'segundo-inicio', 'segundo-fim']);
});

test('V50 mantém correção humana de nome acima do valor automático anterior', () => {
    const previous = resolveCustomerDataDraft({
        draft: { name: 'Nome Antigo', phone: '+593999000111', country: 'EC' },
        conversationPhone: '593999000111',
        correctedByHumanFields: ['name']
    }).resolution;
    const updated = resolveCustomerDataDraft({
        draft: { name: 'Nome Corrigido', phone: '+593999000111', country: 'EC' },
        previousResolution: previous,
        conversationPhone: '593999000111',
        correctedByHumanFields: ['name']
    });
    assert.equal(updated.draft.name, 'Nome Corrigido');
    assert.equal(updated.resolution.fields.name.corrected_by_human, true);
    assert.equal(updated.resolution.fields.name.locked, true);

    const state = { metadata: {}, markModified() {} };
    assert.equal(applyVerifiedCustomerName({ state, name: updated.draft.name, by: 'operador' }), true);
    assert.equal(resolveCustomerDisplayName({ state, orderName: 'Nome Antigo' }), 'Nome Corrigido');
});

test('V50 integra proteção no campo de nome, recarga, autosave e destino fixo', () => {
    assert.match(panelSource, /customer-edit-guard-v50\.js/);
    assert.match(panelSource, /customerFormEditRevision:\s*0/);
    assert.match(panelSource, /state\.customerFormEditRevision \+= 1/);
    assert.match(panelSource, /markCustomerInputCorrectedByHuman\(id\);[\s\S]{0,100}markCustomerFormDirty\(\)/);
    assert.match(panelSource, /if \(!keepManualEdit\) state\.customerCorrectedFields\.clear\(\)/);
    assert.match(panelSource, /encodeURIComponent\(saveSnapshot\.contactStateKey\).*resolve-customer-data/);
    assert.match(panelSource, /correctedByHumanFields:\s*saveSnapshot\.correctedFields/g);
    assert.match(panelSource, /newerManualEditExists[\s\S]{0,450}rememberEditingCustomerDraft\(\)/);
    assert.match(panelSource, /queueSave\([\s\S]{0,180}persistSelectedCustomerDataNow/);
    assert.doesNotMatch(helperSource, /fetch\(|XMLHttpRequest|sendZapi|Dropi|Meta|setInterval/);
});
