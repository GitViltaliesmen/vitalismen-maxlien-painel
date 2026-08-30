import { assertEcOperationalGuardContextManifestV97, EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';
const identity = assertEcOperationalGuardContextManifestV97();
const inherited = Array.isArray(globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) ? globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] : [];
globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] = [...new Set([...inherited, ...identity.overrides])];
await import('./ec-runtime-successor-v96-context.mjs');
await import('../../src/services/ecOperationalGuardContextFreezeRuntimeGuardV97.js');
