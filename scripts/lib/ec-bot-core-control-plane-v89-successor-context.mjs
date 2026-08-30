import path from 'node:path';
import { fileURLToPath } from 'node:url';

const successorOverrideKey = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rootPackageJson = path.join(root, 'package.json');
const samePath = (left, right) => process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
const packageJson = String(process.env.npm_package_json || '').trim();
const npmLifecycle = Boolean(process.env.npm_lifecycle_event || packageJson);
const dependencyLifecycle = npmLifecycle && (
    !packageJson || !samePath(path.resolve(packageJson), rootPackageJson)
);

const remainingNodeOptions = String(process.env.NODE_OPTIONS || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((option) => !option.includes('ec-bot-core-control-plane-v89-successor-context.mjs'))
    .join(' ');
if (remainingNodeOptions) process.env.NODE_OPTIONS = remainingNodeOptions;
else delete process.env.NODE_OPTIONS;

if (!dependencyLifecycle) {
    const inherited = Array.isArray(globalThis[successorOverrideKey])
        ? globalThis[successorOverrideKey]
        : [];
    globalThis[successorOverrideKey] = [...new Set([
        ...inherited,
        'ops/ec-bot-core-v78',
        'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
        'src/index.js',
        'src/services/ecBotCoreLifecycleBootV88Service.js',
        'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js',
        'tests/ec-bot-core-lifecycle-boot-v88.test.mjs'
    ])];
    await import('./ec-bot-core-lifecycle-boot-v88-successor-context.mjs');
    await import('../../src/services/ecBotCoreControlPlaneFreezeRuntimeGuardV89.js');
}
