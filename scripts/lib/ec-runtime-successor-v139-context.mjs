import { assertEcDropiStatusPostSaleV139 } from '../guard-ec-dropi-status-postsale-v139.mjs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifest = assertEcDropiStatusPostSaleV139();
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...manifest.overrides])];
}

await import('./ec-runtime-successor-v97-context.mjs');
