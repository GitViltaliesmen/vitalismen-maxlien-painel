import './ec-runtime-successor-v181-context.mjs';

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const MANIFEST = 'docs/freeze/ec-panel-only-agency-city-scope-v183-20260918.json';
const manifestUrl = new URL(`../../${MANIFEST}`, import.meta.url);
const manifestText = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(manifestText);
const hashFile = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url)))
    .digest('hex');

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, '[V183] manifest_not_canonical');
assert.equal(manifest.freezeId, 'EC_PANEL_ONLY_AGENCY_CITY_SCOPE_V183_20260918');
assert.equal(manifest.version, 'V183');
assert.equal(manifest.parentCommit, '1c0e1457e0feedf8cd08e76a1593c9018a7ac3a1');
assert.equal(manifest.parentTree, 'f2f46aec3e0b05e6da95df57fcf3696bfff5a2a0');
assert.equal(manifest.v181Commit, '2e4d1bd95e5fbd3ebf0109eaacb0eeefbd243ea3');
assert.equal(manifest.policy.panelOptInOnly, true);
assert.equal(manifest.policy.defaultStrictCityScope, false);
assert.equal(manifest.policy.botBehaviorDiff, 0);
assert.equal(manifest.policy.productionChanged, false);
assert.equal(manifest.policy.deployExecuted, false);
assert.equal(manifest.policy.restartExecuted, false);
assert.equal(manifest.overrides.some((file) => /[*?\[\]]/.test(file)), false);
assert.equal(globalThis.__VITALISMEN_V181_V51_BROWSER_SUCCESSOR_CONTEXT?.loaded, true, '[V183] V181_context_not_loaded');

for (const [relativePath, expectedSha256] of Object.entries(manifest.protectedFiles)) {
    assert.equal(hashFile(relativePath), expectedSha256, `[V183] protected_file_invalid:${relativePath}`);
}

globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...new Set([
        ...(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []),
        ...manifest.overrides
    ])
];

globalThis.__VITALISMEN_V183_PANEL_ONLY_AGENCY_CITY_SCOPE_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    parentCommit: manifest.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(manifestText).digest('hex'),
    authorizedFiles: Object.freeze([...manifest.overrides]),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles }),
    policy: Object.freeze({ ...manifest.policy })
});
