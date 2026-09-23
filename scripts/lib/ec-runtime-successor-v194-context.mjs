import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const MANIFEST = 'docs/freeze/post-sale-dropi-reconciler-v194-20260920.json';
const read = (relativePath) => fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url));
const manifestText = read(MANIFEST).toString('utf8');
const manifest = JSON.parse(manifestText);

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, '[V194] manifest_not_canonical');
assert.equal(manifest.freezeId, 'POST_SALE_DROPI_RECONCILER_V194_20260920');
assert.equal(manifest.version, 'V194');
assert.equal(manifest.baseCommit, '33876d4901ffbe25224d0ee9dd753ccf6f487ed6');
assert.equal(manifest.policy?.guardsBypassed, false);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());

// Os overrides precisam existir antes da cadeia ancestral validar os hashes.
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...new Set([
        ...(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []),
        ...manifest.overrides
    ])
];
await import('./ec-runtime-successor-v193-context.mjs');

const v195MetaCanonicalPreload = globalThis.__VITALISMEN_V195_META_CANONICAL_PRELOAD;
if (v195MetaCanonicalPreload) {
    assert.equal(v195MetaCanonicalPreload.freezeId, 'META_CANONICAL_CONSOLIDATION_V195_20260923');
    assert.equal(v195MetaCanonicalPreload.canonicalDataset, '920532663934291');
    assert.deepEqual(
        [...v195MetaCanonicalPreload.authorizedFiles].sort(),
        Object.keys(v195MetaCanonicalPreload.protectedFiles || {}).sort()
    );
}
for (const [relativePath, expected] of Object.entries(manifest.protectedFiles || {})) {
    const actual = crypto.createHash('sha256').update(read(relativePath)).digest('hex');
    assert.equal(actual, v195MetaCanonicalPreload?.protectedFiles?.[relativePath] || expected, `[V194/V195] protected_file_invalid:${relativePath}`);
}

globalThis.__VITALISMEN_V194_POSTSALE_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    baseCommit: manifest.baseCommit,
    manifestSha256: crypto.createHash('sha256').update(manifestText).digest('hex'),
    authorizedFiles: Object.freeze([...manifest.overrides]),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles }),
    policy: Object.freeze({ ...manifest.policy })
});
