import {
    assertOfficialAuditSuccessorManifestV92,
    OFFICIAL_AUDIT_SUCCESSOR_V92_OVERRIDE_KEY
} from '../../src/services/officialAuditSuccessorV92Service.js';

const identity = assertOfficialAuditSuccessorManifestV92();
const remainingNodeOptions = String(process.env.NODE_OPTIONS || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((option) => !option.includes('official-audit-successor-v92-context.mjs'))
    .join(' ');
if (remainingNodeOptions) process.env.NODE_OPTIONS = remainingNodeOptions;
else delete process.env.NODE_OPTIONS;

const inherited = Array.isArray(globalThis[OFFICIAL_AUDIT_SUCCESSOR_V92_OVERRIDE_KEY])
    ? globalThis[OFFICIAL_AUDIT_SUCCESSOR_V92_OVERRIDE_KEY]
    : [];
globalThis[OFFICIAL_AUDIT_SUCCESSOR_V92_OVERRIDE_KEY] = [...new Set([
    ...inherited,
    ...identity.overrides
])];

await import('./deploy-guard-ancestry-v91-successor-context.mjs');
await import('../../src/services/officialAuditSuccessorFreezeRuntimeGuardV92.js');
