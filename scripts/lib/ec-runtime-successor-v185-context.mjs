import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import './ec-runtime-successor-v184-context.mjs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const MANIFEST = 'docs/freeze/v185-metrics-radar-readonly-20260918.json';
const read = relative => fs.readFileSync(new URL(`../../${relative}`, import.meta.url));
const text = read(MANIFEST).toString('utf8');
const manifest = JSON.parse(text);
const sha256 = relative => crypto.createHash('sha256').update(read(relative)).digest('hex');

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`, '[V185] manifest_not_canonical');
assert.equal(manifest.freezeId, 'V185_METRICS_RADAR_READONLY_20260918');
assert.equal(manifest.version, 'V185');
assert.equal(manifest.baseCommit, '596441983a7d05e0cd002200372aa1bd0077214b');
assert.equal(manifest.policy.analyticsReadOnly, true);
assert.equal(manifest.policy.mongoWriteCount, 0);
assert.equal(manifest.policy.metaMutationCount, 0);
assert.equal(manifest.policy.guardsBypassed, false);
assert.deepEqual([...manifest.overrides].sort(), [...manifest.functionalFiles].sort());
assert.equal(manifest.overrides.some(file => /[*?\[\]]/.test(file)), false);
for (const [relative, expected] of Object.entries(manifest.protectedFiles)) {
    assert.equal(sha256(relative), expected, `[V185] protected_file_invalid:${relative}`);
}

const authorizedFiles = [...new Set([
    ...(globalThis.__VITALISMEN_V184_CANONICAL_SUCCESSOR_CONTEXT?.authorizedFiles || []),
    ...manifest.overrides
])];
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...authorizedFiles])];
}

let v170Context;
Object.defineProperty(globalThis, '__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT', {
    configurable: true,
    enumerable: true,
    get: () => v170Context,
    set: value => {
        v170Context = Object.freeze({
            ...(value && typeof value === 'object' ? value : {}),
            authorizedFiles: Object.freeze([...new Set([...(value?.authorizedFiles || []), ...authorizedFiles])]),
            protectedFiles: Object.freeze({
                ...(value?.protectedFiles || {}),
                ...(globalThis.__VITALISMEN_V184_CANONICAL_SUCCESSOR_CONTEXT?.protectedFiles || {}),
                ...manifest.functionalHashes
            }),
            successorFreezeId: manifest.freezeId,
            successorManifestSha256: crypto.createHash('sha256').update(text).digest('hex')
        });
    }
});

globalThis.__VITALISMEN_V185_METRICS_RADAR_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    authorizedFiles: Object.freeze(authorizedFiles),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles }),
    policy: Object.freeze({ ...manifest.policy })
});

await import('./ec-runtime-successor-v97-context.mjs');
