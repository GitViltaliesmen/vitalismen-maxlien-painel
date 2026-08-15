import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/routes/zapi.js', import.meta.url), 'utf8');

test('observacao Z-API retorna antes de alterar ContactState ou inferir leitura', () => {
    const observationGuard = source.indexOf('if (observationOnly) {');
    const readInference = source.indexOf('const readInference = await markPreviousOutboundReadFromCustomerReply');
    const contactStateRead = source.indexOf('const state = await ContactState.findOne', observationGuard);

    assert.ok(observationGuard > 0);
    assert.ok(readInference > observationGuard);
    assert.ok(contactStateRead > observationGuard);
    assert.match(source.slice(observationGuard, readInference), /observationOnly: true/);
    assert.match(source.slice(observationGuard, readInference), /routeToBot: false/);
});

test('os dois webhooks calculam observacao antes da persistencia completa', () => {
    const matches = source.match(/recordZapiInboundPayload\(payload, \{ observationOnly \}\)/g) || [];
    assert.equal(matches.length, 2);
    assert.match(source, /routed: 'inbound_observed_only'/);
});
