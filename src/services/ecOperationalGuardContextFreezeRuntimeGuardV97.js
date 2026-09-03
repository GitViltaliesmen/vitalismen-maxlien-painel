import { assertEcOperationalGuardContextV97, ecOperationalGuardContextV97Files, EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from './ecOperationalGuardContextV97Service.js';
const readiness = assertEcOperationalGuardContextV97();
const active = new Set(globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] || []);
const missing = ecOperationalGuardContextV97Files.modifiedAncestorProtectedFiles.filter((relativePath) => !active.has(relativePath));
if (readiness.ready !== true || readiness.operationalGuardUsesFullSuccessorContext !== true || missing.length) throw new Error(`[EC-OPERATIONAL-GUARD-CONTEXT-V97] runtime_guard_blocked:${missing.join(',') || 'readiness'}`);
