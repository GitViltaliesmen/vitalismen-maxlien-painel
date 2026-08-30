const successorOverrideKey = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
const inherited = Array.isArray(globalThis[successorOverrideKey])
    ? globalThis[successorOverrideKey]
    : [];

globalThis[successorOverrideKey] = [...new Set([
    ...inherited,
    'ops/ec-bot-core-v78',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    'src/index.js',
    'src/services/canaryControllerV77Service.js',
    'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
])];

await import('./ec-bot-core-readiness-v79-successor-context.mjs');
await import('../../src/services/ecBotCoreRuntimeBootFreezeRuntimeGuardV87.js');
