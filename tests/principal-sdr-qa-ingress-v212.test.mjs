import test from 'node:test';
import assert from 'node:assert/strict';
import { PRINCIPAL_SDR_QA_ENTRY_V212, recognizePrincipalSdrQaIngressV212 } from '../src/services/principalSdrQaIngressV212Service.js';
import { createEcQaTestPermitV78, applyEcQaTestResetToStateV78 } from '../src/services/ecQaTestResetV78Service.js';
const now = new Date('2026-11-15T01:00:00Z');
const phone = '5515998038637';
function input() {
    const state = { phoneDigits: phone, chatId: phone + '@c.us', human: { mode: 'manual' },
        tags: ['TESTE_8637_PRIORIDADE', 'TESTE_FIXO_NAO_MEXER', 'BOT_TESTE_LIBERADO'],
        metadata: { testOnly: true, botTestEnabled: true, fullFunnelTestEnabled: true, vslProductKey: 'tex_ultra_ec' } };
    const permit = createEcQaTestPermitV78({ phone, now });
    applyEcQaTestResetToStateV78({ state, phone, permit, now });
    return { text: PRINCIPAL_SDR_QA_ENTRY_V212, phone, connectedPhone: '553171862958', messageId: 'FIXTURE_PROVIDER_ID_1', state, approved: true, now };
}
test('only the approved exact QA signature enters a fresh finite window', () => assert.equal(recognizePrincipalSdrQaIngressV212(input()).recognized, true));
test('an unauthenticated capability, different phone or destination cannot enter', () => {
    for (const delta of [{ approved: false }, { phone: '5511999999999' }, { connectedPhone: '5515991418416' }, { messageId: '' }])
        assert.equal(recognizePrincipalSdrQaIngressV212({ ...input(), ...delta }).recognized, false);
});
test('expired or manually held QA does not gain automation', () => {
    const expired = input(); expired.now = new Date(now.getTime() + 600001); assert.equal(recognizePrincipalSdrQaIngressV212(expired).recognized, false);
    const manual = input(); manual.state.human.mode = 'manual'; assert.equal(recognizePrincipalSdrQaIngressV212(manual).recognized, false);
});
test('a generic greeting is not an initial signature', () => assert.equal(recognizePrincipalSdrQaIngressV212({ ...input(), text: 'Hola' }).recognized, false));
test('recognition never fabricates a VSL attribution or changes origin memory', () => {
    const data = input(); const original = structuredClone(data.state); const r = recognizePrincipalSdrQaIngressV212(data);
    assert.equal(r.attributionClaimed, false); assert.equal(r.sourceUrl, ''); assert.equal(r.productKey, 'vit_power_ec'); assert.deepEqual(data.state, original);
});
