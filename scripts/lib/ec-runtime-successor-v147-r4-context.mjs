import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifestUrl = new URL('../../docs/freeze/ec-v116-canonical-polling-v147-r4-20260910.json', import.meta.url);
const manifestText = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(manifestText);
assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.parentCommit, 'b73cabb745508c4be1b56703a03dc74620d1b678');
assert.equal(manifest.parentTree, '51c596f96c0c72096d311ee4da5a00b63d897ad2');
assert.equal(manifest.freezeId, 'EC_V116_CANONICAL_POLLING_V147_R4_20260910');
assert.equal(manifest.policy.publicationAllowed, false);
assert.equal(manifest.policy.historicalBackfillAllowed, false);
assert.deepEqual(Object.keys(manifest.protectedFiles).sort(), [...manifest.overrides].sort());
for (const [relativePath, expected] of Object.entries(manifest.protectedFiles)) {
    assert.ok(!relativePath.includes('..') && !relativePath.startsWith('/') && !relativePath.includes('\\'));
    const source = fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url));
    const successor = globalThis.__VITALISMEN_V147_R5_CONTEXT?.protectedFiles?.[relativePath];
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), successor || expected, `[V147-R4] ${relativePath}`);
}
globalThis.__VITALISMEN_V147_R4_CONTEXT = Object.freeze({
    loaded: true, freezeId: manifest.freezeId,
    manifestSha256: crypto.createHash('sha256').update(manifestText).digest('hex'),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles })
});
const ancestorManifests = [
    'ec-dropi-status-postsale-v139-20260907.json',
    'ec-phone-servientrega-reconciliation-v140-20260907.json',
    'ec-meta-funnel-reconciliation-v141-20260908.json',
    'ec-panel-new-dropi-persistence-v142-20260908.json',
    'ec-v141-v142-convergence-v143-20260908.json',
    'ec-meta-purchase-after-manual-dropi-v144-20260908.json',
    'ec-integration-health-capi-queue-v145-20260908.json',
    'ec-definitive-normalization-v146-20260908.json',
    'ec-postsale-canonical-restoration-v147-20260909.json',
    'ec-postsale-complete-v147-r2-20260910.json',
    'ec-delivered-single-gate-v147-r3-20260910.json'
];
const inheritedOverrides = ancestorManifests.flatMap((name) => JSON.parse(
    fs.readFileSync(new URL(`../../docs/freeze/${name}`, import.meta.url), 'utf8')
).overrides || []);
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...inheritedOverrides, ...manifest.overrides])];
}
await import('./ec-runtime-successor-v147-r3-context.mjs');
