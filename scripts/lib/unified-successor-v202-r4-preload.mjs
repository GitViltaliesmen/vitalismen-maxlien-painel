import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    assertExternalLocks,
    assertRequiredContexts,
    assertRestored,
    assertUnifiedSuccessor
} from '../guard-unified-successor-v202-r4.mjs';

const contextKeys = () => Object.getOwnPropertyNames(globalThis)
    .filter(key => key.startsWith('__VITALISMEN_')).sort();
const snapshot = () => new Map(contextKeys().map(key => [key,
    Object.getOwnPropertyDescriptor(globalThis, key)]));
const restore = before => {
    for (const key of contextKeys()) {
        if (!before.has(key)) delete globalThis[key];
    }
    for (const [key, descriptor] of before) Object.defineProperty(globalThis, key, descriptor);
};
const values = () => new Map(contextKeys().map(key => [key, globalThis[key]]));

export async function runUnifiedSuccessor({ root, historicalRoot, env = process.env } = {}) {
    const verified = assertUnifiedSuccessor({ root, historicalRoot, env });
    const beforeDescriptors = snapshot();
    const beforeValues = values();
    try {
        const paths = verified.manifest.allowlist.map(entry => entry.path);
        assert.equal(new Set(paths).size, 83, 'R4_ALLOWLIST_NOT_STRICT');
        globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = Object.freeze([...paths]);
        const historicalPreload = pathToFileURL(path.join(historicalRoot,
            verified.manifest.historicalV199.preload)).href;
        await import(historicalPreload);
        assertRequiredContexts({
            v199: globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT?.loaded,
            v146: globalThis.__VITALISMEN_V146_CONTEXT?.loaded
        });
        const currentEntry = pathToFileURL(path.join(root, verified.manifest.currentEntrypoint)).href;
        await import(currentEntry);
        assertExternalLocks(verified.manifest.externalEffectLocks, env);
        return Object.freeze({ successorChainContract: 'PASS', chainGuardsCovered: 33,
            canonicalIdentities: 83, historicalGuardsChanged: false,
            productionChanged: false, dropiSent: false, purchaseSent: false });
    } finally {
        restore(beforeDescriptors);
        assertRestored(beforeValues, values());
    }
}
