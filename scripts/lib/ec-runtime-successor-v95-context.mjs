import {
    assertEcRuntimeSafeResetManifestV95,
    EC_RUNTIME_SAFE_RESET_V95_OVERRIDE_KEY
} from '../../src/services/ecRuntimeSafeResetV95Service.js';

const identity = assertEcRuntimeSafeResetManifestV95();
const inherited = Array.isArray(globalThis[EC_RUNTIME_SAFE_RESET_V95_OVERRIDE_KEY])
    ? globalThis[EC_RUNTIME_SAFE_RESET_V95_OVERRIDE_KEY]
    : [];
globalThis[EC_RUNTIME_SAFE_RESET_V95_OVERRIDE_KEY] = [...new Set([
    ...inherited,
    ...identity.overrides
])];

await import('./ec-runtime-successor-v94-context.mjs');
await import('../../src/services/ecRuntimeSafeResetFreezeRuntimeGuardV95.js');
