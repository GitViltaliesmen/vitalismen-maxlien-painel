import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY
} from './npmLifecyclePreloadBootstrapV80Service.js';
import { resolveCanonicalStageProjectRootV81 } from './npmLifecycleStageEnvelopeCompatibilityV81Service.js';

const resolved = resolveCanonicalStageProjectRootV81();
if (resolved.cwd !== resolved.root) {
    throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] runtime_guard_requires_canonical_root');
}
await import(pathToFileURL(path.join(
    resolved.root,
    'scripts/lib/ec-bot-core-readiness-v79-successor-context.mjs'
)).href);
const inherited = Array.isArray(globalThis[NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY])
    ? globalThis[NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY]
    : [];
globalThis[NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY] = [...new Set([
    ...inherited,
    ...(resolved.manifestV81.declaredAncestorOverrides || [])
])];
await import(pathToFileURL(path.join(
    resolved.root,
    'src/services/ecBotCoreReadinessFreezeRuntimeGuardV79.js'
)).href);

if (
    resolved.manifestV81.policy?.helperFreezeVersion !== 72
    || resolved.manifestV81.policy?.runtimeGuardChainVersion !== 71
    || resolved.manifestV81.policy?.dataCompatibilityVersion !== 66
    || resolved.manifestV81.policy?.datasetId !== '1468946114265008'
    || resolved.manifestV81.policy?.mutatingSchedulersAllowed !== false
    || resolved.manifestV81.policy?.dropiApplyAllowed !== false
    || resolved.manifestV81.policy?.metaPurchaseAllowed !== false
) {
    throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] immutable_contract_invalid');
}

console.log('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] envelope V72/V71/V66 oficial validado; V80/V79/V78 íntegras; nenhuma ativação autorizada pelo guard.');
