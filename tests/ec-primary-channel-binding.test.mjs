import assert from 'node:assert/strict';
import test from 'node:test';
import { ecChannelOwnerDecision, validateEcChannelBinding } from '../src/whatsapp/ecPrimaryChannelBinding.js';

const binding = validateEcChannelBinding({
    version: 1,
    channelId: 'EC_PRIMARY',
    legacySessionId: '5531971862958',
    generation: 2,
    active: { ownerPhoneDigits: '553171862958', approvedAt: '2026-11-25T22:00:00.000Z' },
    pending: { ownerPhoneDigits: '593991234567', stagedAt: '2026-11-26T01:00:00.000Z' },
    history: [{ ownerPhoneDigits: '5531971862958', endedAt: '2026-11-25T22:00:00.000Z' }]
});

test('canal ativo aceita cliente EC sem reescrever o ID técnico histórico', () => {
    const result = ecChannelOwnerDecision({ binding, sessionId: '5531971862958',
        ownerPhoneDigits: '553171862958', peerPhoneDigits: '593991234567' });
    assert.equal(result.allowed, true);
    assert.equal(result.channelId, 'EC_PRIMARY');
    assert.equal(result.generation, 2);
});

test('novo número em preparação atende apenas QA e nunca clientes reais', () => {
    const base = { binding, sessionId: '5531971862958', ownerPhoneDigits: '593991234567' };
    assert.equal(ecChannelOwnerDecision({ ...base, peerPhoneDigits: '5515998038637' }).reason, 'pending_qa_only');
    assert.equal(ecChannelOwnerDecision({ ...base, peerPhoneDigits: '593998887766' }).allowed, false);
});

test('sessão errada, conta antiga e arquivo obrigatório ausente falham fechados', () => {
    assert.equal(ecChannelOwnerDecision({ binding, sessionId: 'outra', ownerPhoneDigits: '553171862958' }).allowed, false);
    assert.equal(ecChannelOwnerDecision({ binding, sessionId: '5531971862958', ownerPhoneDigits: '5531971862958' }).allowed, false);
    assert.equal(ecChannelOwnerDecision({ binding: null, env: { EC_WHATSAPP_CHANNEL_BINDING_REQUIRED: 'true' },
        sessionId: '5531971862958', ownerPhoneDigits: '553171862958' }).reason, 'binding_missing');
    assert.equal(ecChannelOwnerDecision({ binding: null,
        env: { NODE_ENV: 'production', EC_WHATSAPP_TRANSPORT: 'baileys_text' },
        sessionId: '5531971862958', ownerPhoneDigits: '553171862958' }).reason, 'binding_missing');
});

test('registro inválido não ganha autorização', () => {
    assert.throws(() => validateEcChannelBinding({ ...binding,
        pending: { ownerPhoneDigits: '553171862958', stagedAt: '2026-11-26T01:00:00.000Z' } }), /ec_channel_pending_invalid/);
    assert.throws(() => validateEcChannelBinding({ ...binding, history: [{ ownerPhoneDigits: 'abc' }] }), /ec_channel_history_invalid/);
});
