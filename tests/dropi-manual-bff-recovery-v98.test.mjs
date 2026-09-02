import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    assertDropiManualBffRecoveryV98,
    DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_COMMIT,
    DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_TREE
} from '../src/services/dropiManualBffRecoveryV98Service.js';

test('V98 vincula a correção manual Dropi à base operacional exata', () => {
    assert.equal(DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_COMMIT, 'bb5bf3d79d2b9e9fff0fbf5749478bdc8594385e');
    assert.equal(DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_TREE, 'e35037816173f2f2e17918e36d689602b8922c4b');
    assert.equal(assertDropiManualBffRecoveryV98().ready, true);
});

test('V98 é carregada antes da cadeia ancestral e fecha com seu runtime guard', () => {
    const context = fs.readFileSync(new URL('../scripts/lib/ec-runtime-successor-v97-context.mjs', import.meta.url), 'utf8');
    const manifest = context.indexOf('assertDropiManualBffRecoveryManifestV98()');
    const ancestor = context.indexOf('assertEcOperationalGuardContextManifestV97()');
    const runtimeGuard = context.indexOf('dropiManualBffRecoveryFreezeRuntimeGuardV98.js');
    assert.ok(manifest >= 0 && ancestor > manifest && runtimeGuard > ancestor);
});

test('V98 preserva envio manual, idempotência e isolamento operacional', () => {
    const manifest = JSON.parse(fs.readFileSync(new URL('../docs/freeze/dropi-manual-bff-recovery-v98-20260902.json', import.meta.url), 'utf8'));
    assert.equal(manifest.policy.manualDropiOnly, true);
    assert.equal(manifest.policy.automaticDropiSubmitAllowed, false);
    assert.equal(manifest.policy.idempotencyLookupBeforePost, true);
    for (const key of ['postSaleSchedulersChanged', 'whatsappOutboundChanged', 'funnelChanged', 'pricesChanged', 'externalVslFilesChanged', 'pixelDatasetChanged', 'databaseSchemaChanged', 'otherCountryTouched']) {
        assert.equal(manifest.policy[key], false, key);
    }
});
