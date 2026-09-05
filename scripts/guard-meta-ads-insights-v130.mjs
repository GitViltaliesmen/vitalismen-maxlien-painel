import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url));
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const assertMetaAdsInsightsV130 = () => {
    const manifest = JSON.parse(read('docs/freeze/meta-ads-insights-v130.json'));
    assert.equal(manifest.parentCommit, '360e0be94bf06e6cfac70018b422a92fb8c5d3a0');
    assert.equal(manifest.layer, 'META_ADS_READ_ONLY_INSIGHTS');
    assert.equal(manifest.primaryCountry, 'EC');
    assert.equal(manifest.additionalCountry, 'CO');
    assert.equal(manifest.policy.marketingApiReadOnly, true);
    assert.equal(manifest.policy.requiredPermission, 'ads_read');
    assert.equal(manifest.policy.apiVersion, 'v26.0');
    assert.equal(manifest.policy.countryAggregationAllowed, false);
    assert.equal(manifest.policy.campaignMutationAllowed, false);
    assert.equal(manifest.policy.budgetMutationAllowed, false);
    assert.equal(manifest.policy.capiRoutingChanged, false);
    assert.equal(manifest.policy.databaseSchemaChanged, false);
    assert.equal(manifest.policy.cacheOutsideRelease, true);
    assert.equal(hash(read('docs/freeze/manual-media-storage-v129.json')), manifest.parentManifestSha256);
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
    assertMetaAdsInsightsV130();
    console.log('META_ADS_INSIGHTS_V130=PASS');
}
