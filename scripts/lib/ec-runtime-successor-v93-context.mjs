import {
    assertEcRuntimeSuccessorManifestV93,
    EC_RUNTIME_SUCCESSOR_V93_OVERRIDE_KEY
} from '../../src/services/ecRuntimeSuccessorV93Service.js';

const identity = assertEcRuntimeSuccessorManifestV93();
const inherited = Array.isArray(globalThis[EC_RUNTIME_SUCCESSOR_V93_OVERRIDE_KEY])
    ? globalThis[EC_RUNTIME_SUCCESSOR_V93_OVERRIDE_KEY]
    : [];
globalThis[EC_RUNTIME_SUCCESSOR_V93_OVERRIDE_KEY] = [...new Set([
    ...inherited,
    ...identity.overrides
])];

await import('./official-audit-successor-v92-context.mjs');
await import('../../src/services/ecRuntimeSuccessorFreezeRuntimeGuardV93.js');
