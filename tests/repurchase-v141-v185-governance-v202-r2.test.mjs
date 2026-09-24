import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    assertCanonicalEvidence,
    assertR2ManifestBytes,
    assertReleaseFacts,
    classifyShipmentsContext
} from '../scripts/lib/repurchase-v141-v185-governance-v202-r2-context.mjs';
import { assertCanonicalBuffer } from '../scripts/lib/repurchase-v141-v185-governance-v202-r1-context.mjs';
import { assertRepurchaseV202R2Successor } from '../scripts/guard-repurchase-v141-v185-governance-v202-r2.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifestPath = 'docs/freeze/repurchase-v141-v185-governance-successor-v202-r2-20260924.json';
const preloadPath = 'scripts/lib/repurchase-v141-v185-governance-v202-r2-context.mjs';
const manifest = assertR2ManifestBytes(read(manifestPath));
const context = globalThis.__VITALISMEN_V202_R2_SUCCESSOR_CONTEXT;

test('successor canonical suite accepts the exact V202-R2 context and actual shipments blob', () => {
    const result = assertRepurchaseV202R2Successor();
    assert.equal(result.historicalV183V186Preserved, true);
    assert.equal(result.successorShipmentsAccepted, true);
    assert.equal(sha256(read('src/routes/shipments.js')), manifest.successorShipmentsSha256);
});

test('V181 canonical blob and V183/V186 historical evidence remain unchanged', () => {
    for (const [relative, identity] of Object.entries(manifest.historicalEvidence)) {
        assertCanonicalEvidence(relative, read(relative), identity);
    }
    const v183 = JSON.parse(read('docs/freeze/ec-panel-only-agency-city-scope-v183-20260918.json'));
    assert.equal(v183.protectedFiles['src/routes/shipments.js'], manifest.historicalShipmentsSha256);
    const v186 = read('tests/v185-canonical-successor-v186.test.mjs').toString('utf8');
    assert.match(v186, /ec-runtime-successor-v97-context\.mjs/);
    assert.equal(manifest.policy.historicalV186RequiredOnSuccessor, false);
});

test('V185 EOL-only identity is accepted through canonical Git blobs', () => {
    for (const relative of [
        'docs/freeze/v185-metrics-radar-readonly-20260918.json',
        'docs/freeze/ec-v185-canonical-successor-v186-20260918.json',
        'public/funnel-metrics.html'
    ]) {
        assert.ok(assertCanonicalBuffer(relative, read(relative)).length > 0);
    }
});

test('historical hash and successor hash are accepted only with their matching contexts', () => {
    assert.equal(classifyShipmentsContext({
        context: 'HISTORICAL_V183_V186',
        shipmentsSha256: manifest.historicalShipmentsSha256
    }, manifest), 'HISTORICAL_PASS');
    assert.equal(classifyShipmentsContext({
        context: manifest.freezeId,
        shipmentsSha256: manifest.successorShipmentsSha256
    }, manifest), 'SUCCESSOR_PASS');
    for (const pair of [
        { context: 'HISTORICAL_V183_V186', shipmentsSha256: manifest.successorShipmentsSha256 },
        { context: manifest.freezeId, shipmentsSha256: manifest.historicalShipmentsSha256 },
        { context: manifest.freezeId, shipmentsSha256: '0'.repeat(64) },
        { context: undefined, shipmentsSha256: manifest.successorShipmentsSha256 },
        { context: 'UNKNOWN', shipmentsSha256: manifest.successorShipmentsSha256 }
    ]) {
        assert.throws(() => classifyShipmentsContext(pair, manifest), /V202_R2_/);
    }
});

test('tampered successor manifest and wrong parent manifest are blocked', () => {
    const changed = Buffer.from(read(manifestPath).toString('utf8').replace('V202-R2', 'V202-XX'));
    assert.throws(() => assertR2ManifestBytes(changed), /V202_R2_MANIFEST_TAMPERED/);
    assert.equal(sha256(read(manifest.parentManifest)), manifest.parentManifestSha256);
});

test('wrong base tree, unknown release, and functional release change are blocked', () => {
    const valid = {
        head: manifest.baseCommit,
        headTree: manifest.baseTree,
        baseTree: manifest.baseTree,
        baseAncestor: true,
        changedFiles: [],
        trackedDirty: false,
        coreAutocrlf: 'false',
        alternates: false,
        officialMarker: true
    };
    assert.equal(assertReleaseFacts(valid, manifest), true);
    assert.throws(() => assertReleaseFacts({ ...valid, baseTree: '0'.repeat(40) }, manifest),
        /V202_R2_BASE_TREE_MISMATCH/);
    assert.throws(() => assertReleaseFacts({ ...valid, headTree: '0'.repeat(40) }, manifest),
        /V202_R2_HEAD_TREE_MISMATCH/);
    assert.throws(() => assertReleaseFacts({ ...valid, baseAncestor: false }, manifest),
        /V202_R2_UNKNOWN_RELEASE/);
    assert.throws(() => assertReleaseFacts({ ...valid, changedFiles: ['src/routes/shipments.js'] }, manifest),
        /V202_R2_UNAUTHORIZED_RELEASE_CHANGE/);
});

test('missing or wrong preload context is blocked', () => {
    assert.throws(() => assertRepurchaseV202R2Successor({ context: null }),
        /V202_R2_SUCCESSOR_CONTEXT_REQUIRED/);
    assert.throws(() => assertRepurchaseV202R2Successor({
        context: { ...context, preload: 'scripts/lib/ec-runtime-successor-v97-context.mjs' }
    }), /V202_R2_WRONG_PRELOAD/);
    const run = spawnSync(process.execPath, ['scripts/guard-repurchase-v141-v185-governance-v202-r2.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '' }
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /V202_R2_SUCCESSOR_CONTEXT_REQUIRED/);
});

test('tampered preload, shipments, and V183 semantics are blocked', () => {
    const readChanged = (target, replacement) => relative => relative === target ? replacement : read(relative);
    const preload = Buffer.from(read(preloadPath));
    preload[0] ^= 1;
    assert.throws(() => assertRepurchaseV202R2Successor({
        read: readChanged(preloadPath, preload)
    }), /V202_R2_PRELOAD_TAMPERED/);
    assert.throws(() => assertRepurchaseV202R2Successor({
        read: readChanged('src/routes/shipments.js', Buffer.from('wrong shipments'))
    }), /V202_R2_SUCCESSOR_SHIPMENTS_INVALID/);
    const v183 = JSON.parse(read('docs/freeze/ec-panel-only-agency-city-scope-v183-20260918.json'));
    v183.protectedFiles['src/routes/shipments.js'] = manifest.successorShipmentsSha256;
    assert.throws(() => assertRepurchaseV202R2Successor({
        read: readChanged('docs/freeze/ec-panel-only-agency-city-scope-v183-20260918.json',
            Buffer.from(JSON.stringify(v183)))
    }), /V202_R2_HISTORICAL_SEMANTICS_CHANGED/);
});

test('tampered historical file and mixed EOL are blocked', () => {
    const relative = 'scripts/lib/ec-runtime-successor-v183-context.mjs';
    const identity = manifest.historicalEvidence[relative];
    const original = read(relative);
    const changed = Buffer.from(original);
    changed[0] ^= 1;
    assert.throws(() => assertCanonicalEvidence(relative, changed, identity),
        /V202_R2_HISTORICAL_SHA_INVALID/);
    const canonical = assertCanonicalEvidence(relative, original, identity).toString('utf8');
    assert.throws(() => assertCanonicalEvidence(relative,
        Buffer.from(canonical.replace('\n', '\r\n')), identity),
        /V202_R2_MIXED_EOL_FORBIDDEN/);
});
