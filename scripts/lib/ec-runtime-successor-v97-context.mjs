import { assertEcOperationalGuardContextManifestV97, EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';
import { assertPostSaleTransactionalV105Manifest } from '../../src/services/postSaleTransactionalControlPlaneV105Service.js';
import { assertDropiManualTransportManifestV104 } from '../../src/services/dropiManualTransportV104Service.js';
import { assertModernReleaseSourceValidationManifestV103 } from '../../src/services/modernReleaseSourceValidationV103Service.js';
import { assertDropiManualBffRecoveryManifestV98 } from '../../src/services/dropiManualBffRecoveryV98Service.js';
import { assertEcRepurchaseRegistrationManifestV99 } from '../../src/services/ecRepurchaseRegistrationV99Service.js';
import { assertEcRepurchasePanelPrecedenceManifestV100 } from '../../src/services/ecRepurchasePanelPrecedenceV100Service.js';
import { assertProtocoloGSuccessorGuardManifestV101 } from '../../src/services/protocoloGSuccessorGuardV101Service.js';
const postSaleTransactional = assertPostSaleTransactionalV105Manifest();
const postSalePrevious = Array.isArray(globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) ? globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] : [];
globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] = [...new Set([...postSalePrevious, ...postSaleTransactional.overrides])];
const transport = assertDropiManualTransportManifestV104();
const transportPrevious = Array.isArray(globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) ? globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] : [];
globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] = [...new Set([...transportPrevious, ...transport.overrides])];
const inheritedModernOverrides = [
    'ops/vitalismen-stage',
    'src/services/dropiManualBffRecoveryV98Service.js',
    'src/services/ecRepurchaseRegistrationV99Service.js',
    'src/services/protocoloGSuccessorGuardV101Service.js'
];
const inheritedModernPrevious = Array.isArray(globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) ? globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] : [];
globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] = [...new Set([...inheritedModernPrevious, ...inheritedModernOverrides])];
assertModernReleaseSourceValidationManifestV103();
const guardComposition = assertProtocoloGSuccessorGuardManifestV101();
const guardCompositionPrevious = Array.isArray(globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) ? globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] : [];
globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] = [...new Set([...guardCompositionPrevious, ...guardComposition.overrides])];
const latest = assertEcRepurchasePanelPrecedenceManifestV100();
const latestPrevious = Array.isArray(globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) ? globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] : [];
globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] = [...new Set([...latestPrevious, ...latest.overrides])];
const repurchase = assertEcRepurchaseRegistrationManifestV99();
const repurchasePrevious = Array.isArray(globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) ? globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] : [];
globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] = [...new Set([...repurchasePrevious, ...repurchase.overrides])];
const successor = assertDropiManualBffRecoveryManifestV98();
const previous = Array.isArray(globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) ? globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] : [];
globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] = [...new Set([...previous, ...successor.overrides])];
const identity = assertEcOperationalGuardContextManifestV97();
const inherited = Array.isArray(globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) ? globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] : [];
globalThis[EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY] = [...new Set([...inherited, ...identity.overrides])];
await import('./ec-runtime-successor-v96-context.mjs');
await import('../../src/services/ecOperationalGuardContextFreezeRuntimeGuardV97.js');
await import('../../src/services/dropiManualBffRecoveryFreezeRuntimeGuardV98.js');
await import('../../src/services/ecRepurchaseRegistrationFreezeRuntimeGuardV99.js');
await import('../../src/services/ecRepurchasePanelPrecedenceFreezeRuntimeGuardV100.js');
await import('../../src/services/protocoloGSuccessorGuardFreezeRuntimeGuardV101.js');
await import('../../src/services/legacyBaselineAttestationFreezeRuntimeGuardV102.js');
await import('../../src/services/modernReleaseSourceValidationFreezeRuntimeGuardV103.js');
await import('../../src/services/dropiManualTransportFreezeRuntimeGuardV104.js');
await import('../../src/services/postSaleTransactionalControlPlaneFreezeRuntimeGuardV105.js');
