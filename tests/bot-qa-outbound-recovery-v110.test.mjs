import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { shouldDetectFreshEcVslTextContextV110 } from '../src/routes/zapi.js';
import {
    claimEcQaInboundContextV78,
    EC_QA_TEST_MAX_MESSAGES_V110,
    finalizeEcQaInboundContextV78
} from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';
import {
    applyEcQaTestResetToStateV78,
    createEcQaTestPermitV78,
    EC_QA_TEST_PHONE_V78
} from '../src/services/ecQaTestResetV78Service.js';
import { EC_OFFICIAL_VSL_V78_MESSAGE } from '../src/services/ecOfficialVslEntryV78Service.js';

const eligibleState = () => ({
    chatId: `${EC_QA_TEST_PHONE_V78}@c.us`,
    phoneDigits: EC_QA_TEST_PHONE_V78,
    human: {
        mode: 'manual',
        pausedUntil: new Date('2036-08-30T07:04:49.501Z')
    },
    tags: ['TESTE_8637_PRIORIDADE', 'TESTE_FIXO_NAO_MEXER', 'BOT_TESTE_LIBERADO'],
    metadata: {
        testOnly: true,
        botTestEnabled: true,
        fullFunnelTestEnabled: true,
        vslProductKey: 'tex_ultra_ec'
    }
});

test('V110 renova contexto textual quando o vslProductKey persistido ficou antigo', () => {
    assert.equal(shouldDetectFreshEcVslTextContextV110({
        persistedVslProductContext: null,
        vslRoutingAllowed: true
    }), true);
    assert.equal(shouldDetectFreshEcVslTextContextV110({
        persistedVslProductContext: { productKey: 'tex_ultra_ec' },
        vslRoutingAllowed: true
    }), false);
    assert.equal(shouldDetectFreshEcVslTextContextV110({
        persistedVslProductContext: null,
        vslRoutingAllowed: false
    }), false);
});

test('V110 inicia a janela QA com contador e ledger de IDs vazios', () => {
    const now = new Date('2026-09-03T05:00:00.000Z');
    const permit = createEcQaTestPermitV78({
        phone: EC_QA_TEST_PHONE_V78,
        now,
        randomBytes: () => Buffer.alloc(16, 1)
    });
    const result = applyEcQaTestResetToStateV78({
        state: eligibleState(),
        phone: EC_QA_TEST_PHONE_V78,
        permit,
        now
    });
    assert.equal(result.changed, true);
    assert.equal(result.state.human.mode, 'auto');
    assert.equal(result.state.metadata.qaTestContextV78.messageCount, 0);
    assert.deepEqual(result.state.metadata.qaTestContextV78.processedMessageIds, []);
});

test('V110 mantém a primeira entrada presa à assinatura oficial', async () => {
    const calls = [];
    const model = {
        async updateOne(query, update) {
            calls.push({ query, update });
            return { modifiedCount: 1 };
        }
    };
    const result = await claimEcQaInboundContextV78({
        payload: {
            phone: EC_QA_TEST_PHONE_V78,
            messageId: 'provider-v110-initial',
            text: { message: EC_OFFICIAL_VSL_V78_MESSAGE }
        },
        model,
        allowQaFollowUp: true,
        now: new Date('2026-09-03T05:01:00.000Z')
    });
    assert.equal(result.allowed, true);
    assert.equal(result.phase, 'initial');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].query['metadata.qaTestContextV78.status'], 'armed');
});

test('V110 aceita follow-up somente na sessão consumida, exata, vigente e limitada', async () => {
    const calls = [];
    const model = {
        async updateOne(query, update) {
            calls.push({ query, update });
            return { modifiedCount: 1 };
        }
    };
    const result = await claimEcQaInboundContextV78({
        payload: {
            phone: EC_QA_TEST_PHONE_V78,
            messageId: 'provider-v110-followup',
            text: { message: '2 frascos' }
        },
        model,
        allowQaFollowUp: true,
        now: new Date('2026-09-03T05:02:00.000Z')
    });
    assert.equal(result.allowed, true);
    assert.equal(result.phase, 'followup');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].query.phoneDigits, EC_QA_TEST_PHONE_V78);
    assert.equal(calls[0].query['metadata.qaTestContextV78.status'], 'consumed');
    assert.deepEqual(calls[0].query['metadata.qaTestContextV78.messageCount'], {
        $lt: EC_QA_TEST_MAX_MESSAGES_V110
    });
    assert.deepEqual(calls[0].query['metadata.qaTestContextV78.processedMessageIds'], {
        $ne: 'provider-v110-followup'
    });
    assert.equal(calls[0].update.$set['metadata.qaTestContextV78.routingPhase'], 'followup');
});

test('V110 não abre follow-up sem autorização explícita do middleware', async () => {
    let calls = 0;
    const result = await claimEcQaInboundContextV78({
        payload: {
            phone: EC_QA_TEST_PHONE_V78,
            messageId: 'provider-v110-no-followup',
            text: { message: '2 frascos' }
        },
        model: { updateOne: async () => { calls += 1; return { modifiedCount: 1 }; } }
    });
    assert.equal(result.allowed, false);
    assert.equal(calls, 0);
});

test('V110 finaliza cada ID uma vez e incrementa o teto da sessão', async () => {
    const calls = [];
    const result = await finalizeEcQaInboundContextV78({
        claim: {
            applicable: true,
            allowed: true,
            messageId: 'provider-v110-followup',
            phase: 'followup'
        },
        model: {
            async updateOne(query, update) {
                calls.push({ query, update });
                return { modifiedCount: 1 };
            }
        },
        statusCode: 200,
        now: new Date('2026-09-03T05:03:00.000Z')
    });
    assert.equal(result.changed, true);
    assert.equal(calls[0].query.phoneDigits, EC_QA_TEST_PHONE_V78);
    assert.equal(calls[0].query['metadata.qaTestContextV78.status'], 'routing');
    assert.equal(calls[0].update.$addToSet['metadata.qaTestContextV78.processedMessageIds'], 'provider-v110-followup');
    assert.equal(calls[0].update.$inc['metadata.qaTestContextV78.messageCount'], 1);
});

test('V110 permanece restrita ao QA e não toca pedido, Dropi, Meta ou pós-venda', () => {
    const integration = fs.readFileSync('src/services/ecBotCoreRuntimeIntegrationV78Service.js', 'utf8');
    const reset = fs.readFileSync('src/services/ecQaTestResetV78Service.js', 'utf8');
    const zapi = fs.readFileSync('src/routes/zapi.js', 'utf8');
    const successorGuard = fs.readFileSync('src/services/protocoloGSuccessorGuardV101Service.js', 'utf8');
    const postSaleControl = fs.readFileSync('src/services/postSaleTransactionalControlPlaneV105Service.js', 'utf8');
    assert.match(integration, /EC_QA_TEST_MAX_MESSAGES_V110 = 8/);
    assert.match(integration, /allowQaFollowUp: true/);
    assert.match(integration, /phoneDigits: EC_QA_TEST_PHONE_V78/);
    assert.match(reset, /messageCount: 0/);
    assert.match(zapi, /shouldDetectFreshEcVslTextContextV110/);
    assert.match(successorGuard, /v110SuccessorIdentityAccepted/);
    assert.match(postSaleControl, /modified\.has\(relativePath\) \|\| successorOverrides\.has\(relativePath\)/);
    for (const source of [integration, reset]) {
        assert.doesNotMatch(source, /submitDroppiEcuadorOrder|sendMetaPurchase|Shipment\.(?:create|update|delete)/);
    }
});
