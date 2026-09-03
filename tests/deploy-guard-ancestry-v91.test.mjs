import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    assertDeployGuardAncestryV91,
    DEPLOY_GUARD_ANCESTRY_V91_PARENT_COMMIT,
    DEPLOY_GUARD_ANCESTRY_V91_PARENT_TREE
} from '../src/services/deployGuardAncestryV91Service.js';

test('V91 vincula a correção ao commit e tree exatos da V90', () => {
    assert.equal(DEPLOY_GUARD_ANCESTRY_V91_PARENT_COMMIT, '66c7d9db10509643a914c92044dd954617870727');
    assert.equal(DEPLOY_GUARD_ANCESTRY_V91_PARENT_TREE, '054517ac70bead118d8874bf94be7862672895cb');
    const result = assertDeployGuardAncestryV91();
    assert.equal(result.ready, true);
    assert.equal(result.helperChangedOnlyForGuardContext, true);
});

test('V91 injeta contexto somente nos subprocessos npm dos guards', () => {
    const helper = fs.readFileSync(new URL('../ops/vitalismen-stage', import.meta.url), 'utf8');
    assert.match(helper, /successor_guard_node_options\(\)/);
    assert.match(helper, /npm_config_node_options="\$release_guard_node_options"/);
    assert.match(helper, /npm_config_node_options="\$candidate_guard_node_options"/);
    assert.doesNotMatch(helper, /export npm_config_node_options="\$release_guard_node_options"/);
    const v77h2Guard = fs.readFileSync(new URL(
        '../src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js',
        import.meta.url
    ), 'utf8');
    assert.match(v77h2Guard, /!successorOverrides\.has\('ops\/vitalismen-stage'\)/);
    const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(
        packageJson.scripts['guard:predeploy-v71'],
        'node scripts/run-deploy-guard-ancestry-predeploy-v91.mjs'
    );
});

test('V91 preserva explicitamente as superfícies congeladas', () => {
    const manifest = JSON.parse(fs.readFileSync(
        new URL('../docs/freeze/deploy-guard-ancestry-successor-v91-20260830.json', import.meta.url),
        'utf8'
    ));
    assert.equal(manifest.policy.externalVslFilesChanged, false);
    assert.equal(manifest.policy.desktopPageChanged, false);
    assert.equal(manifest.policy.mobilePageChanged, false);
    assert.equal(manifest.policy.pixelDatasetChanged, false);
    assert.equal(manifest.policy.ctaChanged, false);
    assert.equal(manifest.policy.databaseChanged, false);
    assert.equal(manifest.policy.colombiaTouched, false);
});
