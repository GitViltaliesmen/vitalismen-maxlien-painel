import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url));
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const assertInvestmentRadarV134 = () => {
    const manifest = JSON.parse(read('docs/freeze/investment-radar-v134-20260905.json'));
    assert.equal(manifest.parentCommit, '6378d7d1c276a39a397b0639052142d171ef0b82');
    assert.equal(manifest.layer, 'EC_INVESTMENT_RADAR_READ_ONLY');
    assert.equal(manifest.country, 'EC');
    assert.equal(manifest.status, 'implementation_validated_local_successor');
    assert.equal(manifest.policy.readOnlyRecommendationOnly, true);
    assert.equal(manifest.policy.automaticBudgetMutationAllowed, false);
    assert.equal(manifest.policy.metaCampaignMutationAllowed, false);
    assert.equal(manifest.policy.hourlyUsesFirstPartyTelemetry, true);
    assert.equal(manifest.policy.qaMeasurementsExcluded, true);
    assert.equal(manifest.policy.bestWindowHours, 3);
    assert.equal(manifest.policy.botChanged, false);
    assert.equal(manifest.policy.dropiChanged, false);
    assert.equal(manifest.policy.metaRoutingChanged, false);
    assert.equal(manifest.policy.databaseSchemaChanged, false);
    assert.equal(hash(read('docs/freeze/vsl-entry-v78-telemetry-v132-20260905.json')), manifest.parentManifestSha256);
    const successorOverrides = new Set(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []);
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
        if (successorOverrides.has(file)) continue;
        assert.equal(hash(read(file)), expected, file);
    }
    assert.equal(
        manifest.bundleSha256,
        hash(Object.entries(manifest.protectedFiles).map(([file, sha]) => `${file}\0${sha}\n`).join(''))
    );
    return manifest;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    assertInvestmentRadarV134();
    console.log('INVESTMENT_RADAR_V134=PASS');
}
