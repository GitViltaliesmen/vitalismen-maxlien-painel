import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    assertEcRuntimeSafeResetV95,
    EC_RUNTIME_SAFE_RESET_V95_NODE_OPTIONS,
    EC_RUNTIME_SAFE_RESET_V95_PARENT_COMMIT,
    EC_RUNTIME_SAFE_RESET_V95_PARENT_TREE
} from '../src/services/ecRuntimeSafeResetV95Service.js';

test('V95 vincula a sucessora ao commit e tree exatos da V94', () => {
    assert.equal(EC_RUNTIME_SAFE_RESET_V95_PARENT_COMMIT, 'a2a8137fb5ce8f30187ba84824e226871db9409b');
    assert.equal(EC_RUNTIME_SAFE_RESET_V95_PARENT_TREE, 'f0a506d82fca39a23b3e86ee5a69edb0afbac141');
    const result = assertEcRuntimeSafeResetV95();
    assert.equal(result.ready, true);
    assert.equal(result.safeOperationalIdentityReset, true);
    assert.equal(result.pm2UsesCurrentSymlink, true);
});

test('V95 limpa a identidade operacional residual no perfil seguro', () => {
    const helper = fs.readFileSync(new URL('../ops/vitalismen-stage', import.meta.url), 'utf8');
    assert.ok((helper.match(/VITALISMEN_EC_BOT_CORE_OPERATIONAL=false/g) || []).length >= 2);
    assert.match(helper, /VITALISMEN_EC_BOT_CORE_OPERATIONAL: "false"/);
    assert.match(helper, /VITALISMEN_EC_BOT_CORE_PROFILE_VERSION=/);
    assert.match(helper, /VITALISMEN_EC_BOT_CORE_PROFILE_SHA256=/);
    assert.ok(helper.includes(`target_node_options="${EC_RUNTIME_SAFE_RESET_V95_NODE_OPTIONS}"`));
});

test('V95 preserva todas as superfícies congeladas', () => {
    const manifest = JSON.parse(fs.readFileSync(
        new URL('../docs/freeze/ec-runtime-safe-reset-v95-20260830.json', import.meta.url),
        'utf8'
    ));
    assert.equal(manifest.policy.externalVslFilesChanged, false);
    assert.equal(manifest.policy.desktopPageChanged, false);
    assert.equal(manifest.policy.mobilePageChanged, false);
    assert.equal(manifest.policy.pixelDatasetChanged, false);
    assert.equal(manifest.policy.ctaChanged, false);
    assert.equal(manifest.policy.databaseChanged, false);
    assert.equal(manifest.policy.otherCountryTouched, false);
});
