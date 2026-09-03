await import('../../scripts/lib/ec-bot-core-readiness-v79-successor-context.mjs');

import { installRuntimeSuccessorContextV82 } from './runtimeSuccessorContextV82Service.js';

const state = installRuntimeSuccessorContextV82({ mode: 'runtime' });
if (!state.effectiveOverrides.includes('src/index.js')
    || state.effectiveOverrides.length < 2) {
    throw new Error('[RUNTIME-SUCCESSOR-CONTEXT-V82] runtime_override_missing');
}
