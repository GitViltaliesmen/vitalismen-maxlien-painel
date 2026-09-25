import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
    assertR4StartupSuccessorIdentity, importTargetsSelf
} from '../scripts/lib/unified-successor-v202-r4-preload.mjs';
import {
    META_DATASET_ID, SHIPMENTS_SHA256, V168B_SHA256
} from '../scripts/lib/unified-successor-v202-r4-authority.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root,
    'docs/freeze/unified-successor-v47-v77h2-v202-r4-control-plane-20260925.json')));
const v168b = 'scripts/lib/ec-runtime-successor-v168b-bootstrap-context.mjs';
const shipments = 'src/routes/shipments.js';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const verified = () => ({
    checkpoint: {
        checkpointId: 'CHECKPOINT_R4_CONTROL_PLANE_SUCCESSOR_AUTHORITY',
        r4OperationalCommit: 'a'.repeat(40), r4OperationalTree: 'b'.repeat(40),
        v168bSha256: V168B_SHA256, shipmentsSha256: SHIPMENTS_SHA256,
        metaDatasetId: META_DATASET_ID
    },
    attestation: { commit: 'a'.repeat(40), tree: 'b'.repeat(40) },
    manifest
});
const v195 = () => ({
    freezeId: 'META_CANONICAL_CONSOLIDATION_V195_20260923',
    canonicalDataset: META_DATASET_ID,
    authorizedFiles: [v168b], protectedFiles: { [v168b]: V168B_SHA256 }
});
const v195Context = () => ({
    loaded: true,
    manifestSha256: 'ffe319bc3f0a336d9353cd4957b23478fe25c788f243cc1f9670d8024ac793a6',
    policy: { canonicalDataset: META_DATASET_ID }
});
const call = (release = root, identity = verified(), preload = v195(), context = v195Context()) =>
    assertR4StartupSuccessorIdentity(identity, release, preload, context);

test('Gate 8 corrigido: V168B é compartilhada; shipments distingue V201 da R4', () => {
    const v201 = '641759b160c2b91e95a3f1df371ad372a74d72e1';
    const v201Blob = relative => execFileSync('git', ['show', `${v201}:${relative}`],
        { cwd: root });
    const v201V168b = digest(v201Blob(v168b));
    const v201Shipments = digest(v201Blob(shipments));
    const v195 = JSON.parse(fs.readFileSync(path.join(root,
        'docs/freeze/meta-canonical-consolidation-v195-20260923.json')));
    assert.equal(v201V168b, V168B_SHA256);
    assert.equal(v195.protectedFiles[v168b], V168B_SHA256);
    assert.notEqual(v201V168b,
        'ddc96c6a4bd3d26d0fd5435645a2a139473cf5c6490f9a2f5bf64db7db87d3f4');
    assert.equal(v201Shipments,
        '1be80bc61829c56060fd67d1c7248068983a7ac7ddd1d61b2b9e371bdbe49af0');
    assert.equal(digest(fs.readFileSync(path.join(root, v168b))), v201V168b);
    assert.equal(digest(fs.readFileSync(path.join(root, shipments))), SHIPMENTS_SHA256);
    assert.notEqual(v201Shipments, SHIPMENTS_SHA256);
    assert.equal(manifest.allowlist.find(item => item.path === shipments).canonicalSha256,
        SHIPMENTS_SHA256);
});

test('R4 startup successor autoriza V168B, shipments e perfil Meta no mesmo contrato', () => {
    const successor = call();
    assert.equal(successor.protectedFiles[v168b], V168B_SHA256);
    assert.equal(successor.protectedFiles[shipments], SHIPMENTS_SHA256);
    assert.equal(successor.canonicalDataset, META_DATASET_ID);
    assert.deepEqual([...successor.authorizedFiles].sort(),
        Object.keys(successor.protectedFiles).sort());
    assert.ok(Object.isFrozen(successor));
});

test('identidade R4 e V195 ausente ou errada bloqueiam antes de src/index.js', () => {
    for (const change of [
        value => { value.checkpoint.checkpointId = 'CHECKPOINT_R4_V78_SUCCESSOR_READY_FOR_RESTAGE'; },
        value => { value.attestation.commit = '0'.repeat(40); },
        value => { value.attestation.tree = '0'.repeat(40); },
        value => { value.checkpoint.v168bSha256 = '0'.repeat(64); },
        value => { value.checkpoint.v168bSha256 =
            'ddc96c6a4bd3d26d0fd5435645a2a139473cf5c6490f9a2f5bf64db7db87d3f4'; },
        value => { value.checkpoint.shipmentsSha256 = '0'.repeat(64); },
        value => { value.checkpoint.shipmentsSha256 =
            '1be80bc61829c56060fd67d1c7248068983a7ac7ddd1d61b2b9e371bdbe49af0'; },
        value => { value.checkpoint.metaDatasetId = '1468946114265008'; },
        value => { value.manifest.allowlist.find(x => x.path === shipments).canonicalSha256 = '0'.repeat(64); }
    ]) {
        const value = structuredClone(verified());
        change(value);
        assert.throws(() => call(root, value));
    }
    assert.throws(() => call(root, verified(), undefined, { loaded: false }));
    const wrongContext = v195Context();
    wrongContext.policy.canonicalDataset = '1468946114265008';
    assert.throws(() => call(root, verified(), v195(), wrongContext));
    const wrongV195 = v195();
    wrongV195.protectedFiles[v168b] = '0'.repeat(64);
    assert.throws(() => call(root, verified(), wrongV195));
});

test('V168B ou shipments histórico, desconhecido e symlink adulterado bloqueiam', t => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-r4-startup-'));
    t.after(() => {
        assert.ok(path.basename(fixture).startsWith('vitalismen-r4-startup-'));
        fs.rmSync(fixture, { recursive: true, force: true });
    });
    for (const relative of [v168b, shipments]) {
        fs.mkdirSync(path.dirname(path.join(fixture, relative)), { recursive: true });
        fs.copyFileSync(path.join(root, relative), path.join(fixture, relative));
    }
    assert.equal(digest(fs.readFileSync(path.join(fixture, v168b))), V168B_SHA256);
    assert.equal(digest(fs.readFileSync(path.join(fixture, shipments))), SHIPMENTS_SHA256);
    call(fixture);
    for (const [relative, commit, historical] of [
        [v168b, '273ba40', 'ddc96c6a4bd3d26d0fd5435645a2a139473cf5c6490f9a2f5bf64db7db87d3f4'],
        [shipments, '641759b160c2b91e95a3f1df371ad372a74d72e1',
            '1be80bc61829c56060fd67d1c7248068983a7ac7ddd1d61b2b9e371bdbe49af0']
    ]) {
        const historicalBytes = execFileSync('git', ['show', `${commit}:${relative}`],
            { cwd: root });
        assert.equal(digest(historicalBytes), historical);
        fs.writeFileSync(path.join(fixture, relative), historicalBytes);
        assert.throws(() => call(fixture));
        fs.writeFileSync(path.join(fixture, relative), 'unknown');
        assert.throws(() => call(fixture));
        fs.copyFileSync(path.join(root, relative), path.join(fixture, relative));
    }
});

test('detector aceita caminho físico exato e rejeita alias e traversal', () => {
    const physical = pathToFileURL(path.join(root,
        'scripts/lib/unified-successor-v202-r4-preload.mjs')).href;
    assert.equal(importTargetsSelf(physical), true);
    assert.equal(importTargetsSelf(physical.replace('/scripts/lib/', '/scripts/../scripts/lib/')), false);
    assert.equal(importTargetsSelf('file:///tmp/arbitrary/unified-successor-v202-r4-preload.mjs'), false);
    assert.equal(importTargetsSelf('file:///opt/vitalismen-automacao/currently/scripts/lib/unified-successor-v202-r4-preload.mjs'), false);
});
