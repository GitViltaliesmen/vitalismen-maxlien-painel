import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { assertEcRepurchasePanelPrecedenceV100 } from '../src/services/ecRepurchasePanelPrecedenceV100Service.js';

test('V100 preserva na tela o pedido operacional mais recente por telefone', () => {
    const panel = fs.readFileSync('public/leads-window.html', 'utf8');
    const mergeStart = panel.indexOf('const mergeOperationalOrdersIntoLeads =');
    const mergeEnd = panel.indexOf('\n        const hydrateOperationalOrderLeads', mergeStart);
    const merge = panel.slice(mergeStart, mergeEnd);
    const guard = 'if (tail && mergedPhoneTails.has(tail)) return;';
    const lookup = 'const existingIndex = byOrderId.has(opsLead.orderId)';
    assert.ok(merge.includes('const mergedPhoneTails = new Set()'));
    assert.ok(merge.includes(guard));
    assert.ok(merge.indexOf(guard) < merge.indexOf(lookup));
    assert.ok(merge.includes('mergedPhoneTails.add(tail)'));
});

test('V100 mantém o pedido antigo somente como histórico', () => {
    const panel = fs.readFileSync('public/leads-window.html', 'utf8');
    assert.equal(panel.includes('990086509'), false);
    assert.equal(panel.includes('EC-RECOMPRA-MTKEFGCW-RZA8'), false);
});

test('V100 valida manifesto, sucessão e contrato operacional', () => {
    const result = assertEcRepurchasePanelPrecedenceV100();
    assert.equal(result.ok, true);
    assert.equal(result.ready, true);
});
