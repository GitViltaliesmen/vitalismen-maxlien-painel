import {
    assertEcRuntimeCurrentBindingManifestV94,
    EC_RUNTIME_CURRENT_BINDING_V94_OVERRIDE_KEY
} from '../../src/services/ecRuntimeCurrentBindingV94Service.js';

const identity = assertEcRuntimeCurrentBindingManifestV94();
const inherited = Array.isArray(globalThis[EC_RUNTIME_CURRENT_BINDING_V94_OVERRIDE_KEY])
    ? globalThis[EC_RUNTIME_CURRENT_BINDING_V94_OVERRIDE_KEY]
    : [];
globalThis[EC_RUNTIME_CURRENT_BINDING_V94_OVERRIDE_KEY] = [...new Set([
    ...inherited,
    ...identity.overrides
])];

await import('./ec-runtime-successor-v93-context.mjs');
await import('../../src/services/ecRuntimeCurrentBindingFreezeRuntimeGuardV94.js');
