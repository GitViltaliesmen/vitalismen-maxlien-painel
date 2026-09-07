import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const assertEcQueueGuardCompatibilityV137 = () => {
    const manifest = JSON.parse(read('docs/freeze/ec-queue-guard-compatibility-v137-20260907.json'));
    assert.equal(manifest.parentCommit, '2629a80bc67dfec8bb596662228d54339cd1c950');
    assert.equal(manifest.layer, 'EC_QUEUE_GUARD_COMPATIBILITY');
    assert.deepEqual(manifest.overrides, ['scripts/guard-panel-client-search-v41.mjs', 'scripts/guard-protocolo-g-commercial-metrics-v136.mjs', 'scripts/lib/ec-runtime-successor-v97-context.mjs', 'tests/panel-client-search-v41.test.mjs']);
    assert.equal(hash(read('docs/freeze/protocolo-g-commercial-metrics-v136-20260907.json')), manifest.parentManifestSha256);
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) assert.equal(hash(read(file)), expected, file);
    assert.equal(manifest.bundleSha256, hash(Object.entries(manifest.protectedFiles).map(([file, sha]) => `${file}\0${sha}\n`).join('')));
    return manifest;
};
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    assertEcQueueGuardCompatibilityV137();
    console.log('EC_QUEUE_GUARD_COMPATIBILITY_V137=PASS');
}
