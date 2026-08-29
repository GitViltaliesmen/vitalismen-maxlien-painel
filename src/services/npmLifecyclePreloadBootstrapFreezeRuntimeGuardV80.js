import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import {
    NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY,
    resolveCanonicalProjectRootV80
} from './npmLifecyclePreloadBootstrapV80Service.js';

const directEntry = Boolean(process.argv[1])
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
const resolved = resolveCanonicalProjectRootV80();
if (resolved.cwd !== resolved.root) {
    throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] runtime_guard_requires_canonical_root');
}

const inherited = Array.isArray(globalThis[NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY])
    ? globalThis[NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY]
    : [];
globalThis[NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY] = [...new Set([
    ...inherited,
    ...(resolved.manifest.declaredAncestorOverrides || [])
])];

try {
    await import(pathToFileURL(path.join(
        resolved.root,
        'src/services/ecBotCoreReadinessFreezeRuntimeGuardV79.js'
    )).href);
} finally {
    if (inherited.length) globalThis[NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY] = inherited;
    else delete globalThis[NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY];
}

if (
    resolved.manifest.policy?.datasetId !== '1468946114265008'
    || resolved.manifest.policy?.browserCapiEquality !== 'PASS'
    || resolved.manifest.policy?.vslPublicOriginConformance !== 'PASS'
    || resolved.manifest.policy?.mutatingSchedulersAllowed !== false
    || resolved.manifest.policy?.dropiApplyAllowed !== false
    || resolved.manifest.policy?.metaPurchaseAllowed !== false
    || resolved.manifest.policy?.whatsappMessagesSent !== 0
    || resolved.manifest.policy?.metaEventsSent !== 0
) {
    throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] immutable_operational_contract_invalid');
}

if (directEntry) {
    console.log('[NPM-LIFECYCLE-PRELOAD-V80] V80 → V79 → V78 íntegra; bootstrap cwd-independent e lifecycle-safe; nenhuma ativação autorizada.');
}
