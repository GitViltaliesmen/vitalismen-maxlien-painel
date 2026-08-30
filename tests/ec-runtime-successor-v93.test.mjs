import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    assertEcRuntimeSuccessorV93,
    EC_RUNTIME_SUCCESSOR_V93_NODE_OPTIONS,
    EC_RUNTIME_SUCCESSOR_V93_PARENT_COMMIT,
    EC_RUNTIME_SUCCESSOR_V93_PARENT_TREE
} from '../src/services/ecRuntimeSuccessorV93Service.js';

test('V93 vincula o boot PM2 ao commit e tree exatos da V92', () => {
    assert.equal(EC_RUNTIME_SUCCESSOR_V93_PARENT_COMMIT, '929062a04c7e2488eed89b570c562a424e620f05');
    assert.equal(EC_RUNTIME_SUCCESSOR_V93_PARENT_TREE, 'fc6389b11bfb4bc7838f682729eb714902c73108');
    const result = assertEcRuntimeSuccessorV93();
    assert.equal(result.ready, true);
    assert.equal(result.pm2TargetContextBound, true);
});

test('V93 limpa o controlador e injeta somente o preload no processo alvo', () => {
    const helper = fs.readFileSync(new URL('../ops/vitalismen-stage', import.meta.url), 'utf8');
    const restart = fs.readFileSync(new URL('../scripts/lib/pm2-target-env-restart-v89.mjs', import.meta.url), 'utf8');
    const operational = fs.readFileSync(new URL('../src/services/ecBotCoreOperationalV78Service.js', import.meta.url), 'utf8');
    assert.match(helper, /pm2_controller_env=\(NODE_OPTIONS= npm_config_node_options= NPM_CONFIG_NODE_OPTIONS=\)/);
    assert.match(helper, /scripts\/lib\/pm2-target-env-restart-v89\.mjs/);
    assert.match(restart, /controller_node_options_must_start_empty/);
    assert.match(restart, /process\.env\.NODE_OPTIONS = targetNodeOptions/);
    assert.ok(restart.includes(EC_RUNTIME_SUCCESSOR_V93_NODE_OPTIONS));
    assert.ok(operational.includes(EC_RUNTIME_SUCCESSOR_V93_NODE_OPTIONS));
});

test('V93 preserva as superfícies congeladas', () => {
    const manifest = JSON.parse(fs.readFileSync(
        new URL('../docs/freeze/ec-runtime-successor-v93-20260830.json', import.meta.url),
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
