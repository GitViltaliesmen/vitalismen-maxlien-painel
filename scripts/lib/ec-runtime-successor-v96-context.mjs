import { assertEcRuntimeTransientResetManifestV96, EC_RUNTIME_TRANSIENT_RESET_V96_OVERRIDE_KEY } from '../../src/services/ecRuntimeTransientResetV96Service.js';

const identity = assertEcRuntimeTransientResetManifestV96();
const inherited = Array.isArray(globalThis[EC_RUNTIME_TRANSIENT_RESET_V96_OVERRIDE_KEY]) ? globalThis[EC_RUNTIME_TRANSIENT_RESET_V96_OVERRIDE_KEY] : [];
globalThis[EC_RUNTIME_TRANSIENT_RESET_V96_OVERRIDE_KEY] = [...new Set([...inherited, ...identity.overrides])];
await import('./ec-runtime-successor-v95-context.mjs');
await import('../../src/services/ecRuntimeTransientResetFreezeRuntimeGuardV96.js');
