import fs from 'node:fs';

import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const manifestFiles = [
    '../../docs/freeze/ec-dropi-status-postsale-v139-20260907.json',
    '../../docs/freeze/ec-phone-servientrega-reconciliation-v140-20260907.json',
    '../../docs/freeze/ec-meta-funnel-reconciliation-v141-20260908.json',
    '../../docs/freeze/ec-panel-new-dropi-persistence-v142-20260908.json',
    '../../docs/freeze/ec-v141-v142-convergence-v143-20260908.json'
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
