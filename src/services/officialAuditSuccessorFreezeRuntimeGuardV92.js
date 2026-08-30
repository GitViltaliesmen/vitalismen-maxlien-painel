import {
    assertOfficialAuditSuccessorV92,
    officialAuditSuccessorV92Files,
    OFFICIAL_AUDIT_SUCCESSOR_V92_OVERRIDE_KEY
} from './officialAuditSuccessorV92Service.js';

const readiness = assertOfficialAuditSuccessorV92();
const activeOverrides = new Set(globalThis[OFFICIAL_AUDIT_SUCCESSOR_V92_OVERRIDE_KEY] || []);
const missingOverrides = officialAuditSuccessorV92Files.modifiedAncestorProtectedFiles
    .filter((relativePath) => !activeOverrides.has(relativePath));
if (readiness.ready !== true || readiness.officialAuditChildContextBound !== true || missingOverrides.length) {
    throw new Error(`[OFFICIAL-AUDIT-SUCCESSOR-V92] runtime_guard_blocked:${missingOverrides.join(',') || 'readiness'}`);
}
