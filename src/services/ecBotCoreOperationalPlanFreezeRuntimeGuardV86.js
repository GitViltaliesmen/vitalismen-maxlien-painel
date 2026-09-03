import {
    assertEcBotCoreOperationalPlanV86,
    installEcBotCoreOperationalPlanContextV86
} from './ecBotCoreOperationalPlanV86Service.js';

const state = installEcBotCoreOperationalPlanContextV86({ mode: 'runtime' });
const readiness = assertEcBotCoreOperationalPlanV86();
if (readiness.ready !== true || readiness.ancestralPlanGuardCalled !== false
    || readiness.successorPlanGuardCalled !== true
    || !state.effectiveOverrides.includes('ops/ec-bot-core-v78')
    || !state.effectiveOverrides.includes('src/services/canaryControllerV77Service.js')) {
    throw new Error('[EC-BOT-CORE-OPERATIONAL-PLAN-V86] runtime_plan_alignment_missing');
}
