import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const MANIFEST = 'docs/freeze/meta-canonical-consolidation-v195-20260923.json';
const read = (relativePath) => fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url));
const manifestText = read(MANIFEST).toString('utf8');
const manifest = JSON.parse(manifestText);

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, '[V195] manifest_not_canonical');
assert.equal(manifest.freezeId, 'META_CANONICAL_CONSOLIDATION_V195_20260923');
assert.equal(manifest.version, 'V195');
assert.equal(manifest.baseCommit, '8c25ed9912abc4aabee2656cf9192420389934c6');
assert.equal(manifest.policy?.guardsBypassed, false);
assert.equal(manifest.policy?.canonicalDataset, '920532663934291');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());

globalThis.__VITALISMEN_V195_META_CANONICAL_PRELOAD = Object.freeze({
    freezeId: manifest.freezeId,
    canonicalDataset: manifest.policy.canonicalDataset,
    authorizedFiles: Object.freeze([...manifest.overrides]),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles })
});

globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...new Set([
        ...(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []),
        ...manifest.overrides
    ])
];

await import('./ec-runtime-successor-v194-context.mjs');

for (const [relativePath, expected] of Object.entries(manifest.protectedFiles || {})) {
    const actual = crypto.createHash('sha256').update(read(relativePath)).digest('hex');
    assert.equal(actual, expected, `[V195] protected_file_invalid:${relativePath}`);
}

globalThis.__VITALISMEN_V195_META_CANONICAL_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    baseCommit: manifest.baseCommit,
    manifestSha256: crypto.createHash('sha256').update(manifestText).digest('hex'),
    authorizedFiles: Object.freeze([...manifest.overrides]),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles }),
    policy: Object.freeze({ ...manifest.policy })
});
