import assert from 'node:assert/strict';
import test from 'node:test';
import { Decimal128, ObjectId } from 'bson';
import {
    BASELINE_SCHEMA_VERSION,
    DEFAULT_COLLECTIONS,
    assertReadOnlyCommands,
    buildCollectionBaseline,
    buildDocumentFingerprint,
    canonicalStringify,
    criticalProjectionFor
} from '../scripts/audit-document-level-baseline-readonly.mjs';

test('contrato inclui exatamente as oito colecoes operacionais V71', () => {
    assert.equal(BASELINE_SCHEMA_VERSION, 'v2.document-level-readonly-v71');
    assert.deepEqual(DEFAULT_COLLECTIONS, [
        'shipments',
        'orders',
        'contactstates',
        'outbounddedupes',
        'messages',
        'dropisynccycles',
        'operational_safety_states',
        'vslvisits'
    ]);
});

test('serializacao canonica ordena chaves e normaliza tipos BSON', () => {
    const id = new ObjectId('64b64b64b64b64b64b64b64b');
    const decimal = Decimal128.fromString('35.99');
    const left = { z: 1, nested: { b: decimal, a: id }, at: new Date('2026-08-27T23:50:48.000Z') };
    const right = { at: new Date('2026-08-27T23:50:48.000Z'), nested: { a: id, b: decimal }, z: 1 };
    assert.equal(canonicalStringify(left), canonicalStringify(right));
    assert.match(canonicalStringify(left), /\$oid/);
    assert.match(canonicalStringify(left), /\$numberDecimal/);
    assert.match(canonicalStringify(left), /\$date/);
});

test('ordem de arrays permanece significativa', () => {
    assert.notEqual(canonicalStringify({ values: [1, 2] }), canonicalStringify({ values: [2, 1] }));
});

test('hash completo e hash critico separam mudanca operacional de campo nao critico', () => {
    const base = {
        _id: new ObjectId('64b64b64b64b64b64b64b64b'),
        orderId: 'EC-TEST-1',
        country: 'EC',
        logistics: { status: 'created' },
        automation: { postSaleSafetyLedger: {} },
        notes: 'antes',
        updatedAt: new Date('2026-08-27T23:40:00.000Z')
    };
    const nonCritical = { ...base, notes: 'depois' };
    const critical = { ...base, logistics: { status: 'shipped' } };
    const baseHash = buildDocumentFingerprint('shipments', base);
    const nonCriticalHash = buildDocumentFingerprint('shipments', nonCritical);
    const criticalHash = buildDocumentFingerprint('shipments', critical);

    assert.notEqual(baseHash.fullDocumentSha256, nonCriticalHash.fullDocumentSha256);
    assert.equal(baseHash.criticalFieldsSha256, nonCriticalHash.criticalFieldsSha256);
    assert.notEqual(baseHash.criticalFieldsSha256, criticalHash.criticalFieldsSha256);
});

test('baseline por documento independe da ordem de retorno do Mongo', () => {
    const first = { _id: 'b', providerStatus: 'sent', ack: 1, updatedAt: new Date('2026-08-27T23:00:00Z') };
    const second = { _id: 'a', providerStatus: 'read', ack: 3, updatedAt: new Date('2026-08-27T23:01:00Z') };
    const left = buildCollectionBaseline('messages', [first, second]);
    const right = buildCollectionBaseline('messages', [second, first]);

    assert.equal(left.aggregateSha256, right.aggregateSha256);
    assert.equal(left.documentCount, 2);
    assert.deepEqual(left.documents.map((item) => item._id), ['a', 'b']);
    assert.equal(left.documents[0].updatedAt, '2026-08-27T23:01:00.000Z');
});

test('projecao critica inclui os blocos que explicam writes de Shipment', () => {
    const projection = criticalProjectionFor('shipments', {
        automation: { postSaleSafetyLedger: { guide: { status: 'sent' } } },
        logistics: { status: 'in_transit' },
        review: { manualOnly: false }
    });
    assert.deepEqual(projection.automation, { postSaleSafetyLedger: { guide: { status: 'sent' } } });
    assert.deepEqual(projection.logistics, { status: 'in_transit' });
    assert.deepEqual(projection.review, { manualOnly: false });
});

test('VslVisit usa o documento inteiro como contrato critico', () => {
    const visit = { _id: 'visit-1', stage: 'cta', nested: { claimed: false } };
    assert.deepEqual(criticalProjectionFor('vslvisits', visit), visit);
    const fingerprint = buildDocumentFingerprint('vslvisits', visit);
    assert.equal(fingerprint.fullDocumentSha256, fingerprint.criticalFieldsSha256);
});

test('detector fail-closed rejeita qualquer comando Mongo mutante', () => {
    assert.equal(assertReadOnlyCommands(['hello', 'find', 'getMore', 'endSessions']), true);
    assert.throws(() => assertReadOnlyCommands(['find', 'update']), /Comando Mongo mutante observado: update/);
    assert.throws(() => assertReadOnlyCommands(['createIndexes']), /createindexes/);
});

test('colecao fora da allowlist e bloqueada', () => {
    assert.throws(() => buildCollectionBaseline('users', []), /Colecao fora da allowlist/);
});
