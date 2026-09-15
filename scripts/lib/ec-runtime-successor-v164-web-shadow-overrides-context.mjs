import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifestUrl = new URL('../../docs/freeze/ec-web-worker-shadow-activation-v164-20260915.json', import.meta.url);
const text = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(text);
const hashBuffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => hashBuffer(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)));

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_WEB_WORKER_SHADOW_ACTIVATION_V164_20260915');
assert.equal(manifest.version, 164);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());
assert.deepEqual([...manifest.compatibilityOverrides].sort(), Object.keys(manifest.preservedFiles || {}).sort());
for (const [file, expected] of Object.entries({ ...manifest.protectedFiles, ...manifest.preservedFiles })) {
    assert.equal(hashFile(file), expected, `[V164 pre-context] ${file}`);
}

const allOverrides = [...new Set([...(manifest.overrides || []), ...(manifest.compatibilityOverrides || [])])];
globalThis.__VITALISMEN_V164_OVERRIDE_FILES = Object.freeze(allOverrides);
globalThis.__VITALISMEN_V164_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: hashBuffer(text),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles, ...manifest.preservedFiles })
});
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...allOverrides])];
}
