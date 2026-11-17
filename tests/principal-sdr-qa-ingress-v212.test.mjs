import test from 'node:test';
import assert from 'node:assert/strict';
import { PRINCIPAL_SDR_QA_ENTRY_V212, recognizePrincipalSdrQaIngressV212, principalSdrQaPersistedRoutingV212, principalSdrQaRuntimeReadyV212 } from '../src/services/principalSdrQaIngressV212Service.js';
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
test('the approved exact QA text remains compatible with a finite window', () => assert.equal(recognizePrincipalSdrQaIngressV212(input()).recognized, true));
test('an unauthenticated capability, different phone or destination cannot enter', () => {
    for (const delta of [{ approved: false }, { phone: '5511999999999' }, { connectedPhone: '5515991418416' }, { messageId: '' }])
        assert.equal(recognizePrincipalSdrQaIngressV212({ ...input(), ...delta }).recognized, false);
});
test('expired or manually held QA does not gain automation', () => {
    const expired = input(); expired.now = new Date(now.getTime() + 600001); assert.equal(recognizePrincipalSdrQaIngressV212(expired).recognized, false);
    const manual = input(); manual.state.human.mode = 'manual'; assert.equal(recognizePrincipalSdrQaIngressV212(manual).recognized, false);
});
test('a natural greeting enters only the approved exact QA finite window', () => assert.equal(recognizePrincipalSdrQaIngressV212({ ...input(), text: 'Hola' }).recognized, true));
test('recognition never fabricates a VSL attribution or changes origin memory', () => {
    const data = input(); const original = structuredClone(data.state); const r = recognizePrincipalSdrQaIngressV212(data);
    assert.equal(r.attributionClaimed, false); assert.equal(r.sourceUrl, ''); assert.equal(r.productKey, 'vit_power_ec'); assert.deepEqual(data.state, original);
});

test('persisted QA without a fabricated VSL visit reaches the existing router', () => {
    const result = { recorded: true, newMessage: true, phone, messageId: 'ZAPI_REAL_FIXTURE_1', providerMessageId: 'ZAPI_REAL_FIXTURE_1', body: PRINCIPAL_SDR_QA_ENTRY_V212, qaBotEligibility: false };
    const claim = { applicable: true, allowed: true, automationAllowed: true, messageId: result.messageId, phase: 'initial' };
    const args = { result, claim, approved: true }; const original = structuredClone(args);
    assert.equal(principalSdrQaPersistedRoutingV212(args), true); assert.deepEqual(args, original);
    for (const delta of [{ approved: false }, { result: { ...result, newMessage: false } }, { result: { ...result, phone: '5511999999999' } }, { result: { ...result, body: '' } }, { result: { ...result, providerMessageId: 'OTHER_PROVIDER_ID' } }, { claim: { ...claim, allowed: false } }, { claim: { ...claim, automationAllowed: false } }, { claim: { ...claim, messageId: 'OTHER_PROVIDER_ID' } }])
        assert.equal(principalSdrQaPersistedRoutingV212({ ...args, ...delta }), false);
    assert.equal(principalSdrQaPersistedRoutingV212({ ...args, result: { ...result, body: 'Quiero tres frascos' }, claim: { ...claim, phase: 'followup' } }), true);
});

test('inline callback uses the actual routing claim and same live router lease before HTTP finish', () => {
    const data = input(), id = data.messageId;
    Object.assign(data.state.metadata.qaTestContextV78, { status: 'routing', routingMessageId: id, routingPhase: 'initial', routingSignature: PRINCIPAL_SDR_QA_ENTRY_V212 });
    data.state.metadata.processingLock = { messageId: id, expiresAt: new Date(now.getTime() + 60000) };
    const args = { state: data.state, phone, messageId: id, now }, original = structuredClone(data.state);
    assert.equal(principalSdrQaRuntimeReadyV212(args), true); assert.deepEqual(data.state, original);
    for (const patch of [s => {s.human.mode='manual'}, s => {s.metadata.processingLock.messageId='WRONG'}, s => {s.metadata.qaTestContextV78.routingMessageId='WRONG'}, s => {s.metadata.qaTestContextV78.permitId='FORGED'}, s => {s.metadata.qaTestContextV78.expiresAt=now}, s => {s.metadata.processingLock.expiresAt=now}, s => {s.metadata.qaTestContextV78.routingSignature='Hola'}, s => {s.metadata.testOnly=false}]) {
        const state=structuredClone(original); patch(state); assert.equal(principalSdrQaRuntimeReadyV212({...args,state}), false);
    }
    assert.equal(principalSdrQaRuntimeReadyV212({...args,phone:'5511999999999'}), false);
    assert.equal(principalSdrQaRuntimeReadyV212({...args,messageId:'OTHER_MESSAGE'}), false);
});
