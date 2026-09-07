import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const assertProtocoloGCommercialMetricsV136 = () => {
    const manifest = JSON.parse(read('docs/freeze/protocolo-g-commercial-metrics-v136-20260907.json'));
    assert.equal(manifest.parentCommit, '316f1a4cc7b1aa796848d201b6c95dd8ff8b18a9');
    assert.equal(manifest.layer, 'EC_PROTOCOLO_G_COMMERCIAL_METRICS_READ_ONLY');
    assert.deepEqual(manifest.overrides, ['public/funnel-metrics.html', 'scripts/guard-ec-commercial-isolation-v135.mjs', 'scripts/lib/ec-runtime-successor-v97-context.mjs', 'src/routes/funnelMetrics.js', 'tests/funnel-metrics-route.test.mjs']);
    assert.equal(hash(read('docs/freeze/ec-commercial-isolation-v135-20260907.json')), manifest.parentManifestSha256);
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) assert.equal(hash(read(file)), expected, file);
    assert.equal(manifest.bundleSha256, hash(Object.entries(manifest.protectedFiles).map(([file, sha]) => `${file}\0${sha}\n`).join('')));
    return manifest;
};
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    assertProtocoloGCommercialMetricsV136();
    console.log('PROTOCOLO_G_COMMERCIAL_METRICS_V136=PASS');
}
