import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

await import('../scripts/lib/ec-runtime-successor-v97-context.mjs');

import {
    assertEcRuntimeCurrentBindingV94,
    EC_RUNTIME_CURRENT_BINDING_V94_PARENT_COMMIT,
    EC_RUNTIME_CURRENT_BINDING_V94_PARENT_TREE
} from '../src/services/ecRuntimeCurrentBindingV94Service.js';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_NODE_OPTIONS } from '../src/services/ecOperationalGuardContextV97Service.js';

test('V94 vincula a sucessora ao commit e tree exatos da V93', () => {
    assert.equal(EC_RUNTIME_CURRENT_BINDING_V94_PARENT_COMMIT, 'cec3b934246b9883727d4bbfccf1a9cc1775911d');
    assert.equal(EC_RUNTIME_CURRENT_BINDING_V94_PARENT_TREE, '88ada004cf07ffe5e44bf279c75af65f35d75ec5');
    const result = assertEcRuntimeCurrentBindingV94();
    assert.equal(result.ready, true);
    assert.equal(result.stageUsesPhysicalRelease, true);
    assert.equal(result.pm2UsesCurrentSymlink, true);
});

test('V94 separa o preload físico do stage do preload estável do PM2', () => {
    const helper = fs.readFileSync(new URL('../ops/vitalismen-stage', import.meta.url), 'utf8');
    const restart = fs.readFileSync(new URL('../scripts/lib/pm2-target-env-restart-v89.mjs', import.meta.url), 'utf8');
    const operational = fs.readFileSync(new URL('../src/services/ecBotCoreOperationalV78Service.js', import.meta.url), 'utf8');
    assert.match(helper, /preload_path="\$candidate_dir\/scripts\/lib\/ec-runtime-successor-v97-context\.mjs"/);
    assert.ok(helper.includes(`target_node_options="${EC_OPERATIONAL_GUARD_CONTEXT_V97_NODE_OPTIONS}"`));
    assert.ok(restart.includes(EC_OPERATIONAL_GUARD_CONTEXT_V97_NODE_OPTIONS));
    assert.ok(operational.includes(EC_OPERATIONAL_GUARD_CONTEXT_V97_NODE_OPTIONS));
});

test('V94 preserva todas as superfícies congeladas', () => {
    const manifest = JSON.parse(fs.readFileSync(
        new URL('../docs/freeze/ec-runtime-current-binding-v94-20260830.json', import.meta.url),
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
