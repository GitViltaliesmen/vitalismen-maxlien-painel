import fs from 'node:fs';

const v141ManifestUrl = new URL('../../docs/freeze/ec-meta-funnel-reconciliation-v141-20260908.json', import.meta.url);
const v143ManifestUrl = new URL('../../docs/freeze/ec-v141-v142-convergence-v143-20260908.json', import.meta.url);

if (fs.existsSync(v143ManifestUrl)) {
    await import('./ec-runtime-successor-v143-context.mjs');
} else if (fs.existsSync(v141ManifestUrl)) {
    await import('./ec-runtime-successor-v141-context.mjs');
} else {
    const { assertEcPhoneServientregaReconciliationV140 } = await import('../guard-ec-phone-servientrega-reconciliation-v140.mjs');
    const { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } = await import('../../src/services/ecOperationalGuardContextV97Service.js');
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
}
