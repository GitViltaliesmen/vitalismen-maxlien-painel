import './ec-runtime-successor-v170-context.mjs';

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const MANIFEST = 'docs/freeze/ec-v51-browser-successor-v181-20260918.json';
const manifestUrl = new URL(`../../${MANIFEST}`, import.meta.url);
const manifestText = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(manifestText);
const hashFile = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url)))
    .digest('hex');

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, '[V181] manifest_not_canonical');
assert.equal(manifest.freezeId, 'EC_V51_BROWSER_SUCCESSOR_ALIGNMENT_V181_20260918');
assert.equal(manifest.version, 'V181');
assert.equal(manifest.parentCommit, '1c0e1457e0feedf8cd08e76a1593c9018a7ac3a1');
assert.equal(manifest.parentTree, 'f2f46aec3e0b05e6da95df57fcf3696bfff5a2a0');
assert.equal(manifest.v180Candidate, '2bb439145d1eb80a2b44e99788d4129c2a35c0ef');
assert.equal(manifest.policy.testOnly, true);
assert.equal(manifest.policy.manualAgencyClickRequired, true);
assert.equal(manifest.policy.automaticAgencyApplyAllowed, false);
assert.equal(manifest.policy.functionalCodeChanged, 0);
assert.equal(manifest.policy.v180Integrated, false);
assert.equal(manifest.policy.productionChanged, false);
assert.equal(manifest.policy.deployExecuted, false);
assert.equal(manifest.policy.restartExecuted, false);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
assert.equal(manifest.overrides.some((file) => /[*?\[\]]/.test(file)), false);
assert.equal(globalThis.__VITALISMEN_V179_PANEL_FAST_LOAD_CONTEXT?.loaded, true, '[V181] V179_context_not_loaded');

for (const [relativePath, expectedSha256] of Object.entries(manifest.protectedFiles)) {
    assert.equal(hashFile(relativePath), expectedSha256, `[V181] protected_file_invalid:${relativePath}`);
}

globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...new Set([
        ...(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []),
        ...manifest.overrides
    ])
];

globalThis.__VITALISMEN_V181_V51_BROWSER_SUCCESSOR_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    parentCommit: manifest.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(manifestText).digest('hex'),
    authorizedFiles: Object.freeze([...manifest.overrides]),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles }),
    policy: Object.freeze({ ...manifest.policy })
});
