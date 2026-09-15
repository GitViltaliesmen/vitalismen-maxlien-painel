import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifestUrl = new URL('../../docs/freeze/ec-multinumber-shadow-reconciliation-v163-20260915.json', import.meta.url);
const text = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(text);

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_MULTINUMBER_SHADOW_RECONCILIATION_V163_20260915');
assert.equal(manifest.version, 163);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());

const hashBuffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => hashBuffer(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)));
const v164Overrides = new Set(globalThis.__VITALISMEN_V164_OVERRIDE_FILES || []);
for (const [file, expected] of Object.entries(manifest.protectedFiles || {})) {
    if (v164Overrides.has(file)) continue;
    assert.equal(hashFile(file), expected, `[V163 pre-context] ${file}`);
}

const v163ProtectedFiles = Object.freeze(Object.fromEntries(
    Object.entries(manifest.protectedFiles || {}).filter(([file]) => !v164Overrides.has(file))
));
let v148Context = Object.freeze({ protectedFiles: v163ProtectedFiles });
Object.defineProperty(globalThis, '__VITALISMEN_V148_CONTEXT', {
    configurable: true,
    enumerable: true,
    get: () => v148Context,
    set: (value) => {
        v148Context = Object.freeze({
            ...(value && typeof value === 'object' ? value : {}),
            protectedFiles: Object.freeze({ ...(value?.protectedFiles || {}), ...v163ProtectedFiles })
        });
    }
});

globalThis.__VITALISMEN_V163_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: hashBuffer(text),
    protectedFiles: v163ProtectedFiles
});

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...(manifest.overrides || [])])];
}
