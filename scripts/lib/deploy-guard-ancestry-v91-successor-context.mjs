import {
    assertDeployGuardAncestryManifestV91,
    DEPLOY_GUARD_ANCESTRY_V91_OVERRIDE_KEY
} from '../../src/services/deployGuardAncestryV91Service.js';

const identity = assertDeployGuardAncestryManifestV91();
const remainingNodeOptions = String(process.env.NODE_OPTIONS || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((option) => !option.includes('deploy-guard-ancestry-v91-successor-context.mjs'))
    .join(' ');
if (remainingNodeOptions) process.env.NODE_OPTIONS = remainingNodeOptions;
else delete process.env.NODE_OPTIONS;

const inherited = Array.isArray(globalThis[DEPLOY_GUARD_ANCESTRY_V91_OVERRIDE_KEY])
    ? globalThis[DEPLOY_GUARD_ANCESTRY_V91_OVERRIDE_KEY]
    : [];
globalThis[DEPLOY_GUARD_ANCESTRY_V91_OVERRIDE_KEY] = [...new Set([
    ...inherited,
    ...identity.overrides
])];

await import('./ec-bot-core-control-plane-v89-successor-context.mjs');
await import('../../src/services/deployGuardAncestryFreezeRuntimeGuardV91.js');
