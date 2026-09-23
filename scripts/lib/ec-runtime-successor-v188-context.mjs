import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

// A V188 não substitui arquivo congelado ancestral. A cadeia canônica é
// validada primeiro; em seguida este contexto sela somente a microcamada nova.
await import('./ec-runtime-successor-v97-context.mjs');

const MANIFEST = 'docs/freeze/post-sale-full-operational-v188-20260918.json';
const read = (relativePath) => fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url));
const manifestText = read(MANIFEST).toString('utf8');
const manifest = JSON.parse(manifestText);
assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, '[V188] manifest_not_canonical');
assert.equal(manifest.freezeId, 'POST_SALE_FULL_OPERATIONAL_V188_20260918');
assert.equal(manifest.version, 'V188');
assert.equal(manifest.parentCommit, 'e0cd23c7a18552c9c3c56daf788100bc87781dc3');
assert.equal(manifest.policy?.postSaleOnly, true);
assert.equal(manifest.policy?.botCorePreserved, true);
assert.equal(manifest.policy?.guardsBypassed, false);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());

for (const [relativePath, expected] of Object.entries(manifest.protectedFiles || {})) {
    const actual = crypto.createHash('sha256').update(read(relativePath)).digest('hex');
    assert.equal(actual, expected, `[V188] protected_file_invalid:${relativePath}`);
}

globalThis.__VITALISMEN_V188_POSTSALE_FULL_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    parentCommit: manifest.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(manifestText).digest('hex'),
    authorizedFiles: Object.freeze([...manifest.overrides]),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles }),
    policy: Object.freeze({ ...manifest.policy })
});
