import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    META_CANONICAL_DATASET_EC_V195,
    META_HISTORICAL_PROTOCOLO_G_DATASET_V195,
    META_LEGACY_DATASET_EC_V195,
    resolveMetaCanonicalConsolidationV195
} from '../src/services/metaCanonicalConsolidationV195Service.js';

const MANIFEST = 'docs/freeze/meta-canonical-consolidation-v195-20260923.json';
const text = fs.readFileSync(MANIFEST, 'utf8');
const manifest = JSON.parse(text);
const sha256 = (relativePath) => crypto.createHash('sha256').update(fs.readFileSync(relativePath)).digest('hex');

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`, 'V195 manifesto não canônico');
assert.equal(manifest.freezeId, 'META_CANONICAL_CONSOLIDATION_V195_20260923');
assert.equal(manifest.version, 'V195');
assert.equal(manifest.baseCommit, '8c25ed9912abc4aabee2656cf9192420389934c6');
assert.equal(manifest.policy.canonicalDataset, META_CANONICAL_DATASET_EC_V195);
assert.equal(manifest.policy.legacyDataset, META_LEGACY_DATASET_EC_V195);
assert.equal(manifest.policy.historicalProtocoloGDataset, META_HISTORICAL_PROTOCOLO_G_DATASET_V195);
assert.equal(manifest.policy.dualSendAllowed, false);
assert.equal(manifest.policy.historicalReplayAllowed, false);
assert.equal(manifest.policy.purchaseTestAllowed, false);
assert.equal(manifest.policy.vslChanged, false);
assert.equal(manifest.policy.botChanged, false);
assert.equal(manifest.policy.dropiChanged, false);
assert.equal(manifest.policy.zapiChanged, false);
assert.equal(manifest.policy.guardsBypassed, false);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());

for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
    assert.equal(fs.existsSync(file), true, `V195 arquivo ausente: ${file}`);
    assert.equal(sha256(file), expected, `V195 freeze divergente: ${file}`);
}

const active = resolveMetaCanonicalConsolidationV195({
    META_CANONICAL_CONSOLIDATION_EC_APPROVED: 'true',
    META_CANONICAL_DATASET_EC: META_CANONICAL_DATASET_EC_V195,
    META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G: 'guard-token-v195'
});
assert.equal(active.enabled, true);
assert.equal(active.destination.pixelId, META_CANONICAL_DATASET_EC_V195);
assert.equal(active.destination.browserPixelId, META_CANONICAL_DATASET_EC_V195);

const source = fs.readFileSync('src/services/metaConversionsService.js', 'utf8');
assert.match(source, /resolveMetaCanonicalConsolidationV195/);
assert.match(source, /expectedMetaEcDatasetV195/);
assert.match(source, /explicitTestEventCode/);
assert.doesNotMatch(source, /axios\.post\([^\n]+1468946114265008/);

console.log('META_CANONICAL_CONSOLIDATION_V195_GUARD=PASS');
console.log('CANONICAL_DATASET=920532663934291');
console.log('LEGACY_DATASET_NEW_EVENTS=FORBIDDEN');
console.log('HISTORICAL_REPLAY=NO');
console.log('DUAL_SEND=NO');
console.log('PURCHASE_TEST=NO');
