import assert from 'node:assert/strict';
import test from 'node:test';
import { sentDedupeFields } from '../src/services/outboundReceiptPolicy.js';

test('legacy sent dedupe keeps its original fields', () => {
    const now = new Date('2026-11-23T00:00:00Z');
    assert.deepEqual(sentDedupeFields({ now }), { status: 'sent', sentAt: now });
});

test('linked-device sent dedupe preserves the provider receipt for audit', () => {
    const fields = sentDedupeFields({ provider: 'baileys', providerMessageId: '  ABC123  ' });
    assert.equal(fields.provider, 'baileys');
    assert.equal(fields.providerMessageId, 'ABC123');
    assert.equal(fields.status, 'sent');
    assert.throws(() => sentDedupeFields({ provider: 'baileys' }), /baileys_provider_receipt_missing/);
});
