import {
    assertEcBotCoreLifecycleBootV88,
    installEcBotCoreLifecycleBootContextV88
} from './ecBotCoreLifecycleBootV88Service.js';

const state = installEcBotCoreLifecycleBootContextV88({ mode: 'runtime' });
const readiness = assertEcBotCoreLifecycleBootV88();
if (readiness.ready !== true || readiness.firstImportInstalled !== true
    || !state.effectiveOverrides.includes('src/index.js')
    || !state.effectiveOverrides.includes('src/services/canaryControllerV77Service.js')) {
    throw new Error('[EC-BOT-CORE-LIFECYCLE-BOOT-V88] runtime_boot_context_missing');
}
