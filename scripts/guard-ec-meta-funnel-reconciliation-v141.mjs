import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const assertEcMetaFunnelReconciliationV141 = () => {
    const manifestPath = 'docs/freeze/ec-meta-funnel-reconciliation-v141-20260908.json';
    const parentPath = 'docs/freeze/ec-phone-servientrega-reconciliation-v140-20260907.json';
    const manifest = JSON.parse(read(manifestPath));
    const parent = JSON.parse(read(parentPath));
    assert.equal(manifest.parentCommit, '13e752adc08cd089181eeebe2ff527dbe97f5fa9');
    assert.equal(manifest.parentTree, '2b9c9608d110979eb56d7025d08d3506b475c4fb');
    assert.equal(manifest.parentManifestSha256, sha256(read(parentPath)));
    for (const [file, expected] of Object.entries(parent.protectedFiles)) {
        if (manifest.overrides.includes(file)) continue;
        assert.equal(sha256(read(file)), expected, `V140 alterada fora do override V141: ${file}`);
    }
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
        assert.equal(sha256(read(file)), expected, `V141 protegida divergente: ${file}`);
    }

    const metrics = read('src/services/funnelOperationalMetricsV141Service.js');
    const route = read('src/routes/funnelMetrics.js');
    const meta = read('src/services/metaAdsInsightsService.js');
    const dashboard = read('public/funnel-metrics.html');
    const shipments = read('src/routes/shipments.js');
    assert.match(metrics, /event_history_in_canonical_window/);
    assert.match(metrics, /ZAPI_INBOUND_CAPTURED/);
    assert.match(metrics, /metaAttributed/);
    assert.match(route, /resolveFunnelMetricsRange/);
    assert.match(route, /MessageModel\.find/);
    assert.match(meta, /fetchStatus/);
    assert.match(meta, /creativeMapping/);
    assert.doesNotMatch(meta, /method:\s*['"]POST['"]/);
    assert.match(dashboard, /Dados insuficientes ou desatualizados/);
    assert.match(shipments, /ensurePurchaseAfterHumanDropiSuccessV141/);
    assert.match(shipments, /dropiSubmitAuthorizedAt/);
    assert.match(shipments, /metaPurchaseSentAt/);
    assert.equal(manifest.policy.vslChanged, false);
    assert.equal(manifest.policy.realRetroPurchaseAllowed, false);
    assert.equal(manifest.policy.automaticDropiSend, false);
    assert.equal(manifest.policy.automaticShipmentCreation, false);
    assert.equal(manifest.policy.humanDropiAuthorizationRequired, true);
    return manifest;
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    const manifest = assertEcMetaFunnelReconciliationV141();
    console.log('EC_META_FUNNEL_RECONCILIATION_V141=PASS');
    console.log(`FREEZE_ID=${manifest.freezeId}`);
}
