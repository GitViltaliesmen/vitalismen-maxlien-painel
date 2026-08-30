import {
    assertDeployGuardAncestryV91,
    deployGuardAncestryV91Files,
    DEPLOY_GUARD_ANCESTRY_V91_OVERRIDE_KEY
} from './deployGuardAncestryV91Service.js';

const readiness = assertDeployGuardAncestryV91();
const activeOverrides = new Set(globalThis[DEPLOY_GUARD_ANCESTRY_V91_OVERRIDE_KEY] || []);
const missingOverrides = deployGuardAncestryV91Files.modifiedAncestorProtectedFiles
    .filter((relativePath) => !activeOverrides.has(relativePath));
if (readiness.ready !== true || readiness.helperChangedOnlyForGuardContext !== true || missingOverrides.length) {
    throw new Error(`[DEPLOY-GUARD-ANCESTRY-V91] runtime_guard_blocked:${missingOverrides.join(',') || 'readiness'}`);
}
