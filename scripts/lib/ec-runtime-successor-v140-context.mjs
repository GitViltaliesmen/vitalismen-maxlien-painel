import { assertEcPhoneServientregaReconciliationV140 } from '../guard-ec-phone-servientrega-reconciliation-v140.mjs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';
import fs from 'node:fs';

const manifest = assertEcPhoneServientregaReconciliationV140();
const parentManifest = JSON.parse(fs.readFileSync(
    new URL('../../docs/freeze/ec-dropi-status-postsale-v139-20260907.json', import.meta.url),
    'utf8'
));
const overrideFiles = [...new Set([...(parentManifest.overrides || []), ...(manifest.overrides || [])])];
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...overrideFiles])];
}

await import('./ec-runtime-successor-v97-context.mjs');
