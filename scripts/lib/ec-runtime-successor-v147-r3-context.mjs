import crypto from 'node:crypto';
import fs from 'node:fs';

import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifestUrl = new URL('../../docs/freeze/ec-delivered-single-gate-v147-r3-20260910.json', import.meta.url);
const manifestText = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(manifestText);
const overrides = Array.isArray(manifest.overrides) ? manifest.overrides : [];
const ancestorManifestPaths = [
    '../../docs/freeze/ec-dropi-status-postsale-v139-20260907.json',
    '../../docs/freeze/ec-phone-servientrega-reconciliation-v140-20260907.json',
    '../../docs/freeze/ec-meta-funnel-reconciliation-v141-20260908.json',
    '../../docs/freeze/ec-panel-new-dropi-persistence-v142-20260908.json',
    '../../docs/freeze/ec-v141-v142-convergence-v143-20260908.json',
    '../../docs/freeze/ec-meta-purchase-after-manual-dropi-v144-20260908.json',
    '../../docs/freeze/ec-integration-health-capi-queue-v145-20260908.json',
    '../../docs/freeze/ec-definitive-normalization-v146-20260908.json',
    '../../docs/freeze/ec-postsale-canonical-restoration-v147-20260909.json',
    '../../docs/freeze/ec-postsale-complete-v147-r2-20260910.json'
];
const inheritedOverrides = ancestorManifestPaths.flatMap((relativePath) => {
    const url = new URL(relativePath, import.meta.url);
    if (!fs.existsSync(url)) return [];
    const ancestor = JSON.parse(fs.readFileSync(url, 'utf8'));
    return Array.isArray(ancestor.overrides) ? ancestor.overrides : [];
});

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...inheritedOverrides, ...overrides])];
}

await import('./ec-runtime-successor-v147-r2-context.mjs');

for (const [relativePath, expectedSha256] of Object.entries(manifest.protectedFiles || {})) {
    if (globalThis.__VITALISMEN_V147_R4_CONTEXT?.protectedFiles?.[relativePath]) continue;
    const source = fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url));
    const actual = crypto.createHash('sha256').update(source).digest('hex');
    const successor = globalThis.__VITALISMEN_V147_R5_CONTEXT?.protectedFiles?.[relativePath];
    if (actual !== (successor || expectedSha256)) throw new Error(`[V147-R3] arquivo protegido divergente: ${relativePath}`);
}

globalThis.__VITALISMEN_V147_R3_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: crypto.createHash('sha256').update(manifestText).digest('hex'),
    overrides: Object.freeze([...overrides])
});
