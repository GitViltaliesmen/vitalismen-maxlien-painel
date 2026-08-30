import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    assertOfficialAuditSuccessorV92,
    OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_COMMIT,
    OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_TREE
} from '../src/services/officialAuditSuccessorV92Service.js';

test('V92 vincula a propagação ao commit e tree exatos da V91', () => {
    assert.equal(OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_COMMIT, '92b710e460b3ff3631be856161bd0e307e124981');
    assert.equal(OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_TREE, '965f53a1fd6e5872445086f186a169eeafd84b28');
    const result = assertOfficialAuditSuccessorV92();
    assert.equal(result.ready, true);
    assert.equal(result.officialAuditChildContextBound, true);
});

test('V92 entrega o preload somente ao filho do audit oficial', () => {
    const helper = fs.readFileSync(new URL('../ops/vitalismen-stage', import.meta.url), 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const audit = fs.readFileSync(new URL('../scripts/official-state-audit.mjs', import.meta.url), 'utf8');
    const seniorGuard = fs.readFileSync(new URL('../scripts/senior-guard.mjs', import.meta.url), 'utf8');
    assert.match(helper, /VITALISMEN_OFFICIAL_AUDIT_NODE_OPTIONS="\$release_guard_node_options"/);
    assert.match(audit, /childEnv\.NODE_OPTIONS = successorNodeOptions/);
    assert.match(audit, /delete childEnv\.VITALISMEN_OFFICIAL_AUDIT_NODE_OPTIONS/);
    assert.doesNotMatch(audit, /process\.env\.NODE_OPTIONS\s*=/);
    assert.doesNotMatch(packageJson.scripts['senior:check'], /guard:canary-controller-pm2-stdin-v77h/);
    assert.doesNotMatch(packageJson.scripts['senior:check'], /guard:canary-controller-health-policy-v77h2/);
    assert.match(seniorGuard, /'src\/services\/ecVslDashboardIngressV90Service\.js'/);
    assert.match(seniorGuard, /'docs\/DEPLOY_GUARD_ANCESTRY_SUCCESSOR_FREEZE_V91_20260830\.md'/);
});

test('V92 preserva as superfícies congeladas', () => {
    const manifest = JSON.parse(fs.readFileSync(
        new URL('../docs/freeze/official-audit-successor-v92-20260830.json', import.meta.url),
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
