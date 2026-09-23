import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import './ec-runtime-successor-v170-context.mjs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const hashBuffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => hashBuffer(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)));
const canonicalJson = (relative) => {
    const text = fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`, `${relative} must be canonical JSON`);
    return { text, value };
};

const current = canonicalJson('docs/freeze/ec-dropi-pickup-status-sync-v168b-20260916.json');
const parent = canonicalJson('docs/freeze/ec-v148-browser-pixel-guard-successor-v168a-pr-20260916.json');
const manifest = current.value;

assert.equal(manifest.freezeId, 'EC_DROPI_PICKUP_STATUS_SYNC_V168B_20260916');
assert.equal(manifest.version, 'V168B');
assert.equal(manifest.parentCommit, '4a259499ccafe286d6650aa95115023f183f58fe');
assert.equal(manifest.parentTree, 'a64e0c750ec6207239469890ef6d48545926333b');
assert.equal(manifest.parentManifest, 'docs/freeze/ec-v148-browser-pixel-guard-successor-v168a-pr-20260916.json');
assert.equal(manifest.parentManifestSha256, hashBuffer(parent.text));
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());
assert.equal(manifest.overrides.some((file) => /[*?\[\]]/.test(file)), false);
const laterSuccessorOverrides = new Set(globalThis.__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT?.authorizedFiles || []);
for (const [file, expected] of Object.entries(manifest.protectedFiles || {})) {
    if (laterSuccessorOverrides.has(file)) continue;
    assert.equal(hashFile(file), expected, `[V168B] ${file}`);
}

for (const [field, expected] of Object.entries({
    source: 'DROPI_ORDERS_API_AUTHENTICATED',
    exactPickupReleaseRequired: true,
    trackingNumberRequired: true,
    dropiOrderIdRequired: true,
    agencyPickupRequired: true,
    servientregaRequired: true,
    terminalCarrierPrecedence: true,
    historyDedupeRequired: true,
    persistentLedgerRequired: true,
    automaticBulkSend: false,
    dropiOrderCreationChanged: false,
    metaCapiChanged: false,
    whatsappProviderChanged: false
})) assert.equal(manifest.policy?.[field], expected, field);

globalThis.__VITALISMEN_V168B_DROPI_STATUS_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: hashBuffer(current.text),
    protectedFiles: Object.freeze(Object.fromEntries(
        Object.entries(manifest.protectedFiles || {}).filter(([file]) => !laterSuccessorOverrides.has(file))
    ))
});
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...(manifest.overrides || []), ...laterSuccessorOverrides])];
}
