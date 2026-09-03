import {
    assertModernReleaseSourceValidationV103,
    modernReleaseSourceValidationV103Files,
    MODERN_RELEASE_SOURCE_VALIDATION_V103_OVERRIDE_KEY
} from './modernReleaseSourceValidationV103Service.js';

const readiness = assertModernReleaseSourceValidationV103();
const active = new Set(globalThis[MODERN_RELEASE_SOURCE_VALIDATION_V103_OVERRIDE_KEY] || []);
const missing = modernReleaseSourceValidationV103Files.modifiedAncestorProtectedFiles
    .filter((relativePath) => !active.has(relativePath));
if (!readiness.ready || missing.length) {
    throw new Error(`[MODERN-RELEASE-SOURCE-V103] runtime_guard_blocked:${missing.join(',') || 'readiness'}`);
}
