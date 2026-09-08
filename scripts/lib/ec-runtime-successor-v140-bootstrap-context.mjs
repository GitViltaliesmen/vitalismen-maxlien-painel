import fs from 'node:fs';
import { assertEcPhoneServientregaReconciliationV140 } from '../guard-ec-phone-servientrega-reconciliation-v140.mjs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifestUrl = new URL('../../docs/freeze/ec-phone-servientrega-reconciliation-v140-20260907.json', import.meta.url);
const v141ManifestUrl = new URL('../../docs/freeze/ec-meta-funnel-reconciliation-v141-20260908.json', import.meta.url);

if (fs.existsSync(v141ManifestUrl)) {
    const manifest = JSON.parse(fs.readFileSync(v141ManifestUrl, 'utf8'));
    const parentManifest = JSON.parse(fs.readFileSync(manifestUrl, 'utf8'));
    const grandParentManifest = JSON.parse(fs.readFileSync(
        new URL('../../docs/freeze/ec-dropi-status-postsale-v139-20260907.json', import.meta.url),
        'utf8'
    ));
    const overrideFiles = [...new Set([
        ...(grandParentManifest.overrides || []),
        ...(parentManifest.overrides || []),
        ...(manifest.overrides || [])
    ])];
    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...overrideFiles])];
    }
} else if (fs.existsSync(manifestUrl)) {
    const manifest = assertEcPhoneServientregaReconciliationV140();
    const parentManifest = JSON.parse(fs.readFileSync(
        new URL('../../docs/freeze/ec-dropi-status-postsale-v139-20260907.json', import.meta.url),
        'utf8'
    ));
    const overrideFiles = [...new Set([...(parentManifest.overrides || []), ...(manifest.overrides || [])])];
    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...overrideFiles])];
    }
}
