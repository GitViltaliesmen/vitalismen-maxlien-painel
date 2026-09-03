import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { assertPostSaleEligibleBatchV108Manifest } from '../src/services/postSaleEligibleBatchV108Service.js';

test('dispatcher pula bloqueios antes do provider e limita uma tentativa elegível', () => {
    const source = fs.readFileSync('src/services/shipmentStatusDispatcherService.js', 'utf8');
    assert.match(source, /decidePostSaleNotification\(\{/);
    assert.match(source, /acquireLock: false/);
    assert.match(source, /preflight\.decision !== POST_SALE_NOTIFICATION_DECISIONS\.SHOULD_SEND/);
    assert.match(source, /attemptedEligible >= \(quota\.limit \|\| effectiveLimit\)/);
    assert.match(source, /attemptedEligible \+= 1/);
    assert.match(source, /processed: results\.length/);
    assert.doesNotMatch(source, /\.slice\(0, quota\.limit \|\| effectiveLimit\)/);
});

test('lote V105 relata o primeiro candidato realmente elegível', () => {
    const source = fs.readFileSync('scripts/post-sale-transactional-batch-v105.mjs', 'utf8');
    assert.match(source, /find\(\(item\) => item\?\.eligibleAttempt === true \|\| item\?\.success === true\)/);
    assert.match(source, /automaticRetry: false/);
});

test('containment arquiva autorização consumida sem liberar retry do lote único', () => {
    const source = fs.readFileSync('ops/post-sale-v105', 'utf8');
    assert.match(source, /archive_activation_bundle/);
    assert.match(source, /post-sale-v105-permit\.consumed\.json/);
    assert.match(source, /\.contained\.\$timestamp/);
    assert.doesNotMatch(source, /for source in[^;]*post-sale-v105-batch-one\.invoked/);
});

test('manifesto V108 congela preflight e limite externo unitário', () => {
    const result = assertPostSaleEligibleBatchV108Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.providerAttemptsMaxPerCycle, 1);
    assert.equal(result.manifest.policy.messageSendsMaxPerCycle, 1);
});
