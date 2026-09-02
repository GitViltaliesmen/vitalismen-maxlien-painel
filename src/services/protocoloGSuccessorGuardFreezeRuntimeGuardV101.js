import {
    assertProtocoloGSuccessorGuardV101,
    PROTOCOLO_G_SUCCESSOR_GUARD_V101_OVERRIDE_KEY,
    protocoloGSuccessorGuardV101Files
} from './protocoloGSuccessorGuardV101Service.js';

const readiness = assertProtocoloGSuccessorGuardV101();
const active = new Set(globalThis[PROTOCOLO_G_SUCCESSOR_GUARD_V101_OVERRIDE_KEY] || []);
const missing = protocoloGSuccessorGuardV101Files.modifiedAncestorProtectedFiles
    .filter((relativePath) => !active.has(relativePath));
if (readiness.ready !== true || missing.length > 0) {
    throw new Error(`[EC-SUCCESSOR-GUARD-V101] runtime_guard_blocked:${missing.join(',') || 'readiness'}`);
}
