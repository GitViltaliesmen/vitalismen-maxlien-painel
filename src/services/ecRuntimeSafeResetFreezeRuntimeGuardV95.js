import {
    assertEcRuntimeSafeResetV95,
    ecRuntimeSafeResetV95Files,
    EC_RUNTIME_SAFE_RESET_V95_OVERRIDE_KEY
} from './ecRuntimeSafeResetV95Service.js';

const readiness = assertEcRuntimeSafeResetV95();
const activeOverrides = new Set(globalThis[EC_RUNTIME_SAFE_RESET_V95_OVERRIDE_KEY] || []);
const missingOverrides = ecRuntimeSafeResetV95Files.modifiedAncestorProtectedFiles
    .filter((relativePath) => !activeOverrides.has(relativePath));
if (readiness.ready !== true || readiness.safeOperationalIdentityReset !== true || missingOverrides.length) {
    throw new Error(`[EC-RUNTIME-SAFE-RESET-V95] runtime_guard_blocked:${missingOverrides.join(',') || 'readiness'}`);
}
