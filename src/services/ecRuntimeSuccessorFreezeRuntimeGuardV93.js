import {
    assertEcRuntimeSuccessorV93,
    ecRuntimeSuccessorV93Files,
    EC_RUNTIME_SUCCESSOR_V93_OVERRIDE_KEY
} from './ecRuntimeSuccessorV93Service.js';

const readiness = assertEcRuntimeSuccessorV93();
const activeOverrides = new Set(globalThis[EC_RUNTIME_SUCCESSOR_V93_OVERRIDE_KEY] || []);
const missingOverrides = ecRuntimeSuccessorV93Files.modifiedAncestorProtectedFiles
    .filter((relativePath) => !activeOverrides.has(relativePath));
if (readiness.ready !== true || readiness.pm2TargetContextBound !== true || missingOverrides.length) {
    throw new Error(`[EC-RUNTIME-SUCCESSOR-V93] runtime_guard_blocked:${missingOverrides.join(',') || 'readiness'}`);
}
