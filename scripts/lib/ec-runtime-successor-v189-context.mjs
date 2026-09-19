import assert from 'node:assert/strict';
import './ec-runtime-successor-v189-preload-context.mjs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const V170_CONTEXT_KEY = '__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT';
const preload = globalThis.__VITALISMEN_V189_META_CAPI_ALIGNMENT_CONTEXT;
assert.equal(preload?.loaded, true, '[V189] preload_context_missing');
assert.equal(preload?.phase, 'preload', '[V189] preload_context_invalid');

const predecessorDescriptor = Object.getOwnPropertyDescriptor(globalThis, V170_CONTEXT_KEY);
assert.equal(predecessorDescriptor?.configurable, true, '[V189] predecessor_descriptor_not_configurable');
assert.equal(typeof predecessorDescriptor?.get, 'function', '[V189] predecessor_getter_missing');
assert.equal(typeof predecessorDescriptor?.set, 'function', '[V189] predecessor_setter_missing');

const authorizedFiles = [...new Set([
    ...(globalThis.__VITALISMEN_V186_CANONICAL_METRICS_SUCCESSOR_CONTEXT?.authorizedFiles || []),
    ...preload.authorizedFiles
])];
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...authorizedFiles])];
}

let v189Context = predecessorDescriptor.get.call(globalThis);
Object.defineProperty(globalThis, V170_CONTEXT_KEY, {
    configurable: predecessorDescriptor.configurable,
    enumerable: predecessorDescriptor.enumerable,
    get: () => v189Context ?? predecessorDescriptor.get.call(globalThis),
    set: value => {
        predecessorDescriptor.set.call(globalThis, value);
        const inherited = predecessorDescriptor.get.call(globalThis);
        v189Context = Object.freeze({
            ...(inherited && typeof inherited === 'object' ? inherited : {}),
            authorizedFiles: Object.freeze([...new Set([...(inherited?.authorizedFiles || []), ...authorizedFiles])]),
            protectedFiles: Object.freeze({
                ...(inherited?.protectedFiles || {}),
                ...preload.protectedFiles
            }),
            successorFreezeId: preload.freezeId,
            successorManifestSha256: preload.manifestSha256
        });
    }
});

globalThis.__VITALISMEN_V189_META_CAPI_ALIGNMENT_CONTEXT = Object.freeze({
    ...preload,
    phase: 'final',
    loadedAfterV186: true,
    authorizedFiles: Object.freeze(authorizedFiles),
    protectedFiles: preload.protectedFiles,
    preservedFiles: preload.preservedFiles,
    destination: preload.destination,
    policy: preload.policy
});

if (process.env.V189_META_CAPI_ALIGNMENT_AUDIT === '1') {
    console.log('[V189] SUCCESSOR_CONTEXT_LOADED=YES');
}
