import { assertEcRuntimeTransientResetV96, ecRuntimeTransientResetV96Files, EC_RUNTIME_TRANSIENT_RESET_V96_OVERRIDE_KEY } from './ecRuntimeTransientResetV96Service.js';

const readiness = assertEcRuntimeTransientResetV96();
const activeOverrides = new Set(globalThis[EC_RUNTIME_TRANSIENT_RESET_V96_OVERRIDE_KEY] || []);
const missingOverrides = ecRuntimeTransientResetV96Files.modifiedAncestorProtectedFiles.filter((relativePath) => !activeOverrides.has(relativePath));
if (readiness.ready !== true || readiness.transientResetBound !== true || missingOverrides.length) throw new Error(`[EC-RUNTIME-TRANSIENT-RESET-V96] runtime_guard_blocked:${missingOverrides.join(',') || 'readiness'}`);
