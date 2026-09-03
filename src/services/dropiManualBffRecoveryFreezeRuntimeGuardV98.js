import {
    assertDropiManualBffRecoveryV98,
    DROPI_MANUAL_BFF_RECOVERY_V98_OVERRIDE_KEY,
    dropiManualBffRecoveryV98Files
} from './dropiManualBffRecoveryV98Service.js';

const readiness = assertDropiManualBffRecoveryV98();
const active = new Set(globalThis[DROPI_MANUAL_BFF_RECOVERY_V98_OVERRIDE_KEY] || []);
const missing = dropiManualBffRecoveryV98Files.modifiedAncestorProtectedFiles
    .filter((relativePath) => !active.has(relativePath));
if (readiness.ready !== true || missing.length > 0) {
    throw new Error(`[DROPI-MANUAL-BFF-RECOVERY-V98] runtime_guard_blocked:${missing.join(',') || 'readiness'}`);
}
