import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifestText = fs.readFileSync(new URL('../../docs/freeze/ec-transactional-postsale-v147-r5-20260910.json', import.meta.url), 'utf8');
const manifest = JSON.parse(manifestText);
assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.parentCommit, 'b821dc09ace9021c14e1998624dbfad3d49312c6');
assert.equal(manifest.parentTree, '47b6e8d0e6a82d1c8c040334296cf37a7d9bb2bd');
assert.equal(manifest.freezeId, 'EC_TRANSACTIONAL_POSTSALE_V147_R5_20260910');
assert.equal(manifest.policy.publicationAllowed, false);
assert.equal(manifest.policy.historicalBackfillAllowed, false);
assert.deepEqual(Object.keys(manifest.protectedFiles).sort(), [...manifest.overrides].sort());
for (const [file, expected] of Object.entries({ ...manifest.preservedFiles, ...manifest.protectedFiles })) {
    assert.ok(!file.includes('..') && !file.startsWith('/') && !file.includes('\\'));
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(`../../${file}`, import.meta.url))).digest('hex'), globalThis.__VITALISMEN_V147_R6_CONTEXT?.protectedFiles?.[file] || expected, `[V147-R5] ${file}`);
}
globalThis.__VITALISMEN_V147_R5_CONTEXT = Object.freeze({
    loaded: true, freezeId: manifest.freezeId,
    manifestSha256: crypto.createHash('sha256').update(manifestText).digest('hex'),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles, ...globalThis.__VITALISMEN_V147_R6_CONTEXT?.protectedFiles })
});
const ancestors = [
    'ec-dropi-status-postsale-v139-20260907.json', 'ec-phone-servientrega-reconciliation-v140-20260907.json',
    'ec-meta-funnel-reconciliation-v141-20260908.json', 'ec-panel-new-dropi-persistence-v142-20260908.json',
    'ec-v141-v142-convergence-v143-20260908.json', 'ec-meta-purchase-after-manual-dropi-v144-20260908.json',
    'ec-integration-health-capi-queue-v145-20260908.json', 'ec-definitive-normalization-v146-20260908.json',
    'ec-postsale-canonical-restoration-v147-20260909.json', 'ec-postsale-complete-v147-r2-20260910.json',
    'ec-delivered-single-gate-v147-r3-20260910.json', 'ec-v116-canonical-polling-v147-r4-20260910.json'
].flatMap((name) => JSON.parse(fs.readFileSync(new URL(`../../docs/freeze/${name}`, import.meta.url), 'utf8')).overrides || []);
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...ancestors, ...manifest.overrides])];
}
await import('./ec-runtime-successor-v147-r4-context.mjs');
