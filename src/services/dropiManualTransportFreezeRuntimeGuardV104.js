import {
    assertDropiManualTransportV104,
    dropiManualTransportV104Files,
    DROPI_MANUAL_TRANSPORT_V104_OVERRIDE_KEY
} from './dropiManualTransportV104Service.js';

const readiness = assertDropiManualTransportV104();
const active = new Set(globalThis[DROPI_MANUAL_TRANSPORT_V104_OVERRIDE_KEY] || []);
const missing = dropiManualTransportV104Files.modifiedAncestorProtectedFiles
    .filter((relativePath) => !active.has(relativePath));
if (!readiness.ready || missing.length) {
    throw new Error(`[DROPI-MANUAL-TRANSPORT-V104] runtime_guard_blocked:${missing.join(',') || 'readiness'}`);
}
