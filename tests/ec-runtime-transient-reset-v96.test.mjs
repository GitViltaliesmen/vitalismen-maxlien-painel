import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

await import('../scripts/lib/ec-runtime-successor-v97-context.mjs');
import { assertEcRuntimeTransientResetV96, EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_COMMIT, EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_TREE } from '../src/services/ecRuntimeTransientResetV96Service.js';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_NODE_OPTIONS } from '../src/services/ecOperationalGuardContextV97Service.js';

test('V96 vincula a sucessora ao commit e tree exatos da V95', () => {
    assert.equal(EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_COMMIT, '53f616cb2d885091028d1dbaa0090b5ad5d2d017');
    assert.equal(EC_RUNTIME_TRANSIENT_RESET_V96_PARENT_TREE, '603ffe82198723236878f67e11bcdc0e577deff6');
    const result = assertEcRuntimeTransientResetV96();
    assert.equal(result.ready, true);
    assert.equal(result.stagedOverlayPreserved, true);
    assert.equal(result.transientResetBound, true);
});

test('V96 preserva o overlay staged e limpa somente o ambiente PM2 transitório', () => {
    const helper = fs.readFileSync(new URL('../ops/vitalismen-stage', import.meta.url), 'utf8');
    const safeProfile = helper.slice(helper.indexOf('safe_profile_content() {'), helper.indexOf('safe_profile_sha256() {'));
    const safePm2 = helper.slice(helper.indexOf('safe_pm2() {'), helper.indexOf('verify_candidate_pm2_safe_env() {'));
    assert.doesNotMatch(safeProfile, /VITALISMEN_EC_BOT_CORE_/);
    assert.match(safePm2, /VITALISMEN_EC_BOT_CORE_OPERATIONAL=false/);
    assert.ok(helper.includes(`target_node_options="${EC_OPERATIONAL_GUARD_CONTEXT_V97_NODE_OPTIONS}"`));
});

test('V96 preserva as superfícies congeladas', () => {
    const manifest = JSON.parse(fs.readFileSync(new URL('../docs/freeze/ec-runtime-transient-reset-v96-20260830.json', import.meta.url), 'utf8'));
    for (const key of ['externalVslFilesChanged', 'desktopPageChanged', 'mobilePageChanged', 'pixelDatasetChanged', 'ctaChanged', 'databaseChanged', 'otherCountryTouched']) assert.equal(manifest.policy[key], false);
});
