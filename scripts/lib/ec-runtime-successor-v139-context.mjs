import fs from 'node:fs';

const v140ManifestUrl = new URL('../../docs/freeze/ec-phone-servientrega-reconciliation-v140-20260907.json', import.meta.url);

if (fs.existsSync(v140ManifestUrl)) {
    await import('./ec-runtime-successor-v140-context.mjs');
} else {
    const { assertEcDropiStatusPostSaleV139 } = await import('../guard-ec-dropi-status-postsale-v139.mjs');
    const { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } = await import('../../src/services/ecOperationalGuardContextV97Service.js');
    const manifest = assertEcDropiStatusPostSaleV139();
    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...manifest.overrides])];
    }
    await import('./ec-runtime-successor-v97-context.mjs');
}
