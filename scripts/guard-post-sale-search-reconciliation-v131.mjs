import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url));
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const assertPostSaleSearchReconciliationV131 = () => {
    const manifest = JSON.parse(read('docs/freeze/post-sale-search-reconciliation-v131.json'));
    assert.equal(manifest.parentCommit, 'ef3b0b2ca24b2c176057ea8ff58576c16d944240');
    assert.equal(manifest.layer, 'EC_POSTSALE_SEARCH_AND_RECONCILIATION');
    assert.equal(manifest.country, 'EC');
    assert.equal(manifest.policy.globalSearchCrossesOperationalBuckets, true);
    assert.equal(manifest.policy.searchPreservesCountryAndIdentityGuards, true);
    assert.equal(manifest.policy.notificationMarkersVisible, true);
    assert.equal(manifest.policy.inTransitMarkerVisible, true);
    assert.equal(manifest.policy.manualHumanModeAllowedOnlyInsideTransactionalV116WithShipmentApproval, true);
    assert.equal(manifest.policy.inTransitStatusTakesPrecedenceOverLateGuide, true);
    assert.equal(manifest.policy.reconcileRecentSubmittedOrdersBeforeGuide, true);
    assert.equal(manifest.policy.reconciliationWindowDays, 7);
    assert.equal(manifest.policy.batchMax, 1);
    assert.equal(manifest.policy.dailyLimit, 1);
    assert.equal(manifest.policy.atMostOncePreserved, true);
    assert.equal(manifest.policy.automaticRetryAllowed, false);
    assert.equal(manifest.policy.dropiGlobalApplyEnabled, false);
    assert.equal(hash(read('docs/freeze/meta-ads-insights-v130.json')), manifest.parentManifestSha256);
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
        assert.equal(hash(read(file)), expected, file);
    }
    assert.equal(
        manifest.bundleSha256,
        hash(Object.entries(manifest.protectedFiles).map(([file, sha]) => `${file}\0${sha}\n`).join(''))
    );
    return manifest;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    assertPostSaleSearchReconciliationV131();
    console.log('POST_SALE_SEARCH_RECONCILIATION_V131=PASS');
}
