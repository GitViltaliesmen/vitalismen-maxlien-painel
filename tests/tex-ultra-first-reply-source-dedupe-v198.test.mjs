import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    buildSourceScopedOutboundDedupeValue,
    fingerprintOutbound
} from '../src/services/outboundDedupeService.js';
import {
    V198_ALLOWED_COMMAND,
    V198_PRELOAD_PATH,
    readV198Manifest
} from '../scripts/run-with-v198-senior-check-context.mjs';

const responseText = '¡Perfecto! Para continuar con su pedido de Tex Ultra, ¿qué opción desea reservar: 1, 2, 3 o 6 frascos?';
const namespace = 'tex_ultra_purchase_intent_after_interrupt';

const identityFor = (sourceMessageId) => buildSourceScopedOutboundDedupeValue({
    namespace,
    sourceMessageId,
    kind: 'text',
    value: responseText
});

test('o mesmo inbound mantém uma identidade única e bloqueia a segunda reserva', () => {
    const ledger = new Set();
    const identity = identityFor('SOURCE-MESSAGE-ONE');

    assert.ok(identity);
    assert.equal(identity, identityFor('SOURCE-MESSAGE-ONE'));
    assert.equal(ledger.has(identity), false);
    ledger.add(identity);
    assert.equal(ledger.has(identityFor('SOURCE-MESSAGE-ONE')), true);
});

test('um novo inbound permite uma resposta com o mesmo texto e bloqueia sua repetição', () => {
    const ledger = new Set([identityFor('SOURCE-MESSAGE-ONE')]);
    const nextIdentity = identityFor('SOURCE-MESSAGE-TWO');

    assert.notEqual(nextIdentity, identityFor('SOURCE-MESSAGE-ONE'));
    assert.equal(ledger.has(nextIdentity), false);
    ledger.add(nextIdentity);
    assert.equal(ledger.has(identityFor('SOURCE-MESSAGE-TWO')), true);
});

test('o fingerprint histórico permanece separado e nenhuma identidade é criada sem sourceMessageId', () => {
    const historicalFingerprint = fingerprintOutbound({ kind: 'text', value: responseText });
    const scopedFingerprint = fingerprintOutbound({ kind: 'text', value: identityFor('SOURCE-MESSAGE-THREE') });

    assert.equal(historicalFingerprint, '25864c320b26b1b8e03f8b1acbb5d20f01569160');
    assert.notEqual(scopedFingerprint, historicalFingerprint);
    assert.equal(identityFor(''), '');
});

test('a ativação fica confinada ao contexto Tex Ultra autorizado', () => {
    const funnelSource = fs.readFileSync(new URL('../src/services/texUltraFunnelService.js', import.meta.url), 'utf8');

    assert.match(funnelSource, /context === 'tex_ultra_purchase_intent_after_interrupt'/);
    assert.match(funnelSource, /sourceMessageId\s*\n\s*}\);/);
    assert.match(funnelSource, /sourceScopedDedupeValue \|\| `\$\{AGENT_KEY}:\$\{context}:\$\{state\._id}`/);
    assert.match(funnelSource, /\.\.\.\(sourceScopedDedupeValue \? \{ dedupeValue: sourceScopedDedupeValue } : \{}\)/);
});

test('V198 declara sucessão auditável sem alterar ledger ou relaxar anti-spam', () => {
    const manifest = readV198Manifest();

    assert.equal(manifest.canonicalPreload, V198_PRELOAD_PATH);
    assert.deepEqual(manifest.allowedCommands, [V198_ALLOWED_COMMAND]);
    assert.equal(manifest.policy.sameSourceDuplicateBlocked, true);
    assert.equal(manifest.policy.newSourceSameTextAllowedOnce, true);
    assert.equal(manifest.policy.historicalLedgerMutationAllowed, false);
    assert.equal(manifest.policy.globalDedupeDisabled, false);
    assert.equal(manifest.policy.globalAntiSpamRelaxed, false);
    assert.equal(manifest.policy.productionChanged, false);
    assert.equal(manifest.policy.guardsBypassed, false);
});
