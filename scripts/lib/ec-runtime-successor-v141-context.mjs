import fs from 'node:fs';

import { assertEcMetaFunnelReconciliationV141 } from '../guard-ec-meta-funnel-reconciliation-v141.mjs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifest = assertEcMetaFunnelReconciliationV141();
const parent = JSON.parse(fs.readFileSync(
    new URL('../../docs/freeze/ec-phone-servientrega-reconciliation-v140-20260907.json', import.meta.url),
    'utf8'
));
const grandParent = JSON.parse(fs.readFileSync(
    new URL('../../docs/freeze/ec-dropi-status-postsale-v139-20260907.json', import.meta.url),
    'utf8'
));
const overrideFiles = [...new Set([
    ...(grandParent.overrides || []),
    ...(parent.overrides || []),
    ...(manifest.overrides || [])
])];
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...overrideFiles])];
}

await import('./ec-runtime-successor-v97-context.mjs');

