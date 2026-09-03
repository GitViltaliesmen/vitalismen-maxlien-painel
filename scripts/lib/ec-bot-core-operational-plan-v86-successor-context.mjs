const successorOverrideKey = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
const inherited = Array.isArray(globalThis[successorOverrideKey])
    ? globalThis[successorOverrideKey]
    : [];
globalThis[successorOverrideKey] = [...new Set([
    ...inherited,
    'ops/ec-bot-core-v78',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    'src/services/canaryControllerV77Service.js',
    'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
])];

const lifecycleClassified = Boolean(
    process.env.npm_lifecycle_event
    || process.env.npm_package_json
    || process.env.VITALISMEN_V80_PROCESS_CLASSIFICATION === 'official_guard_subprocess'
);
if (lifecycleClassified) {
    await import('./runtime-successor-context-v82.mjs');
} else {
    await import('../../src/services/runtimeSuccessorContextFreezeRuntimeGuardV82.js');
}
await import('../../src/services/ecBotCoreOperationalPlanFreezeRuntimeGuardV86.js');
