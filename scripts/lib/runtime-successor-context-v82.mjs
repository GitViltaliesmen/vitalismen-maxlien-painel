import { pathToFileURL } from 'node:url';
import path from 'node:path';

await import('./npm-lifecycle-stage-envelope-v81.mjs');
const {
    assertRuntimeSuccessorContextManifestV82,
    installRuntimeSuccessorContextV82,
    RUNTIME_SUCCESSOR_CONTEXT_V82_STATE_KEY
} = await import('../../src/services/runtimeSuccessorContextV82Service.js');

const v81State = globalThis.__VITALISMEN_V81_STAGE_ENVELOPE_STATE;
if (!v81State || v81State.version !== 81) {
    throw new Error('[RUNTIME-SUCCESSOR-CONTEXT-V82] v81_stage_context_missing');
}
const ownOption = `--import=${pathToFileURL(path.join(v81State.canonicalRoot, 'scripts/lib/runtime-successor-context-v82.mjs')).href}`;
const stripOwnOption = (key) => {
    const remaining = String(process.env[key] || '')
        .split(/\s+/)
        .filter(Boolean)
        .filter((option) => option !== ownOption)
        .join(' ');
    if (remaining) process.env[key] = remaining;
    else delete process.env[key];
};
const identity = assertRuntimeSuccessorContextManifestV82();
const context = v81State.contextActive
    ? installRuntimeSuccessorContextV82({ mode: 'official_guard' })
    : null;
stripOwnOption('NODE_OPTIONS');
if (!v81State.contextActive) {
    stripOwnOption('npm_config_node_options');
    stripOwnOption('NPM_CONFIG_NODE_OPTIONS');
}
globalThis[RUNTIME_SUCCESSOR_CONTEXT_V82_STATE_KEY] = Object.freeze({
    version: 82,
    mode: v81State.contextActive ? 'official_guard' : 'dependency_lifecycle',
    classification: v81State.classification,
    event: v81State.event,
    canonicalRoot: v81State.canonicalRoot,
    contextActive: v81State.contextActive,
    sourceIdentity: v81State.sourceIdentity,
    manifestSha256: identity.manifestSha256,
    effectiveOverrides: Object.freeze([...(context?.effectiveOverrides || [])])
});
