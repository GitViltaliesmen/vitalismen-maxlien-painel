import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifestUrl = new URL('../../docs/freeze/ec-web-controlled-canary-v165-20260915.json', import.meta.url);
const text = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(text);
const hashBuffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => hashBuffer(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)));

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_WEB_CONTROLLED_CANARY_V165_20260915');
assert.equal(manifest.version, 165);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());
assert.deepEqual([...manifest.compatibilityOverrides].sort(), Object.keys(manifest.preservedFiles || {}).sort());
for (const [file, expected] of Object.entries({ ...manifest.protectedFiles, ...manifest.preservedFiles })) {
    assert.equal(hashFile(file), expected, `[V165 pre-context] ${file}`);
}

const allOverrides = [...new Set([...(manifest.overrides || []), ...(manifest.compatibilityOverrides || [])])];
globalThis.__VITALISMEN_V165_OVERRIDE_FILES = Object.freeze(allOverrides);
globalThis.__VITALISMEN_V165_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: hashBuffer(text),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles, ...manifest.preservedFiles })
});
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...allOverrides])];
}
