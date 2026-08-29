import {
    assertEcBotCoreActivationHealthV84,
    installEcBotCoreActivationHealthContextV84
} from './ecBotCoreActivationHealthV84Service.js';

const state = installEcBotCoreActivationHealthContextV84({ mode: 'runtime' });
const readiness = assertEcBotCoreActivationHealthV84();
if (readiness.ready !== true || readiness.healthAttempts !== 30 || readiness.healthDelaySeconds !== 2
    || !state.effectiveOverrides.includes('ops/ec-bot-core-v78')) {
    throw new Error('[EC-BOT-CORE-ACTIVATION-HEALTH-V84] runtime_health_stabilization_missing');
}
