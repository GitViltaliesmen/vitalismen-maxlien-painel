import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const assertEcCommercialIsolationV135 = () => {
    const manifest = JSON.parse(read('docs/freeze/ec-commercial-isolation-v135-20260907.json'));
    assert.equal(manifest.parentCommit, 'c542ef91bbf8865c9263b97b12389e07da1949ce');
    assert.equal(manifest.layer, 'EC_COMMERCIAL_QUEUE_ISOLATION');
    assert.deepEqual(manifest.overrides, ['public/qr.html', 'scripts/lib/ec-runtime-successor-v97-context.mjs', 'src/routes/whatsapp.js']);
    assert.equal(hash(read('docs/freeze/investment-radar-v134-20260905.json')), manifest.parentManifestSha256);
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) assert.equal(hash(read(file)), expected, file);
    assert.equal(manifest.bundleSha256, hash(Object.entries(manifest.protectedFiles).map(([file, sha]) => `${file}\0${sha}\n`).join('')));
    return manifest;
};
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    assertEcCommercialIsolationV135();
    console.log('EC_COMMERCIAL_ISOLATION_V135=PASS');
}
