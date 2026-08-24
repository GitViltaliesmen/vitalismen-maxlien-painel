import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const repairSource = fs.readFileSync('scripts/repair-panel-customer-alias-v57.mjs', 'utf8');
const normalizeEcPhone = (value = '') => {
    const digits = String(value || '').replace(/\D/g, '');
    if (/^5939\d{8}$/.test(digits)) return digits;
    if (/^09\d{8}$/.test(digits)) return `593${digits.slice(1)}`;
    if (/^9\d{8}$/.test(digits)) return `593${digits}`;
    return digits;
};

test('V57 distingue equivalencia local EC de divergencia real do rascunho', () => {
    assert.equal(normalizeEcPhone('0983125541@c.us'), '593983125541');
    assert.equal(normalizeEcPhone('+593983125541'), '593983125541');
    assert.notEqual(normalizeEcPhone('0983125541@c.us'), '593993994364');
});

test('V57 limita o reparo ao alias local e nao importa pedido, mensagem ou transporte', () => {
    assert.match(repairSource, /6a7de6a3f24ae26732b457a8/);
    assert.match(repairSource, /6a7de6b3f24ae26732b45816/);
    assert.match(repairSource, /0983125541@c\.us/);
    assert.match(repairSource, /593983125541/);
    assert.match(repairSource, /PANEL_CUSTOMER_ALIAS_V57_CONTROLLED_REPAIR/);
    assert.match(repairSource, /canonicalStateMutation: false/);
    assert.doesNotMatch(repairSource, /models\/(?:Message|Order|Shipment)|sendPurchaseEventForOrder|sendText\(|sendAudio\(|sendImage\(|sendZapi|submit.*Dropi/i);
});
