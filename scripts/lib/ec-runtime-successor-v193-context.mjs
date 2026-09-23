import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import './ec-runtime-successor-v139-context.mjs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const read = (relativePath) => fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url));
const hash = (relativePath) => crypto.createHash('sha256').update(read(relativePath)).digest('hex');
const source = read('docs/freeze/vsl-first-response-watchdog-v193-20260919.json').toString('utf8');
const freeze = JSON.parse(source);
const v194Source = read('docs/freeze/post-sale-dropi-reconciler-v194-20260920.json').toString('utf8');
const v194 = JSON.parse(v194Source);
assert.equal(source, `${JSON.stringify(freeze, null, 2)}\n`, '[V193] manifest_not_canonical');
assert.equal(freeze.version, 'V193');
assert.equal(freeze.baseCommit, '818db6cf281ee22d3ab4efc04f76cc7cf7898ae1');
assert.equal(freeze.runtimeGuardSuccessor.policy.guardBypassAllowed, false);
assert.equal(v194Source, `${JSON.stringify(v194, null, 2)}\n`, '[V194] manifest_not_canonical');
assert.equal(v194.version, 'V194');
assert.equal(v194.policy.guardsBypassed, false);

const inherited = freeze.runtimeGuardSuccessor.inheritedProtectedFiles;
const changed = freeze.runtimeGuardSuccessor.protectedFiles;
const v195MetaCanonicalPreload = globalThis.__VITALISMEN_V195_META_CANONICAL_PRELOAD;
if (v195MetaCanonicalPreload) {
    assert.equal(v195MetaCanonicalPreload.freezeId, 'META_CANONICAL_CONSOLIDATION_V195_20260923');
    assert.equal(v195MetaCanonicalPreload.canonicalDataset, '920532663934291');
    assert.deepEqual(
        [...v195MetaCanonicalPreload.authorizedFiles].sort(),
        Object.keys(v195MetaCanonicalPreload.protectedFiles || {}).sort()
    );
}
for (const [file, expected] of Object.entries({ ...inherited, ...changed })) {
    assert.equal(
        hash(file),
        v195MetaCanonicalPreload?.protectedFiles?.[file] || v194.protectedFiles[file] || expected,
        `[V193/V194/V195] successor_hash_mismatch:${file}`
    );
}
const authorizedFiles = [
    ...freeze.runtimeGuardSuccessor.overrides,
    ...Object.keys(inherited),
    ...v194.overrides
];
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...authorizedFiles])];
}
globalThis.__VITALISMEN_V193_WATCHDOG_CONTEXT = Object.freeze({
    loaded: true,
    freezeVersion: freeze.version,
    baseCommit: freeze.baseCommit,
    authorizedFiles: Object.freeze(authorizedFiles),
    guardBypassAllowed: false
});
