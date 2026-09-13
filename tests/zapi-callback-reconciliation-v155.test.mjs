import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    reconcilePendingZapiDeliveryV155,
    rememberUnmatchedZapiDeliveryV155,
    resetPendingZapiDeliveryV155ForTests,
    zapiDeliveryEvidenceFromLogV155
} from '../src/services/zapiDeliveryCallbackReconciliationV155Service.js';

const message = (overrides = {}) => ({
    provider: 'zapi',
    providerMessageId: 'provider-race-1',
    providerZaapId: '',
    peerPhone: '5515998038637',
    deliveryStatus: 'pending',
    providerStatus: 'queued',
    ack: null,
    set(fields) { Object.assign(this, fields); },
    async save() { this.saved = true; return this; },
    ...overrides
});

test.beforeEach(() => resetPendingZapiDeliveryV155ForTests());

test('V155 reconcilia callback entregue que chega antes da persistência manual', async () => {
    const delivered = rememberUnmatchedZapiDeliveryV155({
        providerMessageId: 'provider-race-1',
        phone: '5515998038637',
        deliveryStatus: 'delivered',
        providerStatus: 'deliverycallback',
        ack: 2,
        observedAt: '2026-09-13T13:40:47.865Z'
    });
    const lateSent = rememberUnmatchedZapiDeliveryV155({
        providerMessageId: 'provider-race-1',
        phone: '5515998038637',
        deliveryStatus: 'sent',
        providerStatus: 'sent',
        ack: 1,
        observedAt: '2026-09-13T13:40:48.049Z'
    });
    assert.equal(delivered.remembered, true);
    assert.equal(lateSent.retainedStatus, 'delivered');

    const record = message();
    const result = await reconcilePendingZapiDeliveryV155(record, { now: new Date('2026-09-13T13:41:09.764Z') });
    assert.equal(result.reconciled, true);
    assert.equal(record.deliveryStatus, 'delivered');
    assert.equal(record.ack, 2);
    assert.equal(record.providerStatus, 'deliverycallback');
    assert.equal(record.deliveredAt.toISOString(), '2026-09-13T13:40:47.865Z');
    assert.equal(record.saved, true);
});

test('V155 exige provider id exato e não reconcilia apenas por telefone', async () => {
    rememberUnmatchedZapiDeliveryV155({
        providerZaapId: 'different-provider-id',
        phone: '5515998038637',
        deliveryStatus: 'delivered',
        ack: 2
    });
    const record = message();
    const result = await reconcilePendingZapiDeliveryV155(record);
    assert.equal(result.reconciled, false);
    assert.equal(result.reason, 'pending_callback_not_found');
    assert.equal(record.deliveryStatus, 'pending');
});

test('V155 integração estrutural guarda unmatched e reconcilia depois do Message.create', () => {
    const zapi = fs.readFileSync(new URL('../src/routes/zapi.js', import.meta.url), 'utf8');
    const whatsapp = fs.readFileSync(new URL('../src/routes/whatsapp.js', import.meta.url), 'utf8');
    const mirror = fs.readFileSync(new URL('../src/services/zapiOutboundMirrorService.js', import.meta.url), 'utf8');
    assert.match(zapi, /rememberUnmatchedZapiDeliveryV155/);
    assert.match(zapi, /pendingReconciliation: pending\.remembered === true/);
    assert.match(whatsapp, /reconcilePendingZapiDeliveryV155\(messageRecord\)/);
    assert.ok(whatsapp.indexOf('Message.create(manualRecord)') < whatsapp.indexOf('reconcilePendingDelivery(created)'));
    assert.ok(mirror.indexOf('Message.updateOne(') < mirror.indexOf('reconcilePendingZapiDeliveryV155(mirroredMessage)'));
});

test('V155 extrai somente callback unmatched do ID exato e preserva delivered sobre sent', () => {
    const log = [
        '2026-09-13T13:40:47.865Z | POST /api/zapi/webhook',
        '[ZAPI-WEBHOOK] delivery | matched=false | method=none | phone=5515998038637 | status=delivered | id=provider-race-1',
        '2026-09-13T13:40:48.049Z | POST /api/zapi/webhook',
        '[ZAPI-WEBHOOK] delivery | matched=false | method=none | phone=5515998038637 | status=sent | id=provider-race-1',
        '[ZAPI-WEBHOOK] delivery | matched=false | method=none | phone=5515998038637 | status=read | id=other-id'
    ].join('\n');
    const result = zapiDeliveryEvidenceFromLogV155(log, 'provider-race-1');
    assert.equal(result.found, true);
    assert.equal(result.occurrences, 2);
    assert.equal(result.strongest.deliveryStatus, 'delivered');
    assert.equal(result.strongest.ack, 2);
    assert.equal(result.strongest.observedAt, '2026-09-13T13:40:47.865Z');
});
