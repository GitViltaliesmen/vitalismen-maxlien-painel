import {
    assertEcRepurchaseRegistrationV99,
    EC_REPURCHASE_REGISTRATION_V99_OVERRIDE_KEY,
    ecRepurchaseRegistrationV99Files
} from './ecRepurchaseRegistrationV99Service.js';

const readiness = assertEcRepurchaseRegistrationV99();
const active = new Set(globalThis[EC_REPURCHASE_REGISTRATION_V99_OVERRIDE_KEY] || []);
const missing = ecRepurchaseRegistrationV99Files.modifiedAncestorProtectedFiles
    .filter((relativePath) => !active.has(relativePath));
if (readiness.ready !== true || missing.length > 0) {
    throw new Error(`[EC-REPURCHASE-REGISTRATION-V99] runtime_guard_blocked:${missing.join(',') || 'readiness'}`);
}
