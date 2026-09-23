import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';
const text = fs.readFileSync(new URL('../../docs/freeze/ec-meta-funnel-v148-20260910.json', import.meta.url), 'utf8');
const manifest = JSON.parse(text);
assert.equal(text, JSON.stringify(manifest, null, 2) + '\n');
assert.equal(manifest.parentCommit, 'f7927a9a8720d64f3c8ba5f02dcd290f2774f08f');
assert.equal(manifest.parentTree, '0bfa0d9e298045764dad86ec3096186d6880daba');
assert.equal(manifest.freezeId, 'EC_META_FUNNEL_V148_20260910');
assert.equal(manifest.policy.publicationAllowed, false);
assert.equal(manifest.policy.metaRetroactive, false);
assert.deepEqual(Object.keys(manifest.protectedFiles).sort(), [...manifest.overrides].sort());
for (const [file, expected] of Object.entries({ ...manifest.preservedFiles, ...manifest.protectedFiles })) {
    assert.ok(!file.includes('..') && !file.startsWith('/') && !file.includes('\\'));
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../../' + file, import.meta.url))).digest('hex'), expected, '[V148] ' + file);
}
globalThis.__VITALISMEN_V148_CONTEXT = Object.freeze({ loaded: true, freezeId: manifest.freezeId,
    manifestSha256: crypto.createHash('sha256').update(text).digest('hex'), protectedFiles: Object.freeze({ ...manifest.protectedFiles }) });
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...manifest.overrides])];
}
