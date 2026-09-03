import {
    assertEcBotCoreControlPlaneV89,
    installEcBotCoreControlPlaneContextV89
} from './ecBotCoreControlPlaneV89Service.js';

const state = installEcBotCoreControlPlaneContextV89({ mode: 'runtime' });
const readiness = assertEcBotCoreControlPlaneV89();
if (readiness.ready !== true || readiness.firstImportInstalled !== true
    || readiness.pm2TargetEnvironmentIsolated !== true
    || !state.effectiveOverrides.includes('src/index.js')) {
    throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] runtime_control_plane_context_missing');
}
