import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './repurchase-v141-v185-governance-v202-r1-context.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = 'docs/freeze/repurchase-v141-v185-governance-successor-v202-r2-20260924.json';
const PRELOAD = 'scripts/lib/repurchase-v141-v185-governance-v202-r2-context.mjs';
const EXPECTED_MANIFEST_SHA256 = '5c2c1990f2cc614e9367e210e3678f63944a6dadd36ddec3772cb74ffb060f0e';
const read = relative => fs.readFileSync(path.join(ROOT, relative));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blobOid = bytes => crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
const governancePaths = new Set([
    'docs/freeze/repurchase-v141-v185-governance-successor-v202-20260924.json',
    'docs/freeze/repurchase-v141-v185-governance-successor-v202-r1-20260924.json',
    MANIFEST,
    'docs/freeze/repurchase-v100-v99-eol-successor-v202-r3-20260924.json',
    'scripts/guard-repurchase-v141-v185-governance-v202.mjs',
    'scripts/guard-repurchase-v141-v185-governance-v202-r1.mjs',
    'scripts/guard-repurchase-v141-v185-governance-v202-r2.mjs',
    'scripts/guard-repurchase-v100-v99-eol-successor-v202-r3.mjs',
    'scripts/lib/repurchase-v141-v185-governance-v202-r1-context.mjs',
    PRELOAD,
    'scripts/run-repurchase-v141-v185-governance-v202.mjs',
    'scripts/run-repurchase-v141-v185-governance-v202-r2.mjs',
    'scripts/run-repurchase-v100-v99-eol-successor-v202-r3.mjs',
    'tests/repurchase-v141-v185-governance-v202.test.mjs',
    'tests/repurchase-v141-v185-governance-v202-r1.test.mjs',
    'tests/repurchase-v141-v185-governance-v202-r2.test.mjs',
    'tests/repurchase-v100-v99-eol-successor-v202-r3.test.mjs'
]);

export const assertR2ManifestBytes = bytes => {
    const text = bytes.toString('utf8');
    const candidate = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(candidate, null, 2)}\n`, 'V202_R2_MANIFEST_NOT_CANONICAL');
    assert.equal(sha256(bytes), EXPECTED_MANIFEST_SHA256, 'V202_R2_MANIFEST_TAMPERED');
    assert.equal(candidate.freezeId, 'REPURCHASE_V141_TO_V185_GOVERNANCE_V202_R2_20260924');
    assert.equal(candidate.version, 'V202-R2');
    assert.equal(candidate.policy.failClosed, true);
    assert.equal(candidate.policy.noHistoricalGuardBypass, true);
    return candidate;
};

export const assertCanonicalEvidence = (relative, raw, identity) => {
    assert.ok(Buffer.isBuffer(raw), `V202_R2_BUFFER_REQUIRED:${relative}`);
    const source = raw.toString('utf8');
    assert.deepEqual(Buffer.from(source, 'utf8'), raw, `V202_R2_UTF8_INVALID:${relative}`);
    const crlf = (source.match(/\r\n/g) || []).length;
    const linefeeds = (source.match(/\n/g) || []).length;
    assert.equal((source.match(/\r(?!\n)/g) || []).length, 0,
        `V202_R2_BARE_CR_FORBIDDEN:${relative}`);
    assert.ok(crlf === 0 || crlf === linefeeds, `V202_R2_MIXED_EOL_FORBIDDEN:${relative}`);
    const canonical = Buffer.from(source.replace(/\r\n/g, '\n'), 'utf8');
    assert.equal(sha256(canonical), identity.sha256, `V202_R2_HISTORICAL_SHA_INVALID:${relative}`);
    assert.equal(blobOid(canonical), identity.blobOid, `V202_R2_HISTORICAL_BLOB_INVALID:${relative}`);
    return canonical;
};

export const classifyShipmentsContext = ({ context, shipmentsSha256 }, manifest) => {
    if (context === 'HISTORICAL_V183_V186') {
        assert.equal(shipmentsSha256, manifest.historicalShipmentsSha256,
            'V202_R2_HISTORICAL_HASH_MISMATCH');
        return 'HISTORICAL_PASS';
    }
    if (context === manifest.freezeId) {
        assert.equal(shipmentsSha256, manifest.successorShipmentsSha256,
            'V202_R2_SUCCESSOR_HASH_MISMATCH');
        return 'SUCCESSOR_PASS';
    }
    assert.fail('V202_R2_UNKNOWN_OR_MISSING_CONTEXT');
};

export const assertReleaseFacts = (facts, manifest) => {
    assert.equal(facts.baseTree, manifest.baseTree, 'V202_R2_BASE_TREE_MISMATCH');
    assert.equal(facts.baseAncestor, true, 'V202_R2_UNKNOWN_RELEASE');
    if (facts.head === manifest.baseCommit) {
        assert.equal(facts.headTree, manifest.baseTree, 'V202_R2_HEAD_TREE_MISMATCH');
    } else {
        assert.ok(facts.changedFiles.length > 0, 'V202_R2_UNKNOWN_EMPTY_RELEASE');
    }
    assert.equal(facts.trackedDirty, false, 'V202_R2_TRACKED_DIRTY');
    assert.equal(facts.coreAutocrlf, 'false', 'V202_R2_AUTOCRLF_INVALID');
    assert.equal(facts.alternates, false, 'V202_R2_ALTERNATES_FORBIDDEN');
    assert.equal(facts.officialMarker, true, 'V202_R2_OFFICIAL_MARKER_MISSING');
    for (const relative of facts.changedFiles) {
        assert.ok(governancePaths.has(relative), `V202_R2_UNAUTHORIZED_RELEASE_CHANGE:${relative}`);
    }
    return true;
};

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const gitStatus = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }).status;
const manifest = assertR2ManifestBytes(read(MANIFEST));
assert.equal(sha256(read(manifest.parentManifest)), manifest.parentManifestSha256,
    'V202_R2_PARENT_MANIFEST_TAMPERED');
const v183 = JSON.parse(read('docs/freeze/ec-panel-only-agency-city-scope-v183-20260918.json'));
assert.equal(v183.protectedFiles['src/routes/shipments.js'], manifest.historicalShipmentsSha256,
    'V202_R2_HISTORICAL_SHIPMENTS_SEMANTICS_CHANGED');
for (const [relative, identity] of Object.entries(manifest.historicalEvidence)) {
    assertCanonicalEvidence(relative, read(relative), identity);
}
const shipments = read('src/routes/shipments.js');
assert.equal(sha256(shipments), manifest.successorShipmentsSha256,
    'V202_R2_SUCCESSOR_SHIPMENTS_INVALID');
assert.equal(blobOid(shipments), manifest.successorShipmentsBlobOid,
    'V202_R2_SUCCESSOR_SHIPMENTS_BLOB_INVALID');
const head = git('rev-parse', 'HEAD');
const baseAncestor = gitStatus('merge-base', '--is-ancestor', manifest.baseCommit, 'HEAD') === 0;
const changedFiles = git('diff', '--name-only', manifest.baseCommit, 'HEAD')
    .split(/\r?\n/).filter(Boolean).map(file => file.replace(/\\/g, '/'));
const alternatesPath = git('rev-parse', '--git-path', 'objects/info/alternates');
assertReleaseFacts({
    head,
    headTree: git('rev-parse', 'HEAD^{tree}'),
    baseTree: git('rev-parse', `${manifest.baseCommit}^{tree}`),
    baseAncestor,
    changedFiles,
    trackedDirty: gitStatus('diff', '--quiet') !== 0 || gitStatus('diff', '--cached', '--quiet') !== 0,
    coreAutocrlf: git('config', '--get', 'core.autocrlf'),
    alternates: fs.existsSync(path.resolve(ROOT, alternatesPath)),
    officialMarker: read('.vitalismen-official-root').toString('utf8')
        .includes('VITALISMEN_OFFICIAL_PROJECT=vit_power_ec')
}, manifest);
assert.equal(classifyShipmentsContext({
    context: manifest.freezeId,
    shipmentsSha256: sha256(shipments)
}, manifest), 'SUCCESSOR_PASS');

globalThis.__VITALISMEN_V202_R2_SUCCESSOR_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: EXPECTED_MANIFEST_SHA256,
    parentManifestSha256: manifest.parentManifestSha256,
    preload: PRELOAD,
    baseCommit: manifest.baseCommit,
    baseTree: manifest.baseTree,
    head,
    historicalShipmentsSha256: manifest.historicalShipmentsSha256,
    successorShipmentsSha256: manifest.successorShipmentsSha256,
    historicalEvidence: Object.freeze({ ...manifest.historicalEvidence }),
    policy: Object.freeze({ ...manifest.policy })
});
