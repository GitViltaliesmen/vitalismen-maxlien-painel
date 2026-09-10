import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';
const text = fs.readFileSync(new URL('../../docs/freeze/ec-unified-postsale-v147-r6-20260910.json', import.meta.url), 'utf8');
const manifest = JSON.parse(text);
assert.equal(text, JSON.stringify(manifest, null, 2) + '\n');
assert.equal(manifest.parentCommit, 'dbb3d1440d2a4e549271321686e1edefe8e6e73c');
assert.equal(manifest.parentTree, '1554583304bda990b89c29ea44274ffb0292fec9');
assert.equal(manifest.freezeId, 'EC_UNIFIED_POSTSALE_V147_R6_20260910');
assert.equal(manifest.policy.publicationAllowed, false);
assert.equal(manifest.policy.historicalBackfillAllowed, false);
assert.deepEqual(Object.keys(manifest.protectedFiles).sort(), [...manifest.overrides].sort());
for (const [file, expected] of Object.entries({ ...manifest.preservedFiles, ...manifest.protectedFiles })) {
    assert.ok(!file.includes('..') && !file.startsWith('/') && !file.includes('\\'));
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../../' + file, import.meta.url))).digest('hex'), expected, '[V147-R6] ' + file);
}
globalThis.__VITALISMEN_V147_R6_CONTEXT = Object.freeze({ loaded: true, freezeId: manifest.freezeId,
    manifestSha256: crypto.createHash('sha256').update(text).digest('hex'), protectedFiles: Object.freeze({ ...manifest.protectedFiles }) });
const parent = JSON.parse(fs.readFileSync(new URL('../../docs/freeze/ec-transactional-postsale-v147-r5-20260910.json', import.meta.url), 'utf8'));
const ancestorNames = ['ec-dropi-status-postsale-v139-20260907.json', 'ec-phone-servientrega-reconciliation-v140-20260907.json', 'ec-meta-funnel-reconciliation-v141-20260908.json', 'ec-panel-new-dropi-persistence-v142-20260908.json', 'ec-v141-v142-convergence-v143-20260908.json', 'ec-meta-purchase-after-manual-dropi-v144-20260908.json', 'ec-integration-health-capi-queue-v145-20260908.json', 'ec-definitive-normalization-v146-20260908.json', 'ec-postsale-canonical-restoration-v147-20260909.json', 'ec-postsale-complete-v147-r2-20260910.json', 'ec-delivered-single-gate-v147-r3-20260910.json', 'ec-v116-canonical-polling-v147-r4-20260910.json'];
const inherited = ancestorNames.flatMap((name) => JSON.parse(fs.readFileSync(new URL('../../docs/freeze/' + name, import.meta.url), 'utf8')).overrides || []);
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...inherited, ...parent.overrides, ...manifest.overrides])];
}
await import('./ec-runtime-successor-v147-r5-context.mjs');
