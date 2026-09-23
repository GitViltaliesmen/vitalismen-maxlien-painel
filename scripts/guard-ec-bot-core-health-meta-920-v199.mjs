import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    EC_BOT_CORE_V78_DATASET_ID,
    EC_BOT_CORE_V78_MODE,
    EC_BOT_CORE_V195_CANONICAL_DATASET_ID,
    EC_BOT_CORE_V195_CANONICAL_META_PROFILE,
    assertEcBotCoreV78Health,
    expectedEcBotCoreV78HealthDataset
} from '../src/services/ecBotCoreOperationalV78Service.js';
import {
    assertEcBotCoreV78PreActivationHealth
} from './lib/ec-bot-core-operational-contract-v78.mjs';

const MANIFEST = 'docs/freeze/ec-bot-core-health-meta-920-successor-v199-20260923.json';
const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const manifestText = read(MANIFEST).toString('utf8');
const manifest = JSON.parse(manifestText);

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_BOT_CORE_HEALTH_META_920_SUCCESSOR_V199_20260923');
assert.equal(manifest.policy?.legacyContractPreserved, true);
assert.equal(manifest.policy?.canonicalProfileExactMatchRequired, true);
assert.equal(manifest.policy?.failClosed, true);
assert.equal(manifest.policy?.genericRelaxation, false);
assert.equal(manifest.policy?.productionChanged, false);
assert.equal(manifest.policy?.gitProductionChanged, false);
assert.equal(manifest.policy?.v198Changed, false);

for (const [relativePath, expected] of Object.entries(manifest.protectedFiles || {})) {
    assert.equal(sha256(read(relativePath)), expected, `V199_HASH_MISMATCH:${relativePath}`);
}

assert.equal(EC_BOT_CORE_V78_DATASET_ID, manifest.policy.legacyDataset);
assert.equal(EC_BOT_CORE_V195_CANONICAL_META_PROFILE, manifest.policy.canonicalProfile);
assert.equal(EC_BOT_CORE_V195_CANONICAL_DATASET_ID, manifest.policy.canonicalDataset);

const healthy = {
    status: 'online',
    engine: 'Z-API',
    zapi: { connected: true, outboundBlocked: false },
    automationSafety: {
        mode: EC_BOT_CORE_V78_MODE,
        botCoreOperational: true,
        mutatingSchedulers: 0,
        dropiApplyAllowed: false,
        metaPurchaseAllowed: false
    }
};
const destination = (profile, datasetId, browserPixelId = datasetId) => ({
    profile,
    datasetId,
    browserPixelId,
    browserServerSynchronized: true
});

const legacy = destination('', EC_BOT_CORE_V78_DATASET_ID);
const canonical = destination(EC_BOT_CORE_V195_CANONICAL_META_PROFILE, EC_BOT_CORE_V195_CANONICAL_DATASET_ID);
assert.equal(expectedEcBotCoreV78HealthDataset(legacy), EC_BOT_CORE_V78_DATASET_ID);
assert.equal(expectedEcBotCoreV78HealthDataset(canonical), EC_BOT_CORE_V195_CANONICAL_DATASET_ID);
assert.equal(assertEcBotCoreV78Health(healthy, legacy).ok, true);
assert.equal(assertEcBotCoreV78PreActivationHealth(healthy, legacy).ok, true);
assert.equal(assertEcBotCoreV78Health(healthy, canonical).ok, true);
assert.equal(assertEcBotCoreV78PreActivationHealth(healthy, canonical).ok, true);

for (const blocked of [
    destination(EC_BOT_CORE_V195_CANONICAL_META_PROFILE, '9999999999999999'),
    destination('', EC_BOT_CORE_V195_CANONICAL_DATASET_ID),
    destination('META_CANONICAL_920_V195', EC_BOT_CORE_V195_CANONICAL_DATASET_ID),
    destination(EC_BOT_CORE_V195_CANONICAL_META_PROFILE, EC_BOT_CORE_V195_CANONICAL_DATASET_ID, EC_BOT_CORE_V78_DATASET_ID)
]) {
    assert.throws(() => assertEcBotCoreV78Health(healthy, blocked), /meta_dataset_invalid|browser_pixel_invalid/);
    assert.throws(() => assertEcBotCoreV78PreActivationHealth(healthy, blocked), /meta_dataset_invalid|browser_pixel_invalid/);
}

console.log('EC_BOT_CORE_HEALTH_META_920_V199_GUARD=PASS');
