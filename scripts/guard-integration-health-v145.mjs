import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertMetaPurchaseAfterManualDropiV144 } from './guard-meta-purchase-after-manual-dropi-v144.mjs';

const read = file => fs.readFileSync(path.resolve(file), 'utf8');
const hash = file => crypto.createHash('sha256').update(read(file)).digest('hex');
export const assertIntegrationHealthV145 = () => {
    const file = 'docs/freeze/ec-integration-health-capi-queue-v145-20260908.json';
    const text = read(file), manifest = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
    assert.equal(manifest.layer, 'V145');
    assert.equal(manifest.parentCommit, 'c68163e1013782e013456baeba65538770a7c220');
    assert.equal(manifest.parentTree, '495d32f9547a9ebd223fcdf035ae62881049fdc6');
    assert.equal(hash('docs/freeze/ec-meta-purchase-after-manual-dropi-v144-20260908.json'),
        '3f936322f1b0ef043052923f17ff5cba256e4bab146b0441651196485d754766');
    assert.deepEqual(manifest.overrides, ['public/funnel-metrics.html', 'src/routes/funnelMetrics.js', 'tests/ec-dropi-human-authorization-v138.test.mjs']);
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) assert.equal(hash(file), expected, `V145 divergente: ${file}`);
    globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [...new Set([
        ...(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []), ...manifest.overrides
    ])];
    assertMetaPurchaseAfterManualDropiV144(); // Every protected V144 byte, including its sender and guards, remains mandatory.
    const service = read('src/services/funnelIntegrationHealthV145Service.js');
    const reader = read('src/services/funnelIntegrationHealthV145ReadService.js');
    assert.match(service, /HISTORICAL_NOT_RETROACTIVE/);
    assert.match(service, /retryAuthorized: false/);
    assert.match(service, /NO_DATA_IN_WINDOW/);
    assert.doesNotMatch(service + reader, /sendPurchase|sendZapi|\.save\(|updateOne\(|updateMany\(|deleteOne\(|insertOne\(/);
    assert.equal(manifest.productionChanged, false);
    assert.equal(manifest.candidateActivationAllowed, false);
    return manifest;
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    assertIntegrationHealthV145(); console.log('V145_INTEGRATION_HEALTH_CAPI_QUEUE=PASS');
}
