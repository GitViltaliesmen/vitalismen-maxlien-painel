import {
    assertEcBotCoreCanaryClassificationV85,
    installEcBotCoreCanaryClassificationContextV85
} from './ecBotCoreCanaryClassificationV85Service.js';

const state = installEcBotCoreCanaryClassificationContextV85({ mode: 'runtime' });
const readiness = assertEcBotCoreCanaryClassificationV85();
if (readiness.ready !== true || readiness.v77EnforcementRequired !== false
    || readiness.v75EnforcementRequired !== false
    || !state.effectiveOverrides.includes('ops/ec-bot-core-v78')
    || !state.effectiveOverrides.includes('src/services/canaryControllerV77Service.js')) {
    throw new Error('[EC-BOT-CORE-CANARY-CLASSIFICATION-V85] runtime_classification_missing');
}
