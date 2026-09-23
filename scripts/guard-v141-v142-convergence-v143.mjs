import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(read(file));

const V140_MANIFEST = 'docs/freeze/ec-phone-servientrega-reconciliation-v140-20260907.json';
const V141_MANIFEST = 'docs/freeze/ec-meta-funnel-reconciliation-v141-20260908.json';
const V142_MANIFEST = 'docs/freeze/ec-panel-new-dropi-persistence-v142-20260908.json';
const V143_MANIFEST = 'docs/freeze/ec-v141-v142-convergence-v143-20260908.json';

const verifyProtectedFiles = ({ protectedFiles, skipped = new Set(), label }) => {
    for (const [file, expected] of Object.entries(protectedFiles || {})) {
        if (skipped.has(file)) continue;
        assert.equal(sha256(read(file)), expected, `${label} protegida divergente: ${file}`);
    }
};

export const assertV141V142ConvergenceV143 = () => {
    const v140 = readJson(V140_MANIFEST);
    const v141 = readJson(V141_MANIFEST);
    const v142 = readJson(V142_MANIFEST);
    const v143 = readJson(V143_MANIFEST);

    assert.equal(sha256(read(V140_MANIFEST)), '6f48708daf7fa4c1726b9ac332985c886be692cecc4495d3dbfdd3465dc5fec1');
    assert.equal(sha256(read(V141_MANIFEST)), '7bf09f0406d15885279fad2a553ae83356077cf64f15f298e47d85f448a7d275');
    assert.equal(sha256(read(V142_MANIFEST)), '7c3eaf2e58f88e453394177101e5d6366e9ea1e66722b378f6fa370a4b835cdf');
    assert.equal(v141.parentCommit, v143.mergeBase);
    assert.equal(v142.parentCommit, v143.mergeBase);
    assert.equal(v143.v141Commit, '60001a0d689c1778b10025e9e4bdd4d1adf5a6c0');
    assert.equal(v143.v141Tree, '7a052ba928aa5101b57f1ddd87806f9440825bf1');
    assert.equal(v143.v142Commit, '7eed0f386eb88bcd7fd5b55c3316775ca3a362e1');
    assert.equal(v143.v142Tree, '77d2124342d40a2b340e0c3bea5bc7d269babb8a');

    const v141Overrides = new Set(v141.overrides || []);
    const v142Overrides = new Set(v142.overrides || []);
    const v143Overrides = new Set(v143.overrides || []);
    const successorOverrides = new Set(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []);
    const combinedOverrides = new Set([...v141Overrides, ...v142Overrides, ...v143Overrides, ...successorOverrides]);
    verifyProtectedFiles({ protectedFiles: v140.protectedFiles, skipped: combinedOverrides, label: 'V140' });
    verifyProtectedFiles({
        protectedFiles: v141.protectedFiles,
        skipped: new Set([...v143Overrides, ...successorOverrides, ...Object.keys(v141.protectedFiles || {}).filter((file) => v142Overrides.has(file))]),
        label: 'V141'
    });
    verifyProtectedFiles({
        protectedFiles: v142.protectedFiles,
        skipped: new Set([...v143Overrides, ...successorOverrides, ...Object.keys(v142.protectedFiles || {}).filter((file) => v141Overrides.has(file))]),
        label: 'V142'
    });
    verifyProtectedFiles({ protectedFiles: v143.protectedFiles, skipped: successorOverrides, label: 'V143' });

    const packageJson = read('package.json');
    const v97Context = read('scripts/lib/ec-runtime-successor-v97-context.mjs');
    const v140Guard = read('scripts/guard-ec-phone-servientrega-reconciliation-v140.mjs');
    const meta = read('src/services/metaAdsInsightsService.js');
    const metrics = read('src/services/funnelOperationalMetricsV141Service.js');
    const shipments = read('src/routes/shipments.js');
    const panel = read('public/qr.html');
    const panelPolicy = read('public/panel-intelligence/panel-new-dropi-persistence-v142.js');
    const whatsapp = read('src/routes/whatsapp.js');

    if (successorOverrides.has('package.json')) {
        assert.match(packageJson, /run-with-v144-context\.mjs/);
        assert.match(packageJson, /test:v144-all/);
    } else {
        assert.match(packageJson, /run-with-v143-context\.mjs/);
        assert.match(packageJson, /test:v143-all/);
    }
    if (successorOverrides.has('scripts/lib/ec-runtime-successor-v97-context.mjs')) {
        assert.match(v97Context, /^import '\.\/ec-runtime-successor-v144-bootstrap-context\.mjs';/);
    } else {
        assert.match(v97Context, /^import '\.\/ec-runtime-successor-v143-bootstrap-context\.mjs';/);
    }
    assert.match(v140Guard, /assertV141V142ConvergenceV143/);
    assert.match(v140Guard, /PASS_SUCCESSOR_V143/);

    assert.match(meta, /fetchStatus/);
    assert.match(meta, /creativeMapping/);
    assert.doesNotMatch(meta, /method:\s*['"]POST['"]/);
    assert.match(metrics, /event_history_in_canonical_window/);
    assert.match(shipments, /ensurePurchaseAfterHumanDropiSuccessV141/);
    assert.match(shipments, /dropiSubmitAuthorizedAt/);
    assert.match(shipments, /metaPurchaseSentAt/);

    assert.match(panel, /panel-new-dropi-persistence-v142\.js/);
    assert.match(panel, /isManualNewContactPending\?\.\(chat\)/);
    assert.match(panelPolicy, /configure-order/);
    assert.match(panelPolicy, /already_prepared/);
    assert.doesNotMatch(panelPolicy, /authorize-submit|submitDropiOrder/);
    assert.match(whatsapp, /manuallyCreatedAt: state\.metadata\?\.manuallyCreatedAt \|\| new Date\(\)\.toISOString\(\)/);

    assert.equal(v141.policy.vslChanged, false);
    assert.equal(v141.policy.realRetroPurchaseAllowed, false);
    assert.equal(v141.policy.metaAdsMutationAllowed, false);
    assert.equal(v142.policy.automaticDropiSend, false);
    assert.equal(v142.policy.automaticShipmentCreation, false);
    assert.equal(v142.policy.humanDropiAuthorizationRequired, true);
    assert.equal(v142.policy.dropiCallsOnSave, 0);
    assert.equal(v143.policy.productionChanged, false);
    assert.equal(v143.policy.realPurchaseTestSend, 0);
    assert.equal(v143.policy.crossLayerIsolation, true);
    assert.equal(v143.policy.vslProductionLock, true);
    return v143;
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    const manifest = assertV141V142ConvergenceV143();
    console.log('EC_V141_V142_CONVERGENCE_V143=PASS');
    console.log(`FREEZE_ID=${manifest.freezeId}`);
}
