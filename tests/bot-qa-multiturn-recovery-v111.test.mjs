import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    claimEcQaInboundContextV78,
    isEcQaInboundMessagePayloadV111
} from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';
import { assertBotQaMultiturnRecoveryV111Manifest } from '../src/services/botQaMultiturnRecoveryV111Service.js';

const phone = '5515998038637';

test('V111 distingue inbound textual de callbacks de saída e entrega', () => {
    assert.equal(isEcQaInboundMessagePayloadV111({
        phone,
        messageId: 'inbound-received',
        status: 'RECEIVED',
        text: { message: '2 frascos' }
    }), true);
    assert.equal(isEcQaInboundMessagePayloadV111({
        phone,
        messageId: 'outbound-from-me',
        fromMe: true,
        text: { message: 'respuesta' }
    }), false);
    assert.equal(isEcQaInboundMessagePayloadV111({
        phone,
        messageId: 'delivery-status',
        status: 'DELIVERED'
    }), false);
    assert.equal(isEcQaInboundMessagePayloadV111({
        phone,
        messageId: 'delivery-ack',
        ack: 2
    }), false);
});

test('V111 não consome o claim QA em callback fromMe', async () => {
    let updates = 0;
    const result = await claimEcQaInboundContextV78({
        payload: {
            phone,
            messageId: 'provider-outbound-callback',
            fromMe: true,
            status: 'DELIVERED'
        },
        model: { updateOne: async () => { updates += 1; return { modifiedCount: 1 }; } },
        allowQaFollowUp: true
    });
    assert.equal(result.applicable, false);
    assert.equal(result.reason, 'qa_non_inbound_callback');
    assert.equal(updates, 0);
});

test('V111 renova o timestamp somente quando há atribuição VSL nova', () => {
    const source = fs.readFileSync('src/routes/zapi.js', 'utf8');
    assert.match(source, /const refreshedVslAttribution = Boolean\(attributedProductContext \|\| explicitTextProductContext\)/);
    assert.match(source, /vslEntryPanelLeadAt: refreshedVslAttribution\s*\? now\.toISOString\(\)/);
});

test('V111 valida a sucessão congelada sem liberar efeitos comerciais', () => {
    const result = assertBotQaMultiturnRecoveryV111Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.dropiChanged, false);
    assert.equal(result.manifest.policy.postSaleChanged, false);
    assert.equal(result.manifest.policy.externalEffectsAllowed, false);
});
