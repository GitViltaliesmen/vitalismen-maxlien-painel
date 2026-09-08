import fs from 'node:fs';

import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifest = JSON.parse(fs.readFileSync(
    new URL('../../docs/freeze/ec-meta-purchase-after-manual-dropi-v144-20260908.json', import.meta.url),
    'utf8'
));
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...(manifest.overrides || [])])];
}

const { assertMetaPurchaseAfterManualDropiV144 } = await import('../guard-meta-purchase-after-manual-dropi-v144.mjs');
assertMetaPurchaseAfterManualDropiV144();
await import('./ec-runtime-successor-v97-context.mjs');
