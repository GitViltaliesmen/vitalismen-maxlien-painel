import { assertEcPanelRuntimeRecoveryV115Manifest } from './ecPanelRuntimeRecoveryV115Service.js';

const result = assertEcPanelRuntimeRecoveryV115Manifest();
if (!result.ready) throw new Error('[EC-PANEL-RUNTIME-V115] runtime_guard_blocked');

globalThis.__VITALISMEN_EC_PANEL_RUNTIME_RECOVERY_V115 = Object.freeze({
    ready: true,
    version: 115,
    manifestSha256: result.manifestSha256
});

