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
await import('../../src/services/ecBotCoreOperationalReadinessFreezeRuntimeGuardV83.js');
