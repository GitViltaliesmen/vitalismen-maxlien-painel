import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_ANCESTOR_OVERRIDES,
    assertVitalismenEcQaReadPostSaleRecoveryV126Manifest
} from '../src/services/vitalismenEcQaReadPostSaleRecoveryV126Service.js';

test('V126 congela as quatro correções e preserva a baseline V125', () => {
    const result = assertVitalismenEcQaReadPostSaleRecoveryV126Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.parentCommit, '475ab887656bbb8865f3c16e42bec0d63e9421a6');
    assert.equal(result.manifest.parentTree, '9cc5f631db2d2cf1925d82703478cdda18921386');
    assert.equal(result.manifest.policy.qaPermanentBotTest, true);
    assert.equal(result.manifest.policy.panelHandledStatePersistent, true);
    assert.equal(result.manifest.policy.lifecycleActivationCursorRequired, true);
    assert.equal(result.manifest.policy.historicalBackfillAllowed, false);
    assert.equal(result.manifest.policy.productionChanged, false);
});

test('V126 declara apenas os ancestrais realmente alterados', () => {
    const expected = [
        'ops/post-sale-v116',
        'package.json',
        'public/qr.html',
        'scripts/lib/ec-runtime-successor-v97-context.mjs',
        'scripts/post-sale-transactional-batch-v116.mjs',
        'src/routes/orders.js',
        'src/routes/whatsapp.js',
        'src/routes/zapi.js',
        'src/services/agentRouter.js',
        'src/services/ecBotCoreRuntimeIntegrationV78Service.js',
        'src/services/panelReadStateService.js',
        'src/services/panelWarmupIsolationV118ManifestService.js',
        'src/services/shipmentMessageService.js',
        'src/services/shipmentStatusDispatcherService.js'
    ];
    assert.deepEqual(VITALISMEN_EC_QA_READ_POSTSALE_RECOVERY_V126_ANCESTOR_OVERRIDES, expected);
});

test('V126 não cria scheduler paralelo, backfill, replay, Dropi ou Meta', () => {
    const lifecycle = fs.readFileSync('src/services/postSaleLifecycleRecoveryV126Service.js', 'utf8');
    const executor = fs.readFileSync('ops/post-sale-v116', 'utf8');
    const reset = fs.readFileSync('scripts/reset-ec-qa-8637-v126.mjs', 'utf8');
    assert.match(lifecycle, /POST_SALE_LIFECYCLE_RECOVERY_V126_NOT_BEFORE/);
    assert.match(lifecycle, /reservePostSaleDailyQuotaV116/);
    assert.doesNotMatch(lifecycle, /setInterval|setTimeout/);
    assert.doesNotMatch(reset, /sendZapi|sendText|sendAudio|sendImage|sendPurchase|submitDrop/);
    assert.doesNotMatch(executor, /vitalismen-postsale-lifecycle-v126\.timer/);
});
