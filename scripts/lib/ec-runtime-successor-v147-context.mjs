import crypto from 'node:crypto';
import fs from 'node:fs';

import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifestUrl = new URL('../../docs/freeze/ec-postsale-canonical-restoration-v147-20260909.json', import.meta.url);
const manifestText = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(manifestText);
const overrides = Array.isArray(manifest.overrides) ? manifest.overrides : [];

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...overrides])];
}

for (const [relativePath, expectedSha256] of Object.entries(manifest.protectedFiles || {})) {
    const source = fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url));
    const actual = crypto.createHash('sha256').update(source).digest('hex');
    if (actual !== expectedSha256) throw new Error(`[V147] arquivo protegido divergente: ${relativePath}`);
}

globalThis.__VITALISMEN_V147_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: crypto.createHash('sha256').update(manifestText).digest('hex'),
    overrides: Object.freeze([...overrides])
});
