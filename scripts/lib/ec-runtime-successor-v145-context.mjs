import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifestUrl = new URL('../../docs/freeze/ec-integration-health-capi-queue-v145-20260908.json', import.meta.url);
const manifestText = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(manifestText);
const expectedOverrides = [
    'public/funnel-metrics.html',
    'scripts/guard-meta-purchase-after-manual-dropi-v144.mjs',
    'scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs',
    'scripts/run-with-v144-context.mjs',
    'src/routes/funnelMetrics.js',
    'tests/ec-dropi-human-authorization-v138.test.mjs'
];

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, 'manifesto V145-R2 não canônico');
assert.equal(manifest.freezeId, 'EC_INTEGRATION_HEALTH_CAPI_QUEUE_V145_R2_20260908');
assert.equal(manifest.layer, 'V145-R2');
assert.equal(manifest.parentCommit, 'c68163e1013782e013456baeba65538770a7c220');
assert.equal(manifest.parentTree, '495d32f9547a9ebd223fcdf035ae62881049fdc6');
assert.equal(manifest.parentManifestSha256, '3f936322f1b0ef043052923f17ff5cba256e4bab146b0441651196485d754766');
assert.equal(
    crypto.createHash('sha256').update(fs.readFileSync(new URL('../../docs/freeze/ec-meta-purchase-after-manual-dropi-v144-20260908.json', import.meta.url))).digest('hex'),
    manifest.parentManifestSha256,
    'manifesto pai V144 divergente'
);
assert.deepEqual(manifest.overrides, expectedOverrides);
for (const file of manifest.overrides) {
    const source = fs.readFileSync(new URL(`../../${file}`, import.meta.url));
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), manifest.protectedFiles[file], `V145-R2 divergente: ${file}`);
}

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...manifest.overrides])];
}

globalThis.__VITALISMEN_V145_R2_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: crypto.createHash('sha256').update(manifestText).digest('hex'),
    overrides: Object.freeze([...manifest.overrides])
});
