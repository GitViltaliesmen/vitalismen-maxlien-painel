import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEcMediaHandoff } from '../src/whatsapp/ecMediaHandoffPolicy.js';

test('media step passes the contact to a human and blocks subsequent automatic sends', () => {
    const state = { human: { mode: 'auto' }, tags: ['TEX_ULTRA_EC'], metadata: {} };
    assert.deepEqual(applyEcMediaHandoff(state, 'audio'), { recorded: true });
    assert.equal(state.human.mode, 'manual');
    assert.equal(state.human.lastManualBy, 'ec_baileys_media_handoff');
    assert.equal(state.metadata.operatorNoAutoResend, true);
    assert.ok(state.tags.includes('manual:no_auto_resend'));
    assert.deepEqual(applyEcMediaHandoff(state, 'audio'), { recorded: true, duplicate: true });
});

test('missing contact fails closed', () => {
    assert.throws(() => applyEcMediaHandoff(null), /ec_media_handoff_contact_missing/);
});
