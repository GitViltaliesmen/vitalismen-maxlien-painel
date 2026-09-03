import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    buildPostSaleQuotaIdV116,
    classifyPostSaleProviderFailureV116,
    postSaleFailureDispositionV116,
    reservePostSaleDailyQuotaV116
} from '../src/services/postSaleTransactionalSafetyV116Service.js';
import {
    completePostSaleNotificationStage,
    failPostSaleNotificationStage
} from '../src/services/postSaleNotificationDecisionService.js';
import { POST_SALE_TERMINAL_LEDGER_STATES } from '../src/services/postSaleSafetyV66Service.js';
import { assertPostSaleTransactionalSafetyV116Manifest } from '../src/services/postSaleTransactionalSafetyV116ManifestService.js';

const shipment = () => ({
    _id: 'shipment-v116',
    country: 'EC',
    orderId: 'ORDER-V116',
    logistics: { trackingNumber: 'TRACK-V116' },
    automation: { notificationLocks: {}, postSaleSafetyLedger: {} }
});

test('V116 reserva a cota diária de forma atômica e um segundo worker perde', async () => {
    let reserved = 0;
    const updates = [];
    const quotaModel = {
        async findOneAndUpdate(query, update) {
            updates.push(update);
            await new Promise((resolve) => setImmediate(resolve));
            if (reserved >= query.reserved.$lt) {
                const error = new Error('duplicate key');
                error.code = 11000;
                throw error;
            }
            reserved += update.$inc.reserved;
            return { _id: query._id, reserved };
        }
    };
    const input = {
        dayKey: '2026-09-03',
        timeZone: 'America/Guayaquil',
        dailyLimit: 1,
        correlationId: 'ps66:test',
        quotaModel
    };
    const results = await Promise.all([
        reservePostSaleDailyQuotaV116(input),
        reservePostSaleDailyQuotaV116(input)
    ]);
    assert.equal(results.filter((result) => result.reserved).length, 1);
    assert.equal(results.filter((result) => result.reason === 'daily_quota_exhausted').length, 1);
    assert.equal(buildPostSaleQuotaIdV116(input), results[0].quotaId);
    assert.equal(Object.hasOwn(updates[0].$setOnInsert, 'reserved'), false);
});

test('V116 trata timeout e 5xx como ambíguos, sem retry deliberado', () => {
    const timeout = classifyPostSaleProviderFailureV116(Object.assign(new Error('send timeout'), { code: 'ETIMEDOUT' }));
    const serverError = classifyPostSaleProviderFailureV116({ message: 'gateway', response: { status: 502, data: {} } });
    assert.equal(timeout.terminalState, 'AMBIGUOUS');
    assert.equal(timeout.ambiguous, true);
    assert.equal(serverError.terminalState, 'AMBIGUOUS');
    assert.equal(postSaleFailureDispositionV116({ ok: false, providerAttempted: true, ambiguous: true }).terminalState, 'AMBIGUOUS');
});

test('V116 trata 4xx definitivo como falha terminal e não repetível', () => {
    const rejected = classifyPostSaleProviderFailureV116({ message: 'invalid payload', response: { status: 422, data: {} } });
    assert.equal(rejected.terminalState, 'FAILED_FINAL');
    assert.equal(rejected.ambiguous, false);
    assert.equal(POST_SALE_TERMINAL_LEDGER_STATES.includes('FAILED_FINAL'), true);
});

test('V116 persiste falha ambígua no ledger terminal e libera somente o lock proprietário', async () => {
    const writes = [];
    const model = {
        async updateOne(query, update) {
            writes.push({ query, update });
            return { modifiedCount: 1 };
        }
    };
    const result = await failPostSaleNotificationStage({
        shipment: shipment(),
        stage: 'GUIDE',
        variant: 'guide_text',
        lockToken: 'owner-v116',
        reason: 'provider_timeout',
        terminal: true,
        terminalState: 'AMBIGUOUS',
        providerStatus: 'ambiguous',
        shipmentModel: model
    });
    assert.equal(result.terminal, true);
    assert.equal(writes[0].query['automation.notificationLocks.GUIDE.token'], 'owner-v116');
    assert.equal(writes[0].update.$set['automation.postSaleSafetyLedger.GUIDE'].state, 'AMBIGUOUS');
    assert.equal(POST_SALE_TERMINAL_LEDGER_STATES.includes('AMBIGUOUS'), true);
});

test('V116 não converte aceite sem provider ID em SENT', async () => {
    const writes = [];
    const model = {
        async updateOne(query, update) {
            writes.push({ query, update });
            return { modifiedCount: 1 };
        }
    };
    const result = await completePostSaleNotificationStage({
        shipment: shipment(),
        stage: 'IN_TRANSIT',
        lockToken: 'owner-v116',
        providerMessageId: '',
        shipmentModel: model
    });
    assert.equal(result.completed, false);
    assert.equal(result.terminal, true);
    assert.equal(writes[0].update.$set['automation.postSaleSafetyLedger.IN_TRANSIT'].state, 'AMBIGUOUS');
});

test('V116 congela no código cota persistente, dedupe sem retry e transporte de tentativa única', () => {
    const dispatcher = fs.readFileSync(new URL('../src/services/shipmentStatusDispatcherService.js', import.meta.url), 'utf8');
    const dedupe = fs.readFileSync(new URL('../src/services/outboundDedupeService.js', import.meta.url), 'utf8');
    const text = fs.readFileSync(new URL('../src/whatsapp/sendText.js', import.meta.url), 'utf8');
    assert.match(dispatcher, /reservePostSaleDailyQuotaV116/);
    assert.match(dedupe, /retryAllowed/);
    assert.match(dedupe, /status: 'ambiguous'/);
    assert.match(text, /const maxAttempts = postSaleTransactionalOutbound\(options\) \? 1 : 2/);
    assert.match(text, /markOutboundDedupeAmbiguous/);
});

test('V116 separa observer e executor, serializa ciclos e preserva a cadência oficial de 60 minutos', () => {
    const observer = fs.readFileSync(new URL('../ops/post-sale-next-eligible-v114', import.meta.url), 'utf8');
    const executor = fs.readFileSync(new URL('../ops/post-sale-v116', import.meta.url), 'utf8');
    const timer = fs.readFileSync(new URL('../ops/systemd/vitalismen-postsale-transactional-v116.timer', import.meta.url), 'utf8');
    assert.doesNotMatch(observer, /post-sale[^\n]*\srun\b|batch-run|permit.*consumido/i);
    assert.match(executor, /flock -n 9/);
    assert.match(executor, /post-sale-transactional-batch-v116\.mjs run/);
    assert.match(timer, /OnUnitActiveSec=60min/);
});

test('V116 mantém os guards comerciais antigos vinculados aos hashes exatos do sucessor V115', () => {
    const panelManifestService = fs.readFileSync(
        new URL('../src/services/ecPanelRuntimeRecoveryV115Service.js', import.meta.url),
        'utf8'
    );
    assert.match(panelManifestService, /modified\.has\(relativePath\) \|\| successorOverrides\.has\(relativePath\)/);
    for (const relativePath of [
        '../scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs',
        '../scripts/guard-protocolo-g-conversion-v62.mjs',
        '../scripts/guard-protocolo-g-ad-metrics-v63.mjs'
    ]) {
        const guard = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
        assert.match(guard, /ec-panel-runtime-recovery-v115-20260903\.json/);
        assert.match(guard, /v115Manifest\.declaredAncestorOverrides/);
        assert.match(guard, /v115Manifest\.protectedFiles/);
    }
    const seniorGuard = fs.readFileSync(new URL('../scripts/senior-guard.mjs', import.meta.url), 'utf8');
    assert.match(seniorGuard, /'src\/services\/postSaleTransactionalSafetyV116ManifestService\.js'/);
});

test('manifesto V116 protege o executor, quota, ledger e transportes alterados', () => {
    const result = assertPostSaleTransactionalSafetyV116Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.persistentAtomicDailyQuota, true);
    assert.equal(result.manifest.policy.ambiguousFailureTerminal, true);
    assert.equal(result.manifest.policy.automaticRetryAllowed, false);
});
