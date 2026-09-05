import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url));
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const assertVslEntryV78TelemetryV132 = () => {
    const manifest = JSON.parse(read('docs/freeze/vsl-entry-v78-telemetry-v132-20260905.json'));
    assert.equal(manifest.parentCommit, '77f8fedc1e8835fbe732ec359989c3b8b653d7b1');
    assert.equal(manifest.layer, 'EC_PROTOCOLO_G_VSL_ENTRY_V78_TELEMETRY');
    assert.equal(manifest.country, 'EC');
    assert.equal(manifest.status, 'staging_validated_publication_pending');
    assert.equal(manifest.policy.protocoloGWithoutCustomerPhoneSkipsSellerRotation, true);
    assert.equal(manifest.policy.vslVisitPersistencePreserved, true);
    assert.equal(manifest.policy.duplicateClickIsIdempotent, true);
    assert.equal(manifest.policy.v62V63ContractPreserved, true);
    assert.equal(manifest.policy.botChanged, false);
    assert.equal(manifest.policy.dropiChanged, false);
    assert.equal(manifest.policy.metaChanged, false);
    assert.equal(hash(read('docs/freeze/post-sale-search-reconciliation-v131.json')), manifest.parentManifestSha256);
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
    assertVslEntryV78TelemetryV132();
    console.log('VSL_ENTRY_V78_TELEMETRY_V132=PASS');
}
