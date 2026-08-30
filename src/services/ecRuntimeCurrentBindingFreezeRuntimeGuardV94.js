import {
    assertEcRuntimeCurrentBindingV94,
    ecRuntimeCurrentBindingV94Files,
    EC_RUNTIME_CURRENT_BINDING_V94_OVERRIDE_KEY
} from './ecRuntimeCurrentBindingV94Service.js';

const readiness = assertEcRuntimeCurrentBindingV94();
const activeOverrides = new Set(globalThis[EC_RUNTIME_CURRENT_BINDING_V94_OVERRIDE_KEY] || []);
const missingOverrides = ecRuntimeCurrentBindingV94Files.modifiedAncestorProtectedFiles
    .filter((relativePath) => !activeOverrides.has(relativePath));
if (readiness.ready !== true || readiness.pm2UsesCurrentSymlink !== true || missingOverrides.length) {
    throw new Error(`[EC-RUNTIME-CURRENT-BINDING-V94] runtime_guard_blocked:${missingOverrides.join(',') || 'readiness'}`);
}
