import fs from 'node:fs';

import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';
import './ec-runtime-successor-v152-e-r2-context.mjs';
import './ec-runtime-successor-v147-r6r2-context.mjs';

await import('./ec-runtime-successor-v146-context.mjs');
await import('./ec-runtime-successor-v145-context.mjs');

const v145ManifestUrl = new URL('../../docs/freeze/ec-integration-health-capi-queue-v145-20260908.json', import.meta.url);
const v145Present = fs.existsSync(v145ManifestUrl);

const manifestFiles = [
    '../../docs/freeze/ec-dropi-status-postsale-v139-20260907.json',
    '../../docs/freeze/ec-phone-servientrega-reconciliation-v140-20260907.json',
    '../../docs/freeze/ec-meta-funnel-reconciliation-v141-20260908.json',
    '../../docs/freeze/ec-panel-new-dropi-persistence-v142-20260908.json',
    '../../docs/freeze/ec-v141-v142-convergence-v143-20260908.json',
    '../../docs/freeze/ec-meta-purchase-after-manual-dropi-v144-20260908.json'
];

const overrideFiles = [];
for (const relative of manifestFiles) {
    const url = new URL(relative, import.meta.url);
    if (!fs.existsSync(url)) continue;
    const manifest = JSON.parse(fs.readFileSync(url, 'utf8'));
    overrideFiles.push(...(manifest.overrides || []));
}

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...overrideFiles])];
}

const { assertMetaPurchaseAfterManualDropiV144 } = await import('../guard-meta-purchase-after-manual-dropi-v144.mjs');
assertMetaPurchaseAfterManualDropiV144();

if (v145Present) {
    const { assertIntegrationHealthV145 } = await import('../guard-integration-health-v145.mjs');
    assertIntegrationHealthV145();
}
