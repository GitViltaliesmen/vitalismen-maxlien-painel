// Explicit candidate preload: no changes to any frozen V144 bootstrap or runtime.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

// Validate the exact delta before importing ancestor guards. A guard invoked as
// the CLI entry point executes its main block during import as well.
const manifest = JSON.parse(fs.readFileSync(new URL('../../docs/freeze/ec-integration-health-capi-queue-v145-20260908.json', import.meta.url), 'utf8'));
assert.deepEqual(manifest.overrides, ['public/funnel-metrics.html', 'src/routes/funnelMetrics.js', 'tests/ec-dropi-human-authorization-v138.test.mjs']);
for (const file of manifest.overrides) {
    const source = fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), manifest.protectedFiles[file], `V145 divergente: ${file}`);
}
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [...new Set([
    ...(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []), ...manifest.overrides
])];
await import('./ec-runtime-successor-v144-bootstrap-context.mjs');
const { assertIntegrationHealthV145 } = await import('../guard-integration-health-v145.mjs');
assertIntegrationHealthV145();
await import('./ec-runtime-successor-v144-context.mjs');
