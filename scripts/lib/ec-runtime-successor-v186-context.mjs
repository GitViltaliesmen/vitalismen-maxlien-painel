import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import './ec-runtime-successor-v184-context.mjs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const V185_MANIFEST = 'docs/freeze/v185-metrics-radar-readonly-20260918.json';
const V186_MANIFEST = 'docs/freeze/ec-v185-canonical-successor-v186-20260918.json';
const V170_CONTEXT_KEY = '__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT';
const read = relativePath => fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url));
const readCanonicalManifest = (relativePath, label) => {
    const text = read(relativePath).toString('utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`, `[V186] ${label}_manifest_not_canonical`);
    return { text, value };
};
const sha256 = relativePath => crypto.createHash('sha256').update(read(relativePath)).digest('hex');

const v185 = readCanonicalManifest(V185_MANIFEST, 'v185');
const v186 = readCanonicalManifest(V186_MANIFEST, 'v186');
const manifest = v186.value;
const expectedAncestorIntersection = [
    'public/funnel-metrics.html',
    'src/routes/funnelMetrics.js'
];

assert.equal(manifest.freezeId, 'EC_V185_CANONICAL_SUCCESSOR_V186_20260918');
assert.equal(manifest.version, 'V186');
assert.equal(manifest.parentCommit, 'dde9475953806696ae752359f47073ac950f05ee');
assert.equal(manifest.v184Commit, '596441983a7d05e0cd002200372aa1bd0077214b');
assert.equal(manifest.rootCause, 'V185_SUCCESSOR_CONTEXT_NOT_VISIBLE_TO_V168B_PRELOAD_BEFORE_HASH_VALIDATION');
assert.equal(manifest.canonicalPreloadEntry, 'scripts/lib/ec-runtime-successor-v97-context.mjs');
assert.equal(manifest.successorIntegrationPoint, 'scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs');
assert.deepEqual([...manifest.ancestorProtectedIntersection].sort(), expectedAncestorIntersection);
assert.equal(manifest.ancestorManifestScan.totalJsonFiles, 248);
assert.equal(manifest.ancestorManifestScan.withProtectedFiles, 181);
assert.equal(manifest.ancestorManifestScan.intersectionOccurrences, 19);
assert.deepEqual([...manifest.v185FunctionalFiles].sort(), [...v185.value.functionalFiles].sort());
assert.equal(manifest.overrides.some(file => /[*?\[\]]/.test(file)), false);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
assert.equal(manifest.policy.guardLineageOnly, true);
assert.equal(manifest.policy.functionalCodeChanged, false);
assert.equal(manifest.policy.v184DescriptorPreserved, true);
assert.equal(manifest.policy.guardsBypassed, false);
assert.equal(manifest.policy.productionActivationAuthorized, false);

for (const [relativePath, expectedHash] of Object.entries(v185.value.protectedFiles)) {
    assert.equal(sha256(relativePath), expectedHash, `[V186] v185_frozen_file_invalid:${relativePath}`);
}
for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles)) {
    assert.equal(sha256(relativePath), expectedHash, `[V186] protected_file_invalid:${relativePath}`);
}

const predecessorDescriptor = Object.getOwnPropertyDescriptor(globalThis, V170_CONTEXT_KEY);
assert.equal(predecessorDescriptor?.configurable, true, '[V186] v184_descriptor_not_configurable');
assert.equal(typeof predecessorDescriptor?.get, 'function', '[V186] v184_getter_missing');
assert.equal(typeof predecessorDescriptor?.set, 'function', '[V186] v184_setter_missing');

const authorizedFiles = [...new Set([
    ...(globalThis.__VITALISMEN_V184_CANONICAL_SUCCESSOR_CONTEXT?.authorizedFiles || []),
    ...v185.value.overrides,
    ...manifest.overrides
])];
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...authorizedFiles])];
}

let v186Context = predecessorDescriptor.get.call(globalThis);
Object.defineProperty(globalThis, V170_CONTEXT_KEY, {
    configurable: predecessorDescriptor.configurable,
    enumerable: predecessorDescriptor.enumerable,
    get: () => v186Context ?? predecessorDescriptor.get.call(globalThis),
    set: value => {
        predecessorDescriptor.set.call(globalThis, value);
        const inherited = predecessorDescriptor.get.call(globalThis);
        v186Context = Object.freeze({
            ...(inherited && typeof inherited === 'object' ? inherited : {}),
            authorizedFiles: Object.freeze([...new Set([...(inherited?.authorizedFiles || []), ...authorizedFiles])]),
            protectedFiles: Object.freeze({
                ...(inherited?.protectedFiles || {}),
                ...v185.value.functionalHashes,
                ...manifest.protectedFiles
            }),
            successorFreezeId: manifest.freezeId,
            successorManifestSha256: crypto.createHash('sha256').update(v186.text).digest('hex')
        });
    }
});

globalThis.__VITALISMEN_V186_CANONICAL_METRICS_SUCCESSOR_CONTEXT = Object.freeze({
    loaded: true,
    loadedBeforeV168B: true,
    freezeId: manifest.freezeId,
    parentCommit: manifest.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(v186.text).digest('hex'),
    ancestorOverrideFiles: Object.freeze([...manifest.ancestorProtectedIntersection]),
    authorizedFiles: Object.freeze(authorizedFiles),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles }),
    predecessorDescriptorPreserved: true,
    policy: Object.freeze({ ...manifest.policy })
});

if (process.env.V186_CANONICAL_SUCCESSOR_AUDIT === '1') {
    console.log('[V186] CONTEXT_LOADED_BEFORE_V168B=YES');
}
