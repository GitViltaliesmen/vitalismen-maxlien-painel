import {
    assertModernReleaseSourceValidationManifestV103,
    MODERN_RELEASE_SOURCE_VALIDATION_V103_OVERRIDE_KEY
} from '../../src/services/modernReleaseSourceValidationV103Service.js';

const declaredV103Overrides = ['ops/vitalismen-stage'];
const previous = Array.isArray(globalThis[MODERN_RELEASE_SOURCE_VALIDATION_V103_OVERRIDE_KEY])
    ? globalThis[MODERN_RELEASE_SOURCE_VALIDATION_V103_OVERRIDE_KEY]
    : [];
globalThis[MODERN_RELEASE_SOURCE_VALIDATION_V103_OVERRIDE_KEY] = [...new Set([...previous, ...declaredV103Overrides])];

const successor = assertModernReleaseSourceValidationManifestV103();
if (JSON.stringify(successor.overrides) !== JSON.stringify(declaredV103Overrides)) {
    throw new Error('[MODERN-RELEASE-SOURCE-V103] context_override_manifest_mismatch');
}

await import('./legacy-baseline-attestation-v102-context.mjs');
await import('../../src/services/modernReleaseSourceValidationFreezeRuntimeGuardV103.js');
