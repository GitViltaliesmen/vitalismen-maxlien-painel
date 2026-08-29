import {
    assertEcBotCoreOperationalReadinessV83,
    installEcBotCoreOperationalReadinessContextV83
} from './ecBotCoreOperationalReadinessV83Service.js';

const state = installEcBotCoreOperationalReadinessContextV83({ mode: 'runtime' });
const readiness = assertEcBotCoreOperationalReadinessV83();
if (!state.effectiveOverrides.includes('scripts/lib/ec-bot-core-operational-contract-v78.mjs')
    || !state.effectiveOverrides.includes('src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js')
    || readiness.ready !== true) {
    throw new Error('[EC-BOT-CORE-OPERATIONAL-READINESS-V83] runtime_readiness_missing');
}
