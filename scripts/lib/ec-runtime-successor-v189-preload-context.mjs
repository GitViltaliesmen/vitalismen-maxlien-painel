import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const MANIFEST_PATH = 'docs/freeze/meta-capi-protocolo-g-alignment-v189-20260919.json';
const read = relativePath => fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url));
const manifestText = read(MANIFEST_PATH).toString('utf8');
const manifest = JSON.parse(manifestText);
const sha256 = relativePath => crypto.createHash('sha256').update(read(relativePath)).digest('hex');

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, '[V189] manifest_not_canonical');
assert.equal(manifest.freezeId, 'META_CAPI_PROTOCOLO_G_ALIGNMENT_V189_20260919');
assert.equal(manifest.version, 'V189');
assert.equal(manifest.parentCommit, 'c0cca110a87c82044db413934c7f017c23a9cfca');
assert.equal(manifest.datasetId, '920532663934291');
assert.equal(manifest.browserPixelId, '920532663934291');
assert.equal(manifest.tokenSource, 'env:META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G');
assert.equal(manifest.eventSourceUrl, 'https://vilaliemen.shop/protocolo-g');
assert.equal(manifest.policy.tokenFallbackAllowed, false);
assert.equal(manifest.policy.oldDatasetOperationalUseAllowed, false);
assert.equal(manifest.policy.realPurchaseTestAllowed, false);
assert.equal(manifest.policy.testEventCodePersisted, false);
assert.equal(manifest.policy.vslChanged, false);
assert.equal(manifest.policy.botChanged, false);
assert.equal(manifest.policy.qrPanelChanged, false);
assert.equal(manifest.policy.metricsChanged, false);
assert.equal(manifest.policy.postSaleV188Changed, false);
assert.equal(manifest.policy.dropiChanged, false);
assert.equal(manifest.policy.zapiChanged, false);
assert.equal(manifest.policy.guardsBypassed, false);
assert.equal(manifest.overrides.some(file => /[*?\[\]]/.test(file)), false);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());

for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles)) {
    assert.equal(sha256(relativePath), expectedHash, `[V189] protected_file_invalid:${relativePath}`);
}
for (const [relativePath, expectedHash] of Object.entries(manifest.preservedFiles)) {
    assert.equal(sha256(relativePath), expectedHash, `[V189] preserved_file_changed:${relativePath}`);
}

const authorizedFiles = [...new Set(manifest.overrides)];
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...authorizedFiles])];
}

globalThis.__VITALISMEN_V189_META_CAPI_ALIGNMENT_CONTEXT = Object.freeze({
    loaded: true,
    phase: 'preload',
    loadedBeforeV144: true,
    freezeId: manifest.freezeId,
    parentCommit: manifest.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(manifestText).digest('hex'),
    authorizedFiles: Object.freeze(authorizedFiles),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles }),
    preservedFiles: Object.freeze({ ...manifest.preservedFiles }),
    destination: Object.freeze({
        datasetId: manifest.datasetId,
        browserPixelId: manifest.browserPixelId,
        tokenSource: manifest.tokenSource,
        eventSourceUrl: manifest.eventSourceUrl
    }),
    policy: Object.freeze({ ...manifest.policy })
});

if (process.env.V189_META_CAPI_ALIGNMENT_AUDIT === '1') {
    console.log('[V189] PRELOAD_CONTEXT_LOADED=YES');
}
