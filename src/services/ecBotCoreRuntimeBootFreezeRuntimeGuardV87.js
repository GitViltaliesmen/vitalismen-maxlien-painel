import {
    assertEcBotCoreRuntimeBootV87,
    installEcBotCoreRuntimeBootContextV87
} from './ecBotCoreRuntimeBootV87Service.js';

const state = installEcBotCoreRuntimeBootContextV87({ mode: 'runtime' });
const readiness = assertEcBotCoreRuntimeBootV87();
if (readiness.ready !== true || readiness.firstImportInstalled !== true
    || !state.effectiveOverrides.includes('src/index.js')
    || !state.effectiveOverrides.includes('src/services/canaryControllerV77Service.js')) {
    throw new Error('[EC-BOT-CORE-RUNTIME-BOOT-V87] runtime_boot_context_missing');
}
