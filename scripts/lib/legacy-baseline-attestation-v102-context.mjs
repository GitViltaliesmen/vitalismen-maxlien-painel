import {
    assertLegacyBaselineAttestationManifestV102,
    LEGACY_BASELINE_ATTESTATION_V102_OVERRIDE_KEY
} from '../../src/services/legacyBaselineAttestationV102Service.js';

const declaredV102Overrides = [
    'ops/vitalismen-stage',
    'src/services/dropiManualBffRecoveryV98Service.js',
    'src/services/ecRepurchaseRegistrationV99Service.js',
    'src/services/protocoloGSuccessorGuardV101Service.js'
];
const previous = Array.isArray(globalThis[LEGACY_BASELINE_ATTESTATION_V102_OVERRIDE_KEY])
    ? globalThis[LEGACY_BASELINE_ATTESTATION_V102_OVERRIDE_KEY]
    : [];
globalThis[LEGACY_BASELINE_ATTESTATION_V102_OVERRIDE_KEY] = [...new Set([...previous, ...declaredV102Overrides])];

const successor = assertLegacyBaselineAttestationManifestV102();
if (JSON.stringify(successor.overrides) !== JSON.stringify(declaredV102Overrides)) {
    throw new Error('[LEGACY-BASELINE-V102] context_override_manifest_mismatch');
}

await import('./ec-runtime-successor-v97-context.mjs');
await import('../../src/services/legacyBaselineAttestationFreezeRuntimeGuardV102.js');
