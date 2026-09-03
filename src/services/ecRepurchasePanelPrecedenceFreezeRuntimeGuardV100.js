import {
    assertEcRepurchasePanelPrecedenceV100,
    EC_REPURCHASE_PANEL_PRECEDENCE_V100_OVERRIDE_KEY,
    ecRepurchasePanelPrecedenceV100Files
} from './ecRepurchasePanelPrecedenceV100Service.js';

const readiness = assertEcRepurchasePanelPrecedenceV100();
const active = new Set(globalThis[EC_REPURCHASE_PANEL_PRECEDENCE_V100_OVERRIDE_KEY] || []);
const missing = ecRepurchasePanelPrecedenceV100Files.modifiedAncestorProtectedFiles
    .filter((relativePath) => !active.has(relativePath));
if (readiness.ready !== true || missing.length > 0) {
    throw new Error(`[EC-REPURCHASE-PANEL-PRECEDENCE-V100] runtime_guard_blocked:${missing.join(',') || 'readiness'}`);
}
